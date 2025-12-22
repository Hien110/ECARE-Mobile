import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { doctorService } from "../../services/doctorService";

const DEFAULT_AVATAR =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-h7we5cEhjWKmxlMrlmcjabsOKhK8JA.png";

const ReviewItem = ({ r }) => {
  const author = r?.author || r?.authorName || r?.name || "Ẩn danh";
  const date = r?.date || r?.createdAt || "";
  const rating = r?.rating ?? r?.stars ?? null;
  const content = r?.content || r?.comment || r?.text || "";

  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewTop}>
        <Image source={{ uri: r?.authorAvatar || DEFAULT_AVATAR }} style={styles.reviewAvatar} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.reviewAuthor} numberOfLines={1}>
            {author}
          </Text>
          {!!date && (
            <Text style={styles.reviewDate} numberOfLines={1}>
              {date}
            </Text>
          )}
        </View>

        {rating != null ? (
          <View style={styles.reviewRatingWrap}>
            <Icon name="star" size={14} color="#F59E0B" />
            <Text style={styles.reviewRatingText}>{Number(rating).toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      {!!content && <Text style={styles.reviewContent}>{content}</Text>}
    </View>
  );
};

const ViewDoctorProfileFromCustomerScreen = ({ navigation, route }) => {
  const profileId = route?.params?.profileId || null;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [activitySummary, setActivitySummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");

  const fetchAll = useCallback(async () => {
    if (!profileId) {
      setError("Thiếu profileId");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await doctorService.getProfileById(profileId);

      if (res?.success) setProfile(res?.data || null);
      else setProfile(null);

      const data = res?.data || null;
      const userNode = data?.user || data?.profile?.user || null;
      const userId = userNode ? String(userNode?._id || userNode) : null;

      if (userId) {
        // rating summary
        try {
          const rsum = await doctorService.getDoctorRatingSummary(userId);
          if (rsum?.success) setRatingSummary(rsum.data);
        } catch (e) {}

        // activity summary (nếu backend chưa có endpoint thì bỏ qua)
        try {
          // bạn có thể thay endpoint thật nếu có: doctorService.getDoctorActivitySummary(userId)
          setActivitySummary(null);
        } catch (e) {}

        // reviews
        try {
          const rv = await doctorService.getDoctorReviews(userId, { limit: 20 });
          if (rv?.success && rv?.data?.items) setReviews(rv.data.items);
          else if (rv?.success && Array.isArray(rv?.data)) setReviews(rv.data);
        } catch (e) {}
      }
    } catch (err) {
      setError("Lỗi khi tải hồ sơ");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(() => {
    fetchAll();
  }, [fetchAll]);

  const Header = () => (
    <View style={styles.headerWrap}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Hồ sơ bác sĩ</Text>
          <Text style={styles.headerSubtitle}>Thông tin & đánh giá</Text>
        </View>

        <TouchableOpacity style={styles.iconBtn} onPress={onRefresh} activeOpacity={0.8}>
          <Icon name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header />
        <View style={{ padding: 16 }}>
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header />
        <View style={{ padding: 16 }}>
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={18} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh} activeOpacity={0.9}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const userNode = profile?.user || profile?.account || profile?.owner || null;

  const name = profile?.fullName || userNode?.fullName || userNode?.username || "Bác sĩ";
  const avatar = profile?.avatar || userNode?.avatar || DEFAULT_AVATAR;

  const specialty =
    (profile?.specialization ||
      (Array.isArray(profile?.specializations) ? profile.specializations.join(", ") : "")) ||
    "—";

  const expYears = Number.isFinite(profile?.experience) ? `${profile.experience} năm` : "—";
  const intro = profile?.introduction || profile?.about || profile?.description || "";

  const avg =
    Number(profile?.ratingStats?.averageRating ?? ratingSummary?.avg ?? 0) || 0;
  const total =
    Number(profile?.ratingStats?.totalRatings ?? ratingSummary?.total ?? 0) || 0;

  const consults =
    activitySummary?.consults ?? profile?.stats?.totalConsultations ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <Header />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={styles.profileCard}>
          <Image source={{ uri: avatar }} style={styles.avatar} />

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>

            <Text style={styles.spec} numberOfLines={2}>
              {specialty}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Icon name="star" size={14} color="#F59E0B" />
                <Text style={styles.metaChipText}>{avg.toFixed(1)}</Text>
                <Text style={styles.metaChipSub}>{`(${total})`}</Text>
              </View>

              <View style={styles.metaChip}>
                <MaterialIcons name="access-time" size={16} color="#7C3AED" />
                <Text style={styles.metaChipText}>{expYears}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Intro */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Giới thiệu</Text>
          <Text style={styles.sectionText}>{intro || "Chưa có mô tả."}</Text>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thống kê</Text>

          <View style={styles.statRow}>
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{consults}</Text>
              <Text style={styles.statLabel}>Số lượt tư vấn</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{total}</Text>
              <Text style={styles.statLabel}>Lượt đánh giá</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{avg.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Điểm TB</Text>
            </View>
          </View>
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Đánh giá gần đây</Text>
            <Text style={styles.sectionHint}>{reviews?.length ? `${reviews.length} mục` : ""}</Text>
          </View>

          {reviews && reviews.length ? (
            <FlatList
              data={reviews}
              keyExtractor={(i, idx) => String(i?.id || i?._id || idx)}
              renderItem={({ item }) => <ReviewItem r={item} />}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.sectionText}>Chưa có nhận xét nào</Text>
          )}
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ViewDoctorProfileFromCustomerScreen;

const BLUE = "#4F7EFF";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F6FB" },

  // Header like screenshot
  headerWrap: {
    backgroundColor: BLUE,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 6 : 0,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  headerRow: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { alignItems: "center", flex: 1, paddingHorizontal: 10 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  headerSubtitle: { marginTop: 2, color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },

  content: { padding: 16, paddingBottom: 24 },

  // Loading / Error
  loadingBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },
  loadingText: { color: "#6B7280", fontWeight: "600" },

  errorBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.15)",
  },
  errorText: { color: "#DC2626", fontWeight: "700" },
  retryBtn: {
    marginTop: 6,
    backgroundColor: "#DC2626",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: { color: "#fff", fontWeight: "900" },

  // Profile card
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 12,
  },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: "#E6EEFF" },

  name: { fontSize: 18, fontWeight: "900", color: "#111827" },
  spec: { marginTop: 4, color: "#6B7280", fontWeight: "600" },

  metaRow: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3F6FB",
  },
  metaChipText: { fontWeight: "900", color: "#111827" },
  metaChipSub: { color: "#6B7280", fontWeight: "700" },

  // Section
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },
  sectionHeaderRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionTitle: { fontWeight: "900", fontSize: 15, color: "#111827" },
  sectionHint: { color: "#9CA3AF", fontWeight: "700", fontSize: 12, marginLeft: 10 },
  sectionText: { marginTop: 10, color: "#374151", lineHeight: 18 },

  // Stats
  statRow: {
    marginTop: 12,
    backgroundColor: "#F8FAFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  statCol: { flex: 1, alignItems: "center" },
  statNumber: { fontWeight: "900", fontSize: 18, color: "#111827" },
  statLabel: { marginTop: 4, color: "#6B7280", fontWeight: "700", fontSize: 12 },
  statDivider: { width: 1, height: 34, backgroundColor: "rgba(17,24,39,0.08)" },

  // Reviews
  reviewItem: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },
  reviewTop: { flexDirection: "row", alignItems: "center" },
  reviewAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E6EEFF" },
  reviewAuthor: { fontWeight: "900", color: "#111827" },
  reviewDate: { marginTop: 2, color: "#6B7280", fontSize: 12, fontWeight: "600" },
  reviewRatingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245,158,11,0.10)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  reviewRatingText: { fontWeight: "900", color: "#92400E" },
  reviewContent: { marginTop: 10, color: "#374151", lineHeight: 18 },
});
