package com.drb.driver.ui;

import android.app.Activity;
import android.content.Intent;

public final class NavigationHelper {

    public static final String ROLE_DRIVER = "DRIVER";
    public static final String ROLE_WAREHOUSE = "WAREHOUSE";

    private NavigationHelper() { }

    /**
     * Routes the user to the correct home screen based on their role.
     * DRIVER    -> existing pickup flow (unchanged).
     * WAREHOUSE -> storekeeper home / work queue.
     * Anything else defaults to the driver flow to preserve prior behavior.
     */
    public static void routeAfterLogin(Activity activity, String role) {
        Class<?> target;
        if (ROLE_WAREHOUSE.equalsIgnoreCase(role)) {
            target = StorekeeperHomeActivity.class;
        } else {
            target = PickupListActivity.class;
        }
        activity.startActivity(new Intent(activity, target));
        activity.finish();
    }
}
