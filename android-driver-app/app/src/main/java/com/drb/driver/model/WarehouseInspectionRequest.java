package com.drb.driver.model;

public class WarehouseInspectionRequest {
    // All fields optional; inspectedByUserId is derived server-side and ignored here.
    public String warehouseDecision;
    public String itemCondition;
    public Boolean callFullyHandled;
    public String warehouseNotes;
}
