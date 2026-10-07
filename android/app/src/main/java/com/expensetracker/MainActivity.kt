package com.expensetracker

import android.os.Bundle
import android.os.SystemClock
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.expensetracker.device.SplashGate
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ExpenseTracker"

  override fun onCreate(savedInstanceState: Bundle?) {
    // Must run before super.onCreate. Holds the branded splash until JS reports ready.
    val started = SystemClock.uptimeMillis()
    installSplashScreen().setKeepOnScreenCondition {
      !SplashGate.ready && SystemClock.uptimeMillis() - started < SplashGate.MAX_HOLD_MS
    }
    // react-native-screens: don't restore fragments after process death; React rebuilds the UI.
    super.onCreate(null)
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
