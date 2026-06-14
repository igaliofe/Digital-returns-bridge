package com.drb.server.rest.dto;

import com.drb.server.domain.StatusHistory;
import java.time.LocalDateTime;

public class StatusHistoryDto {
    public Long id;
    public Long returnRequestId;
    public String oldStatus;
    public String newStatus;
    public String comment;
    public Long changedByUserId;
    public String changedByUserName;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;

    public static StatusHistoryDto from(StatusHistory sh) {
        StatusHistoryDto d = new StatusHistoryDto();
        d.id = sh.getId();
        if (sh.getReturnRequest() != null) d.returnRequestId = sh.getReturnRequest().getId();
        d.oldStatus = sh.getOldStatus() != null ? sh.getOldStatus().name() : null;
        d.newStatus = sh.getNewStatus() != null ? sh.getNewStatus().name() : null;
        d.comment = sh.getComment();
        if (sh.getChangedByUser() != null) {
            d.changedByUserId = sh.getChangedByUser().getId();
            d.changedByUserName = sh.getChangedByUser().getFullName();
        }
        d.createdAt = sh.getCreatedAt();
        d.updatedAt = sh.getUpdatedAt();
        return d;
    }
}
