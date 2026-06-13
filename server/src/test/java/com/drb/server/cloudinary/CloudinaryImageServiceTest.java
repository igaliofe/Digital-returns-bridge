package com.drb.server.cloudinary;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.drb.server.domain.enums.ImageType;
import com.drb.server.service.exception.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CloudinaryImageServiceTest {

    @Spy
    private Cloudinary cloudinary = new Cloudinary(Map.of(
        "cloud_name", "real_cloud",
        "api_key",    "test_key",
        "api_secret", "test_secret",
        "secure",     "true"
    ));

    @Mock private Uploader uploader;

    @InjectMocks private CloudinaryImageService service;

    @Test
    void throwsValidationExceptionWhenCloudinaryNotConfigured() {
        cloudinary.config.cloudName = "placeholder_cloud";
        var input = new ByteArrayInputStream("img".getBytes());
        assertThatThrownBy(() -> service.upload(input, ImageType.SERVICE_GENERAL_IMAGE, 1L))
            .isInstanceOf(ValidationException.class)
            .hasMessageContaining("Cloudinary is not configured");
        cloudinary.config.cloudName = "real_cloud";
    }

    @Test
    void uploadCallsCloudinaryAndReturnsResult() throws Exception {
        doReturn(uploader).when(cloudinary).uploader();
        when(uploader.upload(any(byte[].class), any(Map.class)))
            .thenReturn(Map.of(
                "secure_url", "https://res.cloudinary.com/test.jpg",
                "public_id",  "digital-returns-bridge/1/service_image_123"));

        var result = service.upload(
            new ByteArrayInputStream("img".getBytes()),
            ImageType.SERVICE_GENERAL_IMAGE, 1L);

        assertThat(result.getUrl()).isEqualTo("https://res.cloudinary.com/test.jpg");
        assertThat(result.getPublicId()).contains("digital-returns-bridge/1");
    }
}
