package com.drb.server.rest.exception;

import java.util.Map;

public class ErrorEnvelope {
    private final ErrorBody error;

    public ErrorEnvelope(String code, String message) {
        this.error = new ErrorBody(code, message, null);
    }

    public ErrorEnvelope(String code, String message, Map<String, String> fields) {
        this.error = new ErrorBody(code, message, fields);
    }

    public ErrorBody getError() { return error; }

    public static class ErrorBody {
        private final String code;
        private final String message;
        private final Map<String, String> fields;

        ErrorBody(String code, String message, Map<String, String> fields) {
            this.code = code;
            this.message = message;
            this.fields = fields;
        }

        public String getCode() { return code; }
        public String getMessage() { return message; }

        /** Per-field messages; null for every error other than VALIDATION_FAILED. */
        public Map<String, String> getFields() { return fields; }
    }
}
