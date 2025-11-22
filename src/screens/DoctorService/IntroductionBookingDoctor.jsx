import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
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

const heroImages = [
  {
    uri: 'https://images.pexels.com/photos/6129683/pexels-photo-6129683.jpeg',
  },
  {
    uri: 'https://images.pexels.com/photos/7659578/pexels-photo-7659578.jpeg',
  },
];

const IntroductionBookingDoctor = () => {
  const navigation = useNavigation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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

  const handleDotPress = index => {
    setCurrentImageIndex(index);
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleContinue = () => {
    // Khi bắt đầu đặt lịch -> chuyển sang màn danh sách người thân
    // Truyền message để FamilyListFunctionScreen hiển thị tiêu đề phù hợp
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
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* Hero / Doctor Illustration */}
        <View style={styles.doctorCard}>
          <View style={styles.imageContainer}>
            <Image source={heroImages[currentImageIndex]} style={styles.doctorImage} />
            <View style={styles.stethoscopeIcon}>
              <MaterialCommunityIcons
                name="stethoscope"
                size={20}
                color="#3b82f6"
              />
            </View>
          </View>

          {/* Image Indicators */}
          <View style={styles.dotsContainer}>
            {heroImages.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dot,
                  currentImageIndex === index && styles.activeDot,
                ]}
                onPress={() => handleDotPress(index)}
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
              2. Chọn gói khám và thời lượng 30 / 90 / 180 / 270 ngày.{'\n'}
              3. Chọn bác sĩ phù hợp và xác nhận thanh toán.
            </Text>
          </View>
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <View style={styles.benefitsHeader}>
            <Icon name="star" size={20} color="#FFD700" />
            <Text style={styles.benefitsTitle}>Lợi ích khi đặt lịch qua E-Care</Text>
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

        {/* Important Notice */}
        <View style={styles.noticeSection}>
          <View style={styles.noticeContent}>
            <Icon name="alert-circle" size={20} color="#ffffff" />
            <Text style={styles.noticeText}>
              Vui lòng chuẩn bị thông tin sức khỏe, thuốc đang dùng và kết quả
              xét nghiệm gần đây (nếu có) để buổi tư vấn với bác sĩ hiệu quả hơn.
            </Text>
          </View>
        </View>

        {/* Continue Button */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#4F7EFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 60,
    justifyContent: 'center',
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  doctorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  doctorImage: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    backgroundColor: '#E8EEF8',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    backgroundColor: '#E0E0E0',
  },
  activeDot: {
    backgroundColor: '#4F7EFF',
  },
  doctorInfo: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 16,
  },
  doctorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  doctorDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  benefitsSection: {
    marginBottom: 16,
  },
  benefitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  benefitCard: {
    width: '48%',
    backgroundColor: '#ffffff',
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
  benefitTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 16,
  },
  noticeSection: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  noticeContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  noticeText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
    flex: 1,
    marginTop: 2,
  },
  continueButton: {
    backgroundColor: '#4F7EFF',
    borderRadius: 8,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
});

export default IntroductionBookingDoctor;
