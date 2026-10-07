package com.expensetracker.device

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.speech.RecognizerIntent
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.expensetracker.capture.NativeDeviceServicesSpec
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import java.util.Locale

class DeviceServicesModule(reactContext: ReactApplicationContext) :
  NativeDeviceServicesSpec(reactContext) {

  // Biometric or device PIN/pattern/password. BIOMETRIC_WEAK (not STRONG) because
  // STRONG | DEVICE_CREDENTIAL is not supported on API 28-29, and app lock only needs presence.
  private val authenticators = BIOMETRIC_WEAK or DEVICE_CREDENTIAL

  private var voicePromise: Promise? = null

  private val activityListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != VOICE_REQUEST) return
      val promise = voicePromise ?: return
      voicePromise = null
      if (resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return
      }
      val text = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
      promise.resolve(text?.takeIf { it.isNotBlank() })
    }
  }

  init {
    reactContext.addActivityEventListener(activityListener)
  }

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(activityListener)
    voicePromise?.resolve(null)
    voicePromise = null
    super.invalidate()
  }

  override fun canUseAppLock(promise: Promise) {
    val status = BiometricManager.from(reactApplicationContext).canAuthenticate(authenticators)
    promise.resolve(status == BiometricManager.BIOMETRIC_SUCCESS)
  }

  override fun authenticate(title: String, subtitle: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity as? FragmentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    UiThreadUtil.runOnUiThread {
      var settled = false
      fun settle(value: Boolean) {
        if (!settled) {
          settled = true
          promise.resolve(value)
        }
      }
      try {
        val prompt = BiometricPrompt(
          activity,
          ContextCompat.getMainExecutor(activity),
          object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
              settle(true)
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
              settle(false)
            }
            // onAuthenticationFailed = one bad attempt; the prompt stays open, so nothing to do.
          },
        )
        val info = BiometricPrompt.PromptInfo.Builder()
          .setTitle(title)
          .setSubtitle(subtitle)
          .setAllowedAuthenticators(authenticators)
          .build()
        prompt.authenticate(info)
      } catch (_: Exception) {
        settle(false)
      }
    }
  }

  override fun startVoiceInput(prompt: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.resolve(null)
      return
    }
    voicePromise?.resolve(null)
    voicePromise = promise
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
      .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
      .putExtra(RecognizerIntent.EXTRA_PROMPT, prompt)
      .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    try {
      activity.startActivityForResult(intent, VOICE_REQUEST)
    } catch (_: ActivityNotFoundException) {
      voicePromise = null
      promise.reject("E_NO_RECOGNIZER", "No speech recognition service on this device")
    }
  }

  override fun isIgnoringBatteryOptimizations(promise: Promise) {
    val pm = reactApplicationContext.getSystemService(PowerManager::class.java)
    promise.resolve(pm?.isIgnoringBatteryOptimizations(reactApplicationContext.packageName) == true)
  }

  override fun openBatteryOptimizationSettings(promise: Promise) {
    // The list screen needs no special permission (unlike ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
    // whose permission Google Play restricts to specific app types).
    promise.resolve(
      startFirst(
        Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
        appDetailsIntent(),
      ),
    )
  }

  override fun openAppDetailsSettings(promise: Promise) {
    promise.resolve(startFirst(appDetailsIntent()))
  }

  override fun hideSplash() {
    SplashGate.ready = true
  }

  override fun getManufacturer(promise: Promise) {
    promise.resolve(Build.MANUFACTURER.orEmpty().lowercase(Locale.ROOT))
  }

  private fun appDetailsIntent(): Intent =
    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
      .setData(Uri.fromParts("package", reactApplicationContext.packageName, null))

  private fun startFirst(vararg intents: Intent): Boolean {
    val activity = reactApplicationContext.currentActivity
    for (intent in intents) {
      try {
        if (activity != null) {
          activity.startActivity(intent)
        } else {
          reactApplicationContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        return true
      } catch (_: ActivityNotFoundException) {
        // Try the next screen.
      } catch (_: SecurityException) {
        // Some OEMs guard settings screens; try the next one.
      }
    }
    return false
  }

  private companion object {
    const val VOICE_REQUEST = 41_207
  }
}
