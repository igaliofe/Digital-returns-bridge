package com.drb.server.rest.exception;

public class ErrorEnvelope {
    private final ErrorBody error;

    public ErrorEnvelope(String code, String message) {
        this.error = new ErrorBody(code, message);
    }

    public ErrorBody getError() { return error; }

    public static class ErrorBody {
        private final String code;
        private final String message;

        ErrorBody(String code, String message) {
            this.code = code;
            this.message = message;
        }

        public String getCode() { return code; }
        public String getMessage() { return message; }
    }
}
