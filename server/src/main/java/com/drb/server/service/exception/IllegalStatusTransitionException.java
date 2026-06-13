package com.drb.server.service.exception;

import com.drb.server.domain.enums.ReturnStatus;

public class IllegalStatusTransitionException extends RuntimeException {

    private final ReturnStatus from;
    private final ReturnStatus to;

    public IllegalStatusTransitionException(String message) {
        super(message);
        this.from = null;
        this.to = null;
    }

    public IllegalStatusTransitionException(ReturnStatus from, ReturnStatus to) {
        super("Cannot transition from " + from + " to " + to);
        this.from = from;
        this.to = to;
    }

    public ReturnStatus getFrom() { return from; }
    public ReturnStatus getTo() { return to; }
}
