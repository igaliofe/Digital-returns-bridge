package com.drb.server.rest.dto;

public class CreateReturnRequest {
    public Long customerId;
    public Long productId;
    public Long purchaseId;
    public Long driverId;
    public String orderNumber;
    public String reason;
    public String defectDescription;
    public String priority;
    public String originalDeliveryDate;
    public Integer quantity;
    public Boolean underWarranty;
    public Boolean wasUsed;
    public String returnReason;
    public String defectType;
    public String defectStage;
    public String defectLocationText;
}
