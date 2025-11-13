import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { userService } from '../../services/userService';
import InputPhonenumber from '../../components/inputPhonenumber';

const ForgotPasswordScreen = ({ navigation }) => {
  const [phone, setPhone] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSendOTP = async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      setError('Vui lòng nhập số điện thoại');
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại');
      return;
    }
    setError('');

    setLoading(true);
    try {
      const result = await userService.sendForgotPasswordOTP({
        phoneNumber: trimmed,
      });

      if (result?.success) {
        Alert.alert('Thành công', result.message, [
          {
            text: 'OK',
            onPress: () =>
              navigation.navigate('VerifySMS', {
                phoneNumber: trimmed,
                isResetPassword: true,
              }),
          },
        ]);
      } else {
        Alert.alert('Lỗi', result?.message || 'Không thể gửi mã OTP');
      }
    } catch (e) {
      console.error('Send OTP error:', e);
      Alert.alert('Lỗi', 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Back */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-back" size={28} color="#000" />
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Quên mật khẩu</Text>
          <Text style={styles.description}>
            Vui lòng nhập số điện thoại của bạn. Một mã xác minh gồm 4 chữ số sẽ được gửi đến SMS của bạn, sau đó
            bạn có thể tạo mật khẩu mới.
          </Text>
        </View>

        {/* Input component */}
        <InputPhonenumber
          value={phone}
          onChangeText={setPhone}
          error={error}
        />

        {/* Button gửi OTP */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendOTP}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 20,
  },
  container: {
    padding: 20,
    alignItems: 'center',
    height: '100%',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    color: '#555',
    marginTop: 10,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 25,
    backgroundColor: '#335CFF',
    paddingVertical: 14,
    paddingHorizontal: 60,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
});
