package com.drb.server.service;

import com.drb.server.cloudinary.CloudinaryImageService;
import com.drb.server.cloudinary.UploadResult;
import com.drb.server.domain.ReturnImage;
import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.User;
import com.drb.server.domain.enums.ImageType;
import com.drb.server.repository.ReturnImageRepository;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.EntityPart;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.List;
import java.util.logging.Logger;

@ApplicationScoped
public class ImageService {

    private static final Logger LOG = Logger.getLogger(ImageService.class.getName());

    @Inject private CloudinaryImageService cloudinaryService;
    @Inject private ReturnImageRepository imageRepo;
    @Inject private ReturnRequestService returnService;

    /** Upload from JAX-RS multipart EntityPart */
    @Transactional
    public ReturnImage upload(Long returnId, EntityPart file, String imageType, User uploadedBy) {
        LOG.info("Uploading image (EntityPart) for return " + returnId);
        ReturnRequest rr = returnService.getById(returnId);
        ImageType type = EnumParser.parse(ImageType.class, imageType, "imageType");
        if (type == null) {
            throw new ValidationException("IMAGE_TYPE_BLANK", "Image type cannot be blank");
        }
        InputStream stream = file.getContent();
        UploadResult result = cloudinaryService.upload(stream, type, returnId);
        return saveImage(rr, result, type.name(), uploadedBy);
    }

    /** Upload from raw byte array (JSF servlet Part) */
    @Transactional
    public ReturnImage upload(Long returnId, byte[] data, String imageType, User uploadedBy) {
        LOG.info("Uploading image (byte[]) for return " + returnId);
        ReturnRequest rr = returnService.getById(returnId);
        ImageType parsed = EnumParser.parse(ImageType.class, imageType, "imageType");
        ImageType type = parsed != null ? parsed : ImageType.SERVICE_GENERAL_IMAGE;
        UploadResult result = cloudinaryService.upload(new ByteArrayInputStream(data), type, returnId);
        return saveImage(rr, result, type.name(), uploadedBy);
    }

    private ReturnImage saveImage(ReturnRequest rr, UploadResult result, String imageType, User uploadedBy) {
        ReturnImage image = new ReturnImage();
        image.setReturnRequest(rr);
        image.setUploadedByUser(uploadedBy);
        image.setCloudinaryPublicId(result.getPublicId());
        image.setImageUrl(result.getUrl());
        image.setImageType(imageType != null ? ImageType.valueOf(imageType) : null);
        return imageRepo.save(image);
    }

    public List<ReturnImage> findByReturnRequestId(Long returnId) {
        return imageRepo.findByReturnRequestId(returnId);
    }

    public ReturnImage findById(Long imageId) {
        return imageRepo.findById(imageId)
            .orElseThrow(() -> new NotFoundException("ReturnImage", imageId));
    }

    @Transactional
    public void delete(Long imageId) {
        ReturnImage image = findById(imageId);
        if (image.getCloudinaryPublicId() != null) {
            cloudinaryService.destroy(image.getCloudinaryPublicId());
        }
        imageRepo.delete(imageId);
    }
}
