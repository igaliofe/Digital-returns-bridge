package com.drb.server.rest;
import com.drb.server.domain.Product;
import com.drb.server.rest.dto.CreateProductRequest;
import com.drb.server.rest.dto.ProductDto;
import com.drb.server.service.ProductService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.stream.Collectors;
@Path("/products")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ProductResource {
    @Inject
    private ProductService productService;
    @GET
    public Response getAll(@QueryParam("search") String search) {
        if (search != null && !search.isBlank()) {
            return Response.ok(
                productService.search(search).stream().map(ProductDto::from).collect(Collectors.toList())
            ).build();
        }
        return Response.ok(
            productService.findAll().stream().map(ProductDto::from).collect(Collectors.toList())
        ).build();
    }
    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        return Response.ok(ProductDto.from(productService.findById(id))).build();
    }
    @POST
    public Response create(@Valid CreateProductRequest req) {
        Product p = new Product();
        p.setSku(req.sku);
        p.setName(req.name);
        p.setCategory(req.category);
        p.setDescription(req.description);
        p.setPrice(req.price);
        p.setImageUrl(req.imageUrl);
        return Response.status(201).entity(ProductDto.from(productService.create(p))).build();
    }
    @PUT
    @Path("/{id}")
    public Response update(@PathParam("id") Long id, @Valid CreateProductRequest req) {
        Product p = new Product();
        p.setSku(req.sku);
        p.setName(req.name);
        p.setCategory(req.category);
        p.setDescription(req.description);
        p.setPrice(req.price);
        p.setImageUrl(req.imageUrl);
        return Response.ok(ProductDto.from(productService.update(id, p))).build();
    }
}
