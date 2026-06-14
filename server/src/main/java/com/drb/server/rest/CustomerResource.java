package com.drb.server.rest;
import com.drb.server.domain.Customer;
import com.drb.server.rest.dto.CreateCustomerRequest;
import com.drb.server.rest.dto.CustomerDto;
import com.drb.server.rest.dto.CustomerPurchaseDto;
import com.drb.server.rest.exception.ErrorEnvelope;
import com.drb.server.service.CustomerPurchaseService;
import com.drb.server.service.CustomerService;
import com.drb.server.service.exception.NotFoundException;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.stream.Collectors;
@Path("/customers")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CustomerResource {
    @Inject
    private CustomerService customerService;
    @Inject
    private CustomerPurchaseService customerPurchaseService;
    @GET
    public Response getAll(@QueryParam("search") String search) {
        if (search != null && !search.isBlank()) {
            return Response.ok(
                customerService.search(search).stream().map(CustomerDto::from).collect(Collectors.toList())
            ).build();
        }
        return Response.ok(
            customerService.findAll().stream().map(CustomerDto::from).collect(Collectors.toList())
        ).build();
    }
    @GET
    @Path("/by-phone/{phone}")
    public Response getByPhone(@PathParam("phone") String phone) {
        try {
            return Response.ok(CustomerDto.from(customerService.findByPhone(phone))).build();
        } catch (NotFoundException e) {
            return Response.status(404).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope("NOT_FOUND", e.getMessage())).build();
        }
    }
    @GET
    @Path("/{customerId}/purchases")
    public Response getPurchases(@PathParam("customerId") Long customerId) {
        try {
            customerService.findById(customerId);
            return Response.ok(
                customerPurchaseService.findByCustomerId(customerId).stream()
                    .map(CustomerPurchaseDto::from)
                    .collect(Collectors.toList())
            ).build();
        } catch (NotFoundException e) {
            return Response.status(404).type(MediaType.APPLICATION_JSON)
                .entity(new ErrorEnvelope("NOT_FOUND", e.getMessage())).build();
        }
    }
    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        return Response.ok(CustomerDto.from(customerService.findById(id))).build();
    }
    @POST
    public Response create(CreateCustomerRequest req) {
        Customer c = new Customer();
        c.setFullName(req.fullName);
        c.setPhone(req.phone);
        c.setEmail(req.email);
        c.setAddress(req.address);
        return Response.status(201).entity(CustomerDto.from(customerService.create(c))).build();
    }
    @PUT
    @Path("/{id}")
    public Response update(@PathParam("id") Long id, CreateCustomerRequest req) {
        Customer c = new Customer();
        c.setFullName(req.fullName);
        c.setPhone(req.phone);
        c.setEmail(req.email);
        c.setAddress(req.address);
        return Response.ok(CustomerDto.from(customerService.update(id, c))).build();
    }
}
