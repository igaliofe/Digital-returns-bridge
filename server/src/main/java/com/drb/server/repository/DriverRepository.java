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

    public List<Driver> findAll() {
        return em.createQuery("SELECT d FROM Driver d", Driver.class).getResultList();
    }

    public List<Driver> findAllWithUser() {
        return em.createQuery(
                "SELECT DISTINCT d FROM Driver d LEFT JOIN FETCH d.user",
                Driver.class).getResultList();
    }

    public List<Driver> findByUserId(Long userId) {
        return em.createQuery("SELECT d FROM Driver d WHERE d.user.id = :userId", Driver.class)
                .setParameter("userId", userId)
                .getResultList();
    }
}
