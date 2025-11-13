package com.mobile.floating

import com.mobile.R
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
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

        // SharedPreferences
        private const val PREFS = "deadman_prefs"
        private const val KEY_LAST_CHECKIN_MS = "last_checkin_ms"
        private const val KEY_TZID = "last_tz"
    }

    private var wm: WindowManager? = null
    private var bubble: View? = null
    private var token: String? = null
    private var baseUrl: String? = null

    // ====== Deadman windows & watcher ======
    private val DEADMAN_WINDOWS = arrayOf("07:00", "15:00", "19:00")
    private var tzId: String = "Asia/Ho_Chi_Minh"
    private var lastCheckinAt: Long? = null // epoch millis (server/local)
    private val watchHandler = Handler()
    private val watchIntervalMs = 60_000L
    private var watching = false

    // UI refs
    private var btnMain: TextView? = null
    private var panelChoices: LinearLayout? = null
    private var btnSafe: TextView? = null
    private var btnPhys: TextView? = null
    private var btnPsy: TextView? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "✅ onCreate")
        createNotificationChannel()
        val smallIcon = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info
        startForeground(
            NOTI_ID,
            NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(smallIcon)
                .setContentTitle("E-Care đang chạy")
                .setContentText("Nút 'Hôm nay tôi...' sẽ tự hiện đúng khung giờ")
                .setOngoing(true)
                .build()
        )

        // Khởi tạo local state từ SharedPreferences (để ẩn nút trong cùng ngày sau khi restart)
        restoreLocalState()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        token = intent?.getStringExtra(EXTRA_TOKEN)
        baseUrl = intent?.getStringExtra(EXTRA_BASEURL)
        Log.d(TAG, "➡️ onStartCommand token=$token baseUrl=$baseUrl")

        if (!Settings.canDrawOverlays(this)) {
            Log.e(TAG, "❌ Missing overlay permission")
            Toast.makeText(this, "Bật quyền 'Hiển thị trên ứng dụng khác'", Toast.LENGTH_LONG).show()
            stopSelf()
            return START_NOT_STICKY
        }

        showBubble()
        startWatching()      // tick định kỳ
        tickOnceImmediate()  // tick ngay để cập nhật visibility tức thì
        return START_STICKY
    }

    override fun onDestroy() {
        Log.d(TAG, "🛑 onDestroy")
        stopWatching()
        removeBubble()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun showBubble() {
        if (bubble != null) {
            Log.d(TAG, "⚠️ Bubble exists; skip")
            return
        }
        wm = getSystemService(WINDOW_SERVICE) as WindowManager

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else WindowManager.LayoutParams.TYPE_PHONE

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.END or Gravity.CENTER_VERTICAL
            x = 24
        }

        // ====== Container chung ======
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            // padding nhẹ để panel và nút không đè sát mép
            setPadding(dp(4), dp(2), dp(4), dp(2))
            setOnTouchListener(object : View.OnTouchListener {
                var ix = 0; var iy = 0; var tx = 0f; var ty = 0f
                override fun onTouch(v: View, e: MotionEvent): Boolean {
                    when (e.action) {
                        MotionEvent.ACTION_DOWN -> { ix = lp.x; iy = lp.y; tx = e.rawX; ty = e.rawY; return true }
                        MotionEvent.ACTION_MOVE -> { lp.x = ix - (e.rawX - tx).toInt(); lp.y = iy + (e.rawY - ty).toInt(); wm?.updateViewLayout(this@apply, lp); return true }
                    }
                    return false
                }
            })
        }

        // ====== Nút TỔNG: “Hôm nay tôi...” (to, dễ bấm) ======
        btnMain = TextView(this).apply {
            text = "Hôm nay tôi..."
            setTextColor(Color.WHITE)
            textSize = 22f
            setPadding(dp(30), dp(20), dp(30), dp(20))
            gravity = Gravity.CENTER
            setAllCaps(false)
            background = resources.getDrawable(R.drawable.button_background, null)
            // dùng tint để giữ bo tròn đẹp
            background.setTint(Color.parseColor("#0EA5E9")) // xanh dịu mắt
            // Bấm để mở/đóng panel lựa chọn
            setOnClickListener {
                val panel = panelChoices ?: return@setOnClickListener
                val show = panel.visibility != View.VISIBLE
                panel.alpha = if (show) 0f else 1f
                panel.visibility = View.VISIBLE
                panel.animate().alpha(if (show) 1f else 0f).setDuration(150).withEndAction {
                    if (!show) panel.visibility = View.GONE
                }.start()
            }
        }
        container.addView(btnMain)

        // ====== Panel 3 lựa chọn (ẩn mặc định) ======
        panelChoices = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            setPadding(dp(10), dp(8), dp(10), dp(8))
        }

        fun makeChoiceButton(label: String, bgColor: Int): TextView {
            return TextView(this).apply {
                // thêm emoji trực tiếp vào label để giữ nguyên chữ ký hàm
                val textLabel = label
                text = textLabel
                setTextColor(Color.WHITE)
                textSize = 20f
                setPadding(dp(24), dp(18), dp(24), dp(18))
                gravity = Gravity.CENTER
                setAllCaps(false)
                // giữ bo tròn từ drawable + tint màu thay vì setBackgroundColor
                background = resources.getDrawable(R.drawable.button_background, null)
                background.setTint(bgColor)
                val lpInner = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,   // full ngang cho dễ bấm
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = dp(10) }
                layoutParams = lpInner
            }
        }

        // Nhãn + màu tối ưu đọc + dễ hiểu
        btnSafe = makeChoiceButton("✅  Tôi ổn hôm nay", Color.parseColor("#16A34A"))            // xanh lá
        btnPhys = makeChoiceButton("❤️‍🩹  Không ổn về sức khỏe", Color.parseColor("#DC2626"))   // đỏ
        btnPsy  = makeChoiceButton("🧠  Không ổn về tâm lý", Color.parseColor("#2563EB"))        // xanh dương

        // Xử lý chọn từng nút
        btnSafe?.setOnClickListener { onChoiceClick("safe") }
        btnPhys?.setOnClickListener { onChoiceClick("phys_unwell") }
        btnPsy?.setOnClickListener  { onChoiceClick("psy_unwell") }

        panelChoices?.addView(btnSafe)
        panelChoices?.addView(btnPhys)
        panelChoices?.addView(btnPsy)

        container.addView(panelChoices)

        bubble = container
        wm?.addView(container, lp)
        Log.d(TAG, "🎉 Bubble shown (with choices)")
    }

    private fun removeBubble() {
        bubble?.let { wm?.removeView(it) }
        bubble = null
        btnMain = null
        panelChoices = null
        btnSafe = null
        btnPhys = null
        btnPsy = null
    }

    // ========== Hành vi khi chọn một tuỳ chọn ==========
    private fun onChoiceClick(choice: String) {
        Log.d(TAG, "👆 Choice: $choice — sending")
        // Vô hiệu để tránh double tap
        disableChoiceUI()

        Thread {
            val okCheckin = sendCheckin(choice)
            val okNotify  = sendChoiceNotify(choice) // nếu 404 coi như false, không lỗi app
            Handler(mainLooper).post {
                if (okCheckin) {
                    Toast.makeText(
                        this,
                        when (choice) {
                            "safe" -> "✅ Đã xác nhận: An toàn"
                            "phys_unwell" -> "📩 Đã báo: Không ổn về sức khỏe"
                            else -> "💬 Đã báo: Không ổn về tâm lý"
                        },
                        Toast.LENGTH_SHORT
                    ).show()
                    // Cập nhật local để ẩn nút tới hết ngày
                    setLocalCheckinNow()
                    hideAllButtonsToday()
                } else {
                    Toast.makeText(this, "❌ Gửi thất bại. Thử lại sau.", Toast.LENGTH_SHORT).show()
                    enableChoiceUI()
                }
            }
        }.start()
    }

    private fun hideAllButtonsToday() {
        btnMain?.visibility = View.GONE
        panelChoices?.visibility = View.GONE
        btnSafe?.visibility = View.GONE
        btnPhys?.visibility = View.GONE
        btnPsy?.visibility = View.GONE
    }

    private fun disableChoiceUI() {
        btnMain?.isEnabled = false
        btnSafe?.isEnabled = false
        btnPhys?.isEnabled = false
        btnPsy?.isEnabled = false
    }
    private fun enableChoiceUI() {
        btnMain?.isEnabled = true
        btnSafe?.isEnabled = true
        btnPhys?.isEnabled = true
        btnPsy?.isEnabled = true
    }

    // ========== Gửi checkin (có kèm lựa chọn) ==========
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
                .put("choice", choice) // safe | phys_unwell | psy_unwell
                .toString()
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            if (code !in 200..299) {
                val err = runCatching { conn.errorStream?.bufferedReader()?.use { it.readText() } }.getOrNull()
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

    // ========== Gửi thông báo người thân theo tuỳ chọn ==========
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
                val err = runCatching { conn.errorStream?.bufferedReader()?.use { it.readText() } }.getOrNull()
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

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID,
                "E-Care Overlay",
                NotificationManager.IMPORTANCE_MIN
            )
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(ch)
        }
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    // ================= Watcher & quyết định hiển thị =================
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
            fetchStatusSafe() // lấy server state nếu có
            applyVisibility()
        } catch (_: Exception) {}
    }

    private val watchTick = object : Runnable {
        override fun run() {
            try {
                fetchStatusSafe()
                applyVisibility()
            } catch (_: Exception) { }
            finally {
                if (watching) watchHandler.postDelayed(this, watchIntervalMs)
            }
        }
    }

    private fun applyVisibility() {
        val visible = shouldShowNow()

        Log.d(TAG, """
        [VISIBILITY]
        visible=$visible
        lastCheckinAt=$lastCheckinAt (local)
        server_zone=$tzId
        local_lastCheckinMs=${getLocalLastCheckinMs()}
        """.trimIndent()
        )

        if (visible) {
            Log.d(TAG, "→ SHOW BUTTON (đang trong khung giờ & chưa check-in trong khung này)")
            btnMain?.visibility = View.VISIBLE
            panelChoices?.visibility = View.GONE
            btnSafe?.visibility = View.VISIBLE
            btnPhys?.visibility = View.VISIBLE
            btnPsy?.visibility = View.VISIBLE
            enableChoiceUI()
        } else {
            Log.d(TAG, "→ HIDE BUTTON (đã check-in hôm nay hoặc chưa tới giờ)")
            hideAllButtonsToday()
        }
    }

    private fun fetchStatusSafe() {
        try {
            val t = token ?: return
            val base = baseUrl ?: return
            val conn = (URL("$base/api/deadman/status").openConnection() as HttpURLConnection).apply {
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
                val serverMs = last?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }
                val cfg = data.optJSONObject("deadmanConfig")
                val newTz = cfg?.optString("timezone", tzId) ?: tzId

                // ⬇️ QUAN TRỌNG: Server là nguồn quyết định.
                // - Nếu server trả thời điểm check-in → ghi đè local (ẩn đến hết ngày).
                // - Nếu server KHÔNG có (null) → xóa local cache để HIỆN lại (nếu đang trong cửa sổ).
                if (serverMs != null) {
                    lastCheckinAt = serverMs
                    saveLocalState(serverMs, newTz)
                } else {
                    // Reset DB → không có check-in: xóa local để không bị ẩn oan.
                    clearLocalState(newTz)
                    lastCheckinAt = null
                }
                tzId = newTz
            }
            conn.disconnect()
        } catch (e: Exception) {
            Log.w(TAG, "fetchStatusSafe error: ${e.message}")
            // offline → vẫn dùng local fallback
            restoreLocalState()
        }
    }

    // Chỉ hiện khi:
    //  - ĐANG ở sau một mốc bắt đầu cửa sổ (07:00/15:00/19:00 HÔM NAY)
    //  - VÀ chưa có check-in sau mốc cửa sổ đó (theo server hoặc local fallback)
    private fun shouldShowNow(): Boolean {
        if (token.isNullOrEmpty() || baseUrl.isNullOrEmpty()) {
            Log.d(TAG, "REASON: token/baseUrl missing → không thể hiển thị")
            return false
        }

        val zone = runCatching { ZoneId.of(tzId) }.getOrElse { ZoneId.of("Asia/Ho_Chi_Minh") }
        val now = ZonedDateTime.now(zone)

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
            Log.d(TAG, "REASON: chưa tới bất kỳ khung giờ nào (${DEADMAN_WINDOWS.joinToString()}) now=$now")
            return false
        }

        val lastMs = lastCheckinAt ?: getLocalLastCheckinMs()
        if (lastMs != null) {
            val last = Instant.ofEpochMilli(lastMs).atZone(zone)
            if (!last.isBefore(activeStart)) {
                Log.d(TAG, """
                REASON: Đã check-in trong hoặc sau khung giờ này
                lastCheckinAt=$last
                activeStart=$activeStart
            """.trimIndent())
                return false
            }
        }

        Log.d(TAG, "REASON: HIỂN THỊ — now=$now sau mốc=$activeStart và chưa check-in sau mốc.")
        return true
    }


    // ================= Local fallback (giữ ẩn trong cùng ngày) =================
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
        val ms = if (p.contains(KEY_LAST_CHECKIN_MS)) p.getLong(KEY_LAST_CHECKIN_MS, 0L) else null
        val tz = p.getString(KEY_TZID, tzId) ?: tzId
        if (ms != null && ms > 0) lastCheckinAt = ms
        tzId = tz
    }

    // ✅ Thêm hàm clearLocalState để khi DB reset (server null) thì xóa cache local
    private fun clearLocalState(zoneId: String) {
        getPrefs().edit()
            .remove(KEY_LAST_CHECKIN_MS)
            .putString(KEY_TZID, zoneId)
            .apply()
    }

    private fun getLocalLastCheckinMs(): Long? {
        val p = getPrefs()
        return if (p.contains(KEY_LAST_CHECKIN_MS)) p.getLong(KEY_LAST_CHECKIN_MS, 0L).takeIf { it > 0 } else null
    }

    // gọi khi bấm lựa chọn -> coi như check-in của ngày
    private fun setLocalCheckinNow() {
        val zone = runCatching { ZoneId.of(tzId) }.getOrElse { ZoneId.of("Asia/Ho_Chi_Minh") }
        val nowMs = Instant.now().toEpochMilli()
        saveLocalState(nowMs, zone.id)
    }
}
