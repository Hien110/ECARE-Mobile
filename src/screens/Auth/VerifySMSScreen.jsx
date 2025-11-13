import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { userService } from '../../services/userService';
import OtpCodeInput from '../../components/OtpCodeInput';

const VerifySMSScreen = ({ navigation, route }) => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);

  // route params
  const {
    phoneNumber,
    isResetPassword = false,
    isChangePhonenumber = false,
  } = route.params || {};

  const handleResend = async () => {
    setOtp(['', '', '', '']);
    if (!phoneNumber) {
      Alert.alert('Lỗi', 'Không tìm thấy số điện thoại');
      return;
    }

    setLoading(true);
    try {
      if (isResetPassword) {
        const res = await userService.sendForgotPasswordOTP({ phoneNumber });
        Alert.alert(res.success ? 'Thành công' : 'Lỗi', res.message);
      } else if (isChangePhonenumber) {
        const res = await userService.sendChangePhoneOTP({ phoneNumber });
        Alert.alert(res.success ? 'Thành công' : 'Lỗi', res.message);
      } else {
        Alert.alert('Thông báo', 'Chưa cấu hình luồng gửi lại OTP.');
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi gửi lại mã OTP');
      console.error('Resend OTP error:', e);
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
      if (isResetPassword) {
        const res = await userService.verifyForgotPasswordOTP({ phoneNumber, otp: code });
        if (res.success) {
          navigation.navigate('ResetPassword', {
            resetToken: res.data.resetToken,
            phoneNumber,
          });
        } else {
          Alert.alert('Lỗi', res.message);
        }
      } else if (isChangePhonenumber) {
        const res = await userService.verifyChangePhoneOTP({ phoneNumber, otp: code });
        if (res.success) {
          Alert.alert('Thành công', 'Đổi số điện thoại thành công', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Lỗi', res.message);
        }
      } else {
        Alert.alert('Thông báo', 'Chưa cấu hình luồng xác thực cho trường hợp này.');
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi xác thực OTP');
      console.error('Verify OTP error:', e);
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
        <Icon name="arrow-back" size={26} color="#000000ff" />
      </TouchableOpacity>

      <View style={styles.container}>
        <Text style={styles.title}>Nhập mã 4 chữ số</Text>
        <Text style={styles.subtitle}>
          Chúng tôi đã gửi mã đến SMS của bạn, vui lòng kiểm tra hộp thư.
        </Text>

        {/* OTP component */}
        <OtpCodeInput
          value={otp}
          onChange={setOtp}
          onComplete={verify}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {isResetPassword
              ? (loading ? 'Đang xác thực...' : 'Đặt lại mật khẩu')
              : (loading ? 'Đang xác thực...' : 'Xác thực')}
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

export default VerifySMSScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  backButton: { position: 'absolute', top: 20, left: 20, zIndex: 20 },
  container: { flex: 1, marginTop: 20, alignItems: 'center', paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#555', marginTop: 10, lineHeight: 20 },
  button: {
    width: '100%', backgroundColor: '#335CFF', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', marginBottom: 20,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resendText: { fontSize: 15, color: '#335CFF', fontWeight: '500' },
  buttonDisabled: { backgroundColor: '#ccc' },
  textDisabled: { color: '#ccc' },
});
