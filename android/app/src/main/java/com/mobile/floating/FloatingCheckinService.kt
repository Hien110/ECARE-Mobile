package com.mobile.floating

import com.mobile.R
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
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
    // ✅ Ưu tiên coi đây là giá trị lấy từ SERVER (ElderlyProfile.deadmanState.lastCheckinAt)
    private var lastCheckinAt: Long? = null // epoch millis (server-based, có thể sync giữa nhiều device)

    // Watcher tick
    private val watchHandler = Handler(Looper.getMainLooper())
    private val watchIntervalMs = 60_000L
    private var watching = false

    // Auto-hide full-screen panel (giữ cấu trúc, không dùng auto-hide nữa)
    private val fullScreenTimeoutMs = 20 * 60 * 1000L
    private val autoHideHandler = Handler(Looper.getMainLooper())
    private var autoHideRunnable: Runnable? = null

    // Âm thanh & rung
    private var ringtone: Ringtone? = null
    private var vibrator: Vibrator? = null

    // Hẹn giờ dừng chuông + rung sau 1 phút
    private val alertFeedbackHandler = Handler(Looper.getMainLooper())
    private var stopFeedbackRunnable: Runnable? = null
    private val feedbackDurationMs = 60_000L

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

        // Kiểm tra quyền overlay
        if (!Settings.canDrawOverlays(this)) {
            Log.e(TAG, "❌ Missing overlay permission")
            Toast.makeText(
                this,
                "Bật quyền 'Hiển thị trên ứng dụng khác'",
                Toast.LENGTH_LONG
            ).show()
            stopSelf()
            return START_NOT_STICKY
        }

        // Khởi tạo WindowManager
        wm = getSystemService(WINDOW_SERVICE) as WindowManager

        // Bắt đầu watcher
        startWatching()

        // 🔁 Delay một chút sau khi Activity resume để tránh crash khi vừa bật quyền overlay
        if (Settings.canDrawOverlays(this)) {
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    tickOnceImmediate()
                } catch (e: Exception) {
                    Log.e(TAG, "tickOnceImmediate error: ${e.message}")
                }
            }, 200)
        }

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

        // Nền gradient: nửa trên xanh lá, nửa dưới đỏ (đậm hơn một chút)
        val gradient = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(
                Color.parseColor("#A7F3D0"), // xanh lá nhạt nhưng đậm hơn D1FAE5
                Color.parseColor("#FECACA")  // đỏ nhạt nhưng đậm hơn FEE2E2
            )
        )

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = gradient
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(24), dp(24), dp(24))
        }

        // Khối nội dung chiếm toàn màn, để chia top/bottom bằng weight
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        }

        // Tiêu đề ở trên cùng, căn giữa
        val title = TextView(this).apply {
            text = "Nhắc kiểm tra an toàn"
            setTextColor(Color.parseColor("#111827"))
            textSize = 34f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(16))
        }
        content.addView(title)

        // Vùng chia 3 phần: Bác khỏe (top) – nút vuốt (giữa) – Bác không khỏe (bottom)
        val centerContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }

        // Text "Bác khỏe" – nửa trên (vùng xanh)
        val healthyText = TextView(this).apply {
            text = "Bác khỏe"
            setTextColor(Color.parseColor("#047857")) // xanh đậm hơn
            textSize = 38f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            ).apply {
                bottomMargin = dp(8)
            }
        }
        centerContainer.addView(healthyText)

        // Vùng giữa chứa nút VUỐT (chiều cao riêng, không weight)
        val gestureWrapper = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(8)
                bottomMargin = dp(8)
            }
        }

        // Nút VUỐT – kéo dài theo chiều ngang, chữ rất to
        val gestureArea = TextView(this).apply {
            text = "VUỐT"
            setTextColor(Color.WHITE)
            textSize = 40f
            gravity = Gravity.CENTER
            // Padding ngang lớn hơn + MATCH_PARENT để swipe area rộng
            setPadding(dp(32), dp(24), dp(32), dp(24))

            val bg = resources.getDrawable(R.drawable.button_background, null)
            bg.setTint(Color.parseColor("#F59E0B")) // cam ấm
            background = bg
        }
        val gestureParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,   // full chiều ngang
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.CENTER_HORIZONTAL
        }
        gestureArea.layoutParams = gestureParams
        gestureWrapper.addView(gestureArea)
        centerContainer.addView(gestureWrapper)

        // Text "Bác không khỏe" – nửa dưới (vùng đỏ)
        val unwellText = TextView(this).apply {
            text = "Bác không khỏe"
            setTextColor(Color.parseColor("#B91C1C")) // đỏ đậm hơn
            textSize = 38f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            ).apply {
                topMargin = dp(8)
            }
        }
        centerContainer.addView(unwellText)

        content.addView(centerContainer)
        root.addView(content)

        // ===== GESTURE TOÀN MÀN HÌNH: vuốt ở đâu cũng điều khiển nút VUỐT =====
        root.setOnTouchListener(object : View.OnTouchListener {
            var startY = 0f
            var originalTranslationY = 0f

            override fun onTouch(v: View, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        startY = event.rawY
                        originalTranslationY = gestureArea.translationY
                        return true
                    }

                    MotionEvent.ACTION_MOVE -> {
                        val dy = event.rawY - startY
                        val maxOffset = dp(80).toFloat()
                        val newTrans = (originalTranslationY + dy).coerceIn(-maxOffset, maxOffset)
                        // chỉ di chuyển nút, không di chuyển nền
                        gestureArea.translationY = newTrans
                        return true
                    }

                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        val dy = event.rawY - startY
                        val threshold = dp(40).toFloat()

                        when {
                            dy < -threshold -> {
                                // Vuốt lên: bác khỏe
                                gestureArea.animate()
                                    .translationY(originalTranslationY - dp(60))
                                    .setDuration(150)
                                    .withEndAction {
                                        onSwipeChoice("safe")
                                        gestureArea.translationY = originalTranslationY
                                    }
                                    .start()
                            }

                            dy > threshold -> {
                                // Vuốt xuống: bác không khỏe
                                gestureArea.animate()
                                    .translationY(originalTranslationY + dp(60))
                                    .setDuration(150)
                                    .withEndAction {
                                        onSwipeChoice("phys_unwell")
                                        gestureArea.translationY = originalTranslationY
                                    }
                                    .start()
                            }

                            else -> {
                                // Không đủ độ vuốt → đưa nút về vị trí cũ
                                gestureArea.animate()
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
        Log.d(TAG, "🎉 Alert panel shown (green/red background with centered texts)")

        // Bắt đầu rung + chuông (1 phút), màn hình giữ nguyên
        startAlertFeedback()
        // KHÔNG auto-hide panel nữa, chỉ khi bác vuốt mới ẩn
    }

    /** Ẩn màn hình cảnh báo */
    private fun hideAlertPanel() {
        val wmLocal = wm

        overlayView?.let { view ->
            try {
                // Dùng removeViewImmediate() để tránh crash khi overlay chưa attach / Activity đang destroy
                wmLocal?.removeViewImmediate(view)
                Log.d(TAG, "🧹 Overlay removed safely")
            } catch (e: Exception) {
                Log.w(TAG, "⚠️ removeView error: ${e.message}")
            }
        }

        // Reset biến
        overlayView = null

        // Dừng auto hide và feedback
        cancelAutoHide()
        stopAlertFeedback()
    }

    // ============================================================
    // ================== SWIPE ACTION HANDLING ===================
    // ============================================================

    /** Người dùng vuốt chọn */
    private fun onSwipeChoice(choice: String) {
        Log.d(TAG, "👆 Swipe choice: $choice — sending")

        // 🆕 Nếu vuốt xuống (phys_unwell) → xử lý đặc biệt
        if (choice == "phys_unwell") {
            Thread {
                // 1. Gửi checkin để đánh dấu đã vuốt (cập nhật lastCheckinAt trên SERVER)
                val okCheckin = sendCheckin(choice)

                Handler(Looper.getMainLooper()).post {
                    if (okCheckin) {
                        Toast.makeText(
                            this,
                            "🚨 Đang gửi cảnh báo khẩn cấp...",
                            Toast.LENGTH_SHORT
                        ).show()

                        // 2. Lưu timestamp local + cập nhật lastCheckinAt trên THIẾT BỊ NÀY
                        //    (thiết bị khác sẽ sync qua fetchStatusSafe() từ server)
                        setLocalCheckinNow()

                        // 3. Ẩn panel (dừng chuông + rung)
                        hideAlertPanel()

                        // 4. Emit event sang React Native để gọi handleEmergency
                        try {
                            FloatingCheckinModule.sendEmergencyEvent(choice)
                            Log.d(TAG, "✅ Emitted emergency event to React Native")
                        } catch (e: Exception) {
                            Log.e(TAG, "❌ Failed to emit event: ${e.message}")
                        }
                    } else {
                        Toast.makeText(
                            this,
                            "❌ Gửi thất bại. Thử lại sau.",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            }.start()
            return // Kết thúc xử lý cho phys_unwell
        }

        // Xử lý cho các choice khác (safe, etc.)
        Thread {
            // 1. Gửi checkin để cập nhật lastCheckinAt trên SERVER
            val okCheckin = sendCheckin(choice)
            // 2. Gửi choice notify (optional)
            val okNotify = sendChoiceNotify(choice)

            Handler(Looper.getMainLooper()).post {
                if (okCheckin) {
                    Toast.makeText(
                        this,
                        when (choice) {
                            "safe" -> "✅ Đã xác nhận: Hôm nay an toàn"
                            else -> "💬 Đã báo"
                        },
                        Toast.LENGTH_SHORT
                    ).show()
                    // Vuốt xong → đánh dấu đã check-in cho KHUNG GIỜ HIỆN TẠI trên THIẾT BỊ NÀY
                    // Thiết bị khác sẽ đọc cùng lastCheckinAt từ server
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
            // Hủy hẹn cũ nếu có
            stopFeedbackRunnable?.let { alertFeedbackHandler.removeCallbacks(it) }
            stopFeedbackRunnable = null

            vibrator?.let { vib ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val effect = VibrationEffect.createWaveform(
                        longArrayOf(0, 500, 500),
                        0 // lặp
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

            // Hẹn dừng chuông + rung sau 1 phút
            stopFeedbackRunnable = Runnable {
                stopAlertFeedback()
            }
            alertFeedbackHandler.postDelayed(stopFeedbackRunnable!!, feedbackDurationMs)
        } catch (e: Exception) {
            Log.w(TAG, "startAlertFeedback error: ${e.message}")
        }
    }

    private fun stopAlertFeedback() {
        // Hủy hẹn dừng nếu còn
        stopFeedbackRunnable?.let { alertFeedbackHandler.removeCallbacks(it) }
        stopFeedbackRunnable = null

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
        // Giữ nguyên hàm để không phá cấu trúc, nhưng không dùng nữa
        cancelAutoHide()
        autoHideRunnable = Runnable {
            Log.d(TAG, "⏱ Auto-hide alert panel after timeout (unused)")
            hideAlertPanel()
        }
        // Không postDelayed ở đây
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
            lastCheckinAt=$lastCheckinAt (server-based/local copy)
            server_zone=$tzId
            local_lastCheckinMs=${getLocalLastCheckinMs()}
        """.trimIndent()
        )

        if (visible) {
            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    showAlertPanel()
                } catch (e: Exception) {
                    Log.e(TAG, "Overlay show error: ${e.message}")
                }
            }, 150)
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

                // ✅ Lấy lastCheckinAt từ SERVER để mọi device cùng xài chung
                if (serverMs != null) {
                    lastCheckinAt = serverMs
                    saveLocalState(serverMs, newTz)
                }
                tzId = newTz
            }
            conn.disconnect()
        } catch (e: Exception) {
            Log.w(TAG, "fetchStatusSafe error: ${e.message}")
            // Offline → fallback dùng state local của CHÍNH THIẾT BỊ NÀY
            restoreLocalState()
        }
    }

    /**
     * Logic hiển thị (multi-device, server-based):
     *
     * 1) Nếu CHƯA TỪNG check-in (lastCheckinAt == null):
     *      → LUÔN HIỂN THỊ trên mọi thiết bị (miễn có token + baseUrl).
     *
     * 2) Nếu ĐÃ có ít nhất 1 lần check-in:
     *      - Mỗi THIẾT BỊ sẽ đọc cùng một lastCheckinAt từ SERVER
     *        (ElderlyProfile.deadmanState.lastCheckinAt).
     *      - Xét các mốc 07:00 / 15:00 / 19:00 của NGÀY HIỆN TẠI.
     *      - Lấy mốc gần nhất mà now >= mốc đó (activeStart).
     *      - Nếu:
     *          + lastCheckinAt < activeStart → HIỂN THỊ (chưa vuốt trong KHUNG GIỜ HIỆN TẠI).
     *          + lastCheckinAt >= activeStart → KHÔNG HIỂN THỊ (đã vuốt ở ÍT NHẤT 1 THIẾT BỊ;
     *              các thiết bị khác cũng thấy ẩn vì xài chung lastCheckinAt).
     *
     *  ✅ Quan trọng:
     *      - Trong shouldShowNow() KHÔNG dùng getLocalLastCheckinMs() nữa,
     *        để tránh mỗi máy tự suy đoán khác nhau.
     *      - Đồng bộ dựa trên giá trị lastCheckinAt từ server → nhiều máy / nhiều wifi vẫn đúng.
     */
    private fun shouldShowNow(): Boolean {
        if (token.isNullOrEmpty() || baseUrl.isNullOrEmpty()) {
            Log.d(TAG, "REASON: token/baseUrl missing → không thể hiển thị")
            return false
        }

        // 1) Ưu tiên kiểm tra trạng thái "chưa từng check-in" dựa trên SERVER
        val lastMs = lastCheckinAt
        if (lastMs == null) {
            Log.d(TAG, "REASON: chưa từng check-in → luôn hiển thị panel trên mọi thiết bị")
            return true
        }

        // 2) Đã có ít nhất một lần check-in → dùng logic khung giờ dựa trên server
        val zone = runCatching { ZoneId.of(tzId) }.getOrElse { ZoneId.of("Asia/Ho_Chi_Minh") }
        val now = ZonedDateTime.now(zone)

        // Tìm mốc khung giờ gần nhất trong ngày hiện tại mà now >= mốc đó
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
                "REASON: đã có check-in trước đó nhưng chưa tới bất kỳ khung giờ nào (${DEADMAN_WINDOWS.joinToString()}) now=$now"
            )
            return false
        }

        val last = Instant.ofEpochMilli(lastMs).atZone(zone)

        return if (last.isBefore(activeStart)) {
            Log.d(
                TAG, """
                REASON: lastCheckinAt=$last < activeStart=$activeStart
                → CHƯA check-in cho khung giờ hiện tại → HIỂN THỊ trên mọi thiết bị
            """.trimIndent()
            )
            true
        } else {
            Log.d(
                TAG, """
                REASON: lastCheckinAt=$last >= activeStart=$activeStart
                → ĐÃ check-in ở ÍT NHẤT 1 thiết bị cho khung giờ này
                → TẤT CẢ thiết bị khác cũng ẩn panel
            """.trimIndent()
            )
            false
        }
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

    /** Ghi thời điểm check-in (khi vuốt) → dùng để panel tắt ngay trên THIẾT BỊ NÀY,
     *  sau đó server sẽ lưu lastCheckinAt và các device khác sync qua fetchStatusSafe(). */
    private fun setLocalCheckinNow() {
        val zone = runCatching { ZoneId.of(tzId) }.getOrElse { ZoneId.of("Asia/Ho_Chi_Minh") }
        val nowMs = Instant.now().toEpochMilli()
        saveLocalState(nowMs, zone.id)
    }
}
