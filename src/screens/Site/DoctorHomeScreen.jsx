// src/screens/DoctorHomeScreen.jsx
import React, { useCallback, useMemo, useState  } from "react";
import {

  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import logo from "../../assets/logoBrand.png";
import { doctorService } from "../../services/doctorService";
import userService from "../../services/userService";
import doctorBookingService from "../../services/doctorBookingService";
import {SafeAreaView} from "react-native-safe-area-context";

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
    <View style={{ marginTop: 8, width: "100%" }}>
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
  const raw = (rawStatus || "")
    .toString()
    .toLowerCase()
    .trim();

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
      let user = await userService.getUser();
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
          if (b.slot === "morning") {
            timeLabel = "8h - 11h";
          } else if (b.slot === "afternoon") {
            timeLabel = "14h - 16h";
          }

          const { key: statusKey, label: statusLabel, tagType: statusTagType } =
            getStatusInfo(b.status);

          const { label: paymentLabel, tagType: paymentTagType } =
            getPaymentInfoFromBooking(b);

          const dob = b.beneficiary?.dateOfBirth
            ? new Date(b.beneficiary.dateOfBirth)
            : null;
          const computedAge = dob
            ? new Date().getFullYear() - dob.getFullYear()
            : "";

          const idStr = String(b._id || "");
          const bookingCode = idStr ? idStr.slice(-6) : "";

          const elderlyName = b.beneficiary?.fullName || "Người cao tuổi";
          const elderlyAddress = b.beneficiary?.currentAddress || "";
          const registrantName =
            b.registrant?.fullName || b.registrant?.name || "Người đặt lịch";

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
          };

          if (isToday) {
            today.push(item);
          } else if (when > endOfToday) {
            upcoming.push(item);
          }
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>E-CARE</Text>
          <Text style={styles.brandSub}>Chăm sóc người cao tuổi</Text>
        </View>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Đang hoạt động</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!!errorMsg && (
          <View style={[styles.card, { backgroundColor: "#fff3f2" }]}>
            <Text style={{ color: "#9b1c1c", fontWeight: "700" }}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>
                  {doctorName?.charAt(0)?.toUpperCase() || "D"}
                </Text>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.doctorTitle}>Bác sĩ</Text>
              <Text style={styles.doctorName} numberOfLines={1} ellipsizeMode="tail">
                {doctorName}
              </Text>
              <Text style={styles.doctorSub} numberOfLines={2}>
                {specialization} • {hospital}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Tag size="sm" type="success">
                    ⭐ {Number(rating?.averageRating || 0).toFixed(1)}
                  </Tag>
                </View>
                <Text style={[styles.muted, styles.metaItem]}>
                  {rating?.totalRatings || 0} đánh giá
                </Text>
                <View style={styles.metaItem}>
                  <Tag size="sm" type="gray">
                    {expYears} năm KN
                  </Tag>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Thông kê hôm nay</Text>
          <View style={styles.sectionRight}>
            <View style={[styles.badge, { backgroundColor: "#e8fff1" }]}>
              <Text style={[styles.badgeText, { color: "#0a7d2e" }]}>✓</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.statsGrid}>
            <StatItem
              icon="📅"
              value={statsToday.total}
              label="Tổng lịch hẹn"
              bgColor="#0B5FFF"
              textColor="#0f172a"
            />
            <StatItem
              icon="✅"
              value={statsToday.done}
              label="Đã hoàn thành"
              bgColor="#2AC670"
              textColor="#0f172a"
              showProgress
              total={statsToday.total}
              done={statsToday.done}
            />
            <StatItem
              icon="🕒"
              value={statsToday.processing}
              label="Chờ xử lý"
              bgColor="#FF8A34"
              textColor="#0f172a"
            />
            <StatItem
              icon="⏱️"
              value={statsToday.workingHours}
              label="Giờ làm việc"
              bgColor="#E5E7EB"
              textColor="#6B7280"
            />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text  style={styles.sectionTitle}>Lịch làm việc hôm nay</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigate.navigate('CreateWorkSchedule')}> 
            <Tag type="blue">Chỉnh sửa</Tag>
          </TouchableOpacity>
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
                <Text
                  style={[
                    styles.slotText,
                    slot.isAvailable === false && styles.slotTextDisabled,
                  ]}
                >
                  {timeRangeStr(slot)}
                </Text>
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

       

        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: "row" }}>
            <TouchableOpacity onPress={() => setActiveApptTab("today")}>
              <Text style={[styles.tab, activeApptTab === "today" && styles.tabActive]}>
                Hôm nay ({appointmentsToday.length})
              </Text>
            </TouchableOpacity>
            <View style={{ width: 12 }} />
            <TouchableOpacity onPress={() => setActiveApptTab("upcoming")}>
              <Text style={[styles.tab, activeApptTab === "upcoming" && styles.tabActive]}>
                Sắp tới ({appointmentsUpcoming.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {(activeApptTab === "today" ? appointmentsToday : appointmentsUpcoming).map((a) => (
          <TouchableOpacity
            key={a.id}
            style={styles.apptCard}
            activeOpacity={0.8}
            onPress={() =>
              navigate.navigate('DoctorConsultationDetailScreen', {
                registrationId: a.id,
                patientName: a.elderlyName,
                patientGender: a.gender,
                patientDob: a.dob,
                scheduledDate: a.scheduledDate,
                slot: a.slot,
              })
            }
          >
            <View style={{ width: "100%" }}>
              <View style={styles.rowBetween}>
                
                <Tag size="sm" type={a.statusTagType || "blue"}>
                  {a.status || "—"}
                </Tag>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Người cao tuổi</Text>
                <View style={styles.row}>
                  <View style={styles.circleAvatar}>
                    {a.elderlyAvatar ? (
                      <Image
                        source={{ uri: a.elderlyAvatar }}
                        style={styles.circleAvatarImg}
                      />
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
                      Vai trò: Người cao tuổi
                    </Text>
                    {!!a.elderlyAddress && (
                      <Text style={styles.personSub} numberOfLines={1}>
                        Địa chỉ: {a.elderlyAddress}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

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

              <View
                style={[
                  styles.section,
                  styles.rowBetween,
                  { alignItems: "flex-start" },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.sectionLabel}>Ngày khám</Text>
                  <Text style={styles.timeText}>
                    {a.dateLabel || "—"}
                    {a.type ? " • " + a.type : ""}
                  </Text>
                </View>
                {a.paymentLabel ? (
                  <Tag size="sm" type={a.paymentTagType || "primary"}>
                    {a.paymentLabel}
                  </Tag>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default DoctorHomeScreen;

const CARD_BG = "#ffffff";
const SURFACE = "#f6f7fb";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SURFACE },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 12 : 0,
    paddingBottom: 12,
    backgroundColor: "#0B5FFF",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  logo: { width: 36, height: 36, borderRadius: 8 },
  brand: { fontSize: isSmall ? 16 : 18, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },
  brandSub: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#19d36b", marginRight: 6 },
  statusText: { color: "#d7ffe9", fontSize: 12, fontWeight: "600" },

  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

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
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },

  avatar: {
    width: 56, height: 56, borderRadius: 12,
    backgroundColor: "#e9efff",
    alignItems: "center", justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 12 },
  avatarText: { fontWeight: "700", color: "#2b3a67", fontSize: 20 },

  doctorTitle: { color: "#667085", fontSize: 12, marginBottom: 2 },
  doctorName: { fontSize: isSmall ? 16 : 18, fontWeight: "700", color: "#111827" },
  doctorSub: { color: "#4b5563", marginTop: 2 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 8 },
  metaItem: { marginRight: 8, marginBottom: 6 },

  sectionHeader: {
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: isSmall ? 15 : 16, fontWeight: "700", color: "#0f172a" },
  sectionRight: { flexDirection: "row", alignItems: "center" },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statItem: {
    width: "48%",
    alignItems: "center",
    marginBottom: 16,
  },
  statIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statIconEmoji: { fontSize: 22, color: "#fff" },
  statValue: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  statCaption: { fontSize: 12, color: "#6b7280", textAlign: "center" },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
    marginTop: 6,
  },
  progressFill: { height: 8, backgroundColor: "#16a34a", borderRadius: 999 },
  progressText: { fontSize: 12, color: "#6b7280", textAlign: "center", marginTop: 4 },

  slotWrap: { marginTop: 8 },
  slot: {
    backgroundColor: "#e8f7ff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  slotFree: { backgroundColor: "#e8f7ff" },
  slotDisabled: { backgroundColor: "#ffe9e9" },
  slotText: { fontWeight: "700", color: "#0f172a", fontSize: 14 },
  slotTextDisabled: { color: "#9b1c1c" },

  legend: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  legendRow: { flexDirection: "row", alignItems: "center", marginRight: 16 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: "#6b7280", fontSize: 12, marginLeft: 8 },

  tab: {
    fontWeight: "700",
    color: "#64748b",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
  },
  tabActive: { color: "#0b5fff", backgroundColor: "#dfe8ff" },

  apptCard: {
    marginTop: 10,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  apptTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  apptLeft: { paddingRight: 12 },
  circleAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e6edf9",
    justifyContent: "center",
    alignItems: "center",
  },
  circleAvatarImg: { width: "100%", height: "100%", borderRadius: 18 },
  circleAvatarText: { fontWeight: "700", color: "#234", fontSize: 14 },
  apptTime: { color: "#0b5fff", fontWeight: "700" },
  section: { marginTop: 14 },
  sectionLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  personInfo: { marginLeft: 12, flex: 1 },
  personName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  personSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  timeText: { fontSize: 14, fontWeight: "600", color: "#111827" },

  tagBase: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tagText: { color: "#0f172a", fontWeight: "700", fontSize: 12 },
  tagBaseSm: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagTextSm: { color: "#0f172a", fontWeight: "700", fontSize: 11 },
  tagPrimary: { backgroundColor: "#e9f0ff" },
  tagSuccess: { backgroundColor: "#e6f9ee" },
  tagWarn: { backgroundColor: "#fff6e5" },
  tagDanger: { backgroundColor: "#ffe9e9" },
  tagInfo: { backgroundColor: "#e8f7ff" },
  tagGray: { backgroundColor: "#f1f5f9" },
  tagBlue: { backgroundColor: "#dfe8ff" },

  badge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  badgeText: { fontWeight: "800" },
  muted: { color: "#6b7280" },
});