package com.drb.server.rest.dto;

import jakarta.validation.constraints.NotNull;

public class AssignDriverRequest {

    @NotNull(message = "driverId is required")
    public Long driverId;
}
