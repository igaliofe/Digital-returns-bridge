package com.drb.server.rest.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public class CreateReturnRequest {

    @NotNull(message = "customerId is required")
    public Long customerId;

    @NotNull(message = "productId is required")
    public Long productId;

    public Long purchaseId;

    public Long driverId;

    /** return_requests.order_number VARCHAR(60) */
    @Size(max = 60, message = "orderNumber must be at most 60 characters")
    public String orderNumber;

    /** return_requests.reason TEXT — capped to keep unbounded input off the boundary. */
    @Size(max = 2000, message = "reason must be at most 2000 characters")
    public String reason;

    /** return_requests.defect_description TEXT */
    @Size(max = 2000, message = "defectDescription must be at most 2000 characters")
    public String defectDescription;

    /** return_requests.priority VARCHAR(20) */
    @Size(max = 20, message = "priority must be at most 20 characters")
    public String priority;

    /** Parsed with LocalDate.parse, so only an ISO date (or nothing) is accepted. */
    @Pattern(regexp = "^$|^\\d{4}-\\d{2}-\\d{2}$",
             message = "originalDeliveryDate must be an ISO date (yyyy-MM-dd)")
    public String originalDeliveryDate;

    @Positive(message = "quantity must be greater than 0")
    public Integer quantity;

    public Boolean underWarranty;

    public Boolean wasUsed;

    /** return_requests.return_reason VARCHAR(30) */
    @Size(max = 30, message = "returnReason must be at most 30 characters")
    public String returnReason;

    /** return_requests.defect_type VARCHAR(30) */
    @Size(max = 30, message = "defectType must be at most 30 characters")
    public String defectType;

    /** return_requests.defect_stage VARCHAR(30) */
    @Size(max = 30, message = "defectStage must be at most 30 characters")
    public String defectStage;

    /** return_requests.defect_location_text TEXT */
    @Size(max = 2000, message = "defectLocationText must be at most 2000 characters")
    public String defectLocationText;
}
