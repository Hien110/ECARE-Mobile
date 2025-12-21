import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  ScrollView,
  SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

import logo from "../../assets/logoBrand.png";
import userService from "../../services/userService";
import socketService from "../../services/socketService";
import NotificationService from "../../services/NotificationService";

export default function LoginScreen() {
  const nav = useNavigation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fadeIn = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;

  const ROLE_TO_ROUTE = {
    elderly: "ElderHome",
    family: "FamilyMemberHome",
    supporter: "SupporterHome",
    doctor: "DoctorHome",
  };
  
  useEffect(() => {
  let mounted = true;

  (async () => {
    try {
      const token = await userService.getToken();
      if (!token) return; 

      let { data: user } = await userService.getUser();
      if (!user) {
        const res = await userService.getUserInfo();
        if (res?.success) {
          user = res.data?.user || res.data;
          await userService.setUser(user);
        } else {
          await userService.logout?.();
          return;
        }
      }

      if (!mounted) return;

      // Auto connect socket khi đã có token hợp lệ
      try {
        console.log('🔌 Auto connecting socket with existing token...');
        await socketService.connect();
        console.log('✅ Socket auto-connected successfully');
      } catch (socketError) {
        console.error('❌ Socket auto-connect failed:', socketError);
        // Không block navigation nếu socket connect thất bại
      }

      const routeName = ROLE_TO_ROUTE[user?.role] || FALLBACK_ROUTE;
      nav.reset({ index: 0, routes: [{ name: routeName }] });
    } catch (e) {
      await userService.logout?.();
    }
  })();

  return () => { mounted = false; };
}, [nav]);


  // Animation
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -6,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeIn, floatY]);


  const handleLogin = async () => {
    setError("");
    setSuccess("");

    if (!phoneNumber || !password) {
      setError("Vui lòng nhập đủ số điện thoại và mật khẩu.");
      return;
    }

    try {
      setLoading(true);
      
      // Disconnect socket cũ trước khi đăng nhập user mới
      socketService.disconnect();
      
      const res = await userService.loginUser({ phoneNumber, password });

      if (!res.success) {
        setError(res.message || "Đăng nhập thất bại");
        return;
      }

      // Lưu token & user
      if (res.token) await userService.setToken(res.token);
      if (res.user) await userService.setUser(res.user);

      setSuccess("Đăng nhập thành công");

      // Kết nối socket với token mới
      try {
        // Disconnect socket cũ trước rồi kết nối lại để đảm bảo dùng token mới
        socketService.disconnect();
        await socketService.connect();
        
        // 🔥 CRITICAL FIX: Force setup listeners NGAY SAU KHI socket connect
        console.log('🔥 [Login] Socket connected, forcing listener setup...');
        const { forceSetupSocketListeners } = require('../../navigation/AppNavigator');
        // Đợi 100ms để đảm bảo socket internal listeners ready
        setTimeout(() => {
          forceSetupSocketListeners();
          console.log('🔥 [Login] Listeners setup forced after login');
        }, 100);
      } catch (err) {
        console.error('Socket connect after login failed:', err);
      }

      // Lưu FCM token sau khi đăng nhập thành công
      try {
        const fcmToken = await NotificationService.getFCMToken();
        if (fcmToken) {
          console.log('✅ FCM token saved after login');
        }
      } catch (err) {
        console.error('❌ Error saving FCM token after login:', err);
        // Không block user nếu lưu FCM token thất bại
      }

      const routeName = ROLE_TO_ROUTE[res.user?.role] || "DefaultScreen";
      nav.reset({
        index: 0,
        routes: [{ name: routeName }],
      });
    } catch (e) {
      setError("Có lỗi xảy ra. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.logoWrap}>
            <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: floatY }] }}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
            </Animated.View>
            <Text style={styles.brand}>E-CARE</Text>
            <Text style={styles.tagline}>Chăm sóc sức khỏe thông minh</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Đăng nhập</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                style={styles.input}
                placeholder="Số điện thoại"
                keyboardType="phone-pad"
                autoCapitalize="none"
                value={phoneNumber}
                placeholderTextColor="#475569"
                onChangeText={setPhoneNumber}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  style={[styles.input, { paddingRight: 44 }]}
                  placeholder="••••••"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  accessibilityLabel="toggle-password-visibility"
                >
                  <Text style={{ color: "#64748b", fontWeight: "600" }}>
                    {showPassword ? "Ẩn" : "Hiện"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.rowBetween}>
              <TouchableOpacity onPress={() => nav.navigate("ForgotPassword")}>
                <Text style={[styles.small, { color: "#2563eb", fontWeight: "600" }]}>
                  Quên mật khẩu?
                </Text>
              </TouchableOpacity>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}
            {!!success && <Text style={styles.success}>{success}</Text>}

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[styles.loginBtn, loading && { opacity: 0.7 }]}
              activeOpacity={0.9}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginText}>Đăng nhập</Text>}
            </TouchableOpacity>

            <View style={{ alignItems: "center", marginTop: 16 }}>
              <Text style={styles.small}>
                Bạn chưa có tài khoản?{" "}
                <Text onPress={() => nav.navigate("Registers")} style={{ color: "#2563eb", fontWeight: "700" }}>
                  Đăng ký ngay
                </Text>
              </Text>
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef2ff" },
  scrollContent: { flexGrow: 1, padding: 20, justifyContent: "center" },

  logoWrap: { alignItems: "center", marginBottom: 18 },
  logo: { width: 120, height: 120, borderRadius: 28 },
  brand: { marginTop: 2, fontSize: 28, fontWeight: "800", color: "#0f172a" },
  tagline: { marginTop: 2, color: "#64748b" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 12, textAlign: "center" },

  field: { marginBottom: 12 },
  label: { fontSize: 13, color: "#334155", marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    color: "#0f172a",
  },
  eyeBtn: { position: "absolute", right: 12, top: 12, padding: 6 },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },

  small: { fontSize: 13, color: "#475569" },

  error: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    borderColor: "#fecaca",
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    textAlign: "center",
  },
  success: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    textAlign: "center",
  },

  loginBtn: {
    height: 52,
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  loginText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
