package com.zedral.m1.operator;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;

/** Device-owner receiver for COSU lock-task enrollment. */
public class AdminReceiver extends DeviceAdminReceiver {
  @Override
  public void onEnabled(Context context, Intent intent) {
    super.onEnabled(context, intent);
  }
}
