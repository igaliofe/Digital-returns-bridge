package com.drb.driver.model;

public class PickupUpdateModel {
    public Long id;
    public Long returnRequestId;
    public Long driverId;
    public String itemCondition;
    public boolean itemCollected;
    public String driverNotes;
    // Driver defect assessment (from pickup confirmation)
    public String defectType;
    public String defectLocation;
    public String defectLocationOther;
    public String createdAt;
}
