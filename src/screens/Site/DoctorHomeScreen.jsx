// src/screens/DoctorHomeScreen.jsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { doctorService } from "../../services/doctorService";
import userService from "../../services/userService";
import doctorBookingService from "../../services/doctorBookingService";

const { width: SCREEN_W } = Dimensions.get("window");
const isSmall = SCREEN_W < 360;

function mapJsDayToSchema(dayIdx) {
  if (dayIdx === 0) return 8;
  return dayIdx + 1;
}
function timeRangeStr(slot) {
  return `${slot?.start || "--:--"} - ${slot?.end || "--:--"}`;
}

const Tag = ({ children, type = "primary", size = "md" }) => {
  const map = {
    primary: styles.tagPrimary,
    success: styles.tagSuccess,
    warn: styles.tagWarn,
    danger: styles.tagDanger,
    info: styles.tagInfo,
    gray: styles.tagGray,
    blue: styles.tagBlue,
  };
  const isSm = size === "sm";
  return (
    <View style={[isSm ? styles.tagBaseSm : styles.tagBase, map[type] || map.primary]}>
      <Text style={isSm ? styles.tagTextSm : styles.tagText}>{children}</Text>
    </View>
  );
};

const CompletionBar = ({ total, done }) => {
  const safePercent =
    total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;

  return (
    <View style={{ marginTop: 10, width: "100%" }}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${safePercent}%` }]} />
      </View>
      <Text style={styles.progressText}>{safePercent}% hoàn thành</Text>
    </View>
  );
};

const StatItem = ({
  icon,
  value,
  label,
  bgColor = "#0B5FFF",
  textColor = "#0f172a",
  showProgress = false,
  total = 0,
  done = 0,
}) => {
  const display =
    typeof value === "number"
      ? Number.isInteger(value)
        ? value
        : value.toFixed(1)
      : value ?? "—";

  return (
    <View style={styles.statItem}>
      <View style={[styles.statIconWrap, { backgroundColor: bgColor }]}>
        <Text style={styles.statIconEmoji}>{icon}</Text>
      </View>
      <Text style={[styles.statValue, { color: textColor }]} numberOfLines={1}>
        {display}
      </Text>
      <Text style={styles.statCaption} numberOfLines={1}>
        {label}
      </Text>
      {showProgress && <CompletionBar total={total} done={done} />}
    </View>
  );
};

const normalizeStatusKey = (rawStatus) => {
  const raw = (rawStatus || "").toString().toLowerCase().trim();
  if (!raw) return "pending";
  if (["pending", "wait", "waiting", "unconfirmed"].includes(raw)) return "pending";
  if (["confirmed", "accepted", "xacnhan", "xac_nhan"].includes(raw)) return "confirmed";
  if (["in_progress", "in-progress", "ongoing"].includes(raw)) return "in_progress";
  if (["completed", "done", "finished"].includes(raw)) return "completed";
  if (["canceled", "cancelled", "huy"].includes(raw)) return "canceled";
  return "default";
};

const getStatusInfo = (rawStatus) => {
  const key = normalizeStatusKey(rawStatus);
  switch (key) {
    case "pending":
      return { key, label: "Chờ xác nhận", tagType: "blue" };
    case "confirmed":
      return { key, label: "Chờ khám", tagType: "success" };
    case "in_progress":
      return { key, label: "Đang tiến hành", tagType: "info" };
    case "completed":
      return { key, label: "Hoàn thành", tagType: "success" };
    case "canceled":
      return { key, label: "Đã hủy", tagType: "danger" };
    default:
      return { key, label: "Khác", tagType: "gray" };
  }
};

const getPaymentInfoFromBooking = (booking) => {
  const rawMethod = (
    booking?.paymentMethod ||
    booking?.payment?.method ||
    booking?.payment?.paymentMethod ||
    booking?.consultation?.payment?.method ||
    ""
  )
    .toString()
    .toLowerCase();

  if (!rawMethod) return { label: null, tagType: "gray" };

  if (["qr", "online", "bank_transfer", "bank-transfer"].includes(rawMethod)) {
    return { label: "Đã trả trước", tagType: "info" };
  }
  if (["cash", "tienmat", "tiền mặt"].includes(rawMethod)) {
    return { label: "Tiền mặt", tagType: "primary" };
  }
  return { label: "Khác", tagType: "gray" };
};

const DoctorHomeScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);
  const [rating, setRating] = useState({ averageRating: 0, totalRatings: 0 });
  const [activeApptTab, setActiveApptTab] = useState("today");
  const [errorMsg, setErrorMsg] = useState("");
  const [appointmentsToday, setAppointmentsToday] = useState([]);
  const [appointmentsUpcoming, setAppointmentsUpcoming] = useState([]);
  const navigate = useNavigation();

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const user = await userService.getUser();
      const userId = user?.data?._id;
      const role = user?.data?.role;

      if (!userId) {
        setErrorMsg("Chưa đăng nhập hoặc thiếu thông tin người dùng.");
        setProfile(null);
        return;
      }
      if (role !== "doctor") {
        setErrorMsg("Tài khoản hiện tại không phải bác sĩ.");
        setProfile(null);
        return;
      }

      const [p, r] = await Promise.all([
        doctorService.getProfileByUserId(userId),
        doctorService.getMyRatingStats(),
      ]);

      if (p?.success) setProfile(p.data);
      else setErrorMsg(p?.message || "Không thể tải hồ sơ bác sĩ.");

      if (r?.success) setRating(r.data || { averageRating: 0, totalRatings: 0 });

      const bookingsRes = await doctorBookingService.getMyBookings();
      if (bookingsRes?.success && Array.isArray(bookingsRes.data)) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const today = [];
        const upcoming = [];

        bookingsRes.data.forEach((b) => {
          const when = b.scheduledDate ? new Date(b.scheduledDate) : null;
          if (!when) return;

          const isToday = when >= startOfToday && when <= endOfToday;

          let timeLabel = "--:--";
          if (b.slot === "morning") timeLabel = "8h - 11h";
          else if (b.slot === "afternoon") timeLabel = "14h - 16h";

          const { key: statusKey, label: statusLabel, tagType: statusTagType } = getStatusInfo(b.status);
          const { label: paymentLabel, tagType: paymentTagType } = getPaymentInfoFromBooking(b);

          const dob = b.beneficiary?.dateOfBirth ? new Date(b.beneficiary.dateOfBirth) : null;
          const computedAge = dob ? new Date().getFullYear() - dob.getFullYear() : "";

          const idStr = String(b._id || "");
          const bookingCode = idStr ? idStr.slice(-6) : "";

          const elderlyName = b.beneficiary?.fullName || "Người cao tuổi";
          const elderlyAddress = b.beneficiary?.currentAddress || "";
          const registrantName = b.registrant?.fullName || b.registrant?.name || "Người đặt lịch";

          const dateLabel = when.toLocaleDateString("vi-VN");

          const item = {
            id: idStr,
            bookingCode,
            elderlyName,
            registrantName,
            elderlyAvatar: b.beneficiary?.avatar || null,
            registrantAvatar: b.registrant?.avatar || null,
            elderlyAddress,
            age: computedAge,
            gender: b.beneficiary?.gender || "",
            dob: b.beneficiary?.dateOfBirth || null,
            scheduledDate: b.scheduledDate || null,
            slot: b.slot || null,
            type: b.slot === "morning" ? "Buổi sáng" : b.slot === "afternoon" ? "Buổi chiều" : "",
            time: timeLabel,
            dateLabel,
            status: statusLabel,
            statusKey,
            statusTagType,
            paymentLabel,
            paymentTagType,
            cancelReason: (b.cancelReason || "").toString().trim(),
            note: (b.note || "").toString().trim(),
          };

          if (isToday) today.push(item);
          else if (when > endOfToday) upcoming.push(item);
        });

        setAppointmentsToday(today);
        setAppointmentsUpcoming(upcoming);
      } else {
        setAppointmentsToday([]);
        setAppointmentsUpcoming([]);
      }
    } catch (e) {
      setErrorMsg(e?.message || "Đã xảy ra lỗi không xác định.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const todaySlots = useMemo(() => {
    if (!profile?.schedule?.length) return [];
    const now = new Date();
    const schemaDay = mapJsDayToSchema(now.getDay());
    const found = profile.schedule.find((d) => Number(d.dayOfWeek) === schemaDay);
    return (found?.timeSlots || []).map((s, idx) => ({
      key: `${schemaDay}-${idx}`,
      ...s,
    }));
  }, [profile]);

  const workingHourStr = useMemo(() => {
    if (!todaySlots.length) return "—";
    const first = todaySlots[0];
    const last = todaySlots[todaySlots.length - 1];
    return `${first.start} - ${last.end}`;
  }, [todaySlots]);

  const doctorName = profile?.user?.fullName || "—";
  const avatarUrl = profile?.user?.avatar || null;
  const specialization = profile?.specializations || "—";
  const hospital = profile?.hospitalName || "—";
  const expYears = profile?.experience ?? 0;

  const statsToday = {
    total: appointmentsToday.length,
    done: appointmentsToday.filter((a) => a.statusKey === "completed").length,
    processing: appointmentsToday.filter((a) =>
      ["pending", "confirmed", "in_progress"].includes(a.statusKey)
    ).length,
    workingHours: workingHourStr,
  };

  const appts = activeApptTab === "today" ? appointmentsToday : appointmentsUpcoming;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ====== TOP (bỏ phần E-CARE header) ====== */}
        <View style={styles.topRow}>
          {/* <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Trang bác sĩ</Text>
            <Text style={styles.pageSub}>Theo dõi lịch khám và lịch làm việc</Text>
          </View> */}

          {/* <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigate.navigate("CreateWorkSchedule")}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Chỉnh lịch</Text>
          </TouchableOpacity> */}
        </View>

        {!!errorMsg && (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* ====== Profile card ====== */}
        <View style={[styles.card, styles.cardTight]}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{doctorName?.charAt(0)?.toUpperCase() || "D"}</Text>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.doctorTitle}>Bác sĩ</Text>
              <Text style={styles.doctorName} numberOfLines={1}>
                {doctorName}
              </Text>
              <Text style={styles.doctorSub} numberOfLines={2}>
                {specialization} • {hospital}
              </Text>

              <View style={styles.metaRow}>
                <Tag size="sm" type="success">
                  ⭐ {Number(rating?.averageRating || 0).toFixed(1)}
                </Tag>
                <Text style={styles.metaText}>{rating?.totalRatings || 0} đánh giá</Text>
                <Tag size="sm" type="gray">
                  {expYears} năm KN
                </Tag>
              </View>
            </View>
          </View>
        </View>

        {/* ====== Stats ====== */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Thống kê hôm nay</Text>
          <Tag size="sm" type="gray">
            {new Date().toLocaleDateString("vi-VN")}
          </Tag>
        </View>

        <View style={styles.card}>
          <View style={styles.statsGrid}>
            <StatItem icon="📅" value={statsToday.total} label="Tổng lịch hẹn" bgColor="#0B5FFF" />
            <StatItem
              icon="✅"
              value={statsToday.done}
              label="Đã hoàn thành"
              bgColor="#2AC670"
              showProgress
              total={statsToday.total}
              done={statsToday.done}
            />
            <StatItem icon="🕒" value={statsToday.processing} label="Chờ xử lý" bgColor="#FF8A34" />
            <StatItem
              icon="⏱️"
              value={statsToday.workingHours}
              label="Giờ làm việc"
              bgColor="#E5E7EB"
              textColor="#6B7280"
            />
          </View>
        </View>

        {/* ====== Working slots ====== */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lịch làm việc hôm nay</Text>
        </View>

        <View style={styles.slotWrap}>
          {loading ? (
            <Text style={styles.muted}>Đang tải lịch…</Text>
          ) : todaySlots.length ? (
            todaySlots.map((slot) => (
              <View
                key={slot.key}
                style={[
                  styles.slot,
                  slot.isAvailable === false ? styles.slotDisabled : styles.slotFree,
                ]}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text
                    style={[
                      styles.slotText,
                      slot.isAvailable === false && styles.slotTextDisabled,
                    ]}
                  >
                    {timeRangeStr(slot)}
                  </Text>
                  <Text style={styles.slotSub}>
                    {slot.isAvailable === false ? "Không khả dụng" : "Khả dụng"}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Tag
                    size="sm"
                    type={
                      slot.consultationType === "online"
                        ? "info"
                        : slot.consultationType === "offline"
                        ? "warn"
                        : "primary"
                    }
                  >
                    {slot.consultationType || "—"}
                  </Tag>
                  <View style={{ width: 8 }} />
                  <Tag size="sm" type="gray">
                    Max {slot?.maxPatients ?? 1}
                  </Tag>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>Hôm nay chưa có lịch.</Text>
          )}
        </View>

        {/* ====== Tabs ====== */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lịch hẹn</Text>
        </View>

        <View style={styles.tabsRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveApptTab("today")}
            style={[styles.tabPill, activeApptTab === "today" && styles.tabPillActive]}
          >
            <Text style={[styles.tabPillText, activeApptTab === "today" && styles.tabPillTextActive]}>
              Hôm nay
            </Text>
            <View style={styles.tabCount}>
              <Text style={styles.tabCountText}>{appointmentsToday.length}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveApptTab("upcoming")}
            style={[styles.tabPill, activeApptTab === "upcoming" && styles.tabPillActive]}
          >
            <Text
              style={[
                styles.tabPillText,
                activeApptTab === "upcoming" && styles.tabPillTextActive,
              ]}
            >
              Sắp tới
            </Text>
            <View style={styles.tabCount}>
              <Text style={styles.tabCountText}>{appointmentsUpcoming.length}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ====== Appointment list ====== */}
        {appts.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyTitle}>Chưa có lịch hẹn</Text>
            <Text style={styles.emptySub}>
              {activeApptTab === "today"
                ? "Hôm nay bạn chưa có lịch khám nào."
                : "Chưa có lịch khám sắp tới."}
            </Text>
          </View>
        ) : (
          appts.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.apptCard}
              activeOpacity={0.85}
              onPress={() =>
                navigate.navigate("DoctorConsultationDetailScreen", {
                  registrationId: a.id,
                  patientName: a.elderlyName,
                  patientGender: a.gender,
                  patientDob: a.dob,
                  scheduledDate: a.scheduledDate,
                  slot: a.slot,
                })
              }
            >
              {/* Top row */}
              <View style={styles.apptTopRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.apptCode}>#{a.bookingCode || "------"}</Text>
                  <View style={{ width: 10 }} />
                  <Text style={styles.apptTime}>{a.time || "--:--"}</Text>
                </View>

                <Tag size="sm" type={a.statusTagType || "blue"}>
                  {a.status || "—"}
                </Tag>
              </View>

              {a.statusKey === "canceled" && !!a.cancelReason && (
                <View style={styles.cancelReasonBox}>
                  <Text style={styles.cancelReasonLabel}>Lý do hủy</Text>
                  <Text style={styles.cancelReasonText} numberOfLines={2}>
                    {a.cancelReason}
                  </Text>
                </View>
              )}

              {/* Patient */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Người cao tuổi</Text>
                <View style={styles.row}>
                  <View style={styles.circleAvatar}>
                    {a.elderlyAvatar ? (
                      <Image source={{ uri: a.elderlyAvatar }} style={styles.circleAvatarImg} />
                    ) : (
                      <Text style={styles.circleAvatarText}>
                        {a.elderlyName?.charAt(0)?.toUpperCase() || "N"}
                      </Text>
                    )}
                  </View>

                  <View style={styles.personInfo}>
                    <Text style={styles.personName} numberOfLines={1}>
                      {a.elderlyName}
                    </Text>
                    <Text style={styles.personSub} numberOfLines={1}>
                      Vai trò: Người cao tuổi{a.age ? ` • ${a.age} tuổi` : ""}
                    </Text>
                    {!!a.elderlyAddress && (
                      <Text style={styles.personSub} numberOfLines={1}>
                        Địa chỉ: {a.elderlyAddress}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Registrant */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Người đặt lịch</Text>
                <View style={styles.row}>
                  <View style={styles.circleAvatar}>
                    {a.registrantAvatar ? (
                      <Image
                        source={{ uri: a.registrantAvatar }}
                        style={styles.circleAvatarImg}
                      />
                    ) : (
                      <Text style={styles.circleAvatarText}>
                        {a.registrantName?.charAt(0)?.toUpperCase() || "N"}
                      </Text>
                    )}
                  </View>
                  <View style={styles.personInfo}>
                    <Text style={styles.personName} numberOfLines={1}>
                      {a.registrantName}
                    </Text>
                    <Text style={styles.personSub} numberOfLines={1}>
                      Vai trò: Người thân đặt lịch
                    </Text>
                  </View>
                </View>
              </View>

              {/* Bottom row */}
              <View style={[styles.section, styles.bottomRow]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.sectionLabel}>Ngày khám</Text>
                  <Text style={styles.timeText}>
                    {a.dateLabel || "—"}
                    {a.type ? " • " + a.type : ""}
                  </Text>
                  {!!a.note && (
                    <Text style={styles.noteText} numberOfLines={2}>
                      Ghi chú: {a.note}
                    </Text>
                  )}
                </View>

                {a.paymentLabel ? (
                  <Tag size="sm" type={a.paymentTagType || "primary"}>
                    {a.paymentLabel}
                  </Tag>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default DoctorHomeScreen;

/** =========================
 * Styles
 * ========================= */
const CARD_BG = "#ffffff";
const SURFACE = "#f6f7fb";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SURFACE },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },

  // Top
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  pageTitle: { fontSize: isSmall ? 18 : 20, fontWeight: "800", color: "#0f172a" },
  pageSub: { marginTop: 4, fontSize: 12, color: "#64748b" },

  primaryBtn: {
    backgroundColor: "#0B5FFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  // Cards
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 12,
  },
  cardTight: { padding: 14 },
  cardError: { backgroundColor: "#fff3f2", borderWidth: 1, borderColor: "#ffd6d2" },
  errorText: { color: "#9b1c1c", fontWeight: "800" },

  row: { flexDirection: "row", alignItems: "center" },

  // Avatar
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#e9efff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 14 },
  avatarText: { fontWeight: "800", color: "#2b3a67", fontSize: 20 },

  doctorTitle: { color: "#667085", fontSize: 12, marginBottom: 2 },
  doctorName: { fontSize: isSmall ? 16 : 18, fontWeight: "800", color: "#111827" },
  doctorSub: { color: "#4b5563", marginTop: 2 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 10, gap: 8 },
  metaText: { color: "#64748b", fontWeight: "600", fontSize: 12 },

  // Section
  sectionHeader: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: isSmall ? 15 : 16, fontWeight: "800", color: "#0f172a" },

  // Stats
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statItem: { width: "48%", alignItems: "center", marginBottom: 16 },
  statIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statIconEmoji: { fontSize: 22, color: "#fff" },
  statValue: { fontSize: 22, fontWeight: "900", color: "#0f172a", marginBottom: 4 },
  statCaption: { fontSize: 12, color: "#6b7280", textAlign: "center", fontWeight: "600" },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
    marginTop: 6,
  },
  progressFill: { height: 8, backgroundColor: "#16a34a", borderRadius: 999 },
  progressText: { fontSize: 12, color: "#6b7280", textAlign: "center", marginTop: 4, fontWeight: "600" },

  // Slots
  slotWrap: { marginTop: 6 },
  slot: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    borderWidth: 1,
  },
  slotFree: { backgroundColor: "#F3F7FF", borderColor: "#E3ECFF" },
  slotDisabled: { backgroundColor: "#FFF1F2", borderColor: "#FFD4D8" },
  slotText: { fontWeight: "900", color: "#0f172a", fontSize: 14 },
  slotTextDisabled: { color: "#9b1c1c" },
  slotSub: { marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: "600" },

  // Tabs (pill)
  tabsRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
  },
  tabPillActive: { backgroundColor: "#DDE7FF" },
  tabPillText: { fontWeight: "900", color: "#64748b", fontSize: 13 },
  tabPillTextActive: { color: "#0B5FFF" },
  tabCount: {
    minWidth: 26,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  tabCountText: { fontWeight: "900", color: "#0f172a", fontSize: 12 },

  // Appointment card
  apptCard: {
    marginTop: 10,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  apptTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  apptCode: { fontWeight: "900", color: "#0f172a", fontSize: 12 },
  apptTime: { color: "#0B5FFF", fontWeight: "900", fontSize: 12 },

  section: { marginTop: 14 },
  sectionLabel: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 8,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  circleAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#e6edf9",
    justifyContent: "center",
    alignItems: "center",
  },
  circleAvatarImg: { width: "100%", height: "100%", borderRadius: 19 },
  circleAvatarText: { fontWeight: "900", color: "#234", fontSize: 14 },

  personInfo: { marginLeft: 12, flex: 1 },
  personName: { fontSize: 15, fontWeight: "800", color: "#111827" },
  personSub: { fontSize: 12, color: "#6B7280", marginTop: 2, fontWeight: "600" },

  bottomRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  timeText: { fontSize: 14, fontWeight: "800", color: "#111827" },
  noteText: { fontSize: 12, color: "#374151", marginTop: 6, fontWeight: "600" },

  cancelReasonBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  cancelReasonLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#991B1B",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  cancelReasonText: { fontSize: 12, color: "#7F1D1D", fontWeight: "600" },

  // Empty
  emptyCard: { alignItems: "center", paddingVertical: 20 },
  emptyTitle: { fontWeight: "900", color: "#0f172a", fontSize: 14 },
  emptySub: { marginTop: 6, color: "#64748b", fontWeight: "600", textAlign: "center" },

  // Tags
  tagBase: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tagText: { color: "#0f172a", fontWeight: "900", fontSize: 12 },
  tagBaseSm: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  tagTextSm: { color: "#0f172a", fontWeight: "900", fontSize: 11 },
  tagPrimary: { backgroundColor: "#e9f0ff" },
  tagSuccess: { backgroundColor: "#e6f9ee" },
  tagWarn: { backgroundColor: "#fff6e5" },
  tagDanger: { backgroundColor: "#ffe9e9" },
  tagInfo: { backgroundColor: "#e8f7ff" },
  tagGray: { backgroundColor: "#f1f5f9" },
  tagBlue: { backgroundColor: "#dfe8ff" },

  muted: { color: "#6b7280", fontWeight: "600" },
});
