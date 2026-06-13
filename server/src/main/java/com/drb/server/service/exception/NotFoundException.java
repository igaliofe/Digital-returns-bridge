package com.drb.server.service.exception;

public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }

    public NotFoundException(String entityType, Object id) {
        super(entityType + " with id " + id + " not found");
    }
}
