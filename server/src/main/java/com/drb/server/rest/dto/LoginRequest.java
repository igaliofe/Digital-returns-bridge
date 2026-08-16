package com.drb.server.rest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class LoginRequest {

    /** users.phone_number VARCHAR(30) */
    @NotBlank(message = "phoneNumber is required")
    @Size(max = 30, message = "phoneNumber must be at most 30 characters")
    public String phoneNumber;
}
