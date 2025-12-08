// src/screens/doctorBooking/IntroductionBookingDoctor.jsx
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const heroImages = [
  { uri: 'https://images.pexels.com/photos/6129683/pexels-photo-6129683.jpeg' },
  { uri: 'https://dngclinic.com/wp-content/uploads/2023/08/kham-tong-quat-1.jpg' },
  { uri: 'https://www.shutterstock.com/image-photo/doctor-patient-having-friendly-consultation-600nw-2618224383.jpg' },
  { uri: 'https://isofhcare-backup.s3-ap-southeast-1.amazonaws.com/images/162041kham-xuong-khop_785696ed_2602_4d9d_a250_e68a504b646a.jpg' },
];

const IntroductionBookingDoctor = (props) => {
  const navigation = useNavigation();
  const route = useRoute();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const autoSlideTimer = useRef(null);

  // ===== Lấy role ban đầu từ props / params =====
  const [role, setRole] = useState(() => {
    const fromPropsUser = props?.user?.role;
    const fromUserRoleProp = props?.userRole;
    const fromParams =
      route?.params?.role ||
      route?.params?.userRole ||
      route?.params?.currentRole ||
      null;

    const initialRole = fromUserRoleProp || fromPropsUser || fromParams || null;

    console.log('[IntroBooking] user from props =', props?.user);
    console.log('[IntroBooking] props.userRole =', props?.userRole);
    console.log('[IntroBooking] route.params =', route?.params);
    console.log('[IntroBooking] initial role state =', initialRole);

    return initialRole;
  });

  // ===== Nếu chưa có role thì thử đọc từ AsyncStorage =====
  useEffect(() => {
    const loadRole = async () => {
      if (role) return;

      try {
        const raw = await AsyncStorage.getItem('userInfo');
        console.log('[IntroBooking] AsyncStorage userInfo raw =', raw);
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (parsed?.role) {
          console.log('[IntroBooking] setRole from AsyncStorage =', parsed.role);
          setRole(parsed.role);
        }
      } catch (e) {
        console.log('[IntroBooking] AsyncStorage error =', e?.message);
      }
    };

    loadRole();
  }, [role]);

  // ==========================
  // 🔄 AUTO SLIDE 4 GIÂY / ẢNH
  // ==========================
  useEffect(() => {
    startAutoSlide();
    return () => stopAutoSlide();
  }, []);

  const startAutoSlide = () => {
    stopAutoSlide();
    autoSlideTimer.current = setInterval(() => {
      setCurrentImageIndex(prev =>
        prev === heroImages.length - 1 ? 0 : prev + 1,
      );
    }, 4000);
  };

  const stopAutoSlide = () => {
    if (autoSlideTimer.current) {
      clearInterval(autoSlideTimer.current);
    }
  };

  const nextImage = () => {
    stopAutoSlide();
    setCurrentImageIndex(prev =>
      prev === heroImages.length - 1 ? 0 : prev + 1,
    );
    startAutoSlide();
  };

  const prevImage = () => {
    stopAutoSlide();
    setCurrentImageIndex(prev =>
      prev === 0 ? heroImages.length - 1 : prev - 1,
    );
    startAutoSlide();
  };

  const benefits = [
    {
      id: 1,
      title: 'Chủ động thời gian',
      description:
        'Đặt lịch khám theo ngày bắt đầu và thời lượng gói phù hợp với gia đình.',
      icon: 'calendar-outline',
      color: '#4A90E2',
    },
    {
      id: 2,
      title: 'Theo dõi liên tục',
      description:
        'Bác sĩ đồng hành trong suốt 30 / 90 / 180 / 270 ngày của gói khám.',
      icon: 'document-text-outline',
      color: '#4A90E2',
    },
    {
      id: 3,
      title: 'Bác sĩ chuyên khoa',
      description:
        'Lựa chọn bác sĩ phù hợp, nhiều kinh nghiệm với người cao tuổi.',
      icon: 'heart-outline',
      color: '#4A90E2',
    },
    {
      id: 4,
      title: 'Nhắc lịch tự động',
      description:
        'Ứng dụng nhắc lịch tái khám và hiển thị lịch sử đặt lịch rõ ràng.',
      icon: 'notifications-outline',
      color: '#4A90E2',
    },
  ];

  const handleBack = () => navigation.goBack();

  const handleContinue = () => {
    const normalizedRole = role?.toLowerCase?.() || null;
    console.log('[IntroBooking] handleContinue raw role =', role);
    console.log('[IntroBooking] handleContinue normalizedRole =', normalizedRole);

    // Elderly → đi thẳng tới HealthPackageListScreen
    if (normalizedRole === 'elderly') {
      console.log('[IntroBooking] Navigating to HealthPackageListScreen (elderly flow)');
      navigation.navigate('HealthPackageListScreen', {
        flowType: 'doctorBooking',
        fromIntro: true,
        bookingFor: 'self',
      });
      return;
    }

    // Còn lại → giữ flow cũ
    console.log('[IntroBooking] Navigating to FamilyListFunctionScreen (non-elderly flow)');
    navigation.navigate('FamilyListFunctionScreen', {
      message: 'Chức năng đặt lịch bác sĩ',
      flowType: 'doctorBooking',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F7EFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Giới thiệu đặt lịch bác sĩ</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* HERO AREA */}
        <View style={styles.doctorCard}>
          <View style={styles.imageContainer}>
            <Image
              source={heroImages[currentImageIndex]}
              style={styles.doctorImage}
            />

            {/* 🩺 Icon */}
            <View style={styles.stethoscopeIcon}>
              <MaterialCommunityIcons
                name="stethoscope"
                size={20}
                color="#3b82f6"
              />
            </View>

            {/* ◀ ▶ nút chuyển ảnh */}
            <TouchableOpacity style={styles.leftArrow} onPress={prevImage}>
              <Icon name="chevron-back" size={28} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.rightArrow} onPress={nextImage}>
              <Icon name="chevron-forward" size={28} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* ●●● Indicators */}
          <View style={styles.dotsContainer}>
            {heroImages.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dot,
                  currentImageIndex === index && styles.activeDot,
                ]}
                onPress={() => setCurrentImageIndex(index)}
              />
            ))}
          </View>

          {/* Intro text */}
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorTitle}>
              Đặt lịch với Bác sĩ cho Người Cao Tuổi
            </Text>
            <Text style={styles.doctorDescription}>
              Quy trình gồm 3 bước đơn giản:{'\n'}
              1. Chọn người cao tuổi cần được chăm sóc.{'\n'}
              2. Chọn bác sĩ mong muốn.{'\n'}
              3. Chọn thời gian và xác nhận thanh toán.
            </Text>
          </View>
        </View>

        {/* Lợi ích */}
        <View style={styles.benefitsSection}>
          <View style={styles.benefitsHeader}>
            <Icon name="star" size={20} color="#FFD700" />
            <Text style={styles.benefitsTitle}>
              Lợi ích khi đặt lịch qua E-Care
            </Text>
          </View>

          <View style={styles.benefitsGrid}>
            {benefits.map(benefit => (
              <View key={benefit.id} style={styles.benefitCard}>
                <View
                  style={[
                    styles.benefitIcon,
                    { backgroundColor: `${benefit.color}20` },
                  ]}
                >
                  <Icon name={benefit.icon} size={24} color={benefit.color} />
                </View>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDescription}>
                  {benefit.description}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Lưu ý */}
        <View style={styles.noticeSection}>
          <View style={styles.noticeContent}>
            <Icon name="alert-circle" size={20} color="#ffffff" />
            <Text style={styles.noticeText}>
              Vui lòng chuẩn bị thông tin sức khỏe, thuốc đang dùng và kết quả
              xét nghiệm gần đây (nếu có) để buổi tư vấn với bác sĩ hiệu quả hơn.
            </Text>
          </View>
        </View>

        {/* Nút tiếp tục */}
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Bắt đầu đặt lịch</Text>
          <Icon
            name="arrow-forward"
            size={16}
            color="#ffffff"
            style={styles.buttonIcon}
          />
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

/* ==========================
       💅  STYLES
========================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    backgroundColor: '#4F7EFF',
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, paddingHorizontal: 16 },
  doctorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  imageContainer: { position: 'relative', marginBottom: 12 },
  doctorImage: {
    width: '100%',
    height: 280,
    borderRadius: 12,
  },
  stethoscopeIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  leftArrow: {
    position: 'absolute',
    top: '50%',
    left: 10,
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#00000060',
  },
  rightArrow: {
    position: 'absolute',
    top: '50%',
    right: 10,
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#00000060',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
  },
  activeDot: { backgroundColor: '#4F7EFF' },
  doctorInfo: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 16,
  },
  doctorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  doctorDescription: { fontSize: 14, color: '#666', lineHeight: 20 },
  benefitsSection: { marginBottom: 16 },
  benefitsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#000',
  },
  benefitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  benefitCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  benefitTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  benefitDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  noticeSection: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  noticeContent: { flexDirection: 'row', gap: 12 },
  noticeText: { color: '#fff', fontSize: 14, flex: 1, lineHeight: 20 },
  continueButton: {
    backgroundColor: '#4F7EFF',
    borderRadius: 8,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonIcon: { marginLeft: 6 },
});
IntroductionBookingDoctor.propTypes = {
  user: PropTypes.shape({
    role: PropTypes.string,
  }),
  userRole: PropTypes.string,
};

IntroductionBookingDoctor.defaultProps = {
  user: undefined,
  userRole: undefined,
};

export default IntroductionBookingDoctor;