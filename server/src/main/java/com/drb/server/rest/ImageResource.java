package com.drb.server.rest;
import com.drb.server.rest.dto.ReturnImageDto;
import com.drb.server.service.ImageService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
@Path("/images")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ImageResource {
    @Inject
    private ImageService imageService;
    @GET
    @Path("/{imageId}")
    public Response getById(@PathParam("imageId") Long imageId) {
        return Response.ok(ReturnImageDto.from(imageService.findById(imageId))).build();
    }
    @DELETE
    @Path("/{imageId}")
    public Response delete(@PathParam("imageId") Long imageId) {
        imageService.delete(imageId);
        return Response.noContent().build();
    }
}
