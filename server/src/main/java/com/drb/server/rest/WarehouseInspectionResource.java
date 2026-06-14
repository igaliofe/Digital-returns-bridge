package com.drb.server.rest;
import com.drb.server.domain.User;
import com.drb.server.rest.dto.WarehouseInspectionDto;
import com.drb.server.rest.dto.WarehouseInspectionRequest;
import com.drb.server.rest.security.AuthenticatedUser;
import com.drb.server.service.WarehouseInspectionService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/warehouse-inspections")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WarehouseInspectionResource {

    @Inject
    private WarehouseInspectionService warehouseInspectionService;

    @Inject
    private AuthenticatedUser authenticatedUser;

    @PUT
    @Path("/{inspectionId}")
    public Response update(@PathParam("inspectionId") Long inspectionId,
                           WarehouseInspectionRequest req) {
        User user = authenticatedUser.get();
        return Response.ok(WarehouseInspectionDto.from(
            warehouseInspectionService.update(inspectionId, req, user)
        )).build();
    }
}
