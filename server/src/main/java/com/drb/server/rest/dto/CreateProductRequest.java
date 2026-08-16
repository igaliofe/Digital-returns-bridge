package com.drb.server.rest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public class CreateProductRequest {

    /** products.sku VARCHAR(60) NOT NULL UNIQUE */
    @NotBlank(message = "sku is required")
    @Size(max = 60, message = "sku must be at most 60 characters")
    public String sku;

    /** products.name VARCHAR(120) NOT NULL */
    @NotBlank(message = "name is required")
    @Size(max = 120, message = "name must be at most 120 characters")
    public String name;

    /** products.category VARCHAR(80) */
    @Size(max = 80, message = "category must be at most 80 characters")
    public String category;

    /** products.description TEXT — capped to keep unbounded input off the boundary. */
    @Size(max = 2000, message = "description must be at most 2000 characters")
    public String description;

    /** products.price NUMERIC(12,2) */
    @PositiveOrZero(message = "price must not be negative")
    public BigDecimal price;

    /** products.image_url VARCHAR(500) */
    @Size(max = 500, message = "imageUrl must be at most 500 characters")
    public String imageUrl;
}
