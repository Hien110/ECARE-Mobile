import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { doctorService } from '../../services/doctorService';
import DoctorNavTabs from '../../components/DoctorNavTabs';

const CreateDoctorProfileScreen = ({ navigation, onViewProfile }) => {
  const [selectedTab, setSelectedTab] = useState('profile');
  const [progressAnimation] = useState(new Animated.Value(0));
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [formData, setFormData] = useState({
    fullName: '',
    specialty: '',
    experience: '',
    qualifications: '',
    hospitalName: '',
    address: '',
    onlineFee: '',
    offlineFee: '',
  });

  // Các field cần có để gọi API đúng model
  const requiredFields = ['specialty', 'experience', 'hospitalName', 'onlineFee', 'offlineFee'];

  // === Helpers (strict) ===
  const parseIntStrict = (raw) => {
    const s = String(raw ?? '').trim();
    if (!s) return null;
    const n = Number(s.replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  const validateForm = () => {
    const errs = {};
    // bắt buộc điền
    requiredFields.forEach((k) => {
      if (!String(formData[k] || '').trim()) errs[k] = 'Trường này là bắt buộc';
    });
    // dạng số
    const exp = parseIntStrict(formData.experience);
    if (exp === null) errs.experience = 'Kinh nghiệm phải là số nguyên (năm)';
    const feeOnline = parseIntStrict(formData.onlineFee);
    if (feeOnline === null) errs.onlineFee = 'Phí online phải là số';
    const feeOffline = parseIntStrict(formData.offlineFee);
    if (feeOffline === null) errs.offlineFee = 'Phí offline phải là số';

    setFieldErrors(errs);
    return { errs, exp, feeOnline, feeOffline };
  };

  const canSubmit = () => {
    const { errs } = validateForm();
    return Object.keys(errs).length === 0;
  };

  // progress hiển thị (không ảnh hưởng validate gửi API)
  const calculateProgress = () => {
    const fields = Object.values(formData);
    const filledFields = fields.filter((v) => String(v).trim() !== '').length;
    return Math.round((filledFields / fields.length) * 100);
  };

  useEffect(() => {
    const progress = calculateProgress();
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
    // Mỗi khi form đổi, clear thông báo lỗi tổng
    if (errorMsg) setErrorMsg('');
  }, [formData]);

  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleCreate = async () => {
    if (submitting) return;
    const { errs, exp, feeOnline, feeOffline } = validateForm();
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setErrorMsg('');

    // payload chỉ gồm dữ liệu người dùng nhập; không set cứng giá trị mặc định nào
    const payload = {
      specializations: formData.specialty.trim(),
      experience: exp, // số nguyên từ input người dùng
      hospitalName: formData.hospitalName.trim(),
      consultationFees: {
        online: feeOnline,
        offline: feeOffline,
      },
      // KHÔNG set consultationDuration mặc định
    };

    try {
      const res = await doctorService.createMyProfile(payload);
      if (res.success) {
        setShowSuccess(true);
      } else {
        setErrorMsg(res.message || 'Tạo hồ sơ thất bại, vui lòng thử lại.');
      }
    } catch (e) {
      setErrorMsg('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderProgressBar = () => {
    const progress = calculateProgress();
    return (
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <MaterialIcons name="person" size={24} color="#ffffff" />
          <Text style={styles.progressTitle}>Tạo hồ sơ bác sĩ</Text>
        </View>
        <Text style={styles.progressSubtitle}>Hoàn thành thông tin để tạo hồ sơ</Text>

        <View style={styles.progressSection}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>Tiến độ hoàn thành</Text>
            <Text style={styles.progressPercentage}>{progress}%</Text>
          </View>

          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnimation.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2F6FED" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Tạo hồ sơ bác sĩ</Text>
          <Text style={styles.headerSubtitle}>Thiết lập thông tin cơ bản để vận cho người cao tuổi</Text>
        </View>
      </View>

      {/* Tabs */}
      <DoctorNavTabs
  navigation={navigation}
  active={selectedTab}
  routes={{
    profile: [
      'ProfileGate',                 
      'ViewDoctorProfile',           
      'IntroductionCreateDoctorProfile', 
      'EditDoctorProfile',           
    ],
    schedule: [
      'CreateWorkSchedule' 
    ],
    statistics: [
      'EvaluationStatistics',
    ],
  }}
/>


      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress Card */}
        {renderProgressBar()}

        {/* Basic Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <MaterialIcons name="person-outline" size={20} color="#2F6FED" />
            </View>
            <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>
          </View>


          <Text style={styles.fieldLabel}>Chuyên khoa *</Text>
          <TextInput
            style={[styles.textInput, fieldErrors.specialty && styles.inputError]}
            value={formData.specialty}
            onChangeText={(v) => updateFormData('specialty', v)}
            placeholder="Ví dụ: Bác sĩ Chuyên khoa Tim mạch"
            placeholderTextColor="#CCCCCC"
          />
          {fieldErrors.specialty ? <Text style={styles.errorInline}>{fieldErrors.specialty}</Text> : null}
        </View>

        {/* Professional */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#E8F5E8' }]}>
              <MaterialIcons name="school" size={20} color="#4CAF50" />
            </View>
            <Text style={styles.sectionTitle}>Thông tin chuyên môn</Text>
          </View>

          <Text style={styles.fieldLabel}>Kinh nghiệm làm việc (năm) *</Text>
          <TextInput
            style={[styles.textInput, fieldErrors.experience && styles.inputError]}
            value={formData.experience}
            onChangeText={(v) => updateFormData('experience', v)}
            placeholder="Ví dụ: 5"
            placeholderTextColor="#CCCCCC"
            keyboardType="numeric"
          />
          {fieldErrors.experience ? <Text style={styles.errorInline}>{fieldErrors.experience}</Text> : null}


        </View>

        {/* Workplace */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#FFF3E0' }]}>
              <MaterialIcons name="local-hospital" size={20} color="#FF9800" />
            </View>
            <Text style={styles.sectionTitle}>Nơi làm việc</Text>
          </View>

          <Text style={styles.fieldLabel}>Tên bệnh viện/phòng khám *</Text>
          <TextInput
            style={[styles.textInput, fieldErrors.hospitalName && styles.inputError]}
            value={formData.hospitalName}
            onChangeText={(v) => updateFormData('hospitalName', v)}
            placeholder="Nhập tên nơi làm việc"
            placeholderTextColor="#CCCCCC"
          />
          {fieldErrors.hospitalName ? <Text style={styles.errorInline}>{fieldErrors.hospitalName}</Text> : null}

        </View>

        {/* Fees */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#F3E5F5' }]}>
              <MaterialIcons name="attach-money" size={20} color="#9C27B0" />
            </View>
            <Text style={styles.sectionTitle}>Phí tư vấn</Text>
          </View>

          <Text style={styles.fieldLabel}>Phí tư vấn Online (VNĐ) *</Text>
          <TextInput
            style={[styles.textInput, fieldErrors.onlineFee && styles.inputError]}
            value={formData.onlineFee}
            onChangeText={(v) => updateFormData('onlineFee', v)}
            placeholder="Ví dụ: 200000"
            placeholderTextColor="#CCCCCC"
            keyboardType="numeric"
          />
          {fieldErrors.onlineFee ? <Text style={styles.errorInline}>{fieldErrors.onlineFee}</Text> : null}

          <Text style={styles.fieldLabel}>Phí tư vấn Offline (VNĐ) *</Text>
          <TextInput
            style={[styles.textInput, fieldErrors.offlineFee && styles.inputError]}
            value={formData.offlineFee}
            onChangeText={(v) => updateFormData('offlineFee', v)}
            placeholder="Ví dụ: 500000"
            placeholderTextColor="#CCCCCC"
            keyboardType="numeric"
          />
          {fieldErrors.offlineFee ? <Text style={styles.errorInline}>{fieldErrors.offlineFee}</Text> : null}
        </View>

        {/* Error box tổng */}
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={16} color="#D32F2F" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Help */}
        <View style={styles.helpSection}>
          <Icon name="help-circle-outline" size={16} color="#666666" />
          <Text style={styles.helpText}>Hỗ trợ</Text>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          onPress={handleCreate}
          disabled={submitting}
          style={[styles.createButton, !submitting ? styles.createButtonActive : styles.createButtonDisabled]}
        >
          <Text style={[styles.createButtonText, !submitting ? styles.createButtonTextActive : styles.createButtonTextDisabled]}>
            {submitting ? 'Đang tạo...' : 'Tạo hồ sơ'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* SUCCESS POPUP */}
      {showSuccess && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSuccess(false)} />
          <View style={styles.successSheet}>
            <View style={styles.successIconWrap}>
              <View style={styles.successIconCircle}>
                <Icon name="checkmark" size={24} color="#ffffff" />
              </View>
            </View>
            <Text style={styles.successTitle}>Tạo hồ sơ thành công!</Text>
            <Text style={styles.successDesc}>
              Hồ sơ của bạn đã được tạo thành công. Bệnh nhân giờ đây có thể xem thông tin và đặt lịch tư vấn.
            </Text>

            <TouchableOpacity
              style={styles.successPrimaryBtn}
              onPress={() => {
                setShowSuccess(false);
                if (typeof onViewProfile === 'function') return onViewProfile();
                if (navigation?.navigate) return navigation.navigate('ViewDoctorProfile');
              }}
            >
              <Icon name="person-outline" size={18} color="#ffffff" />
              <Text style={styles.successPrimaryText}>Xem thông tin cá nhân</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.successCloseBtn} onPress={() => setShowSuccess(false)}>
              <Text style={styles.successCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#2F6FED', minHeight: 80 },
  backButton: { padding: 8, marginRight: 12 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#E3F2FD', lineHeight: 18 },

  tabContainer: { flexDirection: 'row', backgroundColor: '#ffffff', paddingHorizontal: 16 },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#2F6FED' },
  tabText: { fontSize: 14, color: '#666666', fontWeight: '500' },
  activeTabText: { color: '#2F6FED', fontWeight: '600' },

  content: { flex: 1, padding: 16 },

  progressCard: { backgroundColor: '#2F6FED', borderRadius: 16, padding: 20, marginBottom: 16 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  progressTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginLeft: 8 },
  progressSubtitle: { fontSize: 14, color: '#E3F2FD', marginBottom: 16 },
  progressSection: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressLabel: { fontSize: 14, color: '#ffffff' },
  progressPercentage: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  progressBarContainer: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#ffffff', borderRadius: 4 },

  section: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#000000' },

  fieldLabel: { fontSize: 14, color: '#000000', marginBottom: 8, fontWeight: '500' },
  textInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#000000', backgroundColor: '#ffffff', marginBottom: 8 },
  textArea: { height: 80, textAlignVertical: 'top' },
  inputError: { borderColor: '#F44336' },
  errorInline: { color: '#F44336', fontSize: 12, marginBottom: 8 },

  helpSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  helpText: { fontSize: 14, color: '#666666', marginLeft: 4 },

  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FFCDD2' },
  errorText: { color: '#D32F2F', fontSize: 13, marginLeft: 6 },

  createButton: { paddingVertical: 16, borderRadius: 8, alignItems: 'center', marginBottom: 24 },
  createButtonActive: { backgroundColor: '#2F6FED' },
  createButtonDisabled: { backgroundColor: '#E0E0E0' },
  createButtonText: { fontSize: 16, fontWeight: '600' },
  createButtonTextActive: { color: '#ffffff' },
  createButtonTextDisabled: { color: '#999999' },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  successSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 24 },
  successIconWrap: { alignItems: 'center', marginBottom: 8 },
  successIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2ECC71', alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 16, fontWeight: '700', color: '#000000', textAlign: 'center', marginTop: 8 },
  successDesc: { fontSize: 13, color: '#4F4F4F', textAlign: 'center', lineHeight: 18, marginTop: 6, marginHorizontal: 8 },
  successPrimaryBtn: { marginTop: 14, backgroundColor: '#2F6FED', borderRadius: 12, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  successPrimaryText: { color: '#ffffff', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  successCloseBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 6 },
  successCloseText: { color: '#2F6FED', fontSize: 14, fontWeight: '600' },
});

export default CreateDoctorProfileScreen;
