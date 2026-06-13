package com.drb.server.repository;

import com.drb.server.domain.ReturnImage;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class ReturnImageRepository {

    @PersistenceContext
    private EntityManager em;

    public ReturnImage save(ReturnImage returnImage) {
        if (returnImage.getId() == null) {
            em.persist(returnImage);
            return returnImage;
        }
        return em.merge(returnImage);
    }

    public Optional<ReturnImage> findById(Long id) {
        return Optional.ofNullable(em.find(ReturnImage.class, id));
    }

    public List<ReturnImage> findByReturnRequestId(Long returnRequestId) {
        return em.createQuery(
                "SELECT i FROM ReturnImage i WHERE i.returnRequest.id = :returnRequestId", ReturnImage.class)
                .setParameter("returnRequestId", returnRequestId)
                .getResultList();
    }

    public void delete(ReturnImage returnImage) {
        em.remove(em.contains(returnImage) ? returnImage : em.merge(returnImage));
    }

    public void delete(Long id) {
        ReturnImage image = em.find(ReturnImage.class, id);
        if (image != null) {
            em.remove(image);
        }
    }
}
