import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { doctorBookingService } from '../../services/doctorBookingService';
import { SafeAreaView } from 'react-native-safe-area-context';

const DoctorListBookScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // ✅ nhận lại cả elderly + family từ route (giữ nguyên để truyền tiếp)
  const { elderly, family } = route.params || {};

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const res = await doctorBookingService.getAvailableDoctors();

      const list = Array.isArray(res?.data) ? res.data : [];

      if (list.length) {
        setDoctors(list);
        setError('');
      } else {
        setDoctors([]);
        setError(
          typeof res?.message === 'string'
            ? res.message
            : 'Không lấy được danh sách bác sĩ. Vui lòng thử lại.',
        );
      }
    } catch (err) {
      setError('Không lấy được danh sách bác sĩ. Vui lòng thử lại.');
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDoctors();
    setRefreshing(false);
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSelectDoctor = doctor => {
    if (!doctor) return;

    navigation.navigate('DoctorScheduleSelectScreen', {
      elderly,
      family,
      doctor,
    });
  };

  const renderDoctorCard = doctor => {
    const name = doctor?.fullName || 'Bác sĩ';
    const specialization = doctor?.specialization || '';
    const experience = typeof doctor?.experience === 'number' ? doctor.experience : null;
    const avgRating =
      typeof doctor?.ratingStats?.averageRating === 'number'
        ? doctor.ratingStats.averageRating
        : 0;
    const totalRatings =
      typeof doctor?.ratingStats?.totalRatings === 'number'
        ? doctor.ratingStats.totalRatings
        : 0;
    const hasRating = totalRatings > 0;

    return (
      <View key={doctor?.doctorId || doctor?._id} style={styles.packageCard}>
        <Text style={styles.packageTitle}>{name}</Text>

        {/* Chuyên khoa + kinh nghiệm */}
        {(specialization || experience) && (
          <View style={styles.metaContainer}>
            {specialization ? (
              <Text style={styles.metaText} numberOfLines={1}>
                Chuyên khoa: <Text style={styles.metaHighlight}>{specialization}</Text>
              </Text>
            ) : null}
            {typeof experience === 'number' ? (
              <Text style={styles.metaText}>
                Kinh nghiệm: <Text style={styles.metaHighlight}>{experience} năm</Text>
              </Text>
            ) : null}
          </View>
        )}

        {/* Đánh giá */}
        <View style={styles.ratingRow}>
          <Icon
            name="star"
            size={16}
            color={hasRating ? '#FBBF24' : '#D1D5DB'}
            style={{ marginRight: 4 }}
          />
          {hasRating ? (
            <Text style={styles.ratingText}>
              <Text style={styles.ratingScore}>{avgRating.toFixed(1)}</Text>
              <Text style={styles.ratingSlash}> / 5</Text>
              <Text style={styles.ratingCount}> · {totalRatings} lượt đánh giá</Text>
            </Text>
          ) : (
            <Text style={styles.ratingText}>Chưa có đánh giá</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => handleSelectDoctor(doctor)}
        >
          <Text style={styles.primaryButtonText}>Chọn bác sĩ</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ============== RENDER ==============
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F7EFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đặt lịch tư vấn tại nhà</Text>
        <View style={{ width: 24 }} />
      </View>
      {/* Steps */}
            <View style={styles.stepContainer}>
              <View style={styles.stepItem}>
                <Text style={styles.stepLabel}>1. Chọn lịch khám</Text>
              </View>
              <View style={styles.stepDivider} />
              <View style={[styles.stepItem, styles.stepItemActive]}>
                <Text style={styles.stepLabelActive}>2. Chọn bác sĩ</Text>
              </View>
            </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {error ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Text style={{ color: 'red', marginBottom: 8 }}>
                {typeof error === 'string' ? error : ''}
              </Text>
            </View>
          ) : null}

          {!error && !doctors.length ? (
            <View style={{ padding: 16 }}>
              <Text style={{ textAlign: 'center', color: '#6B7280' }}>
                Hiện chưa có bác sĩ nào khả dụng.
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              {doctors.map(renderDoctorCard)}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default DoctorListBookScreen;

// styles giữ nguyên như bạn
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#4F7EFF',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F7EFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  stepItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  stepItemActive: {
    backgroundColor: '#ffffff',
  },
  stepLabel: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  stepLabelActive: {
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  stepDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5F5',
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  packageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  metaContainer: {
    marginBottom: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 2,
  },
  metaHighlight: {
    fontWeight: '600',
    color: '#1D4ED8',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 13,
    color: '#4B5563',
  },
  ratingScore: {
    fontWeight: '700',
    color: '#111827',
  },
  ratingSlash: {
    color: '#6B7280',
  },
  ratingCount: {
    color: '#6B7280',
  },
  packageDescription: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 8,
  },
  packageLine: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  secondaryButton: {
    marginTop: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#4F7EFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // ===== Modal styles =====
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  modalPackageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modalDescription: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 10,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  modalLine: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  modalButtonsWrapper: {
    marginTop: 16,
  },
  modalSecondaryButton: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  modalPrimaryButton: {
    backgroundColor: '#4F7EFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
