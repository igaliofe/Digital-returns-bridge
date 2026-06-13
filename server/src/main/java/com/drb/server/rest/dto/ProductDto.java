package com.drb.server.rest.dto;

import com.drb.server.domain.Product;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public class ProductDto {
    public Long id;
    public String sku;
    public String name;
    public String category;
    public String description;
    public BigDecimal price;
    public String imageUrl;
    public LocalDateTime createdAt;

    public static ProductDto from(Product p) {
        ProductDto d = new ProductDto();
        d.id = p.getId();
        d.sku = p.getSku();
        d.name = p.getName();
        d.category = p.getCategory();
        d.description = p.getDescription();
        d.price = p.getPrice();
        d.imageUrl = p.getImageUrl();
        d.createdAt = p.getCreatedAt();
        return d;
    }
}
