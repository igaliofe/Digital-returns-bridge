package com.drb.server.rest;
import com.drb.server.domain.User;
import com.drb.server.rest.dto.PickupConfirmationRequest;
import com.drb.server.rest.dto.PickupUpdateDto;
import com.drb.server.rest.security.AuthenticatedUser;
import com.drb.server.service.PickupUpdateService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/pickup-updates")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PickupUpdateResource {

    @Inject
    private PickupUpdateService pickupUpdateService;

    @Inject
    private AuthenticatedUser authenticatedUser;

    @PUT
    @Path("/{pickupUpdateId}")
    public Response update(@PathParam("pickupUpdateId") Long pickupUpdateId,
                           PickupConfirmationRequest req) {
        User user = authenticatedUser.get();
        return Response.ok(PickupUpdateDto.from(
            pickupUpdateService.update(pickupUpdateId, req, user)
        )).build();
    }
}
