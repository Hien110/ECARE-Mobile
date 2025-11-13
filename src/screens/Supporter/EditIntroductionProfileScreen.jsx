// screens/EditIntroductionProfileScreen.jsx
import React, { useEffect, useMemo, useState } from 'react';
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
import { supporterService } from '../../services/supporterService';

const AVATAR_FALLBACK =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-mAf0Q5orw3lJzIC2j6NFU6Ik2VNcgB.png';

const EditIntroductionProfileScreen = ({ navigation, route }) => {
  // ===== Form state (chỉ còn 3 trường) =====
  const [years, setYears] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [serviceArea, setServiceArea] = useState('');

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Popup thành công
  const [showSuccess, setShowSuccess] = useState(false);
  const [profileInfo, setProfileInfo] = useState({ name: '', avatar: '' });

  const onlyDigits = (s) => s.replace(/[^\d]/g, '');

  // ===== Fetch profile để fill form =====
  const hydrateFromProfile = (data) => {
    const expYears = `${Math.max(0, Number(data?.experience?.totalYears ?? 0))}`;
    setYears(expYears);
    setJobDescription(data?.experience?.description ?? '');
    const area = `${Math.max(0, Number(data?.serviceArea ?? 10))}`;
    setServiceArea(area);
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await supporterService.getMyProfile();
      if (res?.success) {
        setProfile(res.data);
        hydrateFromProfile(res.data);
      } else {
        Alert.alert('Lỗi', res?.message || 'Không tải được hồ sơ.');
      }
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không tải được hồ sơ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // ===== Validate tối giản =====
  const ensureValid = () => {
    if (years.trim() === '') {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số năm kinh nghiệm.');
      return false;
    }
    const y = Number(years);
    if (!Number.isFinite(y) || y < 0 || y > 60) {
      Alert.alert('Không hợp lệ', 'Số năm kinh nghiệm phải từ 0 đến 60.');
      return false;
    }

    if (jobDescription.trim() === '') {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả công việc.');
      return false;
    }
    if (jobDescription.trim().length > 500) {
      Alert.alert('Mô tả quá dài', 'Vui lòng nhập mô tả tối đa 500 ký tự.');
      return false;
    }

    if (serviceArea.trim() === '') {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập bán kính phục vụ.');
      return false;
    }
    const areaNum = Number(serviceArea);
    if (!Number.isFinite(areaNum) || areaNum < 0 || areaNum > 50) {
      Alert.alert('Không hợp lệ', 'Bán kính phục vụ tối đa 50 km.');
      return false;
    }
    return true;
  };

  // ===== Save (chỉ gửi 3 trường) =====
  const onSave = async () => {
    if (!ensureValid()) return;

    const payload = {
      experience: {
        totalYears: Number(years),
        description: jobDescription.trim(),
      },
      serviceArea: Math.round(Math.min(Math.max(Number(serviceArea), 0), 50)),
      // ❗ Không gửi schedule / sessionFee nữa
    };

    try {
      setSaving(true);
      const res = await supporterService.updateMyProfile(payload);
      setSaving(false);

      if (res?.success) {
        // Gọi callback màn trước nếu có
        route?.params?.onUpdated?.(res.data);

        const userName = res?.data?.user?.fullName || 'Supporter';
        const userAvatar = res?.data?.user?.avatar || AVATAR_FALLBACK;
        setProfileInfo({ name: userName, avatar: userAvatar });
        setShowSuccess(true);
      } else {
        Alert.alert('Không thành công', res?.message || 'Có lỗi xảy ra.');
      }
    } catch (e) {
      setSaving(false);
      Alert.alert('Lỗi', e?.message || 'Có lỗi xảy ra.');
    }
  };

  const disableSave = useMemo(() => saving || loading, [saving, loading]);

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

          <Text style={styles.successTitle}>Cập nhật hồ sơ thành công!</Text>
          <Text style={styles.successSub}>Thông tin hồ sơ của bạn đã được cập nhật.</Text>

          <View style={styles.miniCard}>
            <Image source={{ uri: profileInfo.avatar || AVATAR_FALLBACK }} style={styles.miniAvatarImg} />
            <View style={{ flex: 1 }}>
              <Text style={styles.miniName} numberOfLines={1}>{profileInfo.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Text style={styles.miniRole}>Supporter chuyên nghiệp</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              setShowSuccess(false);
              navigation?.goBack?.();
            }}
          >
            <Text style={styles.primaryBtnText}>Quay về</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#2F66FF" />
        <ActivityIndicator size="large" color="#2F66FF" />
        <Text style={{ marginTop: 10, color: '#666' }}>Đang tải hồ sơ...</Text>
      </SafeAreaView>
    );
    }

  const avatar = profile?.user?.avatar || AVATAR_FALLBACK;
  const fullName = profile?.user?.fullName || 'Supporter';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2F66FF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chỉnh sửa hồ sơ</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Thông tin cơ bản */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>

          <View style={styles.profileRow}>
            <Image source={{ uri: avatar }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
              <Text style={styles.role}>Supporter chuyên nghiệp</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Số năm kinh nghiệm</Text>
          <TextInput
            style={styles.textInput}
            value={years}
            onChangeText={(t) => setYears(onlyDigits(t).slice(0, 2))}
            placeholder="0"
            placeholderTextColor="#CCC"
            keyboardType="number-pad"
            maxLength={2}
          />

          <Text style={styles.fieldLabel}>Mô tả công việc</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={jobDescription}
            onChangeText={setJobDescription}
            placeholder="Mô tả ngắn gọn về bản thân, kỹ năng và kinh nghiệm"
            placeholderTextColor="#CCCCCC"
            multiline
            numberOfLines={5}
          />
        </View>

        {/* Khu vực phục vụ
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Khu vực phục vụ</Text>
          <Text style={styles.fieldLabel}>Bán kính phục vụ (km, tối đa 50)</Text>
          <TextInput
            style={styles.textInput}
            value={serviceArea}
            onChangeText={(t) => setServiceArea(onlyDigits(t).slice(0, 2))}
            placeholder="10"
            placeholderTextColor="#CCCCCC"
            keyboardType="numeric"
            maxLength={2}
          />
        </View> */}

        {/* Nút lưu */}
        <TouchableOpacity
          style={[styles.saveBtn, disableSave && { opacity: 0.6 }]}
          onPress={onSave}
          disabled={disableSave}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Lưu thông tin</Text>}
        </TouchableOpacity>
      </ScrollView>

      {renderSuccessPopup()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#2F66FF', height: 60,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', flex: 1, textAlign: 'center', marginRight: 40 },
  placeholder: { width: 40 },
  content: { flex: 1 },

  formSection: { backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 16, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 12 },
  fieldLabel: { fontSize: 14, color: '#000', marginBottom: 10, fontWeight: '500' },

  textInput: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#000', backgroundColor: '#fff', marginBottom: 10,
  },
  textArea: { height: 110, textAlignVertical: 'top' },

  profileRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12, backgroundColor: '#E9EEF9' },
  name: { fontSize: 16, fontWeight: '600', color: '#0B1220' },
  role: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  saveBtn: {
    backgroundColor: '#2F66FF', marginHorizontal: 16, marginVertical: 24,
    paddingVertical: 16, borderRadius: 8, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Success popup
  successOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  successCard: {
    width: '100%', maxWidth: 340, backgroundColor: '#fff', borderRadius: 16,
    paddingTop: 20, paddingBottom: 16, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 7,
  },
  successTickWrap: { alignItems: 'center', marginBottom: 12 },
  successTickCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1A5DFF', alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', color: '#0B1220', marginTop: 8 },
  successSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  miniCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#E5ECFF',
    padding: 10, borderRadius: 12, marginTop: 14,
  },
  miniAvatarImg: { width: 42, height: 42, borderRadius: 21, marginRight: 10, backgroundColor: '#E9EEF9' },
  miniName: { fontSize: 15, fontWeight: '600', color: '#0B1220' },
  miniRole: { fontSize: 12, color: '#6B7280' },
  primaryBtn: { marginTop: 14, backgroundColor: '#1A5DFF', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default EditIntroductionProfileScreen;
