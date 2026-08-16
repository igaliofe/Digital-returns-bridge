package com.drb.server.service;

import com.drb.server.domain.Customer;
import com.drb.server.domain.Product;
import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.enums.ReturnStatus;
import com.drb.server.repository.ReturnRequestRepository;
import com.drb.server.repository.StatusHistoryRepository;
import com.drb.server.service.exception.ConcurrentModificationConflictException;
import com.drb.server.service.exception.IllegalStatusTransitionException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.EntityTransaction;
import jakarta.persistence.OptimisticLockException;
import jakarta.persistence.Persistence;
import jakarta.persistence.PessimisticLockException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The concurrency proof: two real threads, two real transactions, one real database row.
 *
 * <p>Scenario: two warehouse operators open the same OPEN return request and both press
 * "send to pickup" at the same instant. Exactly one transition may take effect.
 *
 * <p><b>What this test covers.</b> The production {@link ReturnRequestService} is the object
 * under test — its real transition guard, its real {@code findByIdForUpdate} pessimistic read,
 * its real {@code withConflictDetection} wrapper and the real {@code @Version} column on
 * {@link ReturnRequest}. Both threads run against H2 in PostgreSQL compatibility mode over
 * separate {@link EntityManager}s and separate physical connections, released together by a
 * {@link CyclicBarrier}. The race is genuine: nothing here is stubbed, sequenced or mocked.
 *
 * <p><b>Why it is not a tautology.</b> Verified by mutation: strip the {@code @Version} column
 * <em>and</em> downgrade {@code findByIdForUpdate} back to {@code findById}, and this test fails
 * with "Expected size: 1 but was: 2" — both threads commit the transition and the audit trail
 * gets two rows. Restore either defence on its own and it passes again, each through a different
 * exception, which is why the rejection assertion below accepts either one.
 *
 * <p><b>What this test does not cover.</b> {@code ReturnRequestService} uses {@code @Inject}
 * field injection and container-managed {@code @Transactional}, neither of which exists in a
 * plain JUnit JVM. The repositories and their {@code EntityManager} are therefore injected
 * reflectively, and each transaction is demarcated by hand with
 * {@link EntityTransaction#begin()}/{@code commit()} in place of the CDI interceptor. So this
 * asserts the locking and the guard, not WildFly's transaction demarcation, and not the
 * REST/JSF mapping of the conflict to HTTP 409 (covered by the unit tests).
 */
class ReturnRequestServiceConcurrencyTest {

    private static EntityManagerFactory emf;

    private Long returnId;

    @BeforeAll
    static void startDatabase() {
        emf = Persistence.createEntityManagerFactory("drbTestPU");
    }

    @AfterAll
    static void stopDatabase() {
        if (emf != null) {
            emf.close();
        }
    }

    @BeforeEach
    void seedOpenReturnRequest() {
        EntityManager em = emf.createEntityManager();
        try {
            em.getTransaction().begin();

            Customer customer = new Customer();
            customer.setFullName("Rina Levi");
            customer.setPhone("0501234567");
            em.persist(customer);

            Product product = new Product();
            product.setSku("SKU-CONCURRENCY-1");
            product.setName("Espresso machine");
            product.setPrice(new BigDecimal("1299.00"));
            em.persist(product);

            ReturnRequest rr = new ReturnRequest();
            rr.setCustomer(customer);
            rr.setProduct(product);
            rr.setStatus(ReturnStatus.OPEN);
            rr.setQuantity(1);
            em.persist(rr);

            em.getTransaction().commit();
            returnId = rr.getId();
        } finally {
            em.close();
        }
    }

    @Test
    void twoThreadsTransitioningTheSameReturnRequest_onlyOneWins() throws Exception {
        CyclicBarrier startLine = new CyclicBarrier(2);
        ExecutorService threads = Executors.newFixedThreadPool(2);

        List<Future<Outcome>> futures = new ArrayList<>();
        try {
            futures.add(threads.submit(transitionToWaitingForPickup(startLine, "operator-A")));
            futures.add(threads.submit(transitionToWaitingForPickup(startLine, "operator-B")));

            threads.shutdown();
            assertThat(threads.awaitTermination(30, TimeUnit.SECONDS))
                .as("both racing threads must finish; a hang means the row lock was never released")
                .isTrue();
        } finally {
            threads.shutdownNow();
        }

        List<Outcome> outcomes = new ArrayList<>();
        for (Future<Outcome> future : futures) {
            outcomes.add(future.get());
        }

        List<Outcome> winners = outcomes.stream().filter(Outcome::succeeded).toList();
        List<Outcome> losers = outcomes.stream().filter(o -> !o.succeeded()).toList();

        assertThat(winners)
            .as("exactly one thread may commit the OPEN -> WAITING_FOR_PICKUP transition")
            .hasSize(1);

        assertThat(losers)
            .as("the other thread must be rejected, not silently apply the same transition twice")
            .hasSize(1);

        Throwable loss = losers.get(0).failure;
        assertThat(loss)
            .as("the losing thread must be rejected by one of the two concurrency defences, "
                + "not by a NullPointerException or a raw SQL error")
            .isInstanceOfAny(
                // it queued on the PESSIMISTIC_WRITE row lock, then re-read the winner's
                // committed state and the transition guard refused it (what happens on H2)
                IllegalStatusTransitionException.class,
                // it read before the winner committed, and the @Version check caught the
                // stale write, which withConflictDetection translates for the 409 boundary
                ConcurrentModificationConflictException.class,
                OptimisticLockException.class,
                PessimisticLockException.class);

        assertThat(finalStatus())
            .as("the row ends in the single transitioned state")
            .isEqualTo(ReturnStatus.WAITING_FOR_PICKUP);

        assertThat(versionAfterRace())
            .as("@Version proves the row was updated exactly once")
            .isEqualTo(1L);

        assertThat(statusHistoryRowCount())
            .as("the audit trail must contain exactly ONE new row for this race")
            .isEqualTo(1L);

        assertThat(recordedTransitions())
            .as("and that row records the OPEN -> WAITING_FOR_PICKUP hop")
            .containsExactly(new Object[] { ReturnStatus.OPEN, ReturnStatus.WAITING_FOR_PICKUP });
    }

    /**
     * One racing participant: its own EntityManager, its own transaction, its own wired-up
     * copy of the production service. Both participants block on the barrier until released.
     */
    private Callable<Outcome> transitionToWaitingForPickup(CyclicBarrier startLine, String name) {
        return () -> {
            Thread.currentThread().setName(name);
            EntityManager em = emf.createEntityManager();
            EntityTransaction tx = em.getTransaction();
            try {
                ReturnRequestService service = serviceBackedBy(em);
                startLine.await(20, TimeUnit.SECONDS);

                tx.begin();
                service.transitionStatus(returnId, ReturnStatus.WAITING_FOR_PICKUP, null, "race " + name);
                tx.commit();
                return Outcome.success();
            } catch (RuntimeException e) {
                if (tx.isActive()) {
                    tx.rollback();
                }
                return Outcome.failure(e);
            } finally {
                em.close();
            }
        };
    }

    /**
     * Stands in for CDI: builds the real service over real repositories bound to {@code em}.
     * Only the collaborators this transition touches are wired; the rest stay null, as they
     * would be unused anyway.
     */
    private static ReturnRequestService serviceBackedBy(EntityManager em) {
        ReturnRequestRepository returnRepo = new ReturnRequestRepository();
        setField(returnRepo, "em", em);

        StatusHistoryRepository statusHistoryRepo = new StatusHistoryRepository();
        setField(statusHistoryRepo, "em", em);

        ReturnRequestService service = new ReturnRequestService();
        setField(service, "returnRepo", returnRepo);
        setField(service, "statusHistoryRepo", statusHistoryRepo);
        return service;
    }

    private static void setField(Object target, String name, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(name);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(
                "Cannot wire '" + name + "' on " + target.getClass().getSimpleName(), e);
        }
    }

    private ReturnStatus finalStatus() {
        return inFreshEntityManager(em -> em.find(ReturnRequest.class, returnId).getStatus());
    }

    private Long versionAfterRace() {
        return inFreshEntityManager(em -> em.find(ReturnRequest.class, returnId).getVersion());
    }

    private Long statusHistoryRowCount() {
        return inFreshEntityManager(em -> em.createQuery(
                "SELECT COUNT(s) FROM StatusHistory s WHERE s.returnRequest.id = :id", Long.class)
            .setParameter("id", returnId)
            .getSingleResult());
    }

    private List<Object[]> recordedTransitions() {
        return inFreshEntityManager(em -> em.createQuery(
                "SELECT s.oldStatus, s.newStatus FROM StatusHistory s "
                    + "WHERE s.returnRequest.id = :id ORDER BY s.id", Object[].class)
            .setParameter("id", returnId)
            .getResultList());
    }

    private <T> T inFreshEntityManager(java.util.function.Function<EntityManager, T> read) {
        EntityManager em = emf.createEntityManager();
        try {
            return read.apply(em);
        } finally {
            em.close();
        }
    }

    private record Outcome(boolean succeeded, Throwable failure) {
        static Outcome success() {
            return new Outcome(true, null);
        }

        static Outcome failure(Throwable failure) {
            return new Outcome(false, failure);
        }
    }
}
