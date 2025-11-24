package com.mobile.floating

import com.mobile.R
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.*

class FloatingCheckinService : Service() {

    companion object {
        const val EXTRA_TOKEN = "token"
        const val EXTRA_BASEURL = "baseUrl"
        private const val CHANNEL_ID = "ecare_overlay_channel"
        private const val NOTI_ID = 4557
        private const val TAG = "FloatingCheckinService"

        private const val PREFS = "deadman_prefs"
        private const val KEY_LAST_CHECKIN_MS = "last_checkin_ms"
        private const val KEY_TZID = "last_tz"
    }

    private var wm: WindowManager? = null
    private var overlayView: View? = null
    private var token: String? = null
    private var baseUrl: String? = null

    // Deadman windows
    private val DEADMAN_WINDOWS = arrayOf("07:00", "15:00", "19:00")
    private var tzId: String = "Asia/Ho_Chi_Minh"
    private var lastCheckinAt: Long? = null // epoch millis (server/local)

    // Watcher tick
    private val watchHandler = Handler(Looper.getMainLooper())
    private val watchIntervalMs = 60_000L
    private var watching = false

    // Auto-hide full-screen panel sau 20 phút
    private val fullScreenTimeoutMs = 20 * 60 * 1000L
    private val autoHideHandler = Handler(Looper.getMainLooper())
    private var autoHideRunnable: Runnable? = null

