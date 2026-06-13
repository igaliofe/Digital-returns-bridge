package com.drb.server.domain;

import com.drb.server.domain.enums.ItemCondition;
import com.drb.server.domain.enums.WarehouseDecision;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "warehouse_inspections")
public class WarehouseInspection {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "return_request_id")
    private ReturnRequest returnRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspected_by_user_id")
    private User inspectedByUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "warehouse_decision")
    private WarehouseDecision warehouseDecision;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_condition", length = 40)
    private ItemCondition itemCondition;

    @Column(name = "call_fully_handled")
    private Boolean callFullyHandled;

    @Column(name = "warehouse_notes")
    private String warehouseNotes;

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
    public User getInspectedByUser() { return inspectedByUser; }
    public void setInspectedByUser(User inspectedByUser) { this.inspectedByUser = inspectedByUser; }
    public WarehouseDecision getWarehouseDecision() { return warehouseDecision; }
    public void setWarehouseDecision(WarehouseDecision warehouseDecision) { this.warehouseDecision = warehouseDecision; }
    public ItemCondition getItemCondition() { return itemCondition; }
    public void setItemCondition(ItemCondition itemCondition) { this.itemCondition = itemCondition; }
    public Boolean getCallFullyHandled() { return callFullyHandled; }
    public void setCallFullyHandled(Boolean callFullyHandled) { this.callFullyHandled = callFullyHandled; }
    public String getWarehouseNotes() { return warehouseNotes; }
    public void setWarehouseNotes(String warehouseNotes) { this.warehouseNotes = warehouseNotes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
