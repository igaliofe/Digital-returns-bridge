package com.drb.server.web;

import com.drb.server.rest.dto.DashboardDto;
import com.drb.server.service.ReportsService;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;

@Named
@RequestScoped
public class DashboardBean {

    @Inject
    private ReportsService reportsService;

    private DashboardDto dashboard;

    @PostConstruct
    public void init() {
        dashboard = reportsService.getDashboard();
    }

    public long get(String key) {
        if (dashboard == null) return 0L;
        switch (key) {
            case "totalOpen":             return dashboard.totalOpen;
            case "totalWaitingPickup":    return statusCount("WAITING_FOR_PICKUP");
            case "totalBarcodeAssigned":  return statusCount("BARCODE_ASSIGNED");
            case "totalPickedUp":         return dashboard.totalPickedUp;
            case "totalInWarehouse":      return statusCount("ARRIVED_TO_WAREHOUSE");
            case "totalInspected":        return dashboard.totalInspected;
            case "totalClosed":           return dashboard.totalClosed;
            case "totalNeedsMoreInfo":    return statusCount("NEEDS_MORE_INFO");
            case "noBarcode":             return dashboard.noBarcode;
            default:                      return dashboard.statusCounts != null
                                              ? dashboard.statusCounts.getOrDefault(key, 0L) : 0L;
        }
    }

    private long statusCount(String status) {
        if (dashboard == null || dashboard.statusCounts == null) return 0L;
        return dashboard.statusCounts.getOrDefault(status, 0L);
    }
}
