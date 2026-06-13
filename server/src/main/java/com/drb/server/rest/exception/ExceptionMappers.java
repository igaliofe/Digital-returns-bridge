package com.drb.server.rest.exception;

import com.drb.server.service.exception.IllegalStatusTransitionException;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

@Provider
public class ExceptionMappers {

    @Provider
    public static class NotFoundMapper implements ExceptionMapper<NotFoundException> {
        @Override
        public Response toResponse(NotFoundException e) {
            return Response.status(404).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope("NOT_FOUND", e.getMessage())).build();
        }
    }

    @Provider
    public static class ValidationMapper implements ExceptionMapper<ValidationException> {
        @Override
        public Response toResponse(ValidationException e) {
            return Response.status(400).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope(e.getCode(), e.getMessage())).build();
        }
    }

    @Provider
    public static class IllegalStatusTransitionMapper implements ExceptionMapper<IllegalStatusTransitionException> {
        @Override
        public Response toResponse(IllegalStatusTransitionException e) {
            return Response.status(409).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope("ILLEGAL_STATUS_TRANSITION", e.getMessage())).build();
        }
    }

    @Provider
    public static class GenericMapper implements ExceptionMapper<Exception> {
        @Override
        public Response toResponse(Exception e) {
            return Response.status(500).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope("INTERNAL_ERROR", "An unexpected error occurred")).build();
        }
    }
}
