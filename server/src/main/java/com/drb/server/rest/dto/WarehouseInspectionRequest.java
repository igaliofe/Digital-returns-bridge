package com.drb.server.rest.dto;

import jakarta.validation.constraints.Size;

public class WarehouseInspectionRequest {

    /** Optional: the inspector is derived from the authenticated user. */
    public Long inspectedByUserId;

    /** warehouse_inspections.warehouse_decision VARCHAR(30) */
    @Size(max = 30, message = "warehouseDecision must be at most 30 characters")
    public String warehouseDecision;

    /** warehouse_inspections.item_condition VARCHAR(40) */
    @Size(max = 40, message = "itemCondition must be at most 40 characters")
    public String itemCondition;

    public Boolean callFullyHandled;

    /** warehouse_inspections.warehouse_notes TEXT — capped to keep unbounded input off the boundary. */
    @Size(max = 2000, message = "warehouseNotes must be at most 2000 characters")
    public String warehouseNotes;
}
