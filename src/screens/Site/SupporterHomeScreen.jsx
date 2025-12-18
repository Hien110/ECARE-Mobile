import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
// import đúng service của bạn
import { userService } from "../../services/userService";
import supporterSchedulingService from "../../services/supporterSchedulingService";

import { SafeAreaView } from "react-native-safe-area-context";

export default function FinancialApp() {
  const nav = useNavigation();
  const [activeTab, setActiveTab] = useState("overview");
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [upcomingSchedule, setUpcomingSchedule] = useState([]);
  const [inProgressSchedule, setInProgressSchedule] = useState([]);
  const [canceledSchedule, setCanceledSchedule] = useState([]);

  // ---------- helpers ----------
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  const dateStr = (() => {
    const days = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const d = days[now.getDay()];
    return `${d}, ${now.getDate()} tháng ${now.getMonth() + 1}, ${now.getFullYear()}`;
  })();

  const formatPrice = (price) => {
    if (!price) return "0đ";
    return `${Number(price).toLocaleString('vi-VN')}đ`;
  };

  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    } catch {
      return "--:--";
    }
  };

  // ---------- load user info + schedulings ----------
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Load user info
        const userRes = await userService.getUserInfo();
        if (mounted && userRes?.success) {
          const userData = userRes.data?.user || userRes.data;
          setMe(userData);

          // Load schedulings by status
          if (userData?._id) {
            try {
              const [confirmedRes, inProgressRes, canceledRes] = await Promise.all([
                supporterSchedulingService.getSchedulingsByStatus(userData._id, 'confirmed', 3),
                supporterSchedulingService.getSchedulingsByStatus(userData._id, 'in_progress', 3),
                supporterSchedulingService.getSchedulingsByStatus(userData._id, 'canceled', 3),
              ]);

              if (mounted) {
                if (confirmedRes?.success && Array.isArray(confirmedRes.data)) {
                  setUpcomingSchedule(confirmedRes.data);
                }
                if (inProgressRes?.success && Array.isArray(inProgressRes.data)) {
                  setInProgressSchedule(inProgressRes.data);
                }
                if (canceledRes?.success && Array.isArray(canceledRes.data)) {
                  setCanceledSchedule(canceledRes.data);
                }
              }
            } catch (err) {
              console.error('Error loading schedulings:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error loading user info:', err);
      } finally {
        mounted && setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const renderScheduleItem = (item) => (
    <TouchableOpacity 
      key={item._id || item.id} 
      style={styles.scheduleItem}
      onPress={() => nav.navigate('BookingDetailScreen', { bookingId: item._id })}
      activeOpacity={0.7}
    >
      <View style={styles.scheduleAvatar}>
        {item.elderly?.avatar ? (
          <Image
            source={{ uri: item.elderly.avatar }}
            style={{ width: 44, height: 44, borderRadius: 22 }}
            resizeMode="cover"
          />
        ) : (
          <Text style={{ fontSize: 18 }}>
            {item.elderly?.gender === 'Nữ' ? '👩‍🦳' : '👨‍🦳'}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.scheduleName}>{item.elderly?.fullName || 'N/A'}</Text>
        <Text style={styles.scheduleTime}>
          {formatTime(item.startDate)}
        </Text>
        <Text style={styles.scheduleAddr}>{item.elderly?.currentAddress || '—'}</Text>
      </View>
      <Text style={styles.scheduleAmount}>{formatPrice(item.price)}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.avatarWrap}>
              <Image
                source={{
                  uri:
                    me?.avatarUrl ||
                    "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=faces",
                }}
                style={styles.avatarImg}
              />
              <View style={styles.onlineDot} />
            </View>
            <View style={{ gap: 4 }}>
              <Text style={styles.userName}>Chào {me?.fullName || me?.name || "bạn"}!</Text>
              <Text style={styles.userRole}>
                {(me?.role ? capitalize(me.role) : "Supporter") + (me?.yearsExp ? ` • ${me.yearsExp} năm kinh nghiệm` : "")}
              </Text>
            </View>
          </View>
        </View>

        {/* Time & schedule summary */}
        <View style={styles.timeBar}>
          <View>
            <Text style={styles.timeNow}>{timeStr}</Text>
            <Text style={styles.dateNow}>{dateStr}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.scheduleCount}>
              {upcomingSchedule.length + inProgressSchedule.length} lịch
            </Text>
            <Text style={styles.scheduleDay}>Hiện tại</Text>
          </View>
        </View>

        {/* Upcoming schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📅 Lịch hẹn sắp tới</Text>
            <TouchableOpacity onPress={() => nav.navigate('SupporterBookingListSupporterScreen', { filterStatus: 'confirmed' })}>
              <Text style={styles.viewAll}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#3b82f6" />
          ) : upcomingSchedule.length > 0 ? (
            <View style={{ gap: 12 }}>
              {upcomingSchedule.map(renderScheduleItem)}
            </View>
          ) : (
            <Text style={styles.emptyText}>Không có lịch hẹn sắp tới</Text>
          )}
        </View>

        {/* Lịch hẹn hiện tại (in_progress) */}
        {inProgressSchedule.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>⏳ Lịch hẹn hiện tại</Text>
              <TouchableOpacity onPress={() => nav.navigate('SupporterBookingListSupporterScreen', { filterStatus: 'in_progress' })}>
                <Text style={styles.viewAll}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              {inProgressSchedule.map(renderScheduleItem)}
            </View>
          </View>
        )}

        {/* Lịch hẹn đã hủy (canceled) */}
        {canceledSchedule.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>❌ Lịch hẹn đã hủy</Text>
              <TouchableOpacity onPress={() => nav.navigate('SupporterBookingListSupporterScreen', { filterStatus: 'canceled' })}>
                <Text style={styles.viewAll}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              {canceledSchedule.map(renderScheduleItem)}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function capitalize(str) {
  try {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  } catch {
    return str;
  }
}

/* ================== STYLES ================== */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { paddingBottom: 20 },

  header: {
    backgroundColor: "#6b74df",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  userInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: { position: "relative" },
  avatarImg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4ade80",
    borderWidth: 2,
    borderColor: "#fff",
  },
  userName: { color: "#fff", fontSize: 18, fontWeight: "700" },
  userRole: { color: "rgba(255,255,255,0.9)", fontSize: 12 },
  ratingRow: { flexDirection: "row", gap: 8 },
  ratingStar: { color: "#fff", fontSize: 12 },
  ratingReview: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
  onlineBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  onlineBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  timeBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeNow: { fontSize: 24, fontWeight: "800", color: "#1e293b" },
  dateNow: { fontSize: 12, color: "#64748b", marginTop: 2 },
  scheduleCount: { fontSize: 16, fontWeight: "700", color: "#3b82f6" },
  scheduleDay: { fontSize: 12, color: "#64748b" },

  section: { paddingHorizontal: 16, paddingVertical: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 12 },

  emptyText: { fontSize: 14, color: "#94a3b8", textAlign: "center", paddingVertical: 20 },

  overviewRow: { flexDirection: "row", gap: 12 },
  overviewCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  balanceCard: { backgroundColor: "#2563eb" },
  incomeCard: { backgroundColor: "#d97706" },
  cardIcon: { fontSize: 20, color: "#fff", marginBottom: 6 },
  cardLabel: { fontSize: 12, color: "#fff", opacity: 0.9, marginBottom: 4 },
  cardValue: { fontSize: 18, fontWeight: "800", color: "#fff" },

  actionsGrid: { gap: 12 },
  actionBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconText: { fontSize: 20 },
  actionTitle: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  actionSubtitle: { fontSize: 11, color: "#64748b", marginTop: 2 },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  viewAll: { color: "#3b82f6", fontSize: 12, fontWeight: "600" },

  scheduleItem: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scheduleAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleName: { fontSize: 14, fontWeight: "700", color: "#1e293b", marginBottom: 2 },
  scheduleTime: { fontSize: 12, color: "#3b82f6", fontWeight: "600" },
  scheduleAddr: { fontSize: 11, color: "#64748b", marginTop: 2 },
  scheduleAmount: { fontSize: 14, fontWeight: "800", color: "#059669" },
  scheduleActions: { flexDirection: "row", gap: 8, marginLeft: 8 },
  circleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  activityItem: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: { fontSize: 14, fontWeight: "700", color: "#1e293b", marginBottom: 2 },
  activitySub: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  activityTime: { fontSize: 11, color: "#94a3b8" },
  activityAmount: { fontSize: 14, fontWeight: "800", color: "#059669" },
  activityRate: { fontSize: 12 },
});
