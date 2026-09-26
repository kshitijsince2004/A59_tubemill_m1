package com.zedral.m1.operator;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Device-owner lock-task (COSU) + JS bridge as window.ZedralKiosk via Capacitor evaluate.
 * Enrollment: adb shell dpm set-device-owner com.zedral.m1.operator/.AdminReceiver
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    tryStartLockTask();
    injectKioskBridge();
  }

  private void tryStartLockTask() {
    try {
      ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
      if (am != null && am.getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_NONE) {
        startLockTask();
      }
    } catch (Exception ignored) {
      /* Not device owner — screen pinning only in bench */
    }
  }

  private void injectKioskBridge() {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) return;
    webView.addJavascriptInterface(new KioskJs(this), "ZedralKioskNative");
    webView.post(() -> webView.evaluateJavascript(
      "(function(){window.ZedralKiosk={startLockTask:function(){return ZedralKioskNative.startLockTask();},"
        + "stopLockTask:function(){return ZedralKioskNative.stopLockTask();}};})();",
      null
    ));
  }

  public static class KioskJs {
    private final MainActivity activity;

    KioskJs(MainActivity activity) {
      this.activity = activity;
    }

    @JavascriptInterface
    public boolean startLockTask() {
      try {
        activity.runOnUiThread(activity::startLockTask);
        return true;
      } catch (Exception e) {
        return false;
      }
    }

    @JavascriptInterface
    public boolean stopLockTask() {
      try {
        activity.runOnUiThread(activity::stopLockTask);
        return true;
      } catch (Exception e) {
        return false;
      }
    }
  }
}
