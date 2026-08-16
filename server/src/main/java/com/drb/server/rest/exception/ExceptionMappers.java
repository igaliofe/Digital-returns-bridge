package com.drb.server.rest.exception;

import com.drb.server.service.exception.ConcurrentModificationConflictException;
import com.drb.server.service.exception.IllegalStatusTransitionException;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

@Provider
public class ExceptionMappers {

    private static final Logger LOG = Logger.getLogger(ExceptionMappers.class.getName());

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
    public static class ConcurrentModificationMapper
            implements ExceptionMapper<ConcurrentModificationConflictException> {
        @Override
        public Response toResponse(ConcurrentModificationConflictException e) {
            return Response.status(409).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope("CONCURRENT_MODIFICATION", e.getMessage())).build();
        }
    }

    @Provider
    public static class ConstraintViolationMapper implements ExceptionMapper<ConstraintViolationException> {
        @Override
        public Response toResponse(ConstraintViolationException e) {
            Map<String, String> fields = new LinkedHashMap<>();
            for (ConstraintViolation<?> violation : e.getConstraintViolations()) {
                fields.put(fieldName(violation), violation.getMessage());
            }
            return Response.status(400).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope("VALIDATION_FAILED", "Request validation failed", fields)).build();
        }

        /**
         * Bean Validation reports the whole property path (for example
         * "create.arg0.fullName"); clients only care about the leaf field name.
         */
        private static String fieldName(ConstraintViolation<?> violation) {
            String leaf = null;
            for (Path.Node node : violation.getPropertyPath()) {
                if (node.getName() != null) {
                    leaf = node.getName();
                }
            }
            return leaf != null ? leaf : violation.getPropertyPath().toString();
        }
    }

    @Provider
    public static class GenericMapper implements ExceptionMapper<Exception> {
        @Override
        public Response toResponse(Exception e) {
            Response conflict = integrityConflict(e);
            if (conflict != null) {
                return conflict;
            }
            LOG.log(Level.SEVERE, "Unhandled REST exception", e);
            return Response.status(500).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope("INTERNAL_ERROR", "An unexpected error occurred")).build();
        }
    }

    /**
     * A database integrity violation is the caller's fault, not ours, so it must not surface as a
     * 500 — posting a phone number that already exists used to do exactly that.
     *
     * Matched on SQLState rather than Hibernate's own ConstraintViolationException: that class name
     * collides with Bean Validation's (already mapped above, to 400) and lives in a WildFly-provided
     * module we do not compile against. Class 23 is "integrity constraint violation"; 23505 is a
     * unique violation, 23503 a foreign-key one — the latter is what deleting a still-referenced
     * customer or product produces.
     */
    private static Response integrityConflict(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (!(t instanceof java.sql.SQLException)) {
                if (t.getCause() == t) break;
                continue;
            }
            String state = ((java.sql.SQLException) t).getSQLState();
            if (state == null || !state.startsWith("23")) {
                continue;
            }
            if ("23503".equals(state)) {
                return Response.status(409).type(MediaType.APPLICATION_JSON)
                    .entity(new ErrorEnvelope("RESOURCE_IN_USE",
                        "This record is still referenced by other data and cannot be removed"))
                    .build();
            }
            return Response.status(409).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope("DUPLICATE_RESOURCE",
                    "A record with these details already exists")).build();
        }
        return null;
    }
}
