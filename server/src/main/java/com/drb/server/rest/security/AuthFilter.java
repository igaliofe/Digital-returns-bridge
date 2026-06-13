package com.drb.server.rest.security;

import com.drb.server.domain.User;
import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;
import java.security.Principal;
import java.util.Optional;

@Provider
@PreMatching
public class AuthFilter implements ContainerRequestFilter {

    @Inject
    private TokenStore tokenStore;

    @Override
    public void filter(ContainerRequestContext ctx) throws IOException {
        String path = ctx.getUriInfo().getPath();
        // RESTEasy may return the path with or without a leading slash; normalize.
        if (path.startsWith("/")) path = path.substring(1);
        if (path.startsWith("auth/login")) return;

        String header = ctx.getHeaderString("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            ctx.abortWith(Response.status(401).type(MediaType.APPLICATION_JSON)
                .entity("{\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"Missing or invalid Authorization header\"}}")
                .build());
            return;
        }

        String token = header.substring(7);
        Optional<User> userOpt = tokenStore.lookup(token);
        if (userOpt.isEmpty()) {
            ctx.abortWith(Response.status(401).type(MediaType.APPLICATION_JSON)
                .entity("{\"error\":{\"code\":\"INVALID_TOKEN\",\"message\":\"Invalid or expired token\"}}")
                .build());
            return;
        }

        User user = userOpt.get();
        ctx.setSecurityContext(new SecurityContext() {
            @Override
            public Principal getUserPrincipal() { return user::getPhoneNumber; }
            @Override
            public boolean isUserInRole(String role) { return user.getRole().name().equals(role); }
            @Override
            public boolean isSecure() { return false; }
            @Override
            public String getAuthenticationScheme() { return "Bearer"; }
        });
        ctx.setProperty("authenticatedUser", user);
    }
}
