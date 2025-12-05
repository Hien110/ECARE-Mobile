import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { userService } from '../../services/userService';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Feather from 'react-native-vector-icons/Feather';

const { height } = Dimensions.get('window');

const HEADER_COLOR = '#4F7EFF';
const WHITE = '#FFFFFF';
const TEXT = '#0F172A';
const SUB = '#6B7280';
const BORDER = '#E6EDFF';

const HEADER_H = 80;

const PasswordField = ({
  label,
  value,
  onChangeText,
  secure,
  onToggle,
  placeholder,
  iconName = 'lock-closed-outline',
}) => (
  <>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputRow}>
      <Ionicons
        name={iconName}
        size={18}
        color="#8EA5FF"
        style={styles.leftIcon}
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#9AA4B2"
        secureTextEntry={!secure}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
      />
      <TouchableOpacity
        style={styles.eyeBtn}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <Ionicons name={secure ? 'eye' : 'eye-off'} size={20} color="#7C8DB5" />
      </TouchableOpacity>
    </View>
  </>
);
const ChangePasswordScreen = ({ navigation }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  const onRefresh = useCallback(() => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowOld(false);
    setShowNew(false);
    setShowConfirm(false);
    setError('');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await userService.getUser?.();
        if (res?.success) setUser(res.data || null);
      } catch {}
    })();
  }, []);

  const validate = useCallback(() => {
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return false;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return false;
    }
    if (/\s/.test(newPassword)) {
      setError('Mật khẩu mới không được có dấu cách.');
      return false;
    }
    if (newPassword === oldPassword) {
      setError('Mật khẩu mới không được trùng mật khẩu cũ.');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return false;
    }
    setError('');
    return true;
  }, [oldPassword, newPassword, confirmPassword]);

  const handleChangePassword = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await userService.changePassword({
        oldPassword: oldPassword.trim(),
        newPassword: newPassword.trim(),
      });

      if (res?.success) {
        navigation.navigate('SuccessScreen', {
          title: 'Đổi mật khẩu thành công',
          description:
            res.message ||
            'Bạn đã đổi mật khẩu thành công! Quay lại trang chủ.',
          navigate: user?.role === 'elderly' ? 'ElderHome' : 'FamilyMemberHome',
        });
      } else {
        setError(res?.message || 'Đổi mật khẩu thất bại, vui lòng thử lại.');
      }
    } catch (e) {
      setError('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          {navigation.canGoBack() ? (
            <TouchableOpacity
              onPress={navigation.goBack}
              style={styles.iconBtn}
              activeOpacity={0.8}
            >
              <Feather name="chevron-left" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtnPlaceholder} />
          )}

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Thay đổi mật khẩu</Text>
            <Text style={styles.headerSubtitle}>Bảo vệ tài khoản của bạn</Text>
          </View>

          <TouchableOpacity
            onPress={onRefresh}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <Feather name="refresh-ccw" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hintBox}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color="#2563EB"
            />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={styles.hintTitle}>Yêu cầu mật khẩu</Text>
              <Text style={styles.hintText}>• Ít nhất 6 ký tự</Text>
              <Text style={styles.hintText}>• Không chứa dấu cách</Text>
              <Text style={styles.hintText}>• Khác mật khẩu hiện tại</Text>
            </View>
          </View>

          <PasswordField
            label="Mật khẩu cũ"
            value={oldPassword}
            onChangeText={setOldPassword}
            secure={showOld}
            onToggle={() => setShowOld(!showOld)}
            placeholder="Nhập mật khẩu cũ"
            iconName="key-outline"
          />
          <PasswordField
            label="Mật khẩu mới"
            value={newPassword}
            onChangeText={setNewPassword}
            secure={showNew}
            onToggle={() => setShowNew(!showNew)}
            placeholder="Nhập mật khẩu mới"
          />
          <PasswordField
            label="Nhập lại mật khẩu mới"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secure={showConfirm}
            onToggle={() => setShowConfirm(!showConfirm)}
            placeholder="Nhập lại mật khẩu mới"
            iconName="repeat-outline"
          />

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color="#B91C1C"
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleChangePassword}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Lưu mật khẩu</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChangePasswordScreen;

/* ================== Styles ================== */
const styles = StyleSheet.create({
  screen: { flex: 1 },

  headerWrap: {
    backgroundColor: HEADER_COLOR,
    paddingHorizontal: wp('4%'),
    paddingTop: hp('1%'),
    paddingBottom: hp('2.4%'),
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: HEADER_COLOR,
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnPlaceholder: { width: 40, height: 40 },

  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: wp('3.4%'),
    marginTop: 2,
  },

  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    minHeight: height - HEADER_H,
  },

  label: {
    fontSize: 13,
    color: SUB,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  inputRow: {
    position: 'relative',
    marginBottom: 4,
  },

  leftIcon: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    zIndex: 1,
  },

  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingLeft: 40,
    paddingRight: 44,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT,
    backgroundColor: WHITE,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 1 },
    }),
  },

  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#F4F7FF',
    marginBottom: 8,
  },

  hintTitle: { fontWeight: '700', color: TEXT, marginBottom: 2 },
  hintText: { color: SUB, fontSize: 13, marginTop: 2 },

  errorBox: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorText: { color: '#9F1239', flex: 1, fontSize: 13 },

  button: {
    marginTop: 18,
    backgroundColor: HEADER_COLOR,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: HEADER_COLOR,
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    }),
  },

  buttonDisabled: { backgroundColor: '#94A3B8' },

  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});