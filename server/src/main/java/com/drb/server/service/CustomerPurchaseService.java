package com.drb.server.service;

import com.drb.server.domain.CustomerPurchase;
import com.drb.server.repository.CustomerPurchaseRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;

@ApplicationScoped
public class CustomerPurchaseService {

    @Inject
    private CustomerPurchaseRepository purchaseRepo;

    public List<CustomerPurchase> findByCustomerId(Long customerId) {
        return purchaseRepo.findByCustomerId(customerId);
    }
}
