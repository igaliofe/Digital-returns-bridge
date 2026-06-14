package com.drb.server.web;

import com.drb.server.domain.enums.ReturnStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import java.io.Serializable;

@Named("statusUi")
@ApplicationScoped
public class StatusUi implements Serializable {

    public String label(ReturnStatus status) {
        if (status == null) {
            return "—";
        }
        return switch (status) {
            case OPEN -> "Open";
            case WAITING_FOR_PICKUP -> "Waiting for pickup";
            case BARCODE_ASSIGNED -> "Barcode assigned";
            case PICKED_UP -> "Picked up";
            case ARRIVED_TO_WAREHOUSE -> "Arrived to warehouse";
            case INSPECTED -> "Inspected";
            case CLOSED -> "Closed";
            case NEEDS_MORE_INFO -> "Needs more info";
        };
    }

    public String chipClass(ReturnStatus status) {
        if (status == null) {
            return "drb-chip";
        }
        return switch (status) {
            case OPEN -> "drb-chip drb-chip-status-open";
            case WAITING_FOR_PICKUP -> "drb-chip drb-chip-status-waiting";
            case BARCODE_ASSIGNED -> "drb-chip drb-chip-status-barcode";
            case PICKED_UP -> "drb-chip drb-chip-status-picked";
            case ARRIVED_TO_WAREHOUSE -> "drb-chip drb-chip-status-warehouse";
            case INSPECTED -> "drb-chip drb-chip-status-inspected";
            case CLOSED -> "drb-chip drb-chip-status-closed";
            case NEEDS_MORE_INFO -> "drb-chip drb-chip-status-needs-info";
        };
    }
}
