package com.drb.server.rest.dto;

import java.math.BigDecimal;

public class CreateProductRequest {
    public String sku;
    public String name;
    public String category;
    public String description;
    public BigDecimal price;
    public String imageUrl;
}
