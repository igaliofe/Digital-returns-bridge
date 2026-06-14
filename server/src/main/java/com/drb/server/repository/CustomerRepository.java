package com.drb.server.repository;

import com.drb.server.domain.Customer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class CustomerRepository {

    @PersistenceContext
    private EntityManager em;

    public Customer save(Customer customer) {
        if (customer.getId() == null) {
            em.persist(customer);
            return customer;
        }
        return em.merge(customer);
    }

    public Customer findById(Long id) {
        return em.find(Customer.class, id);
    }

    public List<Customer> findAll() {
        return em.createQuery("SELECT c FROM Customer c", Customer.class).getResultList();
    }

    public List<Customer> search(String text) {
        String pattern = "%" + text + "%";
        return em.createQuery(
                "SELECT c FROM Customer c WHERE c.fullName LIKE :pattern OR c.phone LIKE :pattern",
                Customer.class)
                .setParameter("pattern", pattern)
                .getResultList();
    }

    public Optional<Customer> findByPhone(String phone) {
        List<Customer> results = em.createQuery(
                "SELECT c FROM Customer c WHERE c.phone = :phone",
                Customer.class)
            .setParameter("phone", phone)
            .getResultList();
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }
}
