// src/screens/doctorBooking/DoctorListScreen.jsx
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { doctorBookingService } from '../../services/doctorBookingService'; // chỉnh path nếu khác
import { SafeAreaView } from 'react-native-safe-area-context';

const TAG = '[DoctorListScreen]';

const DoctorListScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // ✅ nhận thêm family + availableDoctors để giữ flow đầy đủ
  const {
    elderly,
    family,
    healthPackage,
    durationDays,
    startDate,
    availableDoctors,
  } = route.params || {};

  // Nếu màn trước truyền sẵn availableDoctors thì dùng làm dữ liệu tạm,
  // sau đó vẫn CALL API để lấy danh sách bác sĩ đầy đủ theo rule mới.
  const [doctors, setDoctors] = useState(
    Array.isArray(availableDoctors) ? availableDoctors : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('rating'); // 'rating' | 'experience'

  const packageName =
    healthPackage?.title || healthPackage?.name || 'Gói sức khỏe đã chọn';

  useEffect(() => {
    console.log(TAG, 'route.params =', route.params);
  }, [route.params]);

  /**
   * ✅ fetchDoctors:
   * - Gọi API backend lấy TẤT CẢ user role='doctor' (phía server xử lý).
   * - Backend nhận: healthPackageId, durationDays, startDate
   *   và TRẢ VỀ chỉ những bác sĩ KHÔNG có booking trùng trong khoảng
   *   [startDate, endDate = startDate + durationDays - 1].
   * → Bác sĩ đã được đặt trong khoảng này sẽ KHÔNG xuất hiện trong list.
   */
  const fetchDoctors = useCallback(async () => {
    try {
      if (!durationDays || !startDate) {
        console.log(
          '[DoctorListScreen][fetchDoctors] thiếu params',
          {
            healthPackageId: healthPackage?._id,
            durationDays,
            startDate,
          },
        );
        return;
      }

      console.log('[DoctorListScreen][fetchDoctors] CALL API với', {
        healthPackageId: healthPackage?._id,
        durationDays,
        startDate,
      });

      setLoading(true);
      setError('');

      const res = await doctorBookingService.getAvailableDoctors({
        healthPackageId: healthPackage?._id, // backend có thể dùng hoặc bỏ qua nếu muốn
        durationDays,
        startDate,
      });

      console.log('[DoctorListScreen][fetchDoctors] RESULT =', res);

      let list = [];
      if (res?.success) {
        // Backend nên trả về tất cả bác sĩ role='doctor'
        // đã ĐƯỢC LỌC: chỉ còn bác sĩ không bị trùng lịch (tức là "chưa bị đặt" trong khoảng).
        if (Array.isArray(res.data)) {
          list = res.data;
        } else if (Array.isArray(res.data?.doctors)) {
          list = res.data.doctors;
        }
      }

      if (list.length) {
        setDoctors(list);
        setError('');
      } else {
        setDoctors([]);
        setError(
          res?.message ||
            'Hiện tại chưa có bác sĩ nào phù hợp trong khoảng thời gian này.',
        );
      }
    } catch (err) {
      console.log(
        '[DoctorListScreen][fetchDoctors] ERROR',
        err?.message,
        err?.response?.status,
        err?.response?.data,
      );
      setError(
        'Hiện tại chưa có bác sĩ nào phù hợp trong khoảng thời gian này.',
      );
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, [healthPackage, durationDays, startDate]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleViewDetail = doctor => {
    if (!doctor) return;
    const doctorId =
      doctor.doctorId ||
      doctor._id ||
      doctor?.doctor?._id ||
      doctor?.doctorProfile?._id;
    const doctorName = getDoctorName(doctor);

    console.log(TAG, 'Navigate DoctorDetail với:', {
      elderly,
      family,
      healthPackageId: healthPackage?._id,
      durationDays,
      startDate,
      doctorId,
    });

    navigation.navigate('ProfileDoctorScreen', {
      elderly, // người được khám
      family, // người đăng ký
      healthPackage,
      durationDays,
      startDate,
      doctorId,
      doctorName,
    });
  };

  const handleSelectDoctor = doctor => {
    if (!doctor) return;

    console.log(TAG, 'Select doctor -> PaymentServiceScreen', {
      elderlyId: elderly?._id,
      familyId: family?._id,
      healthPackageId: healthPackage?._id,
      durationDays,
      startDate,
      doctor: {
        id: doctor._id || doctor.doctorId,
        name: doctor?.user?.fullName || doctor?.fullName || doctor?.name,
      },
    });

    navigation.navigate('PaymentServiceScreen', {
      elderly, // ✅ pass nguyên object người được khám
      family, // ✅ pass nguyên object người đăng ký
      healthPackage,
      durationDays,
      startDate,
      doctor,
    });
  };

  const getDoctorName = d =>
    d?.user?.fullName || d?.fullName || d?.name || 'Chưa có tên';

  const getDoctorAvatarInitial = name => {
    if (!name) return '?';
    return name.trim().charAt(0).toUpperCase();
  };

  const getSpecialization = d => {
    const raw = d?.specializations ?? d?.doctorProfile?.specializations ?? '';

    if (Array.isArray(raw)) {
      return raw.join(', ');
    }
    if (typeof raw === 'string' && raw.trim()) {
      return raw;
    }
    return 'Chưa có mô tả';
  };

  const getHospitalLine = d =>
    d?.hospitalName || d?.doctorProfile?.hospitalName || '';

  const getExperienceText = d => {
    const exp = d?.experience ?? d?.doctorProfile?.experience;
    if (!exp && exp !== 0) return '';
    return `${exp} năm kinh nghiệm`;
  };

  const getRating = d => {
    const avg =
      d?.ratingStats?.averageRating ??
      d?.rating?.average ??
      d?.doctorProfile?.ratingStats?.averageRating;
    const total =
      d?.ratingStats?.totalRatings ??
      d?.rating?.total ??
      d?.doctorProfile?.ratingStats?.totalRatings;
    return {
      average: typeof avg === 'number' ? avg : null,
      total: typeof total === 'number' ? total : null,
    };
  };

  const filteredDoctors = useMemo(() => {
    let list = [...doctors];

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(d => {
        const name = getDoctorName(d).toLowerCase();
        const spec = getSpecialization(d).toLowerCase();
        return name.includes(q) || spec.includes(q);
      });
    }

    list.sort((a, b) => {
      if (sortBy === 'experience') {
        const ea = a?.experience ?? a?.doctorProfile?.experience ?? 0;
        const eb = b?.experience ?? b?.doctorProfile?.experience ?? 0;
        return eb - ea; // exp cao trước
      }
      // sort theo rating
      const ra = getRating(a).average ?? 0;
      const rb = getRating(b).average ?? 0;
      return rb - ra;
    });

    return list;
  }, [doctors, searchText, sortBy]);

  const renderDoctorCard = ({ item }) => {
    const name = getDoctorName(item);
    const spec = getSpecialization(item);
    const hospital = getHospitalLine(item);
    const expText = getExperienceText(item);
    const rating = getRating(item);

    return (
      <View style={styles.card}>
        {/* avatar + info */}
        <View style={styles.cardTop}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {getDoctorAvatarInitial(name)}
              </Text>
            </View>
          </View>

          <View style={styles.infoWrapper}>
            <Text style={styles.name}>{name}</Text>

            {!!spec && (
              <Text style={styles.spec} numberOfLines={1}>
                {spec}
              </Text>
            )}

            {!!hospital && (
              <Text style={styles.hospital} numberOfLines={1}>
                {hospital}
              </Text>
            )}

            {!!expText && <Text style={styles.experience}>{expText}</Text>}

            <View style={styles.ratingBadge}>
              <Icon name="star" size={12} color="#FBBF24" />
              <Text style={styles.ratingText}>
                {rating.average != null ? rating.average.toFixed(1) : 'N/A'}
              </Text>
              {rating.total != null && (
                <Text style={styles.ratingTotal}>({rating.total})</Text>
              )}
            </View>
          </View>
        </View>

        {/* buttons */}
        <View style={styles.cardButtonsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => handleViewDetail(item)}
          >
            <Text style={styles.secondaryButtonText}>Xem chi tiết</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => handleSelectDoctor(item)}
          >
            <Text style={styles.primaryButtonText}>Chọn bác sĩ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F7EFF" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyWrapper}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    if (!filteredDoctors.length) {
      return (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyText}>
            Hiện chưa có bác sĩ nào phù hợp trong gói sức khỏe này.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredDoctors}
        keyExtractor={(item, index) =>
          item._id?.toString() ||
          item.doctorId?.toString() ||
          `doc-${index}`
        }
        renderItem={renderDoctorCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F7EFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn bác sĩ</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Gói đã chọn */}
      <View style={styles.selectedBox}>
        <Text style={styles.selectedLabel}>Gói sức khỏe:</Text>
        <Text style={styles.selectedValue}>{packageName}</Text>
      </View>

      {/* Ô tìm kiếm */}
      <View style={styles.searchWrapper}>
        <Icon name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Nhập tên bác sĩ hoặc chuyên khoa..."
          placeholderTextColor="#9CA3AF"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* Tabs sắp xếp */}
      <View style={styles.sortTabs}>
        <TouchableOpacity
          style={[
            styles.sortTab,
            sortBy === 'rating' && styles.sortTabActive,
          ]}
          onPress={() => setSortBy('rating')}
        >
          <Text
            style={[
              styles.sortTabText,
              sortBy === 'rating' && styles.sortTabTextActive,
            ]}
          >
            Đánh giá
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sortTab,
            sortBy === 'experience' && styles.sortTabActive,
          ]}
          onPress={() => setSortBy('experience')}
        >
          <Text
            style={[
              styles.sortTabText,
              sortBy === 'experience' && styles.sortTabTextActive,
            ]}
          >
            Kinh nghiệm
          </Text>
        </TouchableOpacity>
      </View>

      {renderContent()}
    </SafeAreaView>
  );
};

export default DoctorListScreen;

// giữ nguyên style
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
  selectedBox: {
    marginTop: 10,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  selectedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#111827',
    paddingVertical: 0,
  },
  sortTabs: {
    flexDirection: 'row',
    marginTop: 10,
    marginHorizontal: 16,
  },
  sortTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    marginRight: 8,
  },
  sortTabActive: {
    backgroundColor: '#4F7EFF',
    borderColor: '#4F7EFF',
  },
  sortTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  sortTabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: 'gray',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  avatarWrapper: {
    marginRight: 10,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6B7280',
  },
  infoWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  spec: {
    fontSize: 13,
    color: '#4B5563',
  },
  hospital: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  experience: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  ratingBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  ratingTotal: {
    marginLeft: 4,
    fontSize: 11,
    color: '#6B7280',
  },
  cardButtonsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#4F7EFF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
