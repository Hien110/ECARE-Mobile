import React, { useState } from "react";
import { SafeAreaView, ScrollView, View, Text, TextInput, TouchableOpacity } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { Star, UserRound, Users, Clock3, Wallet } from "lucide-react-native";
import Card from "../../components/Cart";

const initial = [
  {
    id: "1",
    author: "Lê Minh Châu",
    date: "20/12/2024",
    rating: 5,
    content:
      "Bác sĩ rất tận tình và hiền thị. Mẹ tôi 78 tuổi, bác sĩ giải thích rất kỹ và dễ hiểu. Sau 3 buổi tư vấn, tinh thần mẹ đã tích cực hơn rất nhiều.",
    tags: ["Chuyên nghiệp", "Kiên Nhẫn", "Quan tâm"],
  },
  {
    id: "2",
    author: "Người dùng ẩn danh",
    date: "18/12/2024",
    rating: 5,
    content:
      "Cảm ơn bác sĩ đã giúp gia đình tôi vượt qua giai đoạn khó khăn. Ông nội 82 tuổi sau khi mất bà nội rất buồn, bác sĩ đã hướng dẫn cả gia đình chăm sóc tâm lý.",
    tags: ["Hiệu quả", "Quan tâm", "Giải thích rõ ràng"],
  },
];

export default function ReviewsScreen() {
  const [reviews, setReviews] = useState(initial);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");

  const submit = () => {
    if (!rating || !text.trim()) return;
    setReviews((prev) => [
      {
        id: String(Date.now()),
        author: "Bạn",
        date: new Date().toLocaleDateString("vi-VN"),
        rating,
        content: text,
        tags: [],
      },
      ...prev,
    ]);
    setRating(0);
    setText("");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <LinearGradient colors={["#2563EB", "#3B82F6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>Thống kê đánh giá</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Tổng quan đánh giá */}
        <Card style={{ padding: 16 }}>
          <Text style={{ fontWeight: "700", color: "#111827", marginBottom: 8 }}>Thống kê đánh giá</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 28, fontWeight: "800", color: "#111827" }}>4.8</Text>
              <Star size={18} color="#F59E0B" fill="#F59E0B" />
            </View>
            <Text style={{ textAlign: "right", fontWeight: "700", color: "#111827" }}>
              247{"\n"}
              <Text style={{ color: "#6B7280", fontSize: 12 }}>Lượt đánh giá</Text>
            </Text>
          </View>

          {[5, 4, 3, 2, 1].map((r) => (
            <Bar key={r} label={r} value={[173, 49, 17, 5, 3][5 - r]} max={173} />
          ))}
          <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 8 }}>Đánh giá gần nhất: 15/01/2024</Text>
        </Card>

        {/* Thống kê hoạt động */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          <Stat value="1,247" label="Lượt tư vấn" color="#2563EB" bg="#EFF6FF" icon={<UserRound color="#2563EB" />} />
          <Stat value="892" label="Bệnh nhân" color="#F97316" bg="#FFF7ED" icon={<Users color="#F97316" />} />
          <Stat value="32" label="Phút/buổi TB" color="#10B981" bg="#ECFDF5" icon={<Clock3 color="#10B981" />} />
          <Stat value="285M" label="Tổng doanh thu" color="#8B5CF6" bg="#F5F3FF" icon={<Wallet color="#8B5CF6" />} />
        </View>

        {/* Viết đánh giá */}
        <Card style={{ padding: 16, marginTop: 12 }}>
          <Text style={{ fontWeight: "700", color: "#111827", marginBottom: 8 }}>Viết đánh giá</Text>
          <Text style={{ color: "#111827", fontWeight: "600" }}>Đánh giá tổng thể</Text>
          <View style={{ flexDirection: "row", gap: 8, marginVertical: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setRating(n)}>
                <Star size={24} color={n <= rating ? "#F59E0B" : "#D1D5DB"} fill={n <= rating ? "#F59E0B" : "transparent"} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: "#6B7280", marginBottom: 8 }}>{rating ? `${rating}/5` : "Chưa đánh giá"}</Text>
          <Text style={{ color: "#111827", fontWeight: "600" }}>Chi tiết đánh giá</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            placeholder="Chia sẻ kinh nghiệm của bạn để giúp đỡ những người khác..."
            placeholderTextColor="#9CA3AF"
            style={{ marginTop: 8, minHeight: 110, borderRadius: 10, backgroundColor: "#F3F4F6", padding: 12, color: "#111827" }}
          />
          <Text style={{ color: "#6B7280", marginTop: 6, fontSize: 12 }}>{text.length}/500 ký tự</Text>
          <TouchableOpacity onPress={submit} activeOpacity={0.9} style={{ marginTop: 12, backgroundColor: "#FB923C", borderRadius: 10, paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Gửi đánh giá</Text>
          </TouchableOpacity>
        </Card>

        {/* Danh sách đánh giá */}
        <View style={{ marginTop: 12 }}>
          {reviews.map((rv) => (
            <ReviewItem key={rv.id} {...rv} />
          ))}
        </View>
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

function Stat({ value, label, color, bg, icon }) {
  return (
    <Card style={{ paddingVertical: 16, borderWidth: 0, backgroundColor: bg, alignItems: "center", flexGrow: 1, minWidth: "46" + "%" }}>
      {icon}
      <Text style={{ fontSize: 20, fontWeight: "800", color, marginTop: 6 }}>{value}</Text>
      <Text style={{ color: "#6B7280" }}>{label}</Text>
    </Card>
  );
}

function ReviewItem({ author, date, rating, content, tags }) {
  return (
    <Card style={{ padding: 14, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#E0E7FF", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#1D4ED8", fontWeight: "800" }}>{(author?.[0] || "?").toUpperCase()}</Text>
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