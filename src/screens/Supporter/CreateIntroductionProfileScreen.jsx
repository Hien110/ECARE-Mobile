// screens/CreateIntroductionProfile.jsx
// @ts-nocheck

import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { supporterService } from '../../services/supporterService';
import userService from '../../services/userService';
import { useFocusEffect } from '@react-navigation/native';

const AVATAR_FALLBACK =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-mAf0Q5orw3lJzIC2j6NFU6Ik2VNcgB.png';

const CreateIntroductionProfile = ({ navigation }) => {
  // ======= STATE CẦN THIẾT =======
  const [experienceYears, setExperienceYears] = useState('');
  const [experienceYearsError, setExperienceYearsError] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  // Địa chỉ hiện tại của user (đổi tên để khỏi đụng setCurrentUser)
  
  const [currentAddress, setCurrentAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [profileInfo, setProfileInfo] = useState({ name: '', avatar: '' });

  // ======= HÀM LẤY USER + ĐỊA CHỈ (GIỐNG AddressPicker) =======
  const loadUserInfo = useCallback(async () => {
    console.log('========== [CreateIntroductionProfile] loadUserInfo ==========');
    try {
      setLoadingAddress(true);

      // 1) Ưu tiên gọi API để có currentAddress đã giải mã
      const apiResult = await userService.getUserInfo();
      console.log(
        '[CreateIntroductionProfile] getUserInfo result =',
        apiResult,
      );

      if (apiResult?.success && apiResult?.data) {
        // Cập nhật lại local
        await userService.setUser(apiResult.data);

        if (apiResult.data.currentAddress) {
          console.log(
            '[CreateIntroductionProfile] currentAddress from API =',
            apiResult.data.currentAddress,
          );
          setCurrentAddress(apiResult.data.currentAddress);
        }
      } else {
        // 2) Fallback local nếu API fail
        const localResult = await userService.getUser();
        console.log(
          '[CreateIntroductionProfile] getUser (local) result =',
          localResult,
        );
        if (localResult?.success && localResult?.data) {
          if (localResult.data.currentAddress) {
            console.log(
              '[CreateIntroductionProfile] currentAddress from local =',
              localResult.data.currentAddress,
            );
            setCurrentAddress(localResult.data.currentAddress);
          }
        }
      }
    } catch (error) {
      console.error(
        '[CreateIntroductionProfile] Error loading user info:',
        error,
      );
      // Fallback local lần nữa
      try {
        const localResult = await userService.getUser();
        console.log(
          '[CreateIntroductionProfile] fallback local getUser =',
          localResult,
        );
        if (localResult?.success && localResult?.data) {
          if (localResult.data.currentAddress) {
            console.log(
              '[CreateIntroductionProfile] currentAddress fallback local =',
              localResult.data.currentAddress,
            );
            setCurrentAddress(localResult.data.currentAddress);
          }
        }
      } catch (localError) {
        console.error(
          '[CreateIntroductionProfile] Error loading local user info:',
          localError,
        );
      }
    } finally {
      setLoadingAddress(false);
    }
  }, []);
  // Gọi 1 lần khi mount
  useEffect(() => {
    loadUserInfo();
  }, [loadUserInfo]);

  // Gọi lại mỗi lần màn hình được focus (sau khi chỉnh AddressPicker quay lại)
  useFocusEffect(
    useCallback(() => {
      loadUserInfo();
    }, [loadUserInfo]),
  );

  // ======= VALIDATION TỐI GIẢN =======
  const disableCreate = useMemo(() => {
    const invalidYears = !!experienceYearsError || experienceYears === '';
    const invalidDesc = !jobDescription.trim();
    return loading || invalidYears || invalidDesc;
  }, [experienceYears, experienceYearsError, jobDescription, loading]);

  const onChangeExperienceYears = (text) => {
    const onlyDigits = text.replace(/\D/g, '').slice(0, 2);
    setExperienceYears(onlyDigits);
    if (onlyDigits === '') {
      setExperienceYearsError('Vui lòng nhập số năm kinh nghiệm.');
      return;
    }
    const num = Number(onlyDigits);
    if (!Number.isFinite(num) || num < 0) {
      setExperienceYearsError('Số năm kinh nghiệm không hợp lệ.');
    } else if (num > 60) {
      setExperienceYearsError('Số năm kinh nghiệm tối đa 60.');
    } else {
      setExperienceYearsError('');
    }
  };

  // Mở màn AddressPicker – màn đó sẽ tự lưu currentAddress + currentLocation
  const onPickAddress = () => {
    navigation?.navigate?.('AddressPicker');
  };

  // ======= TẠO HỒ SƠ: GỬI KINH NGHIỆM + MÔ TẢ =======
  const onCreateProfile = async () => {
    if (experienceYears === '' || experienceYearsError) {
      Alert.alert(
        'Thiếu thông tin',
        experienceYearsError || 'Vui lòng nhập số năm kinh nghiệm.',
      );
      return;
    }
    if (!jobDescription.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả công việc.');
      return;
    }
    if (jobDescription.trim().length > 500) {
      Alert.alert(
        'Mô tả quá dài',
        'Vui lòng nhập mô tả tối đa 500 ký tự.',
      );
      return;
    }

    const payload = {
      experience: {
        description: jobDescription.trim(),
        totalYears: Math.min(Math.max(Number(experienceYears), 0), 60),
      },
      // currentAddress thuộc User, không cần gửi trong supporterProfile
    };

    try {
      setLoading(true);
      const result = await supporterService.createMyProfile(payload);
      setLoading(false);

      if (result?.success) {
        const userName = result?.data?.user?.fullName || 'Supporter';
        const userAvatar = result?.data?.user?.avatar || AVATAR_FALLBACK;
        setProfileInfo({ name: userName, avatar: userAvatar });
        setShowSuccess(true);
      } else {
        Alert.alert('Không thành công', result?.message || 'Có lỗi xảy ra.');
      }
    } catch (e) {
      setLoading(false);
      Alert.alert('Lỗi', e?.message || 'Có lỗi xảy ra.');
    }
  };

  const renderSuccessPopup = () => (
    <Modal
      visible={showSuccess}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSuccess(false)}
    >
      <View style={styles.successOverlay}>
        <View style={styles.successCard}>
          <View style={styles.successTickWrap}>
            <View style={styles.successTickCircle}>
              <Icon name="checkmark" size={28} color="#fff" />
            </View>
          </View>
          <Text style={styles.successTitle}>Tạo hồ sơ thành công!</Text>
          <Text style={styles.successSub}>
            Hồ sơ của bạn đã được tạo thành công. Bây giờ khách hàng có thể tìm
            thấy và liên hệ với bạn.
          </Text>
          <View style={styles.miniCard}>
            <Image
              source={{ uri: profileInfo.avatar || AVATAR_FALLBACK }}
              style={styles.miniAvatarImg}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.miniName} numberOfLines={1}>
                {profileInfo.name}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 4,
                }}
              >
                <Text style={styles.miniRole}>Supporter chuyên nghiệp</Text>
                <View style={styles.badgeNew}>
                  <Text style={styles.badgeNewText}>Mới tạo</Text>
                </View>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              setShowSuccess(false);
              navigation?.navigate?.('ViewIntroduction');
            }}
          >
            <Text style={styles.primaryBtnText}>Xem hồ sơ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => {
              setShowSuccess(false);
              navigation?.navigate?.('EditIntroduction');
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                name="create-outline"
                size={18}
                color="#1A5DFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.ghostBtnText}>Chỉnh sửa hồ sơ</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2F66FF" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack?.()}
        >
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo hồ sơ</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileIconSection}>
          <View style={styles.profileIcon}>
            <MaterialIcons name="person" size={32} color="#ffffff" />
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Tạo hồ sơ Supporter</Text>
          <Text style={styles.subtitle}>
            Chỉ cần điền thông tin cơ bản và địa chỉ hiện tại để bắt đầu nhận
            việc.
          </Text>
        </View>

        {/* ===== THÔNG TIN CƠ BẢN ===== */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>

          <Text style={styles.fieldLabel}>Số năm kinh nghiệm</Text>
          <TextInput
            style={[
              styles.textInput,
              !!experienceYearsError && { borderColor: '#EF4444' },
            ]}
            value={experienceYears}
            onChangeText={onChangeExperienceYears}
            placeholder="Ví dụ: 2"
            placeholderTextColor="#CCCCCC"
            keyboardType="numeric"
            maxLength={2}
          />
          {!!experienceYearsError && (
            <Text style={{ color: '#EF4444', marginTop: 6 }}>
              {experienceYearsError}
            </Text>
          )}
        </View>

        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>Mô tả công việc</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={jobDescription}
            onChangeText={setJobDescription}
            placeholder="Mô tả ngắn gọn về bản thân, kỹ năng và kinh nghiệm"
            placeholderTextColor="#CCCCCC"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* ===== ĐỊA CHỈ HIỆN TẠI ===== */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Địa chỉ hiện tại</Text>
          <TouchableOpacity
            style={styles.addressBox}
            activeOpacity={0.85}
            onPress={onPickAddress}
          >
            <View style={styles.addressLeft}>
              <Icon
                name="location-outline"
                size={18}
                color="#1A73E8"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.addressText}>
                {loadingAddress
                  ? 'Đang tải địa chỉ...'
                  : currentAddress
                  ? currentAddress
                  : 'Bạn chưa có vị trí, vui lòng nhập vị trí.'}
              </Text>
            </View>
            <Icon
              name="chevron-forward"
              size={20}
              color="#1A73E8"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.createButton, disableCreate && { opacity: 0.6 }]}
          onPress={onCreateProfile}
          disabled={disableCreate}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Tạo hồ sơ</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {renderSuccessPopup()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2F66FF',
    height: 60,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
    marginRight: 10,
  },
  placeholder: { width: 40 },
  content: { flex: 1 },

  profileIconSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#ffffff',
  },
  profileIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },

  formSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E6EF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  textArea: { height: 100, textAlignVertical: 'top' },

  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9F3FF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CFE3FF',
    marginTop: 8,
  },
  addressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#0B1220',
    lineHeight: 20,
  },

  createButton: {
    backgroundColor: '#4A90E2',
    marginHorizontal: 16,
    marginVertical: 24,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },

  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  successTickWrap: { alignItems: 'center', marginBottom: 12 },
  successTickCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A5DFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0B1220',
    marginTop: 8,
  },
  successSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#E5ECFF',
    padding: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  miniAvatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    backgroundColor: '#E9EEF9',
  },
  miniName: { fontSize: 15, fontWeight: '600', color: '#0B1220' },
  miniRole: { fontSize: 12, color: '#6B7280' },
  badgeNew: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#E7F0FF',
    borderWidth: 1,
    borderColor: '#CFE0FF',
  },
  badgeNewText: {
    fontSize: 11,
    color: '#1A5DFF',
    fontWeight: '600',
  },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#1A5DFF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghostBtn: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CFE0FF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  ghostBtnText: { color: '#1A5DFF', fontSize: 15, fontWeight: '700' },
});
CreateIntroductionProfile.propTypes = {
  navigation: PropTypes.object.isRequired,
};

export default CreateIntroductionProfile;
