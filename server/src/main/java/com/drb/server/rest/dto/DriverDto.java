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
        if (d.getUser() != null) {
            dto.userId = d.getUser().getId();
            dto.driverFullName = d.getUser().getFullName();
            dto.phone = d.getUser().getPhoneNumber();
        }
        return dto;
    }
}
