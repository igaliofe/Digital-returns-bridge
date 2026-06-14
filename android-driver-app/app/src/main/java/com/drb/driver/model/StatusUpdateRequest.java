package com.drb.driver.model;

public class StatusUpdateRequest {
    public String status;
    public String comment;

    public StatusUpdateRequest(String status, String comment) {
        this.status = status;
        this.comment = comment;
    }
}
