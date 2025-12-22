// src/screens/Doctor/ScheduleScreen.jsx
import React, { useMemo, useState } from "react";
import {ScrollView, View, Text, TouchableOpacity } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { Calendar, CheckCircle2, MapPin } from "lucide-react-native";
import Card from "../../components/Cart";
import { SafeAreaView } from 'react-native-safe-area-context';

const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function ScheduleScreen() {
  const [day, setDay] = useState(0);
  const [selected, setSelected] = useState(null);

  const slots = useMemo(
    () => [
      { id: "1", label: "08:00 - 09:00", status: "available" },
      { id: "2", label: "09:00 - 10:00", status: "booked" },
      { id: "3", label: "10:00 - 11:00", status: "booked" },
      { id: "4", label: "11:00 - 12:00", status: "available" },
      { id: "5", label: "14:00 - 15:00", status: "booked" },
      { id: "6", label: "15:00 - 16:00", status: "booked" },
      { id: "7", label: "16:00 - 17:00", status: "booked" },
      { id: "8", label: "17:00 - 18:00", status: "available" },
    ],
    []
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <LinearGradient colors={["#2563EB", "#3B82F6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>Xem lịch làm việc</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Banner tuần */}
        <Card style={{ overflow: "hidden", borderWidth: 0 }}>
          <LinearGradient colors={["#2563EB", "#3B82F6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Lịch tuần này</Text>
            <Text style={{ color: "#DBEAFE", marginTop: 4 }}>Quản lý thời gian tư vấn hiệu quả</Text>

            <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <CheckCircle2 color="#34D399" />
                <Text style={{ color: "#fff" }}>Sẵn sàng tiếp nhận</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Calendar color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "800" }}>3 ca làm việc</Text>
              </View>
            </View>
          </LinearGradient>
        </Card>

        {/* Chọn ngày trong tuần */}
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 10 }}>Chọn ngày trong tuần</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {DAYS.map((d, i) => {
              const active = day === i;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDay(i)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: active ? "#2563EB" : "#F8FAFC",
                    borderWidth: 1,
                    borderColor: active ? "#2563EB" : "#E5E7EB",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: active ? "#fff" : "#1F2937", fontWeight: "700" }}>{d}</Text>
                  {active && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff", marginTop: 6 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Lịch hôm nay */}
        <Card style={{ padding: 16, marginTop: 12 }}>
          <Text style={{ fontWeight: "700", color: "#111827", marginBottom: 12 }}>Lịch làm việc hôm nay</Text>

          {/* Grid slot */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {slots.map((s) => {
              const isSelected = selected === s.id;
              const palette = isSelected
                ? { bg: "#3B82F6", text: "#fff" }
                : s.status === "available"
                ? { bg: "#34D399", text: "#064E3B" }
                : { bg: "#FB923C", text: "#7C2D12" };

              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelected(s.id)}
                  style={{
                    minWidth: "46%",
                    alignItems: "center",
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: palette.bg,
                    opacity: s.status === "booked" && !isSelected ? 0.9 : 1,
                  }}
                  disabled={s.status === "booked" && !isSelected}
                >
                  <Text style={{ color: palette.text, fontWeight: "700" }}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 }}>
            <LegendDot color="#34D399" label="Trống" />
            <LegendDot color="#FB923C" label="Đã đặt" />
            <LegendDot color="#3B82F6" label="Đã chọn" />
          </View>
        </Card>

        {/* Tóm tắt & đặt lịch */}
        <Card style={{ padding: 16, marginTop: 12 }}>
          <Text style={{ fontWeight: "700", color: "#111827", marginBottom: 8 }}>Thứ {day + 2}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontWeight: "800", color: "#111827" }}>
                {selected ? slots.find((x) => x.id === selected)?.label : "08:00 - 12:00"}
              </Text>
              <Text style={{ color: "#6B7280" }}>Thời gian tư vấn</Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <Badge label="Online" color="#1D4ED8" />
                <Badge label="Đang hoạt động" color="#059669" soft />
              </View>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: "#2563EB", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <MapPin color="#fff" size={16} />
              <Text style={{ color: "#fff", fontWeight: "700" }}>Đặt lịch ngay</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function LegendDot({ color, label }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: "#6B7280" }}>{label}</Text>
    </View>
  );
}

function Badge({ label, color, soft }) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: soft ? "#ECFDF5" : "transparent",
        borderWidth: soft ? 0 : 1,
        borderColor: color,
      }}
    >
      <Text style={{ color, fontWeight: "600", fontSize: 12 }}>{label}</Text>
    </View>
  );
}
