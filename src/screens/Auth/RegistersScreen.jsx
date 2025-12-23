import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { launchCamera } from 'react-native-image-picker';

import { userService } from '../../services/userService';
import logo from '../../assets/logoBrand.png';
import { SafeAreaView } from 'react-native-safe-area-context';

const isValidPhone = (p) => /^\s*(\+?84|0)\d{9}\s*$/.test(String(p || ''));

const Btn = ({ title, onPress, disabled, leftIcon }) => (
  <TouchableOpacity
    onPress={disabled ? undefined : onPress}
    activeOpacity={0.85}
    disabled={disabled}
    style={[styles.btn, disabled && styles.btnDisabled]}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {leftIcon ? <Icon name={leftIcon} size={18} color="#fff" style={{ marginRight: 8 }} /> : null}
      <Text style={styles.btnText}>{title}</Text>
    </View>
  </TouchableOpacity>
);

const OutlineBtn = ({ title, onPress, disabled, leftIcon }) => (
  <TouchableOpacity
    onPress={disabled ? undefined : onPress}
    activeOpacity={0.85}
    disabled={disabled}
    style={[styles.btnOutline, disabled && { opacity: 0.6 }]}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {leftIcon ? <Icon name={leftIcon} size={18} color={stylesColors.primary} style={{ marginRight: 8 }} /> : null}
      <Text style={styles.btnOutlineText}>{title}</Text>
    </View>
  </TouchableOpacity>
);

const Toggle = ({ active, label, onPress, disabled }) => (
  <TouchableOpacity
    onPress={disabled ? undefined : onPress}
    activeOpacity={disabled ? 1 : 0.8}
    style={[
      styles.toggle,
      active && styles.toggleActive,
      disabled && { opacity: 0.6 },
    ]}
  >
    <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const StepPills = ({ step }) => {
  const s = useMemo(() => {
    // step đang dùng: 1,2,2.1,3,4
    if (step === 1) return 1;
    if (step === 2 || step === 2.1) return 2;
    if (step === 3) return 3;
    if (step === 4) return 4;
    return 1;
  }, [step]);

  return (
    <View style={styles.stepRow}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.stepDot, s >= i ? styles.stepDotActive : null]}>
          <Text style={[styles.stepDotText, s >= i ? styles.stepDotTextActive : null]}>{i}</Text>
        </View>
      ))}
    </View>
  );
};

const Header = ({ title, sub, showBack, onBack }) => (
  <View style={styles.header}>
    <View style={styles.headerTop}>
      {showBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backCircle} activeOpacity={0.85}>
          <Icon name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 44 }} />
      )}

      <Image source={logo} style={styles.headerLogo} />

      <View style={{ width: 44 }} />
    </View>

    <Text style={styles.h1}>{title}</Text>
    {sub ? <Text style={styles.h2}>{sub}</Text> : null}
  </View>
);

