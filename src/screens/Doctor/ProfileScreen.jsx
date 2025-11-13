// src/screens/Doctor/ProfileScreen.jsx
import React from "react";
import { SafeAreaView, ScrollView, View, Text, Image } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { Star, Calendar, MapPin, Clock, Heart, Award } from "lucide-react-native";
import Card from "../../components/Cart";

export default function ProfileScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <LinearGradient
        colors={["#2563EB", "#3B82F6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingVertical: 12, paddingHorizontal: 16 }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>Xem hồ sơ bác sĩ</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Profile Card */}
        <Card style={{ overflow: "hidden" }}>
          <LinearGradient
            colors={["#2563EB", "#3B82F6", "#60A5FA"]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 20 }}
          >
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", borderWidth: 3, borderColor: "rgba(255,255,255,0.3)" }}>
                <Image
                  source={{ uri: "https://raw.githubusercontent.com/ranui-ch/images/main/doctor_profile_placeholder.png" }}
                  style={{ width: "100%", height: "100%" }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 20 }}>uqwqwq</Text>
                <Text style={{ color: "#DBEAFE", marginTop: 2 }}>Bác sĩ chuyên khoa</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <Star size={16} color="#FACC15" fill="#FACC15" />
                  <Text style={{ color: "#fff", fontWeight: "700" }}>4.8</Text>
                  <Text style={{ color: "#DBEAFE", fontSize: 12 }}>(302 đánh giá)</Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <PriceBox icon={<Calendar color="#fff" size={16} />} label="Tư vấn online" value="121,211đ" />
              <PriceBox icon={<MapPin color="#fff" size={16} />} label="Tại phòng khám" value="2,121,212đ" />
            </View>
          </LinearGradient>
        </Card>

        {/* Status */}
        <Card style={{ padding: 16, marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
            <View>
              <Text style={{ fontWeight: "700", color: "#111827" }}>Thông tin chuyên môn</Text>
              <Text style={{ color: "#6B7280" }}>Trực tuyến và sẵn sàng tư vấn</Text>
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <RowDot title="Lĩnh vực chuyên môn" subtitle="Chuyên ngành tim" />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <RowIcon
                icon={<Clock color="#6B7280" size={16} />}
                title="Kinh nghiệm"
                subtitle="10 năm"
              />
              <RowIcon
                icon={<Heart color="#EF4444" size={16} />}
                title=""
                subtitle="43,194 bệnh nhân"
                right
              />
            </View>
          </View>
        </Card>

        {/* Workplace */}
        <Card style={{ padding: 16, marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Award size={18} color="#F97316" />
            <Text style={{ fontWeight: "700", color: "#111827" }}>Nơi làm việc hiện tại</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <MapPin size={16} color="#6B7280" />
            <Text style={{ fontWeight: "600", color: "#111827" }}>Bệnh viện Đà Nẵng</Text>
          </View>
          <View style={{ height: 130, borderRadius: 12, backgroundColor: "#DBEAFE", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#EF4444", borderWidth: 2, borderColor: "#fff" }} />
            <Text style={{ position: "absolute", bottom: 8, left: 8, color: "#2563EB", fontWeight: "600", fontSize: 12 }}>Phường 1</Text>
            <Text style={{ position: "absolute", bottom: 8, right: 8, color: "#2563EB", fontWeight: "600", fontSize: 12 }}>Phường 3</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function PriceBox({ icon, label, value }) {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.35)", borderWidth: 1, borderRadius: 12, padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {icon}
        <Text style={{ color: "#DBEAFE", fontSize: 12 }}>{label}</Text>
      </View>
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>{value}</Text>
    </View>
  );
}

function RowDot({ title, subtitle }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
      <View>
        <Text style={{ fontWeight: "600", color: "#111827" }}>{title}</Text>
        <Text style={{ color: "#6B7280" }}>{subtitle}</Text>
      </View>
    </View>
  );
}

function RowIcon({ icon, title, subtitle, right }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {icon}
      <View style={{ alignItems: right ? "flex-end" : "flex-start" }}>
        {!!title && <Text style={{ fontWeight: "600", color: "#111827" }}>{title}</Text>}
        <Text style={{ color: "#6B7280", fontWeight: right ? "700" : "400" }}>{subtitle}</Text>
      </View>
    </View>
  );
}
