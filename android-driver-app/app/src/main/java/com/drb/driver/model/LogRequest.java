package com.drb.driver.model;

import java.time.Instant;

public class LogRequest {
    public String level;
    public String tag;
    public String message;
    public String timestamp;

    public LogRequest(String level, String tag, String message) {
        this.level = level;
        this.tag = tag;
        this.message = message;
        this.timestamp = Instant.now().toString();
    }
}
