import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

const SuccessScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // Lấy params từ navigate
  const { title, description, navigate } = route.params || {};

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 20,
      }}
    >
      {/* Icon Check */}
      <View
        style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          borderWidth: 4,
          borderColor: "#3b82f6",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 30,
        }}
      >
        <Text style={{ fontSize: 50, color: "#3b82f6" }}>✓</Text>
      </View>

      {/* Title */}
      <Text
        style={{
          fontSize: 20,
          fontWeight: "bold",
          color: "#111827",
          textAlign: "center",
          marginBottom: 10,
        }}
      >
        {title || "Thành công"}
      </Text>

      {/* Description */}
      <Text
        style={{
          fontSize: 14,
          color: "#6b7280",
          textAlign: "center",
          marginBottom: 40,
        }}
      >
        {description || "Thao tác đã hoàn tất!"}
      </Text>

      {/* Button */}
      <TouchableOpacity
        style={{
          backgroundColor: "#3b82f6",
          paddingVertical: 14,
          paddingHorizontal: 50,
          borderRadius: 30,
        }}
        onPress={() => navigation.navigate(navigate || "ElderHome")} // hoặc UpdateInfo
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>
          Xong
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default SuccessScreen;
