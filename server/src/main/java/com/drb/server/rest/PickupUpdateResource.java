package com.drb.server.rest;

import com.drb.server.domain.User;
import com.drb.server.rest.dto.PickupConfirmationRequest;
import com.drb.server.rest.dto.PickupUpdateDto;
import com.drb.server.service.PickupUpdateService;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/pickup-updates")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RequestScoped
public class PickupUpdateResource {

    @Inject
    private PickupUpdateService pickupUpdateService;

    @PUT
    @Path("/{pickupUpdateId}")
    public Response update(@PathParam("pickupUpdateId") Long pickupUpdateId,
                           PickupConfirmationRequest req,
                           @Context ContainerRequestContext ctx) {
        User user = (User) ctx.getProperty("authenticatedUser");
        return Response.ok(PickupUpdateDto.from(
            pickupUpdateService.update(pickupUpdateId, req, user)
        )).build();
    }
}
