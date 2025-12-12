import React, { useCallback, useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { Star, ChevronLeft } from "lucide-react-native";
import Card from "../../components/Cart";
import doctorService from "../../services/doctorService";
import { userService } from "../../services/userService";

export default function ReviewsScreen({ route, navigation }) {
  const passedUserId = route?.params?.userId || null;
  const passedAvg = route?.params?.avgRating;
  const passedTotal = route?.params?.totalRatings;

  const [doctorUserId, setDoctorUserId] = useState(passedUserId);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (passedUserId) {
      setDoctorUserId(passedUserId);
      return;
    }
    (async () => {
      const res = await userService.getUser();
      const id = res?.data?._id || null;
      setDoctorUserId(id);
    })();
  }, [passedUserId]);

  const loadReviews = useCallback(async () => {
    if (!doctorUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await doctorService.getDoctorReviews(doctorUserId, {
        limit: 100,
      });
      if (res?.success) {
        const items = res.data?.items || [];
        setReviews(items);
      } else {
        setError(res?.message || "Không thể tải danh sách đánh giá");
      }
    } catch (e) {
      setError("Không thể tải danh sách đánh giá");
    } finally {
      setLoading(false);
    }
  }, [doctorUserId]);

  useEffect(() => {
    if (doctorUserId) {
      loadReviews();
    }
  }, [doctorUserId, loadReviews]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReviews();
    setRefreshing(false);
  };

  const computedAvg =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
      : 0;
  const displayAvg =
    typeof passedAvg === "number" && passedAvg > 0 ? passedAvg : computedAvg;
  const displayTotal =
    typeof passedTotal === "number" && passedTotal >= 0
      ? passedTotal
      : reviews.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <LinearGradient
        colors={["#2563EB", "#3B82F6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingVertical: 12, paddingHorizontal: 16 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <ChevronLeft
            size={24}
            color="#FFFFFF"
            style={{ marginRight: 8 }}
            onPress={() => navigation?.goBack?.()}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}
            >
              Tất cả đánh giá
            </Text>
            <Text
              style={{ color: "#E0F2FE", marginTop: 2, fontSize: 13 }}
            >
              Mới nhất hiển thị trước
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Card style={{ padding: 16 }}>
          <Text
            style={{
              fontWeight: "700",
              color: "#111827",
              marginBottom: 8,
            }}
          >
            Thống kê tổng quan
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={{ fontSize: 28, fontWeight: "800", color: "#111827" }}
              >
                {displayAvg.toFixed(1)}
              </Text>
              <Star size={18} color="#F59E0B" fill="#F59E0B" />
            </View>
            <Text
              style={{ textAlign: "right", fontWeight: "700", color: "#111827" }}
            >
              {displayTotal}
              {"\n"}
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                Lượt đánh giá
              </Text>
            </Text>
          </View>
        </Card>

        {loading ? (
          <View
            style={{
              marginTop: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={{ marginTop: 8, color: "#64748B" }}>
              Đang tải danh sách đánh giá...
            </Text>
          </View>
        ) : error ? (
          <View style={{ marginTop: 24, alignItems: "center" }}>
            <Text style={{ color: "#B91C1C" }}>{error}</Text>
          </View>
        ) : reviews.length === 0 ? (
          <View style={{ marginTop: 24, alignItems: "center" }}>
            <Text style={{ color: "#6B7280" }}>
              Chưa có đánh giá nào.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 16 }}>
            {reviews.map((rv) => (
              <ReviewItem key={rv.id} {...rv} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Bar({ label, value, max }) {
  const pct = (value / max) * 100;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 2 }}>
      <Text style={{ width: 16, textAlign: "center", color: "#6B7280" }}>{label}</Text>
      <View style={{ flex: 1, height: 8, borderRadius: 6, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: "#FB923C" }} />
      </View>
      <Text style={{ width: 28, textAlign: "right", color: "#6B7280" }}>{value}</Text>
    </View>
  );
}

function ReviewItem({ author, date, rating, content, authorAvatar, tags }) {
  return (
    <Card style={{ padding: 14, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "#E0E7FF",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#1D4ED8", fontWeight: "800" }}>
            {(author?.[0] || "?").toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "700", color: "#111827" }}>{author || "Người dùng ẩn danh"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Star size={14} color="#F59E0B" fill="#F59E0B" />
            <Text style={{ color: "#6B7280", fontSize: 12 }}>{rating} / 5</Text>
          </View>
        </View>
        <Text style={{ color: "#6B7280", fontSize: 12 }}>{date}</Text>
      </View>

      <Text style={{ color: "#111827" }}>{content}</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {tags?.map((t) => (
          <View key={t} style={{ backgroundColor: "#EEF2FF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: "#1D4ED8", fontWeight: "600", fontSize: 12 }}>{t}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}