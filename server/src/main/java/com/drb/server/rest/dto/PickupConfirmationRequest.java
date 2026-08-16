package com.drb.server.rest.dto;

import jakarta.validation.constraints.Size;

public class PickupConfirmationRequest {

    /** Optional: the server takes the driver from the return request itself. */
    public Long driverId;

    /**
     * pickup_updates.item_condition VARCHAR(40).
     * Not @NotBlank: the same DTO drives the partial PUT /pickup-updates/{id},
     * where an omitted field means "leave unchanged".
     */
    @Size(max = 40, message = "itemCondition must be at most 40 characters")
    public String itemCondition;

    /** pickup_updates.defect_type VARCHAR(30) */
    @Size(max = 30, message = "defectType must be at most 30 characters")
    public String defectType;

    /** pickup_updates.defect_location VARCHAR(20) */
    @Size(max = 20, message = "defectLocation must be at most 20 characters")
    public String defectLocation;

    /** pickup_updates.defect_location_other TEXT — capped to keep unbounded input off the boundary. */
    @Size(max = 2000, message = "defectLocationOther must be at most 2000 characters")
    public String defectLocationOther;

    public boolean itemCollected;

    /** pickup_updates.driver_notes TEXT — capped to keep unbounded input off the boundary. */
    @Size(max = 2000, message = "driverNotes must be at most 2000 characters")
    public String driverNotes;
}
