package com.drb.driver.session;

import android.content.Context;
import android.content.SharedPreferences;

public class SessionManager {
    private static final String PREF_NAME = "drb_prefs";
    private static final String KEY_TOKEN = "auth_token";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_FULL_NAME = "full_name";
    private static final String KEY_ROLE = "role";
    private static final String KEY_DRIVER_ID = "driver_id";

    private final SharedPreferences prefs;

    public SessionManager(Context context) {
        prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public void saveSession(String token, Long userId, String fullName, String role) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putLong(KEY_USER_ID, userId)
            .putString(KEY_FULL_NAME, fullName)
            .putString(KEY_ROLE, role)
            .apply();
    }

    public void setDriverId(Long driverId) {
        prefs.edit().putLong(KEY_DRIVER_ID, driverId).apply();
    }

    public String getToken() { return prefs.getString(KEY_TOKEN, null); }
    public Long getUserId() { return prefs.getLong(KEY_USER_ID, -1L); }
    public Long getDriverId() { return prefs.getLong(KEY_DRIVER_ID, -1L); }
    public String getFullName() { return prefs.getString(KEY_FULL_NAME, null); }
    public String getRole() { return prefs.getString(KEY_ROLE, null); }
    public boolean isLoggedIn() { return getToken() != null; }

    public void clearSession() {
        prefs.edit().clear().apply();
    }
}
