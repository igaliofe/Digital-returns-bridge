package com.drb.server.rest.dto;

import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.enums.ReturnStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class ReturnRequestDto {
    public Long id;
    public String barcode;
    public LocalDateTime barcodeAssignedAt;
    public Long barcodeAssignedByDriverId;
    public String barcodeAssignedByDriverName;
    public Long customerId;
    public String customerName;
    public String customerAddress;
    public String customerPhone;
    public Long productId;
    public String productName;
    public String productSku;
    public BigDecimal productPrice;
    public String productImageUrl;
    public Long driverId;
    public String driverName;
    public String orderNumber;
    public String reason;
    public String defectDescription;
    public String priority;
    public LocalDate originalDeliveryDate;
    public Integer quantity;
    public Boolean underWarranty;
    public Boolean wasUsed;
    public String returnReason;
    public String defectType;
    public String defectStage;
    public String defectLocationText;
    public ReturnStatus status;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public List<ReturnImageDto> images;

    public static ReturnRequestDto from(ReturnRequest rr) {
        ReturnRequestDto d = new ReturnRequestDto();
        d.id = rr.getId();
        d.barcode = rr.getBarcode();
        d.barcodeAssignedAt = rr.getBarcodeAssignedAt();
        if (rr.getBarcodeAssignedByDriver() != null) {
            d.barcodeAssignedByDriverId = rr.getBarcodeAssignedByDriver().getId();
            if (rr.getBarcodeAssignedByDriver().getUser() != null)
                d.barcodeAssignedByDriverName = rr.getBarcodeAssignedByDriver().getUser().getFullName();
        }
        if (rr.getCustomer() != null) {
            d.customerId = rr.getCustomer().getId();
            d.customerName = rr.getCustomer().getFullName();
            d.customerAddress = rr.getCustomer().getAddress();
            d.customerPhone = rr.getCustomer().getPhone();
        }
        if (rr.getProduct() != null) {
            d.productId = rr.getProduct().getId();
            d.productName = rr.getProduct().getName();
            d.productSku = rr.getProduct().getSku();
            d.productPrice = rr.getProduct().getPrice();
            d.productImageUrl = rr.getProduct().getImageUrl();
        }
        if (rr.getDriver() != null) {
            d.driverId = rr.getDriver().getId();
            if (rr.getDriver().getUser() != null)
                d.driverName = rr.getDriver().getUser().getFullName();
        }
        d.orderNumber = rr.getOrderNumber();
        d.reason = rr.getReason();
        d.defectDescription = rr.getDefectDescription();
        d.priority = rr.getPriority();
        d.originalDeliveryDate = rr.getOriginalDeliveryDate();
        d.quantity = rr.getQuantity();
        d.underWarranty = rr.getUnderWarranty();
        d.wasUsed = rr.getWasUsed();
        d.returnReason = rr.getReturnReason() != null ? rr.getReturnReason().name() : null;
        d.defectType = rr.getDefectType() != null ? rr.getDefectType().name() : null;
        d.defectStage = rr.getDefectStage() != null ? rr.getDefectStage().name() : null;
        d.defectLocationText = rr.getDefectLocationText();
        d.status = rr.getStatus();
        d.createdAt = rr.getCreatedAt();
        d.updatedAt = rr.getUpdatedAt();
        return d;
    }
}
