package com.drb.server.rest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class CreateUserRequest {

    /** users.phone_number VARCHAR(30) NOT NULL UNIQUE — permissive Israeli format. */
    @NotBlank(message = "phoneNumber is required")
    @Size(max = 30, message = "phoneNumber must be at most 30 characters")
    @Pattern(regexp = "^(\\+?972|0)[\\s-]?\\d{1,2}[\\s-]?\\d{3}[\\s-]?\\d{4}$",
             message = "phoneNumber must be a valid Israeli phone number")
    public String phoneNumber;

    /** users.full_name VARCHAR(120) NOT NULL */
    @NotBlank(message = "fullName is required")
    @Size(max = 120, message = "fullName must be at most 120 characters")
    public String fullName;

    /** users.role VARCHAR(30) NOT NULL — parsed into the Role enum. */
    @NotBlank(message = "role is required")
    @Size(max = 30, message = "role must be at most 30 characters")
    public String role;
}
