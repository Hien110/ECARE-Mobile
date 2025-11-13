import React, { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { doctorService } from '../../services/doctorService';
import { fetchDoctorProfile, hasDoctorProfile } from '../../utils/doctorProfileGate';

export default function ProfileGateScreen({ navigation }) {
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          // luôn force để bảo đảm mới nhất khi người dùng bấm tab
          const profile = await fetchDoctorProfile(doctorService, { force: true });
          if (cancelled) return;
          navigation.replace(
            hasDoctorProfile(profile) ? 'ViewDoctorProfile' : 'IntroductionCreateDoctorProfile'
          );
        } catch (e) {
          if (cancelled) return;
          // nếu API lỗi cứ cho vào intro để người dùng còn thấy nút tạo (tuỳ bạn)
          navigation.replace('IntroductionCreateDoctorProfile');
        }
      })();

      return () => { cancelled = true; };
    }, [navigation])
  );

  // tạm hiển thị spinner trong lúc replace
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
