
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { launchCamera } from 'react-native-image-picker';

import { userService } from '../../services/userService';
import logo from '../../assets/logoBrand.png';


const Btn = ({ title, onPress, disabled }) => (
  <TouchableOpacity
    onPress={disabled ? undefined : onPress}
    disabled={disabled}
    style={{
      backgroundColor: disabled ? '#ccc' : '#007bff',
      padding: 12,
      borderRadius: 8,
      marginTop: 12,
      width: '100%',
    }}
  >
    <Text style={{ color: '#fff', textAlign: 'center' }}>{title}</Text>
  </TouchableOpacity>
);


const Toggle = ({ active, label, onPress, disabled }) => (
  <TouchableOpacity
    onPress={disabled ? undefined : onPress}
    activeOpacity={disabled ? 1 : 0.7}
    style={{
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: active ? '#2563eb' : '#ccc',
      backgroundColor: active ? '#e6f0ff' : '#fff',
      marginRight: 8,
      marginTop: 8,
      opacity: disabled ? 0.6 : 1,
    }}
  >
    <Text style={{ color: active ? '#2563eb' : '#333', fontWeight: active ? '700' : '500' }}>
      {label}
    </Text>
  </TouchableOpacity>
);


const isValidPhone = (p) => /^\s*(\+?84|0)\d{9}\s*$/.test(String(p || ''));

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
  const [gender, setGender] = useState('male');        
  const [address, setAddress] = useState('');

  
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [frontMime, setFrontMime] = useState('image/jpeg');
  const [backMime, setBackMime] = useState('image/jpeg');

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
        setStep(2.1);
        setCountdown(60);
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

  // ===== Chụp ảnh (base64) =====
  const captureSide = async (side) => {
    const hasPerm = await requestCameraPermissions();
    if (!hasPerm) return null;

    const result = await launchCamera({
      mediaType: 'photo',
      includeBase64: true,
      quality: 0.7,
      cameraType: 'back',
      saveToPhotos: false,
      includeExtra: true,
    });

    if (result?.didCancel || result?.errorCode) return null;

    const asset = result?.assets?.[0];
    if (!asset?.base64 || !asset?.type) {
      Alert.alert('Lỗi', 'Không nhận được dữ liệu ảnh');
      return null;
    }

    const mime = asset.type || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${asset.base64}`;

    if (side === 'front') {
      setFrontImage(dataUrl);
      setFrontMime(mime);
    }
    if (side === 'back') {
      setBackImage(dataUrl);
      setBackMime(mime);
    }
  };

 
  const handleExtractFromImages = async () => {
    if (!frontImage || !backImage) {
      Alert.alert('Thiếu ảnh', 'Vui lòng chụp đủ 2 mặt CCCD.');
      return;
    }
    if (loading) return;

    try {
      setLoading(true);
      const res = await userService.uploadCCCD({
        phoneNumber: phoneNumber.trim(),
        frontImageBase64: frontImage,
        backImageBase64: backImage,
        frontMime,
        backMime,
      });

      if (res?.success && res?.data) {
        setIdentityCard(res.data.identityCard || '');
        setFullName(res.data.fullName || '');
        setDateOfBirth(res.data.dateOfBirth || '');
        setGender(res.data.gender || 'male'); 
        setAddress(res.data.address || '');
        setStep(4);
      } else {
        const msg = res?.message || 'Không thể gửi thông tin CCCD';
        if (/Session\s+đăng ký tạm thời|Session\s+hết hạn/i.test(msg)) {
          Alert.alert('Phiên hết hạn', 'Vui lòng xác thực OTP lại để tiếp tục.');
          setStep(2.1);
        } else {
          Alert.alert('Lỗi', msg);
        }
      }
    } catch (err) {
      console.error('handleExtractFromImages error:', err);
      const msg = err?.message || 'Không thể trích xuất';
      if (/Session\s+đăng ký tạm thời|Session\s+hết hạn/i.test(msg)) {
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
        if (/Session\s+đăng ký tạm thời|Session\s+hết hạn/i.test(msg)) {
          Alert.alert('Phiên hết hạn', 'Vui lòng xác thực OTP lại để tiếp tục.');
          setStep(2.1);
        } else {
          Alert.alert('Lỗi', msg);
        }
      }
    } catch (e) {
      const msg = e?.message || 'Hoàn tất không thành công';
      if (/Session\s+đăng ký tạm thời|Session\s+hết hạn/i.test(msg)) {
        Alert.alert('Phiên hết hạn', 'Vui lòng xác thực OTP lại để tiếp tục.');
        setStep(2.1);
      } else {
        Alert.alert('Lỗi', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
 
      {step === 1 && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ marginTop: 25 }}>
            <Image source={logo} style={{ width: 200, height: 100, resizeMode: 'contain' }} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
            E-CARE{'\n'}Chào mừng bạn!
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 24, textAlign: 'center' }}>
            Vui lòng chọn vai trò của bạn để tiếp tục
          </Text>

          <TouchableOpacity onPress={() => setRole('elderly')} style={styles.role(role === 'elderly')}>
            <Text style={styles.roleTitle}>Người cao tuổi</Text>
            <Text style={styles.roleDesc}>Tôi là người cao tuổi cần được chăm sóc</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setRole('family')} style={styles.role(role === 'family')}>
            <Text style={styles.roleTitle}>Thành viên gia đình</Text>
            <Text style={styles.roleDesc}>Tôi muốn chăm sóc và theo dõi người cao tuổi</Text>
          </TouchableOpacity>

          <Btn title="TIẾP TỤC" onPress={() => setStep(2)} />
          <Text style={{ marginTop: 16 }}>
            Bạn đã có tài khoản{' '}
            <Text onPress={() => nav.navigate('Login')} style={{ color: '#2563eb', fontWeight: '700' }}>
              Đăng Nhập ngay
            </Text>
          </Text>
        </View>
      )}

     
      {step === 2 && (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => handleBack(1)}>
            <Icon name="arrow-back" size={28} color="#000" />
          </TouchableOpacity>

          <TextInput
            placeholder="Nhập số điện thoại của bạn"
            value={phoneNumber}
            onChangeText={(t) => {
              setPhoneNumber(t);
              setPhoneError('');
            }}
            keyboardType="phone-pad"
            style={[styles.input, { borderColor: phoneError ? 'red' : '#ccc' }]}
          />
          {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}

          <Btn title="Đăng ký" onPress={handleSendOTP} disabled={loading} />
          <Text style={{ fontSize: 14, textAlign: 'center', marginTop: 16 }}>
            Bạn đã có tài khoản{' '}
            <Text onPress={() => nav.navigate('Login')} style={{ color: '#2563eb', fontWeight: '700' }}>
              Đăng Nhập ngay
            </Text>
          </Text>
        </View>
      )}

   
      {step === 2.1 && (
        <View style={{ flex: 1, paddingTop: 80, alignItems: 'center' }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => handleBack(2)}>
            <Icon name="arrow-back" size={28} color="#000" />
          </TouchableOpacity>

          <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 12, color: '#000' }}>Xác thực số điện thoại</Text>
          <Text style={{ color: '#666', marginBottom: 20, textAlign: 'center' }}>
            Chúng tôi sẽ gửi một mã đến số điện thoại của bạn để xác nhận đó là của bạn
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
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
                style={[styles.otpInput, { borderColor: otpError ? 'red' : '#ccc' }]}
              />
            ))}
          </View>

          {otpError && <Text style={styles.error}>Mã OTP không chính xác</Text>}

          <Btn title="Xác thực" onPress={handleVerifyOTP} disabled={loading} />

          {countdown > 0 ? (
            <Text style={{ marginTop: 16, color: '#666' }}>Gửi lại mã trong {countdown}s</Text>
          ) : (
            <TouchableOpacity style={{ marginTop: 16 }} onPress={handleSendOTP}>
              <Text style={{ color: '#007bff' }}>Gửi lại mã</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

     
      {step === 3 && (
        <View style={{ marginTop: 20 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => handleBack(2.1)}>
            <Icon name="arrow-back" size={28} color="#000" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Image source={logo} style={{ width: 80, height: 80, resizeMode: 'contain' }} />
          </View>

          <Text style={{ color: '#000' }}>Chụp mặt trước CCCD</Text>
          <Btn title="Chụp mặt trước" onPress={() => captureSide('front')} />
          {frontImage ? <Image source={{ uri: frontImage }} style={styles.cccdImg} /> : null}

          <Text style={{ marginTop: 12, color: '#000' }}>Chụp mặt sau CCCD</Text>
          <Btn title="Chụp mặt sau" onPress={() => captureSide('back')} />
          {backImage ? <Image source={{ uri: backImage }} style={styles.cccdImg} /> : null}

          <Btn
            title="Trích xuất & gửi"
            onPress={handleExtractFromImages}
            disabled={!(frontImage && backImage) || loading}
          />
        </View>
      )}

    
      {step === 4 && (
        <View style={{ marginTop: 20 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => handleBack(3)}>
            <Icon name="arrow-back" size={28} color="#000" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Image source={logo} style={{ width: 80, height: 80, resizeMode: 'contain' }} />
          </View>

          <Text style={{ fontWeight: '600', marginBottom: 8 }}>
            Thông tin nhận diện từ CCCD (có trường không cho chỉnh)
          </Text>

         
          <TextInput placeholder="Họ và tên" value={fullName} onChangeText={setFullName} style={styles.input} />

         
          <TextInput
            placeholder="Ngày sinh (dd/mm/yyyy)"
            value={dateOfBirth}
            editable={false}
            selectTextOnFocus={false}
            style={styles.readonly}
          />

       
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <Toggle label="Nam" active={gender === 'male'} disabled onPress={() => {}} />
            <Toggle label="Nữ" active={gender === 'female'} disabled onPress={() => {}} />
          </View>

          
          <TextInput placeholder="Số CCCD" editable={false} value={identityCard} style={styles.readonly} />

        
          <TextInput
            placeholder="Địa chỉ thường trú"
            value={address}
            onChangeText={setAddress}
            style={styles.input}
          />

          <TextInput
            placeholder="Mật khẩu (>=6 ký tự)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          <Btn title="Hoàn tất đăng ký" onPress={handleComplete} disabled={loading} />
        </View>
      )}

      {loading && <ActivityIndicator style={{ marginTop: 20 }} size="large" />}
    </SafeAreaView>
  );
}


const styles = {
  backBtn: { position: 'absolute', top: 20, left: 20, zIndex: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginTop: 12, color: '#000' },
  error: { color: 'red', marginTop: 8 },
  otpInput: {
    width: 50,
    height: 50,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 20,
    marginHorizontal: 6,
    borderRadius: 8,
    color: '#000',
  },
  role: (active) => ({
    width: '100%',
    borderWidth: 1,
    borderColor: active ? '#007bff' : '#ccc',
    backgroundColor: active ? '#e6f0ff' : '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  }),
  roleTitle: { fontSize: 18, fontWeight: '600', color: '#007bff', marginBottom: 4 },
  roleDesc: { fontSize: 14, color: '#666' },
  cccdImg: { width: '100%', height: 180, marginTop: 8, borderRadius: 8 },
  readonly: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
    backgroundColor: '#f6f7f9',
  },
};
