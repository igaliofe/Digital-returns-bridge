package com.drb.server.rest;

import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.User;
import com.drb.server.rest.dto.*;
import com.drb.server.rest.exception.ErrorEnvelope;
import com.drb.server.service.ImageService;
import com.drb.server.service.ReturnRequestService;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.EntityPart;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.stream.Collectors;

@Path("/returns")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RequestScoped
public class ReturnResource {

    @Inject
    private ReturnRequestService returnRequestService;

    @Inject
    private ImageService imageService;

    @GET
    public Response getAll(
            @QueryParam("status") String status,
            @QueryParam("driverId") Long driverId,
            @QueryParam("customerId") Long customerId) {
        return Response.ok(
            returnRequestService.findAll(status, driverId, customerId)
                .stream().map(ReturnRequestDto::from).collect(Collectors.toList())
        ).build();
    }

    @GET
    @Path("/by-barcode/{barcode}")
    public Response getByBarcode(@PathParam("barcode") String barcode) {
        try {
            return Response.ok(ReturnRequestDto.from(returnRequestService.findByBarcode(barcode))).build();
        } catch (NotFoundException e) {
            return Response.status(404).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope("NOT_FOUND", e.getMessage())).build();
        }
    }

    @GET
    @Path("/{returnId}")
    public Response getById(@PathParam("returnId") Long returnId) {
        return Response.ok(ReturnRequestDto.from(returnRequestService.findById(returnId))).build();
    }

    @POST
    public Response create(CreateReturnRequest req, @Context ContainerRequestContext ctx) {
        ReturnRequest rr = new ReturnRequest();
        applyChecklistFields(rr, req);
        return Response.status(201).entity(ReturnRequestDto.from(returnRequestService.create(rr))).build();
    }

    @PUT
    @Path("/{returnId}")
    public Response update(@PathParam("returnId") Long returnId, CreateReturnRequest req) {
        ReturnRequest rr = new ReturnRequest();
        applyChecklistFields(rr, req);
        return Response.ok(ReturnRequestDto.from(returnRequestService.update(returnId, rr))).build();
    }

    private void applyChecklistFields(ReturnRequest rr, CreateReturnRequest req) {
        rr.setOrderNumber(req.orderNumber);
        rr.setReason(req.reason);
        rr.setDefectDescription(req.defectDescription);
        rr.setPriority(req.priority);
        if (req.originalDeliveryDate != null && !req.originalDeliveryDate.isBlank()) {
            rr.setOriginalDeliveryDate(java.time.LocalDate.parse(req.originalDeliveryDate));
        }
        rr.setQuantity(req.quantity);
        rr.setUnderWarranty(req.underWarranty);
        rr.setWasUsed(req.wasUsed);
        if (req.returnReason != null && !req.returnReason.isBlank()) {
            rr.setReturnReason(com.drb.server.domain.enums.ReturnReason.valueOf(req.returnReason));
        }
        if (req.defectType != null && !req.defectType.isBlank()) {
            rr.setDefectType(com.drb.server.domain.enums.DefectType.valueOf(req.defectType));
        }
        if (req.defectStage != null && !req.defectStage.isBlank()) {
            rr.setDefectStage(com.drb.server.domain.enums.DefectStage.valueOf(req.defectStage));
        }
        rr.setDefectLocationText(req.defectLocationText);
    }

    @PATCH
    @Path("/{returnId}/assign-driver")
    public Response assignDriver(@PathParam("returnId") Long returnId, AssignDriverRequest req) {
        return Response.ok(ReturnRequestDto.from(
            returnRequestService.assignDriver(returnId, req.driverId)
        )).build();
    }

    @PATCH
    @Path("/{returnId}/assign-barcode")
    public Response assignBarcode(@PathParam("returnId") Long returnId, AssignBarcodeRequest req,
                                  @Context ContainerRequestContext ctx) {
        try {
            ReturnRequest rr = returnRequestService.assignBarcode(returnId, req.barcode, req.driverId);
            return Response.ok(ReturnRequestDto.from(rr)).build();
        } catch (ValidationException e) {
            if ("BARCODE_ALREADY_ASSIGNED".equals(e.getCode())) {
                return Response.status(409).type(MediaType.APPLICATION_JSON)
                    .entity(new ErrorEnvelope(e.getCode(), e.getMessage())).build();
            }
            return Response.status(400).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope(e.getCode(), e.getMessage())).build();
        } catch (NotFoundException e) {
            return Response.status(404).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope("NOT_FOUND", e.getMessage())).build();
        }
    }

    @PATCH
    @Path("/{returnId}/status")
    public Response changeStatus(@PathParam("returnId") Long returnId, StatusChangeRequest req,
                                 @Context ContainerRequestContext ctx) {
        User user = (User) ctx.getProperty("authenticatedUser");
        return Response.ok(ReturnRequestDto.from(
            returnRequestService.changeStatus(returnId, req.status, req.comment, user)
        )).build();
    }

    @PATCH
    @Path("/{returnId}/priority")
    public Response changePriority(@PathParam("returnId") Long returnId, PriorityChangeRequest req) {
        return Response.ok(ReturnRequestDto.from(
            returnRequestService.changePriority(returnId, req.priority)
        )).build();
    }

    @GET
    @Path("/{returnId}/timeline")
    public Response getTimeline(@PathParam("returnId") Long returnId) {
        return Response.ok(
            returnRequestService.getStatusHistory(returnId)
                .stream().map(StatusHistoryDto::from).collect(Collectors.toList())
        ).build();
    }

    @GET
    @Path("/{returnId}/images")
    public Response getImages(@PathParam("returnId") Long returnId) {
        return Response.ok(
            returnRequestService.getImages(returnId)
                .stream().map(ReturnImageDto::from).collect(Collectors.toList())
        ).build();
    }

    @POST
    @Path("/{returnId}/images")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response uploadImage(@PathParam("returnId") Long returnId,
                                EntityPart file,
                                @FormParam("imageType") String imageType,
                                @Context ContainerRequestContext ctx) {
        User user = (User) ctx.getProperty("authenticatedUser");
        return Response.status(201).entity(ReturnImageDto.from(
            imageService.upload(returnId, file, imageType, user)
        )).build();
    }

    @GET
    @Path("/{returnId}/pickup-updates")
    public Response getPickupUpdates(@PathParam("returnId") Long returnId) {
        return Response.ok(
            returnRequestService.getPickupUpdates(returnId)
                .stream().map(PickupUpdateDto::from).collect(Collectors.toList())
        ).build();
    }

    @POST
    @Path("/{returnId}/pickup-updates")
    public Response createPickupUpdate(@PathParam("returnId") Long returnId,
                                       PickupConfirmationRequest req,
                                       @Context ContainerRequestContext ctx) {
        User user = (User) ctx.getProperty("authenticatedUser");
        return Response.status(201).entity(PickupUpdateDto.from(
            returnRequestService.createPickupUpdate(returnId, req, user)
        )).build();
    }

    @POST
    @Path("/{returnId}/pickup-confirmation")
    public Response confirmPickup(@PathParam("returnId") Long returnId,
                                  PickupConfirmationRequest req,
                                  @Context ContainerRequestContext ctx) {
        User user = (User) ctx.getProperty("authenticatedUser");
        return Response.ok(ReturnRequestDto.from(
            returnRequestService.confirmPickup(returnId, req, user)
        )).build();
    }

    @GET
    @Path("/{returnId}/status-history")
    public Response getStatusHistory(@PathParam("returnId") Long returnId) {
        return Response.ok(
            returnRequestService.getStatusHistory(returnId)
                .stream().map(StatusHistoryDto::from).collect(Collectors.toList())
        ).build();
    }

    @POST
    @Path("/{returnId}/status-history")
    public Response addManualStatusHistory(@PathParam("returnId") Long returnId,
                                           ManualStatusHistoryRequest req,
                                           @Context ContainerRequestContext ctx) {
        User user = (User) ctx.getProperty("authenticatedUser");
        return Response.status(201).entity(StatusHistoryDto.from(
            returnRequestService.addStatusHistory(returnId, req.newStatus, req.comment, user)
        )).build();
    }

    @GET
    @Path("/{returnId}/warehouse-inspections")
    public Response getWarehouseInspections(@PathParam("returnId") Long returnId) {
        return Response.ok(
            returnRequestService.getWarehouseInspections(returnId)
                .stream().map(WarehouseInspectionDto::from).collect(Collectors.toList())
        ).build();
    }

    @POST
    @Path("/{returnId}/warehouse-inspections")
    public Response createWarehouseInspection(@PathParam("returnId") Long returnId,
                                              WarehouseInspectionRequest req,
                                              @Context ContainerRequestContext ctx) {
        User user = (User) ctx.getProperty("authenticatedUser");
        return Response.status(201).entity(WarehouseInspectionDto.from(
            returnRequestService.createWarehouseInspection(returnId, req, user)
        )).build();
    }
}
