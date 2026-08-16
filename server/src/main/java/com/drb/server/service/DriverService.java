package com.drb.server.service;

import com.drb.server.domain.Driver;
import com.drb.server.repository.DriverRepository;
import com.drb.server.service.exception.NotFoundException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class DriverService {

    @Inject
    private DriverRepository driverRepo;

    public List<Driver> findAll() {
        return driverRepo.findAllWithUser();
    }

    public List<Driver> findActive() {
        return driverRepo.findAllWithUser().stream()
            .filter(Driver::isActive)
            .collect(Collectors.toList());
    }

    public Driver findById(Long id) {
        return driverRepo.findById(id)
            .orElseThrow(() -> new NotFoundException("Driver", id));
    }

    @Transactional
    public Driver save(Driver driver) {
        return driverRepo.save(driver);
    }

    @Transactional
    /**
     * Hard delete. Deactivating a driver is a separate operation — the Active
     * checkbox on the admin row editor.
     */
    public void delete(Long id) {
        findById(id);
        driverRepo.delete(id);
    }
}
