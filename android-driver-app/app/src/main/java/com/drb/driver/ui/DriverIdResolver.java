package com.drb.driver.ui;

import android.content.Context;
import android.widget.Toast;
import com.drb.driver.api.ApiClient;
import com.drb.driver.model.DriverModel;
import com.drb.driver.model.UserModel;
import com.drb.driver.session.SessionManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

import java.util.List;

/**
 * Resolves the drivers-table id for the logged-in DRIVER user.
 * {@link com.drb.driver.model.UserModel#id} from /auth/me is the user id, not the driver id.
 */
public final class DriverIdResolver {

    public interface DriverIdCallback {
        void onResolved(Long driverId);
        void onFailure(String message);
    }

    private DriverIdResolver() { }

    public static void resolve(Context context, SessionManager sessionManager, DriverIdCallback callback) {
        Long cached = sessionManager.getDriverId();
        if (cached != null && cached != -1L) {
            callback.onResolved(cached);
            return;
        }

        ApiClient.get(sessionManager).me().enqueue(new retrofit2.Callback<UserModel>() {
            @Override
            public void onResponse(Call<UserModel> call, Response<UserModel> response) {
                if (!response.isSuccessful() || response.body() == null) {
                    callback.onFailure("Failed to load user info");
                    return;
                }
                UserModel user = response.body();
                fetchDriverIdForUser(context, sessionManager, user, callback);
            }

            @Override
            public void onFailure(Call<UserModel> call, Throwable t) {
                callback.onFailure("Network error: " + t.getMessage());
            }
        });
    }

    private static void fetchDriverIdForUser(Context context, SessionManager sessionManager,
                                             UserModel user, DriverIdCallback callback) {
        ApiClient.get(sessionManager).listDrivers().enqueue(new retrofit2.Callback<List<DriverModel>>() {
            @Override
            public void onResponse(Call<List<DriverModel>> call, Response<List<DriverModel>> response) {
                if (!response.isSuccessful() || response.body() == null) {
                    callback.onFailure("Failed to load driver profile");
                    return;
                }
                Long driverId = findDriverId(response.body(), user);
                if (driverId == null) {
                    callback.onFailure("No driver profile found for this account");
                    return;
                }
                sessionManager.setDriverId(driverId);
                callback.onResolved(driverId);
            }

            @Override
            public void onFailure(Call<List<DriverModel>> call, Throwable t) {
                callback.onFailure("Network error: " + t.getMessage());
            }
        });
    }

    private static Long findDriverId(List<DriverModel> drivers, UserModel user) {
        if (drivers == null) return null;
        for (DriverModel d : drivers) {
            if (d == null || d.id == null) continue;
            if (user.id != null && user.id.equals(d.userId)) {
                return d.id;
            }
            if (user.phoneNumber != null && user.phoneNumber.equals(d.phone)) {
                return d.id;
            }
        }
        return null;
    }

    public static void toastFailure(Context context, String message) {
        Toast.makeText(context, message, Toast.LENGTH_LONG).show();
    }
}
