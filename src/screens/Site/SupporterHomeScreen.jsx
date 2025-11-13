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

import { SafeAreaView } from "react-native-safe-area-context";

export default function FinancialApp() {
  const nav = useNavigation();
  const [activeTab, setActiveTab] = useState("overview");
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  // --------- mock data (có thể thay bằng API thật) ----------
  const quickActions = useMemo(
    () => [
      { id: 1, icon: "📝", title: "Yêu cầu mới", subtitle: "+ yêu cầu đăng ký" },
      { id: 2, icon: "📅", title: "Lịch hẹn", subtitle: "Hoạt động hôm nay" },
      { id: 3, icon: "🔧", title: "Hỗ trợ", subtitle: "Cập nhật thông tin" },
      { id: 4, icon: "💰", title: "Thu nhập", subtitle: "Xem chi tiết" },
    ],
    []
  );

  const upcomingSchedule = useMemo(
    () => [
      {
        id: 1,
        name: "Bà Nguyễn Thị Lan",
        time: "14:00",
        address: "153 Đường ABC, Quận 1",
        amount: "600.000đ",
        avatar: "👩‍💼",
      },
      {
        id: 2,
        name: "Ông Trần Văn Minh",
        time: "16:30",
        address: "456 Đường XYZ, Quận 3",
        amount: "400.000đ",
        avatar: "👨‍💼",
      },
    ],
    []
  );

  const recentActivities = useMemo(
    () => [
      {
        id: 1,
        type: "payment",
        title: "Hoàn thành dịch vụ",
        subtitle: "Bà Lê Thị Hương",
        time: "10:00",
        amount: "+240.000đ",
        status: "completed",
      },
      {
        id: 2,
        type: "request",
        title: "Nhận yêu cầu mới",
        subtitle: "Ông Phạm Văn Đức",
        time: "4 giờ trước",
        amount: "+600.000đ",
        status: "pending",
      },
      {
        id: 3,
        type: "payment",
        title: "Nhận thanh toán",
        subtitle: "Bà Nguyễn Thị Mai",
        time: "1 ngày trước",
        amount: "+320.000đ",
        status: "completed",
      },
    ],
    []
  );

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

  // ---------- load user info ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await userService.getUserInfo();
        if (mounted) {
          if (res?.success) {
            // tuỳ backend: res.data có thể là { user: {...} } hoặc {...}
            setMe(res.data?.user || res.data);
          }
        }
      } finally {
        mounted && setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
              <View style={styles.ratingRow}>
                <Text style={styles.ratingStar}>⭐ 4.9</Text>
                <Text style={styles.ratingReview}>(89 đánh giá)</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.9} style={styles.onlineBtn}>
            <Text style={styles.onlineBtnText}>Online</Text>
          </TouchableOpacity>
        </View>

        {/* Time & schedule summary */}
        <View style={styles.timeBar}>
          <View>
            <Text style={styles.timeNow}>{timeStr}</Text>
            <Text style={styles.dateNow}>{dateStr}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.scheduleCount}>3 lịch hẹn</Text>
            <Text style={styles.scheduleDay}>Hôm nay</Text>
          </View>
        </View>

        {/* Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Tổng quan hôm nay</Text>
          <View style={styles.overviewRow}>
            <View style={[styles.overviewCard, styles.balanceCard]}>
              <Text style={styles.cardIcon}>💳</Text>
              <Text style={styles.cardLabel}>Dư khoản thanh</Text>
              <Text style={styles.cardValue}>1</Text>
            </View>
            <View style={[styles.overviewCard, styles.incomeCard]}>
              <Text style={styles.cardIcon}>💰</Text>
              <Text style={styles.cardLabel}>Thu nhập hôm nay</Text>
              <Text style={styles.cardValue}>450.000đ</Text>
            </View>
          </View>
        </View>

        {/* Quick actions */}
        <View style={[styles.section, { backgroundColor: "#f8fafc", paddingVertical: 16 }]}>
          <Text style={styles.sectionTitle}>⚡ Thao tác nhanh</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((a) => (
              <TouchableOpacity key={a.id} style={styles.actionBtn} activeOpacity={0.9}>
                <View style={styles.actionIconBox}>
                  <Text style={styles.actionIconText}>{a.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{a.title}</Text>
                  <Text style={styles.actionSubtitle}>{a.subtitle}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Upcoming schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📅 Lịch hẹn sắp tới</Text>
            <TouchableOpacity>
              <Text style={styles.viewAll}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 12 }}>
            {upcomingSchedule.map((it) => (
              <View key={it.id} style={styles.scheduleItem}>
                <View style={styles.scheduleAvatar}>
                  <Text style={{ fontSize: 18 }}>{it.avatar}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduleName}>{it.name}</Text>
                  <Text style={styles.scheduleTime}>{it.time}</Text>
                  <Text style={styles.scheduleAddr}>{it.address}</Text>
                </View>
                <Text style={styles.scheduleAmount}>{it.amount}</Text>
                <View style={styles.scheduleActions}>
                  <TouchableOpacity style={styles.circleBtn}><Text>📞</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.circleBtn}><Text>💬</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Recent activities */}
        <View style={[styles.section, { backgroundColor: "#f8fafc", paddingVertical: 16 }]}>
          <Text style={styles.sectionTitle}>🕒 Hoạt động gần đây</Text>
          <View style={{ gap: 12 }}>
            {recentActivities.map((ac) => (
              <View key={ac.id} style={styles.activityItem}>
                <View
                  style={[
                    styles.activityIcon,
                    ac.type === "payment" ? { backgroundColor: "#dcfce7" } : { backgroundColor: "#dbeafe" },
                  ]}
                >
                  <Text style={{ fontSize: 14 }}>{ac.type === "payment" ? "✅" : "📋"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle}>{ac.title}</Text>
                  <Text style={styles.activitySub}>{ac.subtitle}</Text>
                  <Text style={styles.activityTime}>{ac.time}</Text>
                </View>
                <Text style={styles.activityAmount}>{ac.amount}</Text>
                <Text style={styles.activityRate}>⭐⭐⭐⭐⭐</Text>
              </View>
            ))}
          </View>
        </View>

        {loading && (
          <View style={{ padding: 16 }}>
            <ActivityIndicator />
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
