package com.drb.server.repository;

import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.enums.ReturnStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class ReturnRequestRepository {

    @PersistenceContext
    private EntityManager em;

    public ReturnRequest save(ReturnRequest returnRequest) {
        if (returnRequest.getId() == null) {
            em.persist(returnRequest);
            return returnRequest;
        }
        return em.merge(returnRequest);
    }

    public Optional<ReturnRequest> findById(Long id) {
        return Optional.ofNullable(em.find(ReturnRequest.class, id));
    }

    public List<ReturnRequest> findAll() {
        return em.createQuery("SELECT r FROM ReturnRequest r", ReturnRequest.class).getResultList();
    }

    public List<ReturnRequest> findAllWithRefs() {
        return em.createQuery(
                "SELECT DISTINCT r FROM ReturnRequest r " +
                "LEFT JOIN FETCH r.customer " +
                "LEFT JOIN FETCH r.product " +
                "LEFT JOIN FETCH r.driver d " +
                "LEFT JOIN FETCH d.user " +
                "LEFT JOIN FETCH r.openedByUser " +
                "LEFT JOIN FETCH r.barcodeAssignedByDriver bd " +
                "LEFT JOIN FETCH bd.user",
                ReturnRequest.class).getResultList();
    }

    public List<ReturnRequest> findByStatus(ReturnStatus status) {
        return em.createQuery("SELECT r FROM ReturnRequest r WHERE r.status = :status", ReturnRequest.class)
                .setParameter("status", status)
                .getResultList();
    }

    public List<ReturnRequest> findByStatusWithRefs(ReturnStatus status) {
        return em.createQuery(
                "SELECT DISTINCT r FROM ReturnRequest r " +
                "LEFT JOIN FETCH r.customer " +
                "LEFT JOIN FETCH r.product " +
                "LEFT JOIN FETCH r.driver d " +
                "LEFT JOIN FETCH d.user " +
                "LEFT JOIN FETCH r.openedByUser " +
                "LEFT JOIN FETCH r.barcodeAssignedByDriver bd " +
                "LEFT JOIN FETCH bd.user " +
                "WHERE r.status = :status",
                ReturnRequest.class)
                .setParameter("status", status)
                .getResultList();
    }

    public Optional<ReturnRequest> findByIdWithRefs(Long id) {
        try {
            ReturnRequest rr = em.createQuery(
                    "SELECT r FROM ReturnRequest r " +
                    "LEFT JOIN FETCH r.customer " +
                    "LEFT JOIN FETCH r.product " +
                    "LEFT JOIN FETCH r.driver d " +
                    "LEFT JOIN FETCH d.user " +
                    "LEFT JOIN FETCH r.openedByUser " +
                    "LEFT JOIN FETCH r.barcodeAssignedByDriver bd " +
                    "LEFT JOIN FETCH bd.user " +
                    "WHERE r.id = :id",
                    ReturnRequest.class)
                    .setParameter("id", id)
                    .getSingleResult();
            return Optional.of(rr);
        } catch (NoResultException e) {
            return Optional.empty();
        }
    }

    public List<ReturnRequest> findByDriverId(Long driverId) {
        return em.createQuery("SELECT r FROM ReturnRequest r WHERE r.driver.id = :driverId", ReturnRequest.class)
                .setParameter("driverId", driverId)
                .getResultList();
    }

    public List<ReturnRequest> findByCustomerId(Long customerId) {
        return em.createQuery("SELECT r FROM ReturnRequest r WHERE r.customer.id = :customerId", ReturnRequest.class)
                .setParameter("customerId", customerId)
                .getResultList();
    }

    public Optional<ReturnRequest> findByBarcode(String barcode) {
        try {
            ReturnRequest rr = em.createQuery(
                    "SELECT r FROM ReturnRequest r WHERE r.barcode = :barcode", ReturnRequest.class)
                    .setParameter("barcode", barcode)
                    .getSingleResult();
            return Optional.of(rr);
        } catch (NoResultException e) {
            return Optional.empty();
        }
    }

    public Optional<ReturnRequest> findByBarcodeWithRefs(String barcode) {
        try {
            ReturnRequest rr = em.createQuery(
                    "SELECT r FROM ReturnRequest r " +
                    "LEFT JOIN FETCH r.customer " +
                    "LEFT JOIN FETCH r.product " +
                    "LEFT JOIN FETCH r.driver d " +
                    "LEFT JOIN FETCH d.user " +
                    "LEFT JOIN FETCH r.openedByUser " +
                    "LEFT JOIN FETCH r.barcodeAssignedByDriver bd " +
                    "LEFT JOIN FETCH bd.user " +
                    "WHERE r.barcode = :barcode",
                    ReturnRequest.class)
                    .setParameter("barcode", barcode)
                    .getSingleResult();
            return Optional.of(rr);
        } catch (NoResultException e) {
            return Optional.empty();
        }
    }

    public long countByBarcodeIsNull() {
        return em.createQuery("SELECT COUNT(r) FROM ReturnRequest r WHERE r.barcode IS NULL", Long.class)
                .getSingleResult();
    }
}
