package com.drb.server.rest.dto;

public class PickupConfirmationRequest {
    public Long driverId;
    public String itemCondition;
    public String defectType;
    public String defectLocation;
    public String defectLocationOther;
    public boolean itemCollected;
    public String driverNotes;
}
