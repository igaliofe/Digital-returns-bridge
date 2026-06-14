package com.drb.server.rest.dto;

import com.drb.server.domain.CustomerPurchase;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class CustomerPurchaseDto {
    public Long id;
    public Long customerId;
    public Long productId;
    public String productName;
    public String productSku;
    public BigDecimal productPrice;
    public String productImageUrl;
    public String orderNumber;
    public Integer quantity;
    public LocalDate originalDeliveryDate;
    public Boolean underWarranty;
    public boolean handled;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;

    public static CustomerPurchaseDto from(CustomerPurchase cp) {
        CustomerPurchaseDto d = new CustomerPurchaseDto();
        d.id = cp.getId();
        if (cp.getCustomer() != null) {
            d.customerId = cp.getCustomer().getId();
        }
        if (cp.getProduct() != null) {
            d.productId = cp.getProduct().getId();
            d.productName = cp.getProduct().getName();
            d.productSku = cp.getProduct().getSku();
            d.productPrice = cp.getProduct().getPrice();
            d.productImageUrl = cp.getProduct().getImageUrl();
        }
        d.orderNumber = cp.getOrderNumber();
        d.quantity = cp.getQuantity();
        d.originalDeliveryDate = cp.getOriginalDeliveryDate();
        d.underWarranty = cp.getUnderWarranty();
        d.handled = cp.isHandled();
        d.createdAt = cp.getCreatedAt();
        d.updatedAt = cp.getUpdatedAt();
        return d;
    }
}
