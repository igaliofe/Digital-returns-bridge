package com.drb.server.service.exception;

/**
 * Raised when another user changed the same record between the moment it was
 * read and the moment it was written (optimistic lock failure).
 */
public class ConcurrentModificationConflictException extends RuntimeException {

    private final String entity;
    private final Object identifier;

    public ConcurrentModificationConflictException(String message) {
        super(message);
        this.entity = null;
        this.identifier = null;
    }

    public ConcurrentModificationConflictException(String entity, Object identifier, Throwable cause) {
        super(entity + " " + identifier + " was modified by another user. Reload and try again.", cause);
        this.entity = entity;
        this.identifier = identifier;
    }

    public String getEntity() { return entity; }
    public Object getIdentifier() { return identifier; }
}
