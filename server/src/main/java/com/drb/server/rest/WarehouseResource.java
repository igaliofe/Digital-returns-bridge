package com.drb.server.rest;

import com.drb.server.rest.dto.ReturnRequestDto;
import com.drb.server.rest.exception.ErrorEnvelope;
import com.drb.server.service.WarehouseService;
import com.drb.server.service.exception.NotFoundException;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/warehouse")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RequestScoped
public class WarehouseResource {

    @Inject
    private WarehouseService warehouseService;

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
        return Response.ok(ReturnRequestDto.from(warehouseService.markArrived(barcode))).build();
    }
}
