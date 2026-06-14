package com.drb.server.cloudinary;

import com.cloudinary.Cloudinary;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import java.util.logging.Logger;

@ApplicationScoped
public class CloudinaryConfig {

    private static final Logger LOG = Logger.getLogger(CloudinaryConfig.class.getName());

    // NOT @ApplicationScoped: a normal-scoped producer yields a CDI client proxy,
    // and CloudinaryImageService reads the public `config` field directly. Field reads
    // on a proxy hit the proxy's own uninitialized fields (cloudName == null) instead of
    // the real bean — which surfaced as a bogus CLOUDINARY_NOT_CONFIGURED. @Dependent
    // (the default) injects the real instance, so field access works.
    @Produces
    public Cloudinary cloudinary() {
        String cloudName = getEnv("CLOUDINARY_CLOUD_NAME", "placeholder_cloud");
        String apiKey    = getEnv("CLOUDINARY_API_KEY",    "placeholder_key");
        String apiSecret = getEnv("CLOUDINARY_API_SECRET", "placeholder_secret");

        if (cloudName.startsWith("placeholder")) {
            LOG.warning("Cloudinary env vars not set — uploads will fail until configured.");
        }

        // URL format is the canonical init for Cloudinary SDK 2.x.
        String url = String.format("cloudinary://%s:%s@%s", apiKey, apiSecret, cloudName);
        return new Cloudinary(url);
    }

    private String getEnv(String key, String defaultValue) {
        String val = System.getenv(key);
        return (val != null && !val.isBlank()) ? val : defaultValue;
    }
}
