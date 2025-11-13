import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

const DefaultScreen = () => {
  const navigation = useNavigation();

  const handleGoBack = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vai trò chưa được hỗ trợ</Text>
      <Text style={styles.desc}>
        Tài khoản của bạn không có quyền truy cập ứng dụng này.
      </Text>
      <Button title="Quay lại đăng nhập" onPress={handleGoBack} />
    </View>
  );
};

export default DefaultScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  desc: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    color: "#666",
  },
});
