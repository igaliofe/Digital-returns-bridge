package com.drb.server.rest;
import com.drb.server.domain.User;
import com.drb.server.rest.dto.ReturnRequestDto;
import com.drb.server.rest.exception.ErrorEnvelope;
import com.drb.server.rest.security.AuthenticatedUser;
import com.drb.server.service.WarehouseService;
import com.drb.server.service.exception.NotFoundException;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/warehouse")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({"WAREHOUSE", "MANAGER"})
public class WarehouseResource {

    @Inject
    private WarehouseService warehouseService;

    @Inject
    private AuthenticatedUser authenticatedUser;
    @GET
    @Path("/returns/{barcode}")
    public Response findByBarcode(@PathParam("barcode") String barcode) {
        try {
            return Response.ok(ReturnRequestDto.from(warehouseService.findByBarcode(barcode))).build();
        } catch (NotFoundException e) {
            return Response.status(404).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope("NOT_FOUND", e.getMessage())).build();
        }
    }
    @POST
    @Path("/arrivals/{barcode}")
    public Response markArrived(@PathParam("barcode") String barcode) {
        User user = authenticatedUser.get();
        return Response.ok(ReturnRequestDto.from(warehouseService.markArrived(barcode, user))).build();
    }
}
