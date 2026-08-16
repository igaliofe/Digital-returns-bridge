package com.drb.server.service;

import com.drb.server.domain.Product;
import com.drb.server.repository.ProductRepository;
import com.drb.server.service.exception.NotFoundException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.List;

@ApplicationScoped
public class ProductService {

    @Inject
    private ProductRepository productRepo;

    public List<Product> findAll() {
        return productRepo.findAll();
    }

    public List<Product> search(String query) {
        if (query == null || query.isBlank()) return productRepo.findAll();
        return productRepo.search(query);
    }

    public Product findById(Long id) {
        Product p = productRepo.findById(id);
        if (p == null) throw new NotFoundException("Product", id);
        return p;
    }

    @Transactional
    public Product create(Product product) {
        return productRepo.save(product);
    }

    @Transactional
    public Product save(Product product) {
        return productRepo.save(product);
    }

    @Transactional
    public Product update(Long id, Product updates) {
        Product existing = findById(id);
        existing.setName(updates.getName());
        existing.setSku(updates.getSku());
        existing.setCategory(updates.getCategory());
        existing.setDescription(updates.getDescription());
        existing.setPrice(updates.getPrice());
        existing.setImageUrl(updates.getImageUrl());
        return productRepo.save(existing);
    }

    @Transactional
    public void delete(Long id) {
        findById(id);
        productRepo.delete(id);
    }
}
