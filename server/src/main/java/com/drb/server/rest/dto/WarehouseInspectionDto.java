package com.drb.server.rest.dto;

import com.drb.server.domain.WarehouseInspection;
import java.time.LocalDateTime;

public class WarehouseInspectionDto {
    public Long id;
    public Long returnRequestId;
    public Long inspectedByUserId;
    public String warehouseDecision;
    public String itemCondition;
    public Boolean callFullyHandled;
    public String warehouseNotes;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;

    public static WarehouseInspectionDto from(WarehouseInspection wi) {
        WarehouseInspectionDto d = new WarehouseInspectionDto();
        d.id = wi.getId();
        if (wi.getReturnRequest() != null) d.returnRequestId = wi.getReturnRequest().getId();
        if (wi.getInspectedByUser() != null) d.inspectedByUserId = wi.getInspectedByUser().getId();
        d.warehouseDecision = wi.getWarehouseDecision() != null ? wi.getWarehouseDecision().name() : null;
        d.itemCondition = wi.getItemCondition() != null ? wi.getItemCondition().name() : null;
        d.callFullyHandled = wi.getCallFullyHandled();
        d.warehouseNotes = wi.getWarehouseNotes();
        d.createdAt = wi.getCreatedAt();
        d.updatedAt = wi.getUpdatedAt();
        return d;
    }
}
