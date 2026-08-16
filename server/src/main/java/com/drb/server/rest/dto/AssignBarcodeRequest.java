package com.drb.server.rest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class AssignBarcodeRequest {

    /** return_requests.barcode VARCHAR(60) UNIQUE */
    @NotBlank(message = "barcode is required")
    @Size(max = 60, message = "barcode must be at most 60 characters")
    public String barcode;

    @NotNull(message = "driverId is required")
    public Long driverId;
}
