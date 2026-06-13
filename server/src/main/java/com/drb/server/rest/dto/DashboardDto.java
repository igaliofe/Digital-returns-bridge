package com.drb.server.rest.dto;

import java.util.Map;

public class DashboardDto {
    public Map<String, Long> statusCounts;
    public long noBarcode;
    public long totalOpen;
    public long totalPickedUp;
    public long totalInspected;
    public long totalClosed;
}
