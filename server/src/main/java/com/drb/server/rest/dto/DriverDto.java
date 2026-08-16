package com.drb.server.rest.dto;

import com.drb.server.domain.Driver;

public class DriverDto {
    public Long id;
    public Long userId;
    public String driverFullName;
    public String vehicleNumber;
    public String phone;
    public boolean active;

    public static DriverDto from(Driver d) {
        DriverDto dto = new DriverDto();
        dto.id = d.getId();
        dto.vehicleNumber = d.getVehicleNumber();
        dto.active = d.isActive();
        // The driver's own contact number is what the admin screen edits and renders
        // (`drivers.xhtml` binds the Phone column to #{d.phone}), so it is what this DTO must
        // report. Falling back to the account's number keeps rows that never set one — every
        // seeded driver has the two equal, which is why the mismatch went unnoticed.
        dto.phone = d.getPhone();
        if (d.getUser() != null) {
            dto.userId = d.getUser().getId();
            dto.driverFullName = d.getUser().getFullName();
            if (dto.phone == null) {
                dto.phone = d.getUser().getPhoneNumber();
            }
        }
        return dto;
    }
}
