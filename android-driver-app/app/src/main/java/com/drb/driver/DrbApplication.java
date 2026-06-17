package com.drb.driver;

import android.app.Application;
import com.drb.driver.session.SessionManager;

public class DrbApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        SessionManager sm = new SessionManager(this);
        RemoteLogger.init(sm);

        Thread.setDefaultUncaughtExceptionHandler((thread, ex) -> {
            RemoteLogger.e("CRASH", "Uncaught exception on " + thread.getName(), ex);
        });
    }
}
