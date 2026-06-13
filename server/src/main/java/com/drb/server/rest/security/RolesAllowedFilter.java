package com.drb.server.rest.security;

import jakarta.annotation.Priority;
import jakarta.annotation.security.DenyAll;
import jakarta.annotation.security.PermitAll;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;
import java.lang.reflect.Method;

/**
 * Enforces @RolesAllowed / @PermitAll / @DenyAll on JAX-RS resources.
 * Runs after AuthFilter (which populates SecurityContext).
 */
@Provider
@Priority(Priorities.AUTHORIZATION)
public class RolesAllowedFilter implements ContainerRequestFilter {

    @Context
    private ResourceInfo resourceInfo;

    @Override
    public void filter(ContainerRequestContext ctx) throws IOException {
        Method method = resourceInfo.getResourceMethod();
        Class<?> resourceClass = resourceInfo.getResourceClass();
        if (method == null || resourceClass == null) return;

        if (method.isAnnotationPresent(DenyAll.class)) {
            abort(ctx, 403, "FORBIDDEN", "Access denied");
            return;
        }
        if (method.isAnnotationPresent(PermitAll.class)) return;

        RolesAllowed roles = method.getAnnotation(RolesAllowed.class);
        if (roles == null) {
            if (resourceClass.isAnnotationPresent(PermitAll.class)) return;
            roles = resourceClass.getAnnotation(RolesAllowed.class);
        }
        if (roles == null) return;

        SecurityContext sec = ctx.getSecurityContext();
        if (sec == null || sec.getUserPrincipal() == null) {
            abort(ctx, 401, "UNAUTHORIZED", "Authentication required");
            return;
        }
        for (String role : roles.value()) {
            if (sec.isUserInRole(role)) return;
        }
        abort(ctx, 403, "FORBIDDEN", "Role not permitted for this endpoint");
    }

    private void abort(ContainerRequestContext ctx, int status, String code, String msg) {
        ctx.abortWith(Response.status(status).type(MediaType.APPLICATION_JSON)
            .entity("{\"error\":{\"code\":\"" + code + "\",\"message\":\"" + msg + "\"}}")
            .build());
    }
}
