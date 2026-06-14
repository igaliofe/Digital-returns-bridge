package com.drb.server.rest.dto;

import com.drb.server.domain.ReturnImage;
import java.time.LocalDateTime;

public class ReturnImageDto {
    public Long id;
    public String cloudinaryPublicId;
    public String imageUrl;
    public String imageType;
    public Long uploadedByUserId;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;

    public static ReturnImageDto from(ReturnImage ri) {
        ReturnImageDto d = new ReturnImageDto();
        d.id = ri.getId();
        d.cloudinaryPublicId = ri.getCloudinaryPublicId();
        d.imageUrl = ri.getImageUrl();
        d.imageType = ri.getImageType() != null ? ri.getImageType().name() : null;
        if (ri.getUploadedByUser() != null) d.uploadedByUserId = ri.getUploadedByUser().getId();
        d.createdAt = ri.getCreatedAt();
        d.updatedAt = ri.getUpdatedAt();
        return d;
    }
}
