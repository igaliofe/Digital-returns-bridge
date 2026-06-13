package com.drb.driver.model;

public class PickupConfirmationRequest {
    public Long driverId;
    // Renamed from packageCondition -> itemCondition (SHARED CONTRACT, ItemCondition enum)
    public String itemCondition;
    public boolean itemCollected;
    public String driverNotes;
    // New driver-assessment fields (SHARED CONTRACT)
    public String defectType;
    public String defectLocation;
    public String defectLocationOther;
}
