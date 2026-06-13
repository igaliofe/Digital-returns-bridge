package com.drb.server.cloudinary;

public class UploadResult {
    private final String publicId;
    private final String url;

    public UploadResult(String publicId, String url) {
        this.publicId = publicId;
        this.url = url;
    }

    public String getPublicId() { return publicId; }
    public String getUrl() { return url; }
}
