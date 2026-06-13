package com.drb.server.rest.dto;

import com.drb.server.domain.User;
import com.drb.server.domain.enums.Role;
import java.time.LocalDateTime;

public class UserDto {
    public Long id;
    public String phoneNumber;
    public String fullName;
    public Role role;
    public boolean active;
    public LocalDateTime createdAt;

    public static UserDto from(User u) {
        UserDto d = new UserDto();
        d.id = u.getId();
        d.phoneNumber = u.getPhoneNumber();
        d.fullName = u.getFullName();
        d.role = u.getRole();
        d.active = u.isActive();
        d.createdAt = u.getCreatedAt();
        return d;
    }
}
