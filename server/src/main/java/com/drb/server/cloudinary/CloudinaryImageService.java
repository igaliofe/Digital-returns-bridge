package com.drb.server.cloudinary;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.drb.server.domain.enums.ImageType;
import com.drb.server.service.exception.ValidationException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.Map;
import java.util.logging.Logger;

@ApplicationScoped
public class CloudinaryImageService {

    private static final Logger LOG = Logger.getLogger(CloudinaryImageService.class.getName());
    private static final String BASE_FOLDER = "digital-returns-bridge";

    @Inject
    private Cloudinary cloudinary;

    public UploadResult upload(InputStream inputStream, ImageType imageType, Long returnId) {
        if (cloudinary.config.cloudName == null || cloudinary.config.cloudName.startsWith("placeholder")) {
            throw new ValidationException("CLOUDINARY_NOT_CONFIGURED",
                "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET env vars.");
        }
        try {
            byte[] bytes = inputStream.readAllBytes();
            String folder = BASE_FOLDER + "/" + returnId;
            // public_id is the bare filename; the "folder" param does the nesting.
            // Prefixing the folder here too made Cloudinary double-nest the path.
            String publicId = imageType.name().toLowerCase() + "_" + System.currentTimeMillis();

            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().upload(bytes,
                ObjectUtils.asMap(
                    "public_id", publicId,
                    "resource_type", "image",
                    "folder", folder
                ));

            String url = (String) result.get("secure_url");
            String pid = (String) result.get("public_id");
            LOG.info("Uploaded image to Cloudinary: " + pid);
            return new UploadResult(pid, url);
        } catch (Exception e) {
            throw new ValidationException("UPLOAD_FAILED", "Image upload failed: " + e.getMessage());
        }
    }

    public void destroy(String publicId) {
        try {
            cloudinary.api().deleteResources(
                Collections.singletonList(publicId),
                ObjectUtils.emptyMap());
            LOG.info("Deleted Cloudinary resource: " + publicId);
        } catch (Exception e) {
            LOG.warning("Failed to delete Cloudinary resource " + publicId + ": " + e.getMessage());
        }
    }
}
