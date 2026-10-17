package com.maab.academy;

import android.content.pm.ActivityInfo;
import android.os.Build;
import android.os.Bundle;

/** يفتح الموقع الحي بملء الشاشة؛ الاتجاه عمودي كما في الموقع (قالب Bubblewrap) */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // ضبط الاتجاه يعطّل التطبيق بخلفيته الشفافة على أندرويد 8.0 وما قبله
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }
}
