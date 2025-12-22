import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Image,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { doctorBookingService } from "../../services/doctorBookingService";

const pad2 = (n) => String(n).padStart(2, "0");

const toYMD = (scheduledDate) => {
  if (!scheduledDate) return scheduledDate;

  if (scheduledDate instanceof Date) {
    const y = scheduledDate.getFullYear();
    const m = pad2(scheduledDate.getMonth() + 1);
    const d = pad2(scheduledDate.getDate());
    return `${y}-${m}-${d}`;
  }

  if (typeof scheduledDate === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) return scheduledDate;
    const parsed = new Date(scheduledDate);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = pad2(parsed.getMonth() + 1);
      const d = pad2(parsed.getDate());
      return `${y}-${m}-${d}`;
    }
  }

  return scheduledDate;
};

const RatingRow = ({ rating, count }) => {
  if (rating == null) return <Text style={styles.noRating}>Chưa có đánh giá</Text>;
  return (
    <View style={styles.ratingRow}>
      <Icon name="star" size={14} color="#F59E0B" />
      <Text style={styles.ratingText}>{`${Number(rating).toFixed(1)}`}</Text>
      <Text style={styles.ratingCount}>{count ? ` (${count})` : ""}</Text>
    </View>
  );
};

const DoctorCard = ({ item, onPick, onDetail }) => {
  const rating =
    item?.ratingStats?.averageRating ??
    item?.rating ??
    item?.avgRating ??
    item?.averageRating ??
    null;

  const ratingCount =
    item?.ratingStats?.totalRatings ??
    item?.ratingCount ??
    item?.reviewCount ??
    item?.reviews ??
    0;

  const subtitle =
    item?.specialization ||
    item?.experience?.description ||
    item?.experience ||
    "Bác sĩ tư vấn sức khỏe";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {item?.avatar ? (
          <>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          </>
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{(item?.fullName || "B").slice(0, 1)}</Text>
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {item?.fullName || "Bác sĩ"}
          </Text>

          <RatingRow rating={rating} count={ratingCount} />

          <Text style={styles.desc} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.btnOutline} onPress={() => onDetail(item)} activeOpacity={0.9}>
          <Text style={styles.btnOutlineText}>Xem chi tiết</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnPrimary} onPress={() => onPick(item)} activeOpacity={0.9}>
          <Text style={styles.btnPrimaryText}>Chọn bác sĩ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const AvailableDoctorsScreen = ({ navigation, route }) => {
  const { scheduledDate, slot, specialization, elderly, family } = route.params || {};

  const scheduledDateStr = useMemo(() => toYMD(scheduledDate), [scheduledDate]);

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await doctorBookingService.getAvailableDoctors({
          scheduledDate: scheduledDateStr,
          slot,
          specialization,
        });

        if (!mounted) return;

        if (res?.success) {
          setList(Array.isArray(res?.data) ? res.data : []);
        } else {
          setList([]);
          setError(res?.message || "Không có bác sĩ khả dụng");
        }
      } catch (e) {
        if (!mounted) return;
        setList([]);
        setError("Lỗi khi gọi server");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [scheduledDateStr, slot, specialization]);

  const slotLabelDisplay = slot === "morning" ? "Sáng" : "Chiều";
  const slotTime = slot === "morning" ? "08:00 - 11:00" : "14:00 - 17:00";

  const filtered = useMemo(() => {
    const arr = Array.isArray(list) ? list : [];
    const q = search.trim().toLowerCase();
    if (!q) return arr;
    return arr.filter((i) => String(i?.fullName || "").toLowerCase().includes(q));
  }, [list, search]);

  const handlePick = (doc) => {
    navigation.navigate("PaymentServiceScreen", {
      doctor: doc,
      scheduledDate: scheduledDateStr,
      slot,
      slotLabel: `${slotLabelDisplay} • ${slotTime}`,
      price: doc?.consultationFee || doc?.price || null,
      elderly: elderly || null,
      family: family || null,
    });
  };

  const handleDetail = (doc) => {
    const profileId = doc?.profileDoctorId || doc?.doctorProfileId || doc?.profile?._id;
    console.log(doc, "Bác sĩ");
    
    if (!profileId) {
      // nếu bạn muốn, có thể show alert ở đây
      // Alert.alert("Thiếu dữ liệu", "Không tìm thấy profileId của bác sĩ.");
      return;
    }

    navigation.navigate('ViewDoctorProfileFromCustomer', {
      profileId,
    });
  };


  return (
    <SafeAreaView style={styles.safe}>
      {/* Header Blue */}
      <View style={styles.topBar}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.topTitle}>Chọn bác sĩ</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.searchWrap}>
          <Icon name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Nhập để tìm kiếm..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")} style={styles.clearChip}>
              <Icon name="close" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.meta}>
          Ngày {scheduledDateStr} • Ca {slotLabelDisplay} • {slotTime}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 18 }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => String(i?.doctorId || i?._id || i?.id)}
            renderItem={({ item }) => (
              <DoctorCard item={item} onPick={handlePick} onDetail={handleDetail} />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ paddingBottom: 18 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default AvailableDoctorsScreen;

const BLUE = "#2563EB";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F6FB" },

  // top
  topBar: {
    backgroundColor: BLUE,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 6 : 0,
  },
  topRow: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },

  searchWrap: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#111827",
  },
  clearChip: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  meta: {
    marginTop: 10,
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
  },

  // body
  body: { flex: 1, padding: 16 },

  errorText: { color: "#DC2626", marginTop: 12, fontWeight: "600" },

  // card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.06)",
  },
  cardTop: { flexDirection: "row", alignItems: "center" },

  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#E6EEFF" },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(37,99,235,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 22, fontWeight: "900", color: BLUE },

  cardInfo: { flex: 1, marginLeft: 14 },
  name: { fontSize: 18, fontWeight: "900", color: "#111827" },

  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  ratingText: { marginLeft: 6, fontSize: 14, fontWeight: "800", color: "#111827" },
  ratingCount: { fontSize: 13, color: "#6B7280" },
  noRating: { marginTop: 6, fontSize: 13, color: "#9CA3AF", fontWeight: "600" },

  desc: { marginTop: 8, fontSize: 13, color: "#6B7280", lineHeight: 18 },

  actionsRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  btnOutline: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  btnOutlineText: { color: BLUE, fontWeight: "900", fontSize: 15 },

  btnPrimary: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
