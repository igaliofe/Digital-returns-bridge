package com.drb.server.domain;

import com.drb.server.domain.enums.DefectStage;
import com.drb.server.domain.enums.DefectType;
import com.drb.server.domain.enums.ReturnReason;
import com.drb.server.domain.enums.ReturnStatus;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "return_requests")
public class ReturnRequest {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "barcode", unique = true)
    private String barcode;

    @Column(name = "barcode_assigned_at")
    private LocalDateTime barcodeAssignedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "barcode_assigned_by_driver_id")
    private Driver barcodeAssignedByDriver;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_id")
    private CustomerPurchase purchase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id")
    private Driver driver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opened_by_user_id")
    private User openedByUser;

    @Column(name = "order_number")
    private String orderNumber;

    @Column(name = "reason")
    private String reason;

    @Column(name = "defect_description")
    private String defectDescription;

    @Column(name = "priority")
    private String priority;

    @Column(name = "original_delivery_date")
    private LocalDate originalDeliveryDate;

    @Column(name = "quantity")
    private Integer quantity;

    @Column(name = "under_warranty")
    private Boolean underWarranty;

    @Column(name = "was_used")
    private Boolean wasUsed;

    @Enumerated(EnumType.STRING)
    @Column(name = "return_reason", length = 30)
    private ReturnReason returnReason;

    @Enumerated(EnumType.STRING)
    @Column(name = "defect_type", length = 30)
    private DefectType defectType;

    @Enumerated(EnumType.STRING)
    @Column(name = "defect_stage", length = 30)
    private DefectStage defectStage;

    @Column(name = "defect_location_text")
    private String defectLocationText;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ReturnStatus status = ReturnStatus.OPEN;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void preUpdate() { this.updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBarcode() { return barcode; }
    public void setBarcode(String barcode) { this.barcode = barcode; }
    public LocalDateTime getBarcodeAssignedAt() { return barcodeAssignedAt; }
    public void setBarcodeAssignedAt(LocalDateTime barcodeAssignedAt) { this.barcodeAssignedAt = barcodeAssignedAt; }
    public Driver getBarcodeAssignedByDriver() { return barcodeAssignedByDriver; }
    public void setBarcodeAssignedByDriver(Driver barcodeAssignedByDriver) { this.barcodeAssignedByDriver = barcodeAssignedByDriver; }
    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer customer) { this.customer = customer; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public CustomerPurchase getPurchase() { return purchase; }
    public void setPurchase(CustomerPurchase purchase) { this.purchase = purchase; }
    public Driver getDriver() { return driver; }
    public void setDriver(Driver driver) { this.driver = driver; }
    public User getOpenedByUser() { return openedByUser; }
    public void setOpenedByUser(User openedByUser) { this.openedByUser = openedByUser; }
    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getDefectDescription() { return defectDescription; }
    public void setDefectDescription(String defectDescription) { this.defectDescription = defectDescription; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public LocalDate getOriginalDeliveryDate() { return originalDeliveryDate; }
    public void setOriginalDeliveryDate(LocalDate originalDeliveryDate) { this.originalDeliveryDate = originalDeliveryDate; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public Boolean getUnderWarranty() { return underWarranty; }
    public void setUnderWarranty(Boolean underWarranty) { this.underWarranty = underWarranty; }
    public Boolean getWasUsed() { return wasUsed; }
    public void setWasUsed(Boolean wasUsed) { this.wasUsed = wasUsed; }
    public ReturnReason getReturnReason() { return returnReason; }
    public void setReturnReason(ReturnReason returnReason) { this.returnReason = returnReason; }
    public DefectType getDefectType() { return defectType; }
    public void setDefectType(DefectType defectType) { this.defectType = defectType; }
    public DefectStage getDefectStage() { return defectStage; }
    public void setDefectStage(DefectStage defectStage) { this.defectStage = defectStage; }
    public String getDefectLocationText() { return defectLocationText; }
    public void setDefectLocationText(String defectLocationText) { this.defectLocationText = defectLocationText; }
    public ReturnStatus getStatus() { return status; }
    public void setStatus(ReturnStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
