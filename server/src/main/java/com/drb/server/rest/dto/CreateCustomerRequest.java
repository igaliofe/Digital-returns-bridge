package com.drb.server.rest.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class CreateCustomerRequest {

    /** customers.full_name VARCHAR(120) NOT NULL */
    @NotBlank(message = "fullName is required")
    @Size(max = 120, message = "fullName must be at most 120 characters")
    public String fullName;

    /**
     * customers.phone VARCHAR(30) — optional. Permissive Israeli format:
     * 0501234567, 050-123-4567, 03-1234567, +972-50-123-4567.
     */
    @Pattern(regexp = "^\\s*$|^(\\+?972|0)[\\s-]?\\d{1,2}[\\s-]?\\d{3}[\\s-]?\\d{4}$",
             message = "phone must be a valid Israeli phone number")
    @Size(max = 30, message = "phone must be at most 30 characters")
    public String phone;

    /** customers.email VARCHAR(120) */
    @Email(message = "email must be a valid email address")
    @Size(max = 120, message = "email must be at most 120 characters")
    public String email;

    /** customers.address VARCHAR(255) */
    @Size(max = 255, message = "address must be at most 255 characters")
    public String address;
}
