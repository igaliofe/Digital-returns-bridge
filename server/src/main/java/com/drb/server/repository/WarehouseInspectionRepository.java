package com.drb.server.repository;

import com.drb.server.domain.WarehouseInspection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.util.List;

@ApplicationScoped
public class WarehouseInspectionRepository {

    @PersistenceContext
    private EntityManager em;

    public WarehouseInspection save(WarehouseInspection inspection) {
        if (inspection.getId() == null) {
            em.persist(inspection);
            return inspection;
        }
        return em.merge(inspection);
    }

    public WarehouseInspection findById(Long id) {
        return em.find(WarehouseInspection.class, id);
    }

    public List<WarehouseInspection> findAll() {
        return em.createQuery("SELECT w FROM WarehouseInspection w", WarehouseInspection.class)
                .getResultList();
    }

    public List<WarehouseInspection> findByReturnRequestId(Long returnRequestId) {
        return em.createQuery(
                "SELECT w FROM WarehouseInspection w WHERE w.returnRequest.id = :returnRequestId",
                WarehouseInspection.class)
                .setParameter("returnRequestId", returnRequestId)
                .getResultList();
    }

    public WarehouseInspection update(WarehouseInspection inspection) {
        return em.merge(inspection);
    }
}
