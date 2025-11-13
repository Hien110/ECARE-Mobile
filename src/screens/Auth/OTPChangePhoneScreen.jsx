import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { userService } from '../../services/userService';
import OtpCodeInput from '../../components/OtpCodeInput';

const OTPChangePhoneScreen = ({ navigation, route }) => {
  // Nhận số điện thoại mới từ màn trước
  const { phoneNumber } = route.params || {};

  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    if (!phoneNumber) {
      Alert.alert('Lỗi', 'Không tìm thấy số điện thoại');
      return;
    }
    setOtp(['', '', '', '']);
    setLoading(true);
    try {
      const res = await userService.sendChangePhoneOTP({ phoneNumber });
      Alert.alert(res.success ? 'Thành công' : 'Lỗi', res.message);
    } catch (e) {
      console.error('Resend OTP error:', e);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi gửi lại mã OTP');
    } finally {
      setLoading(false);
    }
  };

  const verify = async (code) => {
    if (!phoneNumber) {
      Alert.alert('Lỗi', 'Không tìm thấy số điện thoại');
      return;
    }
    setLoading(true);
    try {
      const res = await userService.verifyChangePhoneOTP({ phoneNumber, otp: code });
      if (res.success) {
        Alert.alert('Thành công', 'Đổi số điện thoại thành công', [
          { text: 'OK', onPress: () => navigation.navigate('Profile') },
        ]);
      } else {
        Alert.alert('Lỗi', res.message);
      }
    } catch (e) {
      console.error('Verify OTP error:', e);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi xác thực OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    const code = otp.join('');
    if (code.length !== 4) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ mã OTP');
      return;
    }
    verify(code);
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Back */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={26} color="#000" />
      </TouchableOpacity>

      <View style={styles.container}>
        <Text style={styles.title}>Xác thực số điện thoại</Text>
        <Text style={styles.subtitle}>
          Nhập mã 4 chữ số đã được gửi đến {phoneNumber || 'số điện thoại mới'}.
        </Text>

        <OtpCodeInput value={otp} onChange={setOtp} onComplete={verify} />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Đang xác thực...' : 'Xác thực'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={loading}>
          <Text style={[styles.resendText, loading && styles.textDisabled]}>
            {loading ? 'Đang gửi...' : 'Gửi lại mã'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default OTPChangePhoneScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  backButton: { position: 'absolute', top: 20, left: 20, zIndex: 20 },
  container: { flex: 1, marginTop: 20, alignItems: 'center', paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#555', marginTop: 10, lineHeight: 20, textAlign: 'center' },
  button: {
    width: '100%', backgroundColor: '#335CFF', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', marginBottom: 20,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resendText: { fontSize: 15, color: '#335CFF', fontWeight: '500' },
  buttonDisabled: { backgroundColor: '#ccc' },
  textDisabled: { color: '#ccc' },
});
