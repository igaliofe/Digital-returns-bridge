package com.drb.server.domain;

import com.drb.server.domain.enums.DefectLocation;
import com.drb.server.domain.enums.DefectType;
import com.drb.server.domain.enums.ItemCondition;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pickup_updates")
public class PickupUpdate {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "return_request_id")
    private ReturnRequest returnRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id")
    private Driver driver;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_condition", length = 40)
    private ItemCondition itemCondition;

    @Enumerated(EnumType.STRING)
    @Column(name = "defect_type", length = 30)
    private DefectType defectType;

    @Enumerated(EnumType.STRING)
    @Column(name = "defect_location", length = 20)
    private DefectLocation defectLocation;

    @Column(name = "defect_location_other")
    private String defectLocationOther;

    @Column(name = "signature_image_url", length = 500)
    private String signatureImageUrl;

    @Column(name = "item_collected")
    private boolean itemCollected;

    @Column(name = "driver_notes")
    private String driverNotes;

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
    public ReturnRequest getReturnRequest() { return returnRequest; }
    public void setReturnRequest(ReturnRequest returnRequest) { this.returnRequest = returnRequest; }
    public Driver getDriver() { return driver; }
    public void setDriver(Driver driver) { this.driver = driver; }
    public ItemCondition getItemCondition() { return itemCondition; }
    public void setItemCondition(ItemCondition itemCondition) { this.itemCondition = itemCondition; }
    public DefectType getDefectType() { return defectType; }
    public void setDefectType(DefectType defectType) { this.defectType = defectType; }
    public DefectLocation getDefectLocation() { return defectLocation; }
    public void setDefectLocation(DefectLocation defectLocation) { this.defectLocation = defectLocation; }
    public String getDefectLocationOther() { return defectLocationOther; }
    public void setDefectLocationOther(String defectLocationOther) { this.defectLocationOther = defectLocationOther; }
    public String getSignatureImageUrl() { return signatureImageUrl; }
    public void setSignatureImageUrl(String signatureImageUrl) { this.signatureImageUrl = signatureImageUrl; }
    public boolean isItemCollected() { return itemCollected; }
    public void setItemCollected(boolean itemCollected) { this.itemCollected = itemCollected; }
    public String getDriverNotes() { return driverNotes; }
    public void setDriverNotes(String driverNotes) { this.driverNotes = driverNotes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
