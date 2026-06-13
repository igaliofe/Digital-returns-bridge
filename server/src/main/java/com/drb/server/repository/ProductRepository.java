package com.drb.server.repository;

import com.drb.server.domain.Product;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.util.List;

@ApplicationScoped
public class ProductRepository {

    @PersistenceContext
    private EntityManager em;

    public Product save(Product product) {
        if (product.getId() == null) {
            em.persist(product);
            return product;
        }
        return em.merge(product);
    }

    public Product findById(Long id) {
        return em.find(Product.class, id);
    }

    public List<Product> findAll() {
        return em.createQuery("SELECT p FROM Product p", Product.class).getResultList();
    }

    public List<Product> search(String text) {
        String pattern = "%" + text + "%";
        return em.createQuery(
                "SELECT p FROM Product p WHERE p.name LIKE :pattern OR p.sku LIKE :pattern",
                Product.class)
                .setParameter("pattern", pattern)
                .getResultList();
    }
}
