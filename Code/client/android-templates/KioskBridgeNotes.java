package com.zedral.m1.operator;

/**
 * Template snippet for MainActivity — copy into the Capacitor-generated Android project
 * after `npx cap add android`.
 *
 * Enables device-owner lock task (COSU) and exposes start/stop to the WebView as ZedralKiosk.
 *
 * Enrollment (MDM or adb as device owner):
 *   adb shell dpm set-device-owner com.zedral.m1.operator/.AdminReceiver
 */
public final class KioskBridgeNotes {
  private KioskBridgeNotes() {}
}
