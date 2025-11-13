import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { userService } from '../../services/userService';
import InputEmail from '../../components/InputEmail';

const ChangeEmailScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidEmail = (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());

  const handleSendOTP = async () => {
    const trimmed = (email || '').trim();
    if (!trimmed) {
      setErr('Vui lòng nhập email');
      Alert.alert('Lỗi', 'Vui lòng nhập email');
      return;
    }
    if (!isValidEmail(trimmed)) {
      setErr('Email không hợp lệ');
      Alert.alert('Lỗi', 'Email không hợp lệ');
      return;
    }
    setErr('');
    setLoading(true);
    try {
      // Cần có 2 API trong userService:
      // sendChangeEmailOTP({ email })
      const res = await userService.sendChangeEmailOTP({ email: trimmed });

      if (res?.success) {
        Alert.alert('Thành công', res.message || 'Đã gửi mã OTP', [
          {
            text: 'OK',
            onPress: () =>
              navigation.navigate('OTPChangeEmail', { email: trimmed }),
          },
        ]);
      } else {
        // ví dụ backend trả "Email đã được đăng ký"
        Alert.alert('Lỗi', res?.message || 'Không thể gửi mã OTP');
      }
    } catch (e) {
      console.error('Send Email OTP error:', e);
      Alert.alert('Lỗi', 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={28} color="#000" />
      </TouchableOpacity>

      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Đổi email</Text>
          <Text style={styles.description}>
            Nhập email mới của bạn. Chúng tôi sẽ gửi mã xác minh gồm 4 chữ số
            tới email để xác nhận thay đổi.
          </Text>
        </View>

        <InputEmail value={email} onChangeText={setEmail} error={err} />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendOTP}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Đang gửi...' : 'Gửi mã OTP'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChangeEmailScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', alignItems: 'center' },
  backButton: { position: 'absolute', top: 20, left: 20, zIndex: 20 },
  container: { padding: 20, alignItems: 'center', height: '100%', width: '100%' },
  header: { alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 22, fontWeight: 'bold' },
  description: { fontSize: 14, color: '#555', marginTop: 10, lineHeight: 20, textAlign: 'center' },
  button: {
    marginTop: 25, backgroundColor: '#335CFF', paddingVertical: 14, paddingHorizontal: 60,
    borderRadius: 8, alignItems: 'center', width: '100%',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { backgroundColor: '#ccc' },
});
