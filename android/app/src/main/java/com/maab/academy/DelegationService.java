package com.maab.academy;

/** يمرّر إشعارات الموقع للتطبيق فتظهر باسمه وأيقونته (قالب Bubblewrap) */
public class DelegationService extends com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();
    }
}
