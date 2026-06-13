package com.drb.server.repository;

import com.drb.server.domain.PickupUpdate;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class PickupUpdateRepository {

    @PersistenceContext
    private EntityManager em;

    public PickupUpdate save(PickupUpdate pickupUpdate) {
        if (pickupUpdate.getId() == null) {
            em.persist(pickupUpdate);
            return pickupUpdate;
        }
        return em.merge(pickupUpdate);
    }

    public Optional<PickupUpdate> findById(Long id) {
        return Optional.ofNullable(em.find(PickupUpdate.class, id));
    }

    public List<PickupUpdate> findByReturnRequestId(Long returnRequestId) {
        return em.createQuery(
                "SELECT p FROM PickupUpdate p WHERE p.returnRequest.id = :returnRequestId", PickupUpdate.class)
                .setParameter("returnRequestId", returnRequestId)
                .getResultList();
    }

    public PickupUpdate update(PickupUpdate pickupUpdate) {
        return em.merge(pickupUpdate);
    }
}
