package com.drb.server.rest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ManualStatusHistoryRequest {

    /** status_history.new_status VARCHAR(30) NOT NULL — parsed into the ReturnStatus enum. */
    @NotBlank(message = "newStatus is required")
    @Size(max = 30, message = "newStatus must be at most 30 characters")
    public String newStatus;

    /** status_history.comment TEXT — capped to keep unbounded input off the boundary. */
    @Size(max = 2000, message = "comment must be at most 2000 characters")
    public String comment;
}
