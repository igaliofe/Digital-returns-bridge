package com.drb.server.rest;
import com.drb.server.rest.dto.DriverDto;
import com.drb.server.rest.dto.ReturnRequestDto;
import com.drb.server.service.DriverService;
import com.drb.server.service.ReturnRequestService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.stream.Collectors;
@Path("/drivers")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DriverResource {
    @Inject
    private DriverService driverService;
    @Inject
    private ReturnRequestService returnRequestService;
    @GET
    public Response getAll() {
        return Response.ok(
            driverService.findAll().stream().map(DriverDto::from).collect(Collectors.toList())
        ).build();
    }
    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        return Response.ok(DriverDto.from(driverService.findById(id))).build();
    }
    @GET
    @Path("/{id}/pickups")
    public Response getPickups(
            @PathParam("id") Long id,
            @QueryParam("date") String date,
            @QueryParam("status") String status) {
        var pickups = returnRequestService.findByDriverId(id);
        if (status != null && !status.isBlank()) {
            pickups = pickups.stream()
                .filter(rr -> rr.getStatus() != null && rr.getStatus().name().equalsIgnoreCase(status))
                .collect(Collectors.toList());
        }
        return Response.ok(
            pickups.stream().map(ReturnRequestDto::from).collect(Collectors.toList())
        ).build();
    }
}
