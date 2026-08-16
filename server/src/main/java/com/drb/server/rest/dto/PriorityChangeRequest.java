package com.drb.server.rest.dto;

import jakarta.validation.constraints.Size;

public class PriorityChangeRequest {

    /** return_requests.priority VARCHAR(20) — nullable, so blank clears it. */
    @Size(max = 20, message = "priority must be at most 20 characters")
    public String priority;
}
