package com.drb.server.rest.dto;

import com.drb.server.domain.PickupUpdate;
import java.time.LocalDateTime;

public class PickupUpdateDto {
    public Long id;
    public Long returnRequestId;
    public Long driverId;
    public String itemCondition;
    public String defectType;
    public String defectLocation;
    public String defectLocationOther;
    public String signatureImageUrl;
    public boolean itemCollected;
    public String driverNotes;
    public LocalDateTime createdAt;

    public static PickupUpdateDto from(PickupUpdate pu) {
        PickupUpdateDto d = new PickupUpdateDto();
        d.id = pu.getId();
        if (pu.getReturnRequest() != null) d.returnRequestId = pu.getReturnRequest().getId();
        if (pu.getDriver() != null) d.driverId = pu.getDriver().getId();
        d.itemCondition = pu.getItemCondition() != null ? pu.getItemCondition().name() : null;
        d.defectType = pu.getDefectType() != null ? pu.getDefectType().name() : null;
        d.defectLocation = pu.getDefectLocation() != null ? pu.getDefectLocation().name() : null;
        d.defectLocationOther = pu.getDefectLocationOther();
        d.signatureImageUrl = pu.getSignatureImageUrl();
        d.itemCollected = pu.isItemCollected();
        d.driverNotes = pu.getDriverNotes();
        d.createdAt = pu.getCreatedAt();
        return d;
    }
}
