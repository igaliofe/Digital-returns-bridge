package com.drb.server.repository;

import com.drb.server.domain.Driver;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class DriverRepository {

    @PersistenceContext
    private EntityManager em;

    public Driver save(Driver driver) {
        if (driver.getId() == null) {
            em.persist(driver);
            return driver;
        }
        return em.merge(driver);
    }

    public Optional<Driver> findById(Long id) {
        return Optional.ofNullable(em.find(Driver.class, id));
    }

    public List<Driver> findAllWithUser() {
        return em.createQuery(
                "SELECT DISTINCT d FROM Driver d LEFT JOIN FETCH d.user",
                Driver.class).getResultList();
    }

    /** Hard delete. No-op when the row is already gone. */
    public void delete(Long id) {
        Driver driver = em.find(Driver.class, id);
        if (driver != null) {
            em.remove(driver);
        }
    }
}
