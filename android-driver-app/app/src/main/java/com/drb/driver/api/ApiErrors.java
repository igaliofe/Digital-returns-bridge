package com.drb.driver.api;

import java.io.IOException;

import retrofit2.Response;

/**
 * Helpers for reading the server's error envelope ({"code": ..., "message": ...}).
 *
 * <p>The server returns HTTP 409 for two different situations: an illegal status
 * transition and a lost race against another user editing the same return. Only the
 * envelope code tells them apart.
 */
public final class ApiErrors {

    private static final String CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION";

    /** Toast text shown when another user changed the same return first. */
    public static final String CONCURRENT_MODIFICATION_MESSAGE =
        "This return was just updated by another user. Refresh and try again.";

    private ApiErrors() {
    }

    /** True when the response is a 409 caused by a concurrent update rather than a bad transition. */
    public static boolean isConcurrentModification(Response<?> response) {
        if (response == null || response.code() != 409 || response.errorBody() == null) {
            return false;
        }
        String body;
        try {
            body = response.errorBody().string();
        } catch (IOException e) {
            return false;
        }
        return body != null && body.contains(CONCURRENT_MODIFICATION);
    }
}
