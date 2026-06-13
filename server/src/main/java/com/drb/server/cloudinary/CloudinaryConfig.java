package com.drb.server.cloudinary;

import com.cloudinary.Cloudinary;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;

@ApplicationScoped
public class CloudinaryConfig {

    private static final Logger LOG = Logger.getLogger(CloudinaryConfig.class.getName());

    @Produces
    @ApplicationScoped
    public Cloudinary cloudinary() {
        String cloudName = getEnv("CLOUDINARY_CLOUD_NAME", "placeholder_cloud");
        String apiKey    = getEnv("CLOUDINARY_API_KEY",    "placeholder_key");
        String apiSecret = getEnv("CLOUDINARY_API_SECRET", "placeholder_secret");

        if (cloudName.startsWith("placeholder")) {
            LOG.warning("Cloudinary env vars not set — uploads will fail until configured.");
        }

        Map<String, String> config = new HashMap<>();
        config.put("cloud_name", cloudName);
        config.put("api_key",    apiKey);
        config.put("api_secret", apiSecret);
        config.put("secure",     "true");
        return new Cloudinary(config);
    }

    private String getEnv(String key, String defaultValue) {
        String val = System.getenv(key);
        return (val != null && !val.isBlank()) ? val : defaultValue;
    }
}