export default function RegistersScreen() {
  const nav = useNavigation();
  const inputRefs = useRef([]);

  const [step, setStep] = useState(1);
  const [countdown, setCountdown] = useState(60);
  const [role, setRole] = useState('elderly');

  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState(false);

  const [identityCard, setIdentityCard] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('Khác');
  const [address, setAddress] = useState('');

  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    if (step !== 2.1 || countdown <= 0) return;
    const timer = setInterval(() => setCountdown((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  useEffect(() => {
    return () => {
      cleanupOnExit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanupOnExit = async () => {
    if (phoneNumber && step > 1 && step < 4) {
      try {
        await userService.cleanupTempData({ phoneNumber });
      } catch {}
    }
  };

  const handleBack = (newStep) => {
    if (newStep < step) cleanupOnExit();
    setStep(newStep);
  };

  const handleSendOTP = async () => {
    if (!isValidPhone(phoneNumber)) {
      setPhoneError('Số điện thoại không hợp lệ');
      return;
    }
    if (loading) return;
    try {
      setLoading(true);
      const res = await userService.sendOTP({ phoneNumber: phoneNumber.trim(), role });
      setLoading(false);
      if (res.success) {
        setPhoneError('');
        setOtp('');
        setOtpError(false);
        setStep(2.1);
        setCountdown(60);
        setTimeout(() => inputRefs.current[0]?.focus?.(), 200);
      } else {
        setPhoneError(res.message || 'Không gửi được OTP');
      }
    } catch {
      setLoading(false);
      setPhoneError('Không gửi được OTP');
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 4) {
      setOtpError(true);
      return;
    }
    if (loading) return;
    try {
      setLoading(true);
      const res = await userService.verifyOTP({ phoneNumber: phoneNumber.trim(), otp });
      setLoading(false);
      if (res.success) {
        setOtpError(false);
        setStep(3);
      } else setOtpError(true);
    } catch {
      setLoading(false);
      setOtpError(true);
    }
  };

  const requestCameraPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const camera = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      const readImages = await PermissionsAndroid
        .request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES)
        .catch(() => PermissionsAndroid.RESULTS.GRANTED);
      const readStorage = await PermissionsAndroid
        .request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE)
        .catch(() => PermissionsAndroid.RESULTS.GRANTED);

      const ok =
        camera === PermissionsAndroid.RESULTS.GRANTED &&
        (readImages === PermissionsAndroid.RESULTS.GRANTED ||
          readStorage === PermissionsAndroid.RESULTS.GRANTED);
      if (!ok) Alert.alert('Quyền bị từ chối', 'Vui lòng cấp quyền Camera và Ảnh.');
      return ok;
    } catch {
      return false;
    }
  };

  const captureSide = async (side) => {
    const hasPerm = await requestCameraPermissions();
    if (!hasPerm) return null;

    const result = await launchCamera({
      mediaType: 'photo',
      includeBase64: true,
      quality: 0.75,
      cameraType: 'back',
      saveToPhotos: false,
      includeExtra: true,
    });

    if (result?.didCancel || result?.errorCode) return null;

    const asset = result?.assets?.[0];
    if (!asset?.uri || !asset?.type) {
      Alert.alert('Lỗi', 'Không nhận được dữ liệu ảnh');
      return null;
    }

    const mime = asset.type || 'image/jpeg';
    const nameGuess = asset.fileName || `${side}.jpg`;
    const preview = asset.base64 ? `data:${mime};base64,${asset.base64}` : null;

    if (side === 'front') {
      setFrontPreview(preview);
      setFrontFile({ uri: asset.uri, type: mime, name: nameGuess });
    }
    if (side === 'back') {
      setBackPreview(preview);
      setBackFile({ uri: asset.uri, type: mime, name: nameGuess });
    }
  };

  const handleExtractFromImages = async () => {
    if (!frontFile || !backFile) {
      Alert.alert('Thiếu ảnh', 'Vui lòng chụp đủ 2 mặt CCCD.');
      return;
    }
    if (loading) return;

    try {
      setLoading(true);
      const res = await userService.uploadCCCD({
        phoneNumber: phoneNumber.trim(),
        frontFile,
        backFile,
      });

      if (res?.success && res?.data) {
        setIdentityCard(res.data.identityCard || '');
        setFullName(res.data.fullName || '');
        setDateOfBirth(res.data.dateOfBirth || '');
        setGender(res.data.gender || 'Khác');
        setAddress(res.data.address || '');
        setStep(4);
      } else {
        const msg = res?.message || 'Không thể gửi thông tin CCCD';
        if (res?.nextStep === 'enterPhone') {
          Alert.alert('Phiên hết hạn', 'Vui lòng nhập lại số điện thoại để bắt đầu.');
          setStep(2);
        } else if (/Session\s+đăng ký tạm thời|Session\s+hết hạn/i.test(msg)) {
          Alert.alert('Phiên hết hạn', 'Vui lòng xác thực OTP lại để tiếp tục.');
          setStep(2.1);
        } else {
          Alert.alert('Lỗi', msg);
        }
      }
    } catch (err) {
      const msg = err?.message || 'Không thể trích xuất';
      if (err?.response?.data?.nextStep === 'enterPhone') {
        Alert.alert('Phiên hết hạn', 'Vui lòng nhập lại số điện thoại để bắt đầu.');
        setStep(2);
      } else if (/Session\s+đăng ký tạm thời|Session\s+hết hạn/i.test(msg)) {
        Alert.alert('Phiên hết hạn', 'Vui lòng xác thực OTP lại để tiếp tục.');
        setStep(2.1);
      } else {
        Alert.alert('Lỗi', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!password || password.length < 6) {
      Alert.alert('Mật khẩu không hợp lệ', 'Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (loading) return;

    try {
      setLoading(true);
      const res = await userService.completeProfile({
        phoneNumber: phoneNumber.trim(),
        password,
        fullName,
        gender,
        dateOfBirth,
        address,
      });
      if (res.success) {
        Alert.alert('Đăng Ký Thành Công');
        nav.navigate('Login');
      } else {
        const msg = res?.message || 'Hoàn tất không thành công';
        if (res?.nextStep === 'enterPhone') {
          Alert.alert('Phiên hết hạn', 'Vui lòng nhập lại số điện thoại để bắt đầu.');
          setStep(2);
        } else if (/Session\s+đăng ký tạm thời|Session\s+hết hạn/i.test(msg)) {
          Alert.alert('Phiên hết hạn', 'Vui lòng xác thực OTP lại để tiếp tục.');
          setStep(2.1);
        } else {
          Alert.alert('Lỗi', msg);
        }
      }
    } catch (e) {
      const msg = e?.message || 'Hoàn tất không thành công';
      if (e?.response?.data?.nextStep === 'enterPhone') {
        Alert.alert('Phiên hết hạn', 'Vui lòng nhập lại số điện thoại để bắt đầu.');
        setStep(2);
      } else if (/Session\s+đăng ký tạm thời|Session\s+hết hạn/i.test(msg)) {
        Alert.alert('Phiên hết hạn', 'Vui lòng xác thực OTP lại để tiếp tục.');
        setStep(2.1);
      } else {
        Alert.alert('Lỗi', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const bottomLogin = (
    <Text style={styles.bottomText}>
      Bạn đã có tài khoản{' '}
      <Text onPress={() => nav.navigate('Login')} style={styles.bottomLink}>
        Đăng nhập ngay
      </Text>
    </Text>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepPills step={step} />

          {step === 1 && (
            <>
              <Header
                title={'E-CARE\nChào mừng bạn!'}
                sub="Vui lòng chọn vai trò để tiếp tục"
                showBack={false}
              />

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Chọn vai trò</Text>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setRole('elderly')}
                  style={[styles.roleCard, role === 'elderly' && styles.roleCardActive]}
                >
                  <View
  style={[
    styles.roleIconWrap,
    role === 'elderly' && styles.roleIconWrapActive,
  ]}
>
  <Icon
    name="person"
    size={20}
    color={role === 'elderly' ? '#fff' : stylesColors.primary}
  />
</View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleTitle, role === 'elderly' && { color: stylesColors.primary }]}>
                      Người cao tuổi
                    </Text>
                    <Text style={styles.roleDesc}>Tôi là người cao tuổi cần được chăm sóc</Text>
                  </View>
                  {role === 'elderly' ? <Icon name="checkmark-circle" size={22} color={stylesColors.primary} /> : null}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setRole('family')}
                  style={[styles.roleCard, role === 'family' && styles.roleCardActive]}
                >
                  <View
  style={[
    styles.roleIconWrap,
    role === 'family' && styles.roleIconWrapActive,
  ]}
>
  <Icon
    name="people"
    size={20}
    color={role === 'family' ? '#fff' : stylesColors.primary}
  />
</View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleTitle, role === 'family' && { color: stylesColors.primary }]}>
                      Thành viên gia đình
                    </Text>
                    <Text style={styles.roleDesc}>Tôi muốn chăm sóc và theo dõi người cao tuổi</Text>
                  </View>
                  {role === 'family' ? <Icon name="checkmark-circle" size={22} color={stylesColors.primary} /> : null}
                </TouchableOpacity>

                <Btn title="TIẾP TỤC" onPress={() => setStep(2)} leftIcon="arrow-forward" />
                {bottomLogin}
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <Header
                title="Đăng ký"
                sub="Nhập số điện thoại để nhận mã OTP"
                showBack
                onBack={() => handleBack(1)}
              />

              <View style={styles.card}>
                <Text style={styles.label}>Số điện thoại</Text>
                <TextInput
                  placeholder="Nhập số điện thoại của bạn"
                  placeholderTextColor="#9ca3af"
                  value={phoneNumber}
                  onChangeText={(t) => {
                    setPhoneNumber(t);
                    setPhoneError('');
                  }}
                  keyboardType="phone-pad"
                  style={[styles.input, phoneError && styles.inputError]}
                />
                {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}

                <Btn title="GỬI MÃ OTP" onPress={handleSendOTP} disabled={loading} leftIcon="chatbubble-ellipses" />
                {bottomLogin}
              </View>
            </>
          )}

          {step === 2.1 && (
            <>
              <Header
                title="Xác thực OTP"
                sub="Nhập 4 chữ số được gửi về điện thoại"
                showBack
                onBack={() => handleBack(2)}
              />

              <View style={styles.card}>
                <View style={styles.infoLine}>
                  <Icon name="call" size={18} color="#6b7280" style={{ marginRight: 8 }} />
                  <Text style={styles.infoText}>Gửi đến: {phoneNumber || '---'}</Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <TextInput
                      key={i}
                      ref={(ref) => (inputRefs.current[i] = ref)}
                      value={otp[i] || ''}
                      onChangeText={(val) => {
                        const digit = (val || '').replace(/[^0-9]/g, '');
                        const newOtp = otp.split('');
                        newOtp[i] = digit;
                        setOtp(newOtp.join(''));
                        if (digit && i < 3) inputRefs.current[i + 1]?.focus();
                      }}
                      onKeyPress={({ nativeEvent }) => {
                        if (nativeEvent.key === 'Backspace') {
                          const current = otp[i] || '';
                          const newOtp = otp.split('');
                          if (current) {
                            newOtp[i] = '';
                            setOtp(newOtp.join(''));
                            if (i > 0) inputRefs.current[i - 1]?.focus();
                          } else if (i > 0) {
                            inputRefs.current[i - 1]?.focus();
                            newOtp[i - 1] = '';
                            setOtp(newOtp.join(''));
                          }
                        }
                      }}
                      maxLength={1}
                      keyboardType="number-pad"
                      style={[styles.otpInput, otpError && styles.otpInputError]}
                    />
                  ))}
                </View>

                {otpError && <Text style={[styles.error, { textAlign: 'center' }]}>Mã OTP không chính xác</Text>}

                <Btn title="XÁC THỰC" onPress={handleVerifyOTP} disabled={loading} leftIcon="shield-checkmark" />

                <View style={{ marginTop: 14, alignItems: 'center' }}>
                  {countdown > 0 ? (
                    <Text style={{ color: '#6b7280' }}>Gửi lại mã trong {countdown}s</Text>
                  ) : (
                    <TouchableOpacity onPress={handleSendOTP} activeOpacity={0.85}>
                      <Text style={{ color: stylesColors.primary, fontWeight: '800' }}>Gửi lại mã</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Header
                title="Xác minh CCCD"
                sub="Chụp 2 mặt CCCD để hệ thống tự điền thông tin"
                showBack
                onBack={() => handleBack(2.1)}
              />

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Ảnh CCCD</Text>

                <View style={styles.twoCol}>
                  <View style={styles.imgBox}>
                    <View style={styles.imgTop}>
                      <Text style={styles.imgLabel}>Mặt trước</Text>
                      {frontPreview ? <Icon name="checkmark-circle" size={18} color={stylesColors.success} /> : null}
                    </View>

                    {frontPreview ? (
                      <Image source={{ uri: frontPreview }} style={styles.cccdImg} />
                    ) : (
                      <View style={styles.imgPlaceholder}>
                        <Icon name="image-outline" size={26} color="#9ca3af" />
                        <Text style={styles.imgHint}>Chưa có ảnh</Text>
                      </View>
                    )}

                    {frontPreview ? (
                      <OutlineBtn title="Chụp lại" onPress={() => captureSide('front')} leftIcon="camera" />
                    ) : (
                      <Btn title="Chụp" onPress={() => captureSide('front')} leftIcon="camera" />
                    )}
                  </View>

                  <View style={styles.imgBox}>
                    <View style={styles.imgTop}>
                      <Text style={styles.imgLabel}>Mặt sau</Text>
                      {backPreview ? <Icon name="checkmark-circle" size={18} color={stylesColors.success} /> : null}
                    </View>

                    {backPreview ? (
                      <Image source={{ uri: backPreview }} style={styles.cccdImg} />
                    ) : (
                      <View style={styles.imgPlaceholder}>
                        <Icon name="image-outline" size={26} color="#9ca3af" />
                        <Text style={styles.imgHint}>Chưa có ảnh</Text>
                      </View>
                    )}

                    {backPreview ? (
                      <OutlineBtn title="Chụp lại" onPress={() => captureSide('back')} leftIcon="camera" />
                    ) : (
                      <Btn title="Chụp" onPress={() => captureSide('back')} leftIcon="camera" />
                    )}
                  </View>
                </View>

                <Btn
                  title="TRÍCH XUẤT & GỬI"
                  onPress={handleExtractFromImages}
                  disabled={!(frontFile && backFile) || loading}
                  leftIcon="cloud-upload"
                />
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <Header
                title="Hoàn tất hồ sơ"
                sub="Kiểm tra và bổ sung thông tin trước khi tạo tài khoản"
                showBack
                onBack={() => handleBack(3)}
              />

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Thông tin từ CCCD</Text>

                <Text style={styles.label}>Họ và tên</Text>
                <TextInput
                  placeholder="Họ và tên"
                  placeholderTextColor="#9ca3af"
                  value={fullName}
                  onChangeText={setFullName}
                  style={styles.input}
                />

                <Text style={styles.label}>Ngày sinh</Text>
                <TextInput
                  placeholder="Ngày sinh (dd/mm/yyyy)"
                  value={dateOfBirth}
                  editable={false}
                  selectTextOnFocus={false}
                  style={styles.readonly}
                />

                <Text style={styles.label}>Giới tính</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {gender === 'Nam' ? (
                    <Toggle label="Nam" active disabled onPress={() => {}} />
                  ) : gender === 'Nữ' ? (
                    <Toggle label="Nữ" active disabled onPress={() => {}} />
                  ) : (
                    <Toggle label="Khác" active disabled onPress={() => {}} />
                  )}
                </View>

                <Text style={styles.label}>Số CCCD</Text>
                <TextInput placeholder="Số CCCD" editable={false} value={identityCard} style={styles.readonly} />

                <Text style={styles.label}>Địa chỉ thường trú</Text>
                <TextInput
                  placeholder="Địa chỉ thường trú"
                  placeholderTextColor="#9ca3af"
                  value={address}
                  onChangeText={setAddress}
                  style={styles.input}
                />

                <Text style={styles.label}>Mật khẩu</Text>
                <TextInput
                  placeholder="Mật khẩu (>=6 ký tự)"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={styles.input}
                />

                <Btn title="HOÀN TẤT ĐĂNG KÝ" onPress={handleComplete} disabled={loading} leftIcon="checkmark" />
              </View>
            </>
          )}

          {loading ? (
            <View style={{ marginTop: 14, alignItems: 'center' }}>
              <ActivityIndicator size="large" />
              <Text style={{ marginTop: 8, color: '#6b7280' }}>Đang xử lý…</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const stylesColors = {
  primary: '#2563eb',
  primarySoft: '#e6f0ff',
  text: '#111827',
  sub: '#6b7280',
  border: '#e5e7eb',
  bg: '#ffffff',
  success: '#22c55e',
};

const styles = {
  safe: { flex: 1, backgroundColor: stylesColors.bg },

  // Header
  header: {
    paddingTop: 6,
    paddingBottom: 14,
    alignItems: 'center',
  },
  headerTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: stylesColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  headerLogo: { width: 110, height: 40, resizeMode: 'contain' },
  h1: { fontSize: 22, fontWeight: '900', color: stylesColors.text, textAlign: 'center' },
  h2: { marginTop: 6, fontSize: 14, color: stylesColors.sub, textAlign: 'center', lineHeight: 20 },

  // Steps
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: stylesColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  stepDotActive: { borderColor: stylesColors.primary, backgroundColor: stylesColors.primarySoft },
  stepDotText: { fontSize: 12, fontWeight: '800', color: '#9ca3af' },
  stepDotTextActive: { color: stylesColors.primary },

  // Card
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: stylesColors.border,
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
    }),
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: stylesColors.text, marginBottom: 10 },

  label: { marginTop: 10, fontSize: 12, fontWeight: '800', color: '#374151' },

  input: {
    borderWidth: 1,
    borderColor: stylesColors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 8,
    color: stylesColors.text,
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#ef4444' },

  readonly: {
    borderWidth: 1,
    borderColor: stylesColors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 8,
    color: '#6b7280',
    backgroundColor: '#f6f7f9',
  },

  error: { color: '#ef4444', marginTop: 8, fontWeight: '700' },

  // Buttons
  btn: {
    backgroundColor: stylesColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
  },
  btnDisabled: { backgroundColor: '#9ca3af' },
  btnText: { color: '#fff', fontWeight: '900', letterSpacing: 0.3 },

  btnOutline: {
    borderWidth: 1,
    borderColor: stylesColors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: '#fff',
  },
  btnOutlineText: { color: stylesColors.primary, fontWeight: '900', letterSpacing: 0.3 },

  // Bottom login
  bottomText: { marginTop: 16, color: stylesColors.text, textAlign: 'center' },
  bottomLink: { color: stylesColors.primary, fontWeight: '900' },

  // Role cards
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: stylesColors.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    backgroundColor: '#fff',
  },
  roleCardActive: { borderColor: stylesColors.primary, backgroundColor: stylesColors.primarySoft },
  roleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: stylesColors.primary,
    backgroundColor: '#fff',
  },
  roleTitle: { fontSize: 16, fontWeight: '900', color: stylesColors.text },
  roleDesc: { marginTop: 3, fontSize: 13, color: stylesColors.sub, lineHeight: 18 },

  // OTP
  otpInput: {
    width: 54,
    height: 54,
    borderWidth: 1,
    borderColor: stylesColors.border,
    textAlign: 'center',
    fontSize: 20,
    marginHorizontal: 6,
    borderRadius: 14,
    color: stylesColors.text,
    backgroundColor: '#fff',
    fontWeight: '900',
  },
  otpInputError: { borderColor: '#ef4444' },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: stylesColors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  infoText: { color: '#374151', fontWeight: '700' },

  // CCCD capture
  twoCol: { flexDirection: 'row', gap: 12 },
  imgBox: { flex: 1 },
  imgTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  imgLabel: { fontSize: 13, fontWeight: '900', color: stylesColors.text },
  cccdImg: { width: '100%', height: 160, borderRadius: 14, backgroundColor: '#f3f4f6' },
  imgPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: stylesColors.border,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgHint: { marginTop: 6, color: '#9ca3af', fontWeight: '700' },

  // Toggle
  toggle: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: stylesColors.border,
    backgroundColor: '#fff',
    marginRight: 10,
    marginTop: 8,
  },
  toggleActive: { borderColor: stylesColors.primary, backgroundColor: stylesColors.primarySoft },
  toggleText: { color: '#374151', fontWeight: '800' },
  toggleTextActive: { color: stylesColors.primary },
  roleIconWrapActive: {
  backgroundColor: stylesColors.primary,
  borderColor: stylesColors.primary,
},

};
