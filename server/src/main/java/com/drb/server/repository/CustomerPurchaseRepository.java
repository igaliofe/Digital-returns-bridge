package com.drb.server.repository;

import com.drb.server.domain.CustomerPurchase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class CustomerPurchaseRepository {

    @PersistenceContext
    private EntityManager em;

    public CustomerPurchase save(CustomerPurchase purchase) {
        if (purchase.getId() == null) {
            em.persist(purchase);
            return purchase;
        }
        return em.merge(purchase);
    }

    public Optional<CustomerPurchase> findByIdWithRefs(Long id) {
        List<CustomerPurchase> results = em.createQuery(
                "SELECT cp FROM CustomerPurchase cp " +
                "JOIN FETCH cp.customer JOIN FETCH cp.product WHERE cp.id = :id",
                CustomerPurchase.class)
            .setParameter("id", id)
            .getResultList();
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public List<CustomerPurchase> findAll() {
        return em.createQuery(
                "SELECT cp FROM CustomerPurchase cp " +
                "JOIN FETCH cp.customer JOIN FETCH cp.product " +
                "ORDER BY cp.originalDeliveryDate DESC, cp.id DESC",
                CustomerPurchase.class)
            .getResultList();
    }

    public List<CustomerPurchase> findByCustomerId(Long customerId) {
        return em.createQuery(
                "SELECT cp FROM CustomerPurchase cp " +
                "JOIN FETCH cp.product WHERE cp.customer.id = :customerId " +
                "ORDER BY cp.originalDeliveryDate DESC, cp.id DESC",
                CustomerPurchase.class)
            .setParameter("customerId", customerId)
            .getResultList();
    }
}
