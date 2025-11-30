package com.mobile.floating

import android.app.Activity
import android.app.ActivityManager
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class FloatingCheckinModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        private const val REQ_OVERLAY = 2025
        private const val TAG = "FloatingCheckinModule"
        private var moduleInstance: FloatingCheckinModule? = null

        /**
         * Gọi từ Service để emit event sang React Native
         * @param choice: "phys_unwell" khi vuốt xuống
         */
        fun sendEmergencyEvent(choice: String) {
            moduleInstance?.emitEmergencyEvent(choice)
        }
    }

    private var pendingToken: String? = null
    private var pendingBaseUrl: String? = null
    private var pendingPromise: Promise? = null
    private var activeDialog: AlertDialog? = null
    @Volatile private var overlayFlowActive: Boolean = false

    private val mainHandler = Handler(Looper.getMainLooper())

    init {
        reactContext.addActivityEventListener(this)
        moduleInstance = this
    }

    override fun getName() = "FloatingCheckin"

    /** Dismiss popup LUÔN trên UI thread để chắc chắn biến mất */
    private fun dismissActiveDialog() {
        try {
            val dialog = activeDialog ?: return
            mainHandler.post {
                try {
                    if (dialog.isShowing) dialog.dismiss()
                } catch (_: Exception) {}
            }
        } catch (_: Exception) {}
        activeDialog = null
    }

    /** Service đã chạy (overlay đang hiển thị) chưa? */
    private fun isServiceRunning(ctx: Context): Boolean {
        return try {
            val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            @Suppress("DEPRECATION")
            am.getRunningServices(Int.MAX_VALUE).any {
                it.service.className == FloatingCheckinService::class.qualifiedName
            }
        } catch (e: Exception) {
            Log.w(TAG, "isServiceRunning error: ${e.message}")
            false
        }
    }

    /** Đã có quyền overlay chưa (check cả 2 context để tránh lệch ROM)? */
    private fun hasOverlayPermission(activity: Activity?): Boolean {
        val appHas = Settings.canDrawOverlays(reactContext)
        val actHas = activity?.let { Settings.canDrawOverlays(it) } ?: false
        return appHas || actHas
    }

    // ==============================================================
    // =============== REQUEST OVERLAY PERMISSION ===================
    // ==============================================================

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        Log.d(TAG, "🔒 requestOverlayPermission() called")

        // Nếu service đang chạy hoặc đã có quyền → không cần popup
        if (isServiceRunning(reactContext) || hasOverlayPermission(reactContext.currentActivity)) {
            dismissActiveDialog()
            promise.resolve(true)
            return
        }

        val act = reactContext.currentActivity
        if (act == null) {
            promise.reject("perm_err", "No current activity")
            return
        }

        if (overlayFlowActive) {
            Log.d(TAG, "⚠️ Overlay flow already active -> skip")
            promise.resolve(true)
            return
        }

        val dialog = AlertDialog.Builder(act)
            .setTitle("Cho phép hiển thị trên ứng dụng khác")
            .setMessage(
                "E-Care cần quyền này để hiển thị màn hình kiểm tra an toàn nổi. " +
                        "Bấm “Cho phép” để mở phần cài đặt hệ thống."
            )
            .setCancelable(false)
            .setNegativeButton("Hủy") { d, _ ->
                d.dismiss()
                activeDialog = null
                promise.reject("perm_denied", "User cancelled")
            }
            .setPositiveButton("Cho phép") { d, _ ->
                try {
                    d.dismiss()
                    activeDialog = null
                    overlayFlowActive = true
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${act.packageName}")
                    )
                    act.startActivityForResult(intent, REQ_OVERLAY)
                    // Ở flow này chỉ là xin quyền trước, nên resolve luôn cho JS
                    promise.resolve(true)
                } catch (e: Exception) {
                    overlayFlowActive = false
                    promise.reject("perm_err", e)
                }
            }
            .create()

        activeDialog = dialog
        dialog.show()
    }

    // ==============================================================
    // ===================== START FLOATING =========================
    // ==============================================================

    @ReactMethod
    fun start(token: String, baseUrl: String, promise: Promise) {
        Log.d(TAG, "🚀 start() token=$token baseUrl=$baseUrl")
        try {
            val act = reactContext.currentActivity

            // 1) Nếu service đã chạy → ẩn popup (nếu có) và xong
            if (isServiceRunning(reactContext)) {
                dismissActiveDialog()
                promise.resolve(true)
                return
            }

            // 2) Nếu đã có quyền overlay (check cả app & activity) → start ngay
            if (hasOverlayPermission(act)) {
                startService(token, baseUrl) // startService sẽ tự dismiss popup thêm lần nữa
                promise.resolve(true)
                return
            }

            // 3) Chưa có quyền và không có Activity → không thể mở popup
            if (act == null) {
                promise.reject("start_err", "No activity & no overlay permission")
                return
            }

            // 4) Nếu flow xin quyền đang diễn ra → không mở lại popup
            if (overlayFlowActive) {
                Log.d(TAG, "⚠️ Overlay flow active → skip reopening dialog")
                pendingToken = token
                pendingBaseUrl = baseUrl
                pendingPromise = promise
                return
            }

            // 5) Mở popup xin quyền
            val dialog = AlertDialog.Builder(act)
                .setTitle("Cho phép hiển thị trên ứng dụng khác")
                .setMessage(
                    "E-Care cần quyền này để hiển thị màn hình kiểm tra an toàn nổi. " +
                            "Cấp quyền để tiếp tục."
                )
                .setCancelable(false)
                .setNegativeButton("Hủy") { d, _ ->
                    d.dismiss()
                    activeDialog = null
                    promise.reject("start_err", "User cancelled overlay")
                }
                .setPositiveButton("Cho phép") { d, _ ->
                    try {
                        d.dismiss()
                        activeDialog = null
                        overlayFlowActive = true
                        pendingToken = token
                        pendingBaseUrl = baseUrl
                        pendingPromise = promise
                        val intent = Intent(
                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:${act.packageName}")
                        )
                        act.startActivityForResult(intent, REQ_OVERLAY)
                    } catch (e: Exception) {
                        overlayFlowActive = false
                        pendingToken = null
                        pendingBaseUrl = null
                        pendingPromise = null
                        promise.reject("start_err", e)
                    }
                }
                .create()

            activeDialog = dialog
            dialog.show()

        } catch (e: Exception) {
            promise.reject("start_err", e)
        }
    }

    // ==============================================================
    // ======================== STOP ================================
    // ==============================================================

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            dismissActiveDialog()
            overlayFlowActive = false
            pendingPromise = null
            pendingToken = null
            pendingBaseUrl = null
            reactContext.stopService(Intent(reactContext, FloatingCheckinService::class.java))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("stop_err", e)
        }
    }

    // ==============================================================
    // ===================== CALLBACK RESULT ========================
    // ==============================================================

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != REQ_OVERLAY) return

        // Khi quay về từ Settings → đóng popup và hạ cờ
        dismissActiveDialog()
        overlayFlowActive = false

        val granted = hasOverlayPermission(activity)
        val p = pendingPromise
        val t = pendingToken
        val u = pendingBaseUrl
        pendingPromise = null
        pendingToken = null
        pendingBaseUrl = null

        if (granted && t != null && u != null) {
            startService(t, u) // sẽ tự dismiss popup trên UI thread
            p?.resolve(true)
        } else {
            p?.reject("perm_denied", "Overlay not granted")
        }
    }

    override fun onNewIntent(intent: Intent) {
        // no-op
    }

    // ==============================================================
    // ===================== START SERVICE ==========================
    // ==============================================================

    private fun startService(token: String, baseUrl: String) {
        // ĐẢM BẢO ẨN POPUP TRƯỚC KHI OVERLAY HIỆN
        dismissActiveDialog()

        val intent = Intent(reactContext, FloatingCheckinService::class.java).apply {
            putExtra(FloatingCheckinService.EXTRA_TOKEN, token)
            putExtra(FloatingCheckinService.EXTRA_BASEURL, baseUrl)
        }
        ContextCompat.startForegroundService(reactContext, intent)
    }

    // ==============================================================
    // ================= SEND EVENT TO REACT NATIVE =================
    // ==============================================================

    /**
     * Emit event "onDeadmanSwipe" sang JavaScript
     */
    private fun emitEmergencyEvent(choice: String) {
        try {
            val params = Arguments.createMap().apply {
                putString("choice", choice)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onDeadmanSwipe", params)
            
            Log.d(TAG, "✅ Event emitted: onDeadmanSwipe with choice=$choice")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to emit event: ${e.message}")
        }
    }
}
