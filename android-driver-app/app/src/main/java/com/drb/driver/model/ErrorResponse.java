package com.drb.driver.model;

public class ErrorResponse {
    public ErrorBody error;

    public static class ErrorBody {
        public String code;
        public String message;
    }

    public String getCode() {
        return error != null ? error.code : null;
    }

    public String getMessage() {
        return error != null ? error.message : null;
    }
}
