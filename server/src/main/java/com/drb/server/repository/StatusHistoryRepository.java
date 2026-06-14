package com.drb.server.repository;

import com.drb.server.domain.StatusHistory;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.util.List;

@ApplicationScoped
public class StatusHistoryRepository {

    @PersistenceContext
    private EntityManager em;

    public StatusHistory save(StatusHistory statusHistory) {
        if (statusHistory.getId() == null) {
            em.persist(statusHistory);
            return statusHistory;
        }
        return em.merge(statusHistory);
    }

    public List<StatusHistory> findByReturnRequestId(Long returnRequestId) {
        return em.createQuery(
                "SELECT s FROM StatusHistory s WHERE s.returnRequest.id = :returnRequestId ORDER BY s.createdAt ASC",
                StatusHistory.class)
                .setParameter("returnRequestId", returnRequestId)
                .getResultList();
    }

    public List<StatusHistory> findByReturnRequestIdWithUser(Long returnRequestId) {
        return em.createQuery(
                "SELECT s FROM StatusHistory s " +
                "LEFT JOIN FETCH s.changedByUser " +
                "WHERE s.returnRequest.id = :returnRequestId ORDER BY s.createdAt ASC",
                StatusHistory.class)
                .setParameter("returnRequestId", returnRequestId)
                .getResultList();
    }
}
