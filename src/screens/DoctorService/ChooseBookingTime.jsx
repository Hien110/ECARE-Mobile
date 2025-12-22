import React, { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { doctorBookingService } from "../../services/doctorBookingService";

const pad = (n) => String(n).padStart(2, "0");

const formatDate = (d) => {
  if (!d) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const weekdayName = (d) => {
  if (!d) return "";
  return d.toLocaleDateString("vi-VN", { weekday: "long" });
};

const toYMD = (d) => {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}`;
};

const ChooseBookingTime = ({ navigation, route }) => {
  // initial date from params
  const _scheduled = route?.params?.scheduledDate;
  let initial;
  if (_scheduled) {
    if (typeof _scheduled === "string" && /^\d{4}-\d{2}-\d{2}$/.test(_scheduled)) {
      const [yy, mm, dd] = _scheduled.split("-").map(Number);
      initial = new Date(yy, mm - 1, dd);
    } else {
      initial = new Date(_scheduled);
      if (isNaN(initial.getTime())) initial = new Date();
    }
  } else {
    initial = new Date();
  }

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  if (initial < today) initial = new Date(today);

  const [date, setDate] = useState(initial);
  const [slot, setSlot] = useState(route?.params?.slot || "morning");
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1)
  );
  const [loading, setLoading] = useState(false);

  const specialization = route?.params?.specialization || null;

  const slotStartHour = (s) => (s === "morning" ? 8 : 14);

  const isSlotBookable = (d, s) => {
    if (!d || !s) return false;

    const now = new Date();
    const todayNorm = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetNorm = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    // future day always ok
    if (targetNorm > todayNorm) return true;

    // same day: require at least 1 hour before slot start
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), slotStartHour(s), 0, 0);
    const limit = new Date(start.getTime() - 60 * 60 * 1000);
    return now < limit;
  };

  const canGoPrev = date > today;

  const changeDay = (delta) => {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    if (next < today) return;
    setDate(next);
  };

  const handleContinue = async () => {
    if (!isSlotBookable(date, slot)) {
      Alert.alert(
        "Thông báo",
        "Ca khám đã bắt đầu hoặc không còn đủ thời gian (ít nhất 1 giờ trước ca). Vui lòng chọn ca khác hoặc ngày khác."
      );
      return;
    }

    const scheduledDate = toYMD(date);

    setLoading(true);
    try {
      const res = await doctorBookingService.getAvailableDoctors({
        scheduledDate,
        slot,
        specialization,
      });

      const doctors = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.doctors)
          ? res.data.doctors
          : [];

      navigation.navigate("AvailableDoctors", {
        scheduledDate,
        slot,
        specialization,
        elderly: route?.params?.elderly || null,
        family: route?.params?.family || null,
        availableDoctors: doctors,
      });
    } catch (e) {
      navigation.navigate("AvailableDoctors", {
        scheduledDate,
        slot,
        specialization,
        elderly: route?.params?.elderly || null,
        family: route?.params?.family || null,
      });
    } finally {
      setLoading(false);
    }
  };

  // Calendar helpers
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

  const prevMonth = () =>
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const nextMonth = () =>
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));

  const selectDay = (day) => {
    const picked = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    const pickedNorm = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate());
    if (pickedNorm < today) return;
    setDate(pickedNorm);
    setShowCalendar(false);
  };

  const summaryText = useMemo(() => {
    const slotLabel = slot === "morning" ? "Sáng (08:00–11:00)" : "Chiều (14:00–17:00)";
    return `${weekdayName(date)} • ${formatDate(date)} • ${slotLabel}`;
  }, [date, slot]);

  const morningOk = isSlotBookable(date, "morning");
  const afternoonOk = isSlotBookable(date, "afternoon");

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.title}>Chọn lịch tư vấn</Text>
          <Text style={styles.subtitle}>Chọn ngày và ca khám phù hợp</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container}>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconWrap}>
            <Icon name="calendar-outline" size={18} color="#111827" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Bạn đang chọn</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {summaryText}
            </Text>
          </View>
        </View>

        {/* Date card */}
        <Text style={styles.sectionTitle}>Ngày khám</Text>
        <View style={styles.card}>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
              onPress={() => changeDay(-1)}
              disabled={!canGoPrev}
            >
              <Icon name="chevron-back" size={18} color="#374151" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.datePill} onPress={() => setShowCalendar(true)}>
              <Text style={styles.weekday}>{weekdayName(date)}</Text>
              <Text style={styles.dateLarge}>{formatDate(date)}</Text>
              <View style={styles.changeHint}>
                <Icon name="caret-down" size={14} color="#6B7280" />
                <Text style={styles.changeHintText}>Chạm để mở lịch</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navBtn} onPress={() => changeDay(1)}>
              <Icon name="chevron-forward" size={18} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Slot */}
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Chọn ca</Text>
        <View style={styles.slotGrid}>
          <TouchableOpacity
            style={[
              styles.slotCard,
              slot === "morning" && styles.slotCardActive,
              !morningOk && styles.slotCardDisabled,
            ]}
            onPress={() => setSlot("morning")}
            disabled={!morningOk}
          >
            <View style={styles.slotTop}>
              <View style={[styles.badge, slot === "morning" && styles.badgeActive]}>
                <Text style={[styles.badgeText, slot === "morning" && styles.badgeTextActive]}>
                  SÁNG
                </Text>
              </View>
              {slot === "morning" ? (
                <Icon name="checkmark-circle" size={18} color="#1D4ED8" />
              ) : (
                <Icon name="time-outline" size={18} color="#6B7280" />
              )}
            </View>

            <Text style={[styles.slotTime, slot === "morning" && styles.slotTimeActive]}>
              08:00 - 11:00
            </Text>
            <Text style={styles.slotDesc} numberOfLines={2}>
              Phù hợp tư vấn buổi sáng, bắt đầu sớm.
            </Text>

            {!morningOk && <Text style={styles.unavailable}>Không khả dụng</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.slotCard,
              slot === "afternoon" && styles.slotCardActive,
              !afternoonOk && styles.slotCardDisabled,
            ]}
            onPress={() => setSlot("afternoon")}
            disabled={!afternoonOk}
          >
            <View style={styles.slotTop}>
              <View style={[styles.badge, slot === "afternoon" && styles.badgeActive]}>
                <Text style={[styles.badgeText, slot === "afternoon" && styles.badgeTextActive]}>
                  CHIỀU
                </Text>
              </View>
              {slot === "afternoon" ? (
                <Icon name="checkmark-circle" size={18} color="#1D4ED8" />
              ) : (
                <Icon name="time-outline" size={18} color="#6B7280" />
              )}
            </View>

            <Text style={[styles.slotTime, slot === "afternoon" && styles.slotTimeActive]}>
              14:00 - 17:00
            </Text>
            <Text style={styles.slotDesc} numberOfLines={2}>
              Dễ sắp xếp sau giờ trưa, thư thả hơn.
            </Text>

            {!afternoonOk && <Text style={styles.unavailable}>Không khả dụng</Text>}
          </TouchableOpacity>
        </View>

        {/* Continue */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueBtn,
              (loading || !isSlotBookable(date, slot)) && styles.continueBtnDisabled,
            ]}
            onPress={handleContinue}
            disabled={loading || !isSlotBookable(date, slot)}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.continueText}>Tiếp tục</Text>
                <Icon name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footerHint}>
            Bạn cần đặt trước ít nhất <Text style={styles.footerHintBold}>1 giờ</Text> so với giờ bắt đầu ca.
          </Text>
        </View>

        {/* Calendar Modal */}
        <Modal visible={showCalendar} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalGrab} />

              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={prevMonth} style={styles.modalNav}>
                  <Icon name="chevron-back" size={20} color="#111827" />
                </TouchableOpacity>

                <Text style={styles.modalTitle}>
                  {calendarMonth.toLocaleDateString("vi-VN", {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>

                <TouchableOpacity onPress={nextMonth} style={styles.modalNav}>
                  <Icon name="chevron-forward" size={20} color="#111827" />
                </TouchableOpacity>
              </View>

              <View style={styles.weekdaysRow}>
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((w) => (
                  <Text key={w} style={styles.weekdayCell}>
                    {w}
                  </Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {(() => {
                  const first = startOfMonth(calendarMonth);
                  const offset = (first.getDay() + 6) % 7; // Monday = 0
                  const total = daysInMonth(calendarMonth);
                  const cells = [];
                  for (let i = 0; i < offset; i++) cells.push(null);
                  for (let d = 1; d <= total; d++) cells.push(d);

                  return cells.map((day, idx) => {
                    if (day == null) return <View key={`blank-${idx}`} style={styles.dayCell} />;

                    const dayDate = new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth(),
                      day
                    );
                    const dayNorm = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());

                    const isSelected =
                      date.getFullYear() === calendarMonth.getFullYear() &&
                      date.getMonth() === calendarMonth.getMonth() &&
                      date.getDate() === day;

                    const isPast = dayNorm < today;

                    return (
                      <TouchableOpacity
                        key={`day-${day}-${idx}`}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellActive,
                          isPast && styles.dayCellDisabled,
                        ]}
                        onPress={() => selectDay(day)}
                        disabled={isPast}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isSelected && styles.dayTextActive,
                            isPast && styles.dayTextDisabled,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>

              <TouchableOpacity style={styles.modalClose} onPress={() => setShowCalendar(false)}>
                <Text style={styles.modalCloseText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ChooseBookingTime;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F6FB" },

  header: {
    height: 64,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,24,39,0.06)",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  title: { fontSize: 16, fontWeight: "800", color: "#111827" },
  subtitle: { marginTop: 2, fontSize: 12, color: "#6B7280" },

  container: { padding: 16 },

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(79,126,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(79,126,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  summaryLabel: { fontSize: 12, color: "#6B7280" },
  summaryValue: { marginTop: 2, fontSize: 14, fontWeight: "800", color: "#111827" },

  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#111827", marginBottom: 10 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F8FAFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },
  navBtnDisabled: { opacity: 0.45 },

  datePill: { flex: 1, alignItems: "center", justifyContent: "center", marginHorizontal: 10 },
  weekday: { fontSize: 13, color: "#6B7280", textTransform: "capitalize" },
  dateLarge: { marginTop: 6, fontSize: 20, fontWeight: "900", color: "#111827" },
  changeHint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  changeHintText: { fontSize: 12, color: "#6B7280" },

  slotGrid: { flexDirection: "row", gap: 12 },
  slotCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    minHeight: 132,
  },
  slotCardActive: {
    borderColor: "rgba(79,126,255,0.45)",
    // backgroundColor: "rgba(79,126,255,0.08)",
  },
  slotCardDisabled: { opacity: 0.5, backgroundColor: "#F8FAFF" },

  slotTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(17,24,39,0.06)",
  },
  badgeActive: { backgroundColor: "rgba(79,126,255,0.18)" },
  badgeText: { fontSize: 12, fontWeight: "900", color: "#374151" },
  badgeTextActive: { color: "#1D4ED8" },

  slotTime: { marginTop: 10, fontSize: 16, fontWeight: "900", color: "#111827" },
  slotTimeActive: { color: "#1D4ED8" },
  slotDesc: { marginTop: 6, fontSize: 12, color: "#6B7280", lineHeight: 16 },
  unavailable: { marginTop: 10, fontSize: 12, fontWeight: "800", color: "#9CA3AF" },

  footer: { marginTop: 18 },
  continueBtn: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F7EFF",
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: "#2B6CB0",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  continueBtnDisabled: { opacity: 0.7 },
  continueText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  footerHint: { marginTop: 10, textAlign: "center", fontSize: 12, color: "#6B7280" },
  footerHintBold: { fontWeight: "900", color: "#111827" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.40)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 14,
    paddingBottom: Platform.OS === "ios" ? 26 : 18,
  },
  modalGrab: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(17,24,39,0.15)",
    marginBottom: 10,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalNav: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F8FAFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },

  weekdaysRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  weekdayCell: { width: `${100 / 7}%`, textAlign: "center", fontSize: 12, color: "#6B7280" },

  daysGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  dayText: { fontSize: 14, color: "#111827" },
  dayCellActive: { backgroundColor: "rgba(79,126,255,0.14)", borderRadius: 12 },
  dayTextActive: { color: "#1D4ED8", fontWeight: "900" },
  dayCellDisabled: { opacity: 0.35 },
  dayTextDisabled: { color: "#9CA3AF" },

  modalClose: {
    marginTop: 8,
    backgroundColor: "rgba(79,126,255,0.10)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseText: { color: "#1D4ED8", fontWeight: "900" },
});
