package com.drb.server.rest;
import com.drb.server.service.ReportsService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
@Path("/reports")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ReportsResource {
    @Inject
    private ReportsService reportsService;
    @GET
    @Path("/dashboard")
    public Response getDashboard() {
        return Response.ok(reportsService.getDashboard()).build();
    }
    @GET
    @Path("/returns-by-status")
    public Response getReturnsByStatus() {
        return Response.ok(reportsService.getReturnsByStatus()).build();
    }
    @GET
    @Path("/warehouse-decisions")
    public Response getWarehouseDecisions() {
        return Response.ok(reportsService.getWarehouseDecisions()).build();
    }
    @GET
    @Path("/missing-info")
    public Response getMissingInfo() {
        return Response.ok(reportsService.getMissingInfo()).build();
    }
    @GET
    @Path("/driver-performance")
    public Response getDriverPerformance() {
        return Response.ok(reportsService.getDriverPerformance()).build();
    }
    @GET
    @Path("/daily-returns")
    public Response getDailyReturns() {
        return Response.ok(reportsService.getDailyReturns()).build();
    }
}
