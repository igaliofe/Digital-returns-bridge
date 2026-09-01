package com.drb.server.service;

import com.drb.server.domain.Customer;
import com.drb.server.domain.CustomerPurchase;
import com.drb.server.domain.Product;
import com.drb.server.repository.CustomerPurchaseRepository;
import com.drb.server.repository.CustomerRepository;
import com.drb.server.repository.ProductRepository;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.LocalDate;
import java.util.List;

@ApplicationScoped
public class CustomerPurchaseService {

    @Inject
    private CustomerPurchaseRepository purchaseRepo;

    @Inject
    private CustomerRepository customerRepo;

    @Inject
    private ProductRepository productRepo;

    public List<CustomerPurchase> findAll() {
        return purchaseRepo.findAll();
    }

    public List<CustomerPurchase> findByCustomerId(Long customerId) {
        return purchaseRepo.findByCustomerId(customerId);
    }

    /**
     * Record that a customer bought a product — the link the return wizard's step 2 reads.
     *
     * Until this existed, rows in customer_purchases could only arrive through seed.sql or
     * direct SQL, so a customer created in the admin screen could never have a return opened
     * for them: the wizard lists this customer's purchases and refuses to advance without one.
     */
    @Transactional
    public CustomerPurchase create(Long customerId, Long productId, CustomerPurchase details) {
        if (customerId == null) {
            throw new ValidationException("CUSTOMER_REQUIRED", "Customer is required");
        }
        if (productId == null) {
            throw new ValidationException("PRODUCT_REQUIRED", "Product is required");
        }

        Customer customer = customerRepo.findById(customerId);
        if (customer == null) {
            throw new NotFoundException("Customer", customerId);
        }
        Product product = productRepo.findById(productId);
        if (product == null) {
            throw new NotFoundException("Product", productId);
        }

        Integer quantity = details.getQuantity();
        if (quantity != null && quantity < 1) {
            throw new ValidationException("QUANTITY_INVALID", "Quantity must be greater than 0");
        }
        LocalDate deliveredOn = details.getOriginalDeliveryDate();
        if (deliveredOn != null && deliveredOn.isAfter(LocalDate.now())) {
            throw new ValidationException("DELIVERY_DATE_FUTURE",
                "Original delivery date cannot be in the future");
        }

        CustomerPurchase purchase = new CustomerPurchase();
        purchase.setCustomer(customer);
        purchase.setProduct(product);
        purchase.setOrderNumber(trimToNull(details.getOrderNumber()));
        purchase.setQuantity(quantity != null ? quantity : 1);
        purchase.setOriginalDeliveryDate(deliveredOn);
        purchase.setUnderWarranty(details.getUnderWarranty() != null
            ? details.getUnderWarranty() : Boolean.FALSE);
        // Always available to return on creation. ReturnRequestService flips `handled` once a
        // return is opened against it, which is what greys the row out in the wizard.
        purchase.setHandled(false);

        return purchaseRepo.save(purchase);
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
