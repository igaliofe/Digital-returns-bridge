package com.drb.driver.ui;

import android.app.Activity;
import android.view.View;
import android.widget.TextView;
import com.drb.driver.R;

/**
 * Wires the shared navy top bar ({@code include_drb_header}). The app theme is
 * NoActionBar, so {@code setTitle()} is invisible — screens use this header
 * instead. Views are looked up by their inner ids, so the {@code <include>}
 * does not need its own id.
 */
public final class HeaderHelper {

    private HeaderHelper() { }

    public static void setTitle(Activity activity, CharSequence title) {
        TextView t = activity.findViewById(R.id.tvHeaderTitle);
        if (t != null) {
            t.setText(title);
        }
    }

    /** Show a back arrow that finishes the activity (sub-screens). */
    public static void enableBack(Activity activity) {
        View back = activity.findViewById(R.id.headerBack);
        if (back != null) {
            back.setVisibility(View.VISIBLE);
            back.setOnClickListener(v -> activity.finish());
        }
    }

    /** Show the trailing logout action with a custom handler (top-level screens). */
    public static void enableLogout(Activity activity, View.OnClickListener onLogout) {
        TextView action = activity.findViewById(R.id.tvHeaderAction);
        if (action != null) {
            action.setVisibility(View.VISIBLE);
            action.setOnClickListener(onLogout);
        }
    }

    /** Convenience for a sub-screen: title + back arrow. */
    public static void setupSubScreen(Activity activity, int titleRes) {
        setTitle(activity, activity.getString(titleRes));
        enableBack(activity);
    }
}
