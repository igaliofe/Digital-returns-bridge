package com.drb.driver.ui;

import android.app.Activity;
import android.view.View;
import android.widget.TextView;
import com.drb.driver.R;

/**
 * Functional hook for role-specific login chrome. Agent 6 applies pixel-perfect styling
 * to {@code R.id.driverLoginChrome} and {@code R.id.warehouseLoginChrome}.
 */
public final class LoginChromeHelper {

    private LoginChromeHelper() { }

    public static void apply(Activity activity, String preferredRole) {
        View driverChrome = activity.findViewById(R.id.driverLoginChrome);
        View warehouseChrome = activity.findViewById(R.id.warehouseLoginChrome);
        View loginHeader = activity.findViewById(R.id.loginHeader);
        if (driverChrome == null || warehouseChrome == null) {
            return;
        }
        boolean warehouse = NavigationHelper.ROLE_WAREHOUSE.equalsIgnoreCase(preferredRole);
        driverChrome.setVisibility(warehouse ? View.GONE : View.VISIBLE);
        warehouseChrome.setVisibility(warehouse ? View.VISIBLE : View.GONE);

        if (loginHeader != null) {
            TextView headerTitle = loginHeader.findViewById(R.id.tvHeaderTitle);
            if (headerTitle != null) {
                headerTitle.setText(warehouse
                        ? activity.getString(R.string.login_warehouse_header)
                        : activity.getString(R.string.login_driver_header));
            }
        }
    }
}
