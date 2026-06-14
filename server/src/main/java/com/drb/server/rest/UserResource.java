package com.drb.server.rest;
import com.drb.server.domain.User;
import com.drb.server.domain.enums.Role;
import com.drb.server.rest.dto.CreateUserRequest;
import com.drb.server.rest.dto.UserDto;
import com.drb.server.service.UserService;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.stream.Collectors;
@Path("/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed("MANAGER")
public class UserResource {
    @Inject
    private UserService userService;
    @GET
    public Response getAll() {
        return Response.ok(
            userService.findAll().stream().map(UserDto::from).collect(Collectors.toList())
        ).build();
    }
    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        return Response.ok(UserDto.from(userService.findById(id))).build();
    }
    @POST
    public Response create(CreateUserRequest req) {
        User u = new User();
        u.setPhoneNumber(req.phoneNumber);
        u.setFullName(req.fullName);
        u.setRole(Role.valueOf(req.role));
        return Response.status(201).entity(UserDto.from(userService.create(u))).build();
    }
    @PUT
    @Path("/{id}")
    public Response update(@PathParam("id") Long id, CreateUserRequest req) {
        User u = new User();
        u.setPhoneNumber(req.phoneNumber);
        u.setFullName(req.fullName);
        u.setRole(Role.valueOf(req.role));
        return Response.ok(UserDto.from(userService.update(id, u))).build();
    }
    @PATCH
    @Path("/{id}/active")
    public Response setActive(@PathParam("id") Long id, @QueryParam("active") boolean active) {
        userService.setActive(id, active);
        return Response.noContent().build();
    }
}