    // Âm thanh & rung
    private var ringtone: Ringtone? = null
    private var vibrator: Vibrator? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "✅ onCreate")
        createNotificationChannel()
        val smallIcon =
            applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info
        startForeground(
            NOTI_ID,
            NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(smallIcon)
                .setContentTitle("E-Care đang theo dõi an toàn")
                .setContentText("Màn hình kiểm tra an toàn sẽ bật vào các khung giờ đã đặt.")
                .setOngoing(true)
                .build()
        )

        vibrator = getSystemService(VIBRATOR_SERVICE) as? Vibrator
        restoreLocalState()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        token = intent?.getStringExtra(EXTRA_TOKEN)
        baseUrl = intent?.getStringExtra(EXTRA_BASEURL)
        Log.d(TAG, "➡️ onStartCommand token=$token baseUrl=$baseUrl")

        if (!Settings.canDrawOverlays(this)) {
            Log.e(TAG, "❌ Missing overlay permission")
            Toast.makeText(this, "Bật quyền 'Hiển thị trên ứng dụng khác'", Toast.LENGTH_LONG)
                .show()
            stopSelf()
            return START_NOT_STICKY
        }

        wm = getSystemService(WINDOW_SERVICE) as WindowManager

        startWatching()
        tickOnceImmediate()
        return START_STICKY
    }

    override fun onDestroy() {
        Log.d(TAG, "🛑 onDestroy")
        stopWatching()
        hideAlertPanel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ============================================================
    // =============== FULLSCREEN DEADMAN PANEL ===================
    // ============================================================

    /** Hiển thị màn hình cảnh báo full-screen */
    private fun showAlertPanel() {
        if (overlayView != null) {
            Log.d(TAG, "⚠️ Alert panel already visible; skip")
            return
        }
        val wmLocal = wm ?: return

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else WindowManager.LayoutParams.TYPE_PHONE

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER
        }

        // NỀN TỐI kiểu màn báo thức
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#050816")) // tím than đậm
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(24), dp(24), dp(24))
        }

        // Khối nội dung ở giữa
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
        }

        // Tiêu đề to, dễ đọc
        val title = TextView(this).apply {
            text = "Nhắc kiểm tra an toàn"
            setTextColor(Color.WHITE)
            textSize = 24f
        }
        content.addView(title)

        // Mô tả ngắn cho bác
        val msg = TextView(this).apply {
            text = "Bác vuốt để báo hôm nay tình trạng của mình cho người thân biết."
            setTextColor(Color.parseColor("#E5E7EB")) // xám nhạt
            textSize = 18f
            setPadding(0, dp(12), 0, dp(12))
        }
        content.addView(msg)

        // Hướng dẫn chi tiết
        val guide = TextView(this).apply {
            text = "• Vuốt LÊN: Hôm nay bác ổn\n• Vuốt XUỐNG: Bác không ổn về sức khỏe"
            setTextColor(Color.parseColor("#9CA3AF"))
            textSize = 16f
        }
        content.addView(guide)

        // Nút VUỐT – nhỏ gọn, chữ rất to
        val gestureArea = TextView(this).apply {
            text = "VUỐT"
            setTextColor(Color.WHITE)
            textSize = 30f                    // chữ lớn cho người cao tuổi
            gravity = Gravity.CENTER
            setPadding(dp(40), dp(16), dp(40), dp(16))

            val bg = resources.getDrawable(R.drawable.button_background, null)
            bg.setTint(Color.parseColor("#F59E0B")) // cam ấm giống nút Snooze
            background = bg
        }
        val gestureParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            topMargin = dp(32)
            bottomMargin = dp(8)
            gravity = Gravity.CENTER_HORIZONTAL
        }
        gestureArea.layoutParams = gestureParams
        content.addView(gestureArea)

        // Gợi ý nhỏ phía dưới
        val hint = TextView(this).apply {
            text = "Màn hình sẽ tự tắt nếu bác không vuốt trong 20 phút."
            setTextColor(Color.parseColor("#9CA3AF"))
            textSize = 14f
            setPadding(0, dp(16), 0, 0)
        }
        content.addView(hint)

        root.addView(content)

        // Gesture kéo theo tay (vuốt lên / xuống)
        gestureArea.setOnTouchListener(object : View.OnTouchListener {
            var startY = 0f
            var originalTranslationY = 0f

            override fun onTouch(v: View, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        startY = event.rawY
                        originalTranslationY = v.translationY
                        return true
                    }

                    MotionEvent.ACTION_MOVE -> {
                        val dy = event.rawY - startY
                        val maxOffset = dp(80).toFloat()
                        val newTrans = (originalTranslationY + dy).coerceIn(-maxOffset, maxOffset)
                        v.translationY = newTrans
                        return true
                    }

                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        val dy = event.rawY - startY
                        val threshold = dp(40).toFloat()

                        when {
                            dy < -threshold -> {
                                v.animate()
                                    .translationY(originalTranslationY - dp(100))
                                    .setDuration(150)
                                    .withEndAction {
                                        onSwipeChoice("safe")
                                        v.translationY = originalTranslationY
                                    }
                                    .start()
                            }

                            dy > threshold -> {
                                v.animate()
                                    .translationY(originalTranslationY + dp(100))
                                    .setDuration(150)
                                    .withEndAction {
                                        onSwipeChoice("phys_unwell")
                                        v.translationY = originalTranslationY
                                    }
                                    .start()
                            }

                            else -> {
                                v.animate()
                                    .translationY(originalTranslationY)
                                    .setDuration(150)
                                    .start()
                            }
                        }
                        return true
                    }
                }
                return false
            }
        })

        overlayView = root
        wmLocal.addView(root, lp)
        Log.d(TAG, "🎉 Alert panel shown (alarm-style)")

        startAlertFeedback()
        scheduleAutoHide()
    }

    /** Ẩn màn hình cảnh báo */
    private fun hideAlertPanel() {
        val wmLocal = wm
        overlayView?.let {
            try {
                wmLocal?.removeView(it)
            } catch (_: Exception) {
            }
        }
        overlayView = null
        cancelAutoHide()
        stopAlertFeedback()
    }

    // ============================================================
    // ================== SWIPE ACTION HANDLING ===================
    // ============================================================

    /** Người dùng vuốt chọn */
    private fun onSwipeChoice(choice: String) {
        Log.d(TAG, "👆 Swipe choice: $choice — sending")
        Thread {
            val okCheckin = sendCheckin(choice)
            val okNotify = sendChoiceNotify(choice)

            Handler(Looper.getMainLooper()).post {
                if (okCheckin) {
                    Toast.makeText(
                        this,
                        when (choice) {
                            "safe" -> "✅ Đã xác nhận: Hôm nay an toàn"
                            "phys_unwell" -> "📩 Đã báo: Không ổn về sức khỏe"
                            else -> "💬 Đã báo"
                        },
                        Toast.LENGTH_SHORT
                    ).show()
                    // Vuốt xong → coi như đã check-in, backend sẽ không nhắc nữa
                    setLocalCheckinNow()
                    hideAlertPanel()
                } else {
                    Toast.makeText(
                        this,
                        "❌ Gửi thất bại. Thử lại sau.",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }.start()
    }

    // ============================================================
    // ================== SOUND / VIBRATION =======================
    // ============================================================

    private fun startAlertFeedback() {
        try {
            vibrator?.let { vib ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val effect = VibrationEffect.createWaveform(
                        longArrayOf(0, 500, 500),
                        0
                    )
                    vib.vibrate(effect)
                } else {
                    @Suppress("DEPRECATION")
                    vib.vibrate(longArrayOf(0, 500, 500), 0)
                }
            }

            if (ringtone == null) {
                val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                ringtone = RingtoneManager.getRingtone(applicationContext, uri)
            }
            ringtone?.play()
        } catch (e: Exception) {
            Log.w(TAG, "startAlertFeedback error: ${e.message}")
        }
    }

    private fun stopAlertFeedback() {
        try {
            vibrator?.cancel()
        } catch (_: Exception) {
        }
        try {
            ringtone?.stop()
        } catch (_: Exception) {
        }
    }

    private fun scheduleAutoHide() {
        cancelAutoHide()
        autoHideRunnable = Runnable {
            Log.d(TAG, "⏱ Auto-hide alert panel after timeout")
            hideAlertPanel()
        }
        autoHideHandler.postDelayed(autoHideRunnable!!, fullScreenTimeoutMs)
    }

    private fun cancelAutoHide() {
        autoHideRunnable?.let { autoHideHandler.removeCallbacks(it) }
        autoHideRunnable = null
    }

    // ============================================================
    // ================== NETWORK: CHECKIN / NOTIFY ===============
    // ============================================================

    private fun sendCheckin(choice: String): Boolean {
        Log.d(TAG, "📡 POST /api/deadman/checkin (choice=$choice) ...")
        return try {
            val t = token ?: return false
            val base = baseUrl ?: return false
            val url = URL("$base/api/deadman/checkin")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Authorization", "Bearer $t")
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connectTimeout = 10_000
                readTimeout = 10_000
                doOutput = true
                doInput = true
            }
            val body = JSONObject()
                .put("source", "mobile_overlay")
                .put("choice", choice)
                .toString()
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            if (code !in 200..299) {
                val err =
                    runCatching { conn.errorStream?.bufferedReader()?.use { it.readText() } }.getOrNull()
                Log.w(TAG, "checkin HTTP $code err=$err")
            }
            conn.disconnect()
            Log.d(TAG, "✅ HTTP $code")
            code in 200..299
        } catch (e: Exception) {
            Log.e(TAG, "🔥 ERROR ${e.message}")
            false
        }
    }

    private fun sendChoiceNotify(choice: String): Boolean {
        Log.d(TAG, "📡 POST /api/deadman/choice (choice=$choice) ...")
        return try {
            val t = token ?: return false
            val base = baseUrl ?: return false
            val url = URL("$base/api/deadman/choice")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Authorization", "Bearer $t")
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connectTimeout = 10_000
                readTimeout = 10_000
                doOutput = true
                doInput = true
            }
            val message = when (choice) {
                "safe" -> "Hôm nay người cao tuổi báo AN TOÀN: sức khỏe & tâm trạng tốt."
                "phys_unwell" -> "Người cao tuổi báo KHÔNG ỔN về SỨC KHỎE."
                else -> "Người cao tuổi báo KHÔNG ỔN về TÂM LÝ."
            }
            val body = JSONObject()
                .put("choice", choice)
                .put("message", message)
                .toString()
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            if (code !in 200..299) {
                val err =
                    runCatching { conn.errorStream?.bufferedReader()?.use { it.readText() } }.getOrNull()
                Log.w(TAG, "notify HTTP $code err=$err")
            }
            conn.disconnect()
            Log.d(TAG, "notify choice -> HTTP $code")
            code in 200..299
        } catch (e: Exception) {
            Log.w(TAG, "(optional) notify choice error: ${e.message}")
            false
        }
    }

    // ============================================================
    // ============ WATCHER & VISIBILITY DECISION =================
    // ============================================================

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch =
                NotificationChannel(CHANNEL_ID, "E-Care Overlay", NotificationManager.IMPORTANCE_MIN)
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(ch)
        }
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun startWatching() {
        if (watching) return
        watching = true
        watchHandler.post(watchTick)
    }

    private fun stopWatching() {
        watching = false
        watchHandler.removeCallbacks(watchTick)
    }

    private fun tickOnceImmediate() {
        try {
            fetchStatusSafe()
            applyVisibility()
        } catch (_: Exception) {
        }
    }

    private val watchTick = object : Runnable {
        override fun run() {
            try {
                fetchStatusSafe()
                applyVisibility()
            } catch (_: Exception) {
            } finally {
                if (watching) watchHandler.postDelayed(this, watchIntervalMs)
            }
        }
    }

    private fun applyVisibility() {
        val visible = shouldShowNow()

        Log.d(
            TAG, """
            [VISIBILITY]
            visible=$visible
            lastCheckinAt=$lastCheckinAt (local/server)
            server_zone=$tzId
            local_lastCheckinMs=${getLocalLastCheckinMs()}
        """.trimIndent()
        )

        if (visible) {
            showAlertPanel()
        } else {
            hideAlertPanel()
        }
    }

    private fun fetchStatusSafe() {
        try {
            val t = token ?: return
            val base = baseUrl ?: return
            val conn =
                (URL("$base/api/deadman/status").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    setRequestProperty("Authorization", "Bearer $t")
                    connectTimeout = 10_000
                    readTimeout = 10_000
                    doInput = true
                }
            val code = conn.responseCode
            if (code in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                val data = json.optJSONObject("data") ?: json
                val st = data.optJSONObject("deadmanState") ?: data
                val last = st.optString("lastCheckinAt", null)
                val serverMs =
                    last?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }
                val cfg = data.optJSONObject("deadmanConfig")
                val newTz = cfg?.optString("timezone", tzId) ?: tzId

                if (serverMs != null) {
                    lastCheckinAt = serverMs
                    saveLocalState(serverMs, newTz)
                }
                tzId = newTz
            }
            conn.disconnect()
        } catch (e: Exception) {
            Log.w(TAG, "fetchStatusSafe error: ${e.message}")
            restoreLocalState()
        }
    }

    /**
     * Logic hiển thị:
     *  - Nếu đã check-in → ẩn đến 07:00 sáng hôm sau
     *  - Nếu chưa check-in → chỉ hiển thị khi:
     *      + Đã qua ít nhất một mốc cửa sổ trong ngày (07:00 / 15:00 / 19:00)
     *      + Và chưa có check-in sau mốc đó
     */
    private fun shouldShowNow(): Boolean {
        if (token.isNullOrEmpty() || baseUrl.isNullOrEmpty()) {
            Log.d(TAG, "REASON: token/baseUrl missing → không thể hiển thị")
            return false
        }

        val zone = runCatching { ZoneId.of(tzId) }.getOrElse { ZoneId.of("Asia/Ho_Chi_Minh") }
        val now = ZonedDateTime.now(zone)

        val lastMs = lastCheckinAt ?: getLocalLastCheckinMs()
        if (lastMs != null) {
            val last = Instant.ofEpochMilli(lastMs).atZone(zone)

            val expiry =
                last.toLocalDate().plusDays(1).atTime(7, 0).atZone(zone)

            if (now.isBefore(expiry)) {
                Log.d(
                    TAG, """
                    REASON: Đã check-in và còn hiệu lực tới 07:00 hôm sau
                    lastCheckinAt=$last
                    expiry=$expiry
                    now=$now
                """.trimIndent()
                )
                return false
            }
        }

        var activeStart: ZonedDateTime? = null
        for (hm in DEADMAN_WINDOWS) {
            val parts = hm.split(":")
            val h = parts.getOrNull(0)?.toIntOrNull() ?: 0
            val m = parts.getOrNull(1)?.toIntOrNull() ?: 0
            val ws = now.withHour(h).withMinute(m).withSecond(0).withNano(0)
            if (!now.isBefore(ws)) {
                if (activeStart == null || ws.isAfter(activeStart)) activeStart = ws
            }
        }

        if (activeStart == null) {
            Log.d(
                TAG,
                "REASON: chưa tới bất kỳ khung giờ nào (${DEADMAN_WINDOWS.joinToString()}) now=$now"
            )
            return false
        }

        Log.d(
            TAG,
            "REASON: HIỂN THỊ — now=$now sau mốc=$activeStart và không có check-in còn hiệu lực."
        )
        return true
    }

    // ============================================================
    // ============= LOCAL STATE (SharedPreferences) ==============
    // ============================================================

    private fun getPrefs() = getSharedPreferences(PREFS, MODE_PRIVATE)

    private fun saveLocalState(lastMs: Long, zoneId: String) {
        getPrefs().edit()
            .putLong(KEY_LAST_CHECKIN_MS, lastMs)
            .putString(KEY_TZID, zoneId)
            .apply()
        lastCheckinAt = lastMs
        tzId = zoneId
    }

    private fun restoreLocalState() {
        val p = getPrefs()
        val ms =
            if (p.contains(KEY_LAST_CHECKIN_MS)) p.getLong(KEY_LAST_CHECKIN_MS, 0L) else null
        val tz = p.getString(KEY_TZID, tzId) ?: tzId
        if (ms != null && ms > 0) lastCheckinAt = ms
        tzId = tz
    }

    private fun getLocalLastCheckinMs(): Long? {
        val p = getPrefs()
        return if (p.contains(KEY_LAST_CHECKIN_MS)) p.getLong(KEY_LAST_CHECKIN_MS, 0L)
            .takeIf { it > 0 } else null
    }

    /** Ghi thời điểm check-in (khi vuốt) → ẩn tới 7h sáng hôm sau */
    private fun setLocalCheckinNow() {
        val zone = runCatching { ZoneId.of(tzId) }.getOrElse { ZoneId.of("Asia/Ho_Chi_Minh") }
        val nowMs = Instant.now().toEpochMilli()
        saveLocalState(nowMs, zone.id)
    }
}
