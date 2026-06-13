package com.drb.server.service;

import com.drb.server.domain.Customer;
import com.drb.server.repository.CustomerRepository;
import com.drb.server.service.exception.NotFoundException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.List;

@ApplicationScoped
public class CustomerService {

    @Inject
    private CustomerRepository customerRepo;

    public List<Customer> findAll() {
        return customerRepo.findAll();
    }

    public List<Customer> search(String query) {
        if (query == null || query.isBlank()) return customerRepo.findAll();
        return customerRepo.search(query);
    }

    public Customer findById(Long id) {
        Customer c = customerRepo.findById(id);
        if (c == null) throw new NotFoundException("Customer", id);
        return c;
    }

    @Transactional
    public Customer create(Customer customer) {
        return customerRepo.save(customer);
    }

    @Transactional
    public Customer save(Customer customer) {
        return customerRepo.save(customer);
    }

    @Transactional
    public Customer update(Long id, Customer updates) {
        Customer existing = findById(id);
        existing.setFullName(updates.getFullName());
        existing.setPhone(updates.getPhone());
        existing.setEmail(updates.getEmail());
        existing.setAddress(updates.getAddress());
        return customerRepo.save(existing);
    }

    @Transactional
    public void delete(Long id) {
        Customer customer = findById(id);
        customerRepo.save(customer);
    }
}
