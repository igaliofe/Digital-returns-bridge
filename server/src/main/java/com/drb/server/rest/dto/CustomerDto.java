package com.drb.server.rest.dto;

import com.drb.server.domain.Customer;
import java.time.LocalDateTime;

public class CustomerDto {
    public Long id;
    public String fullName;
    public String phone;
    public String email;
    public String address;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;

    public static CustomerDto from(Customer c) {
        CustomerDto d = new CustomerDto();
        d.id = c.getId();
        d.fullName = c.getFullName();
        d.phone = c.getPhone();
        d.email = c.getEmail();
        d.address = c.getAddress();
        d.createdAt = c.getCreatedAt();
        d.updatedAt = c.getUpdatedAt();
        return d;
    }
}
