package com.drb.driver;

import android.util.Log;
import com.drb.driver.api.ApiClient;
import com.drb.driver.model.LogRequest;
import com.drb.driver.session.SessionManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RemoteLogger {

    private static SessionManager sessionManager;

    public static void init(SessionManager sm) {
        sessionManager = sm;
    }

    public static void d(String tag, String message) {
        Log.d(tag, message);
        send("DEBUG", tag, message);
    }

    public static void i(String tag, String message) {
        Log.i(tag, message);
        send("INFO", tag, message);
    }

    public static void w(String tag, String message) {
        Log.w(tag, message);
        send("WARN", tag, message);
    }

    public static void e(String tag, String message) {
        Log.e(tag, message);
        send("ERROR", tag, message);
    }

    public static void e(String tag, String message, Throwable t) {
        Log.e(tag, message, t);
        String full = t != null ? message + " — " + t.getClass().getSimpleName() + ": " + t.getMessage() : message;
        send("ERROR", tag, full);
    }

    private static void send(String level, String tag, String message) {
        if (sessionManager == null) return;
        try {
            ApiClient.get(sessionManager)
                .postLog(new LogRequest(level, tag, message))
                .enqueue(new Callback<Void>() {
                    @Override public void onResponse(Call<Void> call, Response<Void> response) {}
                    @Override public void onFailure(Call<Void> call, Throwable t) {}
                });
        } catch (Exception ignored) {}
    }
}
