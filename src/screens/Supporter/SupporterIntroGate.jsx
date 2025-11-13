// src/screens/SupporterIntroGate.jsx
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { supporterService } from '../../services/supporterService';
import { useIsFocused } from '@react-navigation/native';

const SupporterIntroGate = ({ navigation }) => {
  const isFocused = useIsFocused();
  const navigating = useRef(false); // tránh double navigate khi focus lại

  useEffect(() => {
    const run = async () => {
      if (navigating.current || !isFocused) return;
      navigating.current = true;

      try {
        // Gợi ý tối ưu: lấy từ Redux/React Query trước, nếu có cache thì skip network
        const res = await supporterService.getMyProfile();
        if (res?.success && res?.data) {
          navigation.replace('ViewIntroduction'); // đã có hồ sơ
        } else {
          navigation.replace('CreateIntroduction'); // chưa có hồ sơ
        }
      } catch (e) {
        // Lỗi mạng: vẫn cho vào trang tạo để user thử lại
        navigation.replace('CreateIntroduction');
      } finally {
        navigating.current = false;
      }
    };
    run();
  }, [isFocused, navigation]);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#4A90E2" />
      <Text style={styles.hint}>Đang kiểm tra hồ sơ...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' },
  hint: { marginTop: 10, color: '#666' },
});

export default SupporterIntroGate;
