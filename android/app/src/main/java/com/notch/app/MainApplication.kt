package com.notch.app

import android.app.Application
import com.notch.app.capture.TransactionCapturePackage
import com.notch.app.device.DeviceServicesPackage
import com.notch.app.device.ThemePrefs
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(TransactionCapturePackage())
          add(DeviceServicesPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Apply the saved light/dark choice before any UI (splash included) is created.
    ThemePrefs.apply(ThemePrefs.get(this))
    loadReactNative(this)
  }
}
