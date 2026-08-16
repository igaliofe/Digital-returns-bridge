package com.drb.server.rest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class StatusChangeRequest {

    /** return_requests.status VARCHAR(30) NOT NULL — parsed into the ReturnStatus enum. */
    @NotBlank(message = "status is required")
    @Size(max = 30, message = "status must be at most 30 characters")
    public String status;

    /** status_history.comment TEXT — capped to keep unbounded input off the boundary. */
    @Size(max = 2000, message = "comment must be at most 2000 characters")
    public String comment;
}
