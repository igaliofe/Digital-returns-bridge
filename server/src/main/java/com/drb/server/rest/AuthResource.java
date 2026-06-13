package com.drb.server.rest;

import com.drb.server.domain.User;
import com.drb.server.rest.dto.LoginRequest;
import com.drb.server.rest.dto.LoginResponse;
import com.drb.server.rest.dto.UserDto;
import com.drb.server.service.AuthService;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RequestScoped
public class AuthResource {

    @Inject
    private AuthService authService;

    @POST
    @Path("/login")
    public Response login(LoginRequest req) {
        String token = authService.login(req.phoneNumber);
        User user = authService.getByToken(token);
        LoginResponse resp = new LoginResponse();
        resp.token = token;
        resp.userId = user.getId();
        resp.fullName = user.getFullName();
        resp.role = user.getRole().name();
        return Response.ok(resp).build();
    }

    @GET
    @Path("/me")
    public Response me(@Context ContainerRequestContext ctx) {
        User user = (User) ctx.getProperty("authenticatedUser");
        if (user == null) return Response.status(401).build();
        return Response.ok(UserDto.from(user)).build();
    }

    @POST
    @Path("/logout")
    public Response logout(@HeaderParam("Authorization") String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            authService.logout(authHeader.substring(7));
        }
        return Response.noContent().build();
    }
}
