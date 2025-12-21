import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import DoctorNavTabs from '../../components/DoctorNavTabs';
import { SafeAreaView } from 'react-native-safe-area-context';

const IntroductionCreateDoctorProfileScreen = ({ navigation, onStart }) => {
  const [selectedTab, setSelectedTab] = useState('profile');
  const [completedSteps, setCompletedSteps] = useState([]);

  const benefits = [
    {
      icon: 'medal-outline',
      title: 'Tăng độ uy tín',
      description: 'Hồ sơ rõ ràng giúp bệnh nhân tin tưởng và lựa chọn',
      color: '#2F6FED',
    },
    {
      icon: 'calendar-outline',
      title: 'Tối ưu lịch hẹn',
      description: 'Chủ động quản lý ca trực và thời gian tư vấn',
      color: '#FF9800',
    },
    {
      icon: 'cash-outline',
      title: 'Thiết lập phí minh bạch',
      description: 'Điều chỉnh mức phí phù hợp chuyên môn & nhu cầu',
      color: '#4CAF50',
    },
  ];

  const setupSteps = [
    { step: 1, title: 'Thông tin cơ bản', description: 'Họ tên, chuyên khoa' },
    { step: 2, title: 'Chuyên môn & kinh nghiệm', description: 'Số năm, chứng chỉ' },
    { step: 3, title: 'Nơi làm việc', description: 'Bệnh viện, phòng khám' },
    { step: 4, title: 'Phí tư vấn', description: 'Mức phí online/offline' },
  ];

  const quickRequirements = [
    { icon: 'document-text-outline', text: 'Ảnh đại diện & mô tả ngắn gọn' },
    { icon: 'ribbon-outline', text: 'Chuyên khoa chính & số năm kinh nghiệm' },
    { icon: 'business-outline', text: 'Tên bệnh viện/phòng khám đang công tác' },
    { icon: 'card-outline', text: 'Phí tư vấn online & trực tiếp' },
  ];

  const faqs = [
    {
      q: 'Tôi có thể chỉnh sửa hồ sơ sau khi tạo không?',
      a: 'Có. Bạn có thể cập nhật thông tin bất kỳ lúc nào ở mục “Cập nhật hồ sơ”.',
    },
    {
      q: 'Lịch làm việc có thể sao chép sang ngày khác?',
      a: 'Có. Bạn có thể tạo lịch cho 1 ngày, sau đó sao chép để áp dụng cho nhiều ngày.',
    },
    {
      q: 'Phí tư vấn có bắt buộc nhập cả online & offline?',
      a: 'Bạn nên nhập đầy đủ để hệ thống hiển thị minh bạch cho bệnh nhân.',
    },
  ];

  const toggleStepCompletion = (idx) => {
    const stepNumber = idx + 1;
    setCompletedSteps((prev) =>
      prev.includes(stepNumber)
        ? prev.filter((s) => s !== stepNumber)
        : [...prev, stepNumber]
    );
  };

  const handleStartCreate = () => {
    // Tuỳ luồng app:
    // 1) Điều hướng sang màn form tạo hồ sơ chi tiết
    if (typeof onStart === 'function') return onStart();
    if (navigation?.navigate) return navigation.navigate('CreateDoctorProfile');

    // 2) Hoặc ở lại trang này (demo)
    // console.log('Start creating doctor profile');
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
          <Text style={styles.headerTitle}>Giới thiệu tạo hồ sơ bác sĩ</Text>
          <Text style={styles.headerSubtitle}>
            Hoàn thiện hồ sơ chuyên nghiệp để bệnh nhân dễ dàng tìm và đặt lịch với bạn
          </Text>
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
        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.doctorIcon}>
            <MaterialIcons name="medical-services" size={32} color="#ffffff" />
          </View>

          <Text style={styles.welcomeTitle}>Chào mừng bác sĩ!</Text>
          <Text style={styles.welcomeDescription}>
            Chỉ với vài bước đơn giản, bạn sẽ có hồ sơ hiển thị đẹp mắt, minh bạch thông tin
            và sẵn sàng nhận lịch hẹn.
          </Text>

          <TouchableOpacity style={styles.createProfileButton} onPress={handleStartCreate}>
            <Icon name="add-circle-outline" size={20} color="#2F6FED" />
            <Text style={styles.createProfileText}>Tạo hồ sơ ngay</Text>
          </TouchableOpacity>
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lợi ích khi có hồ sơ hoàn chỉnh</Text>
          {benefits.map((b, i) => (
            <View key={i} style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: `${b.color}20` }]}>
                <Icon name={b.icon} size={24} color={b.color} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDescription}>{b.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Quick Requirements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yêu cầu tối thiểu để bắt đầu</Text>
          {quickRequirements.map((item, idx) => (
            <View key={idx} style={styles.requireItem}>
              <Icon name={item.icon} size={18} color="#2F6FED" />
              <Text style={styles.requireText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Setup Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thiết lập nhanh chỉ 4 bước</Text>
          {setupSteps.map((step, index) => (
            <TouchableOpacity
              key={index}
              style={styles.stepItem}
              onPress={() => toggleStepCompletion(index)}
            >
              <View style={styles.stepLeft}>
                <View
                  style={[
                    styles.stepNumber,
                    completedSteps.includes(step.step) && styles.completedStepNumber,
                  ]}
                >
                  {completedSteps.includes(step.step) ? (
                    <Icon name="checkmark" size={16} color="#ffffff" />
                  ) : (
                    <Text style={styles.stepNumberText}>{step.step}</Text>
                  )}
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.stepAction}>
                <Icon name="chevron-forward" size={20} color="#CCCCCC" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Câu hỏi thường gặp</Text>
          {faqs.map((f, idx) => (
            <View key={idx} style={styles.faqItem}>
              <Text style={styles.faqQ}>• {f.q}</Text>
              <Text style={styles.faqA}>{f.a}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Container & Header
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2F6FED',
    minHeight: 80,
  },
  backButton: { padding: 8, marginRight: 12 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#E3F2FD', lineHeight: 18 },

  // Tabs
  tabContainer: { flexDirection: 'row', backgroundColor: '#ffffff', paddingHorizontal: 16 },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#2F6FED' },
  tabText: { fontSize: 14, color: '#666666', fontWeight: '500' },
  activeTabText: { color: '#2F6FED', fontWeight: '600' },

  // Content
  content: { flex: 1, padding: 16 },
  welcomeCard: {
    backgroundColor: '#2F6FED',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  doctorIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: { fontSize: 20, fontWeight: '600', color: '#ffffff', marginBottom: 12 },
  welcomeDescription: {
    fontSize: 14,
    color: '#E3F2FD',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  createProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createProfileText: { fontSize: 14, color: '#2F6FED', fontWeight: '600', marginLeft: 8 },

  // Sections
  section: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#000000', marginBottom: 16 },

  // Benefit
  benefitItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  benefitContent: { flex: 1 },
  benefitTitle: { fontSize: 14, fontWeight: '600', color: '#000000', marginBottom: 4 },
  benefitDescription: { fontSize: 12, color: '#666666', lineHeight: 16 },

  // Requirements
  requireItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  requireText: { marginLeft: 10, fontSize: 13, color: '#333333' },

  // Steps
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  stepLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  completedStepNumber: { backgroundColor: '#4CAF50' },
  stepNumberText: { fontSize: 14, fontWeight: '600', color: '#666666' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 14, fontWeight: '600', color: '#000000', marginBottom: 2 },
  stepDescription: { fontSize: 12, color: '#666666' },
  stepAction: { padding: 8 },

  // FAQ
  faqItem: { marginBottom: 12 },
  faqQ: { fontSize: 13, fontWeight: '600', color: '#000000', marginBottom: 4 },
  faqA: { fontSize: 12, color: '#666666', lineHeight: 18 },

});

export default IntroductionCreateDoctorProfileScreen;
