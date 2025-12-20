// src/screens/doctorBooking/HealthPackageScheduleScreen.jsx
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { doctorBookingService } from '../../services/doctorBookingService';
import { SafeAreaView } from 'react-native-safe-area-context';

// Fallback mặc định nếu package không có thông tin duration
const DEFAULT_DURATIONS = [
  { label: '30 ngày', days: 30 },
  { label: '90 ngày', days: 90 },
  { label: '180 ngày', days: 180 },
  { label: '270 ngày', days: 270 },
];

const TAG = '[HealthPackageScheduleScreen]';

// ✅ SỬA Ở ĐÂY: format theo LOCAL, KHÔNG dùng toISOString
const formatDate = date => {
  if (!(date instanceof Date)) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`; // YYYY-MM-DD theo giờ local
};

const formatDateVN = date => {
  if (!(date instanceof Date)) return '';
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days - 1); // -1 để bao gồm ngày bắt đầu
  return d;
};

// Helper tạo label từ số ngày: hiển thị luôn X ngày
const makeDurationLabel = days => {
  const d = Number(days);
  if (!d || Number.isNaN(d)) return '';
  return `${d} ngày`;
};

const HealthPackageScheduleScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const { elderly, family, healthPackage } = route.params || {};

  React.useEffect(() => {
    console.log(TAG, 'route.params =', route.params);
    console.log(TAG, 'healthPackage =', healthPackage);
  }, [route.params, healthPackage]);

  // Cho phép đổi ngày bắt đầu
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ===== LẤY DURATION TỪ DATABASE =====
  const durationOptions = useMemo(() => {
    // 1) Nếu backend trả mảng durations dạng [{ days, fee, isOption }, ...]
    if (
      healthPackage &&
      Array.isArray(healthPackage.durations) &&
      healthPackage.durations.length
    ) {
      const opts = healthPackage.durations
        .map(raw => {
          if (!raw) return null;

          const days = Number(raw.days);
          if (!days || Number.isNaN(days)) return null;

          const fee =
            raw.fee != null && !Number.isNaN(Number(raw.fee))
              ? Number(raw.fee)
              : null;

          return {
            days,
            fee, // đọc fee trực tiếp từ DB
            isOption: !!raw.isOption,
            label: makeDurationLabel(days), // ví dụ: "90 ngày"
          };
        })
        .filter(Boolean);

      if (opts.length) return opts;
    }

    // 2) Nếu backend chỉ có 1 duration đơn lẻ (trường cũ durationDays)
    if (healthPackage?.durationDays) {
      const days = Number(healthPackage.durationDays);
      if (days) {
        return [
          {
            days,
            fee:
              healthPackage?.price != null &&
              !Number.isNaN(Number(healthPackage.price))
                ? Number(healthPackage.price)
                : null,
            label: makeDurationLabel(days),
          },
        ];
      }
    }

    // 3) Không có → fallback
    return DEFAULT_DURATIONS;
  }, [healthPackage]);

  const [selectedDuration, setSelectedDuration] = useState(() => {
    return durationOptions[0] || DEFAULT_DURATIONS[0];
  });

  React.useEffect(() => {
    if (durationOptions.length) {
      setSelectedDuration(durationOptions[0]);
    }
  }, [durationOptions]);

  const endDate = useMemo(
    () => addDays(startDate, selectedDuration.days),
    [startDate, selectedDuration.days],
  );

  // Giá tạm tính:
  // 1) Nếu duration có field fee → dùng trực tiếp
  // 2) Nếu không có fee → fallback theo logic cũ: basePrice * (days / 30)
  const estimatedPrice = useMemo(() => {
    const durationFee =
      selectedDuration?.fee != null &&
      !Number.isNaN(Number(selectedDuration.fee))
        ? Number(selectedDuration.fee)
        : null;

    if (durationFee != null) {
      return durationFee;
    }

    const base = Number(healthPackage?.price || 0);
    if (!base) return null;

    return base * (selectedDuration.days / 30);
  }, [healthPackage, selectedDuration]);

  const handleBack = () => navigation.goBack();

  const handleOpenDatePicker = () => {
    if (submitting) return;
    setShowDatePicker(true);
  };

  // ========== CALL API LẤY BÁC SĨ ==========
  const handleContinue = async () => {
    const healthPackageId = healthPackage?._id || healthPackage?.id;

    if (!healthPackageId) {
      Alert.alert('Thông báo', 'Thiếu thông tin gói sức khỏe.');
      return;
    }

    const startDateStr = formatDate(startDate); // dùng hàm format mới

    try {
      setSubmitting(true);

      const res = await doctorBookingService.getAvailableDoctors({
        healthPackageId,
        durationDays: selectedDuration.days,
        startDate: startDateStr,
      });

      if (!res?.success) {
        Alert.alert(
          'Không thể tải bác sĩ',
          res?.message || 'Vui lòng thử lại',
        );
        return;
      }

      const doctors = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.doctors)
        ? res.data.doctors
        : [];

      navigation.navigate('DoctorListScreen', {
        elderly,
        family,
        healthPackage,
        durationDays: selectedDuration.days,
        startDate: startDateStr,
        availableDoctors: doctors,
      });
    } catch (e) {
      Alert.alert('Lỗi kết nối', 'Không thể tải danh sách bác sĩ.');
    } finally {
      setSubmitting(false);
    }
  };

  const packageName =
    healthPackage?.title || healthPackage?.name || 'Gói sức khỏe';

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

      {/* Steps (date-first flow) */}
      <View style={styles.stepContainer}>
        <View style={[styles.stepItem, styles.stepItemActive]}>
          <Text style={styles.stepLabelActive}>1. Chọn lịch khám</Text>
        </View>
        <View style={styles.stepDivider} />
        <View style={styles.stepItem}>
          <Text style={styles.stepLabel}>2. Chọn bác sĩ</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Gói đã chọn */}
        <View style={styles.selectedBox}>
          <Text style={styles.selectedLabel}>Gói sức khỏe đã chọn:</Text>
          <Text style={styles.selectedValue}>{packageName}</Text>
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chọn gói dịch vụ</Text>
          <View style={styles.durationTabs}>
            {durationOptions.map(d => (
              <TouchableOpacity
                key={d.days}
                style={[
                  styles.durationTab,
                  selectedDuration.days === d.days &&
                    styles.durationTabActive,
                ]}
                onPress={() => setSelectedDuration(d)}
                disabled={submitting}
              >
                <Text
                  style={[
                    styles.durationTabText,
                    selectedDuration.days === d.days &&
                      styles.durationTabTextActive,
                  ]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chọn ngày bắt đầu</Text>

          <View style={styles.dateCard}>
            <TouchableOpacity
              style={styles.dateRow}
              activeOpacity={0.8}
              onPress={handleOpenDatePicker}
              disabled={submitting}
            >
              <Icon name="calendar-outline" size={18} color="#6B7280" />
              <Text style={styles.dateText}>
                {formatDate(startDate)} (YYYY-MM-DD)
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                minimumDate={new Date()} // không cho chọn ngày quá khứ
                onChange={(event, selected) => {
                  setShowDatePicker(false);
                  if (event?.type === 'dismissed') return;
                  if (selected) {
                    const normalized = new Date(
                      selected.getFullYear(),
                      selected.getMonth(),
                      selected.getDate(),
                      0,
                      0,
                      0,
                      0,
                    );
                    setStartDate(normalized);
                  }
                }}
              />
            )}

            <Text style={styles.infoLine}>
              Gói có hiệu lực liên tục trong suốt thời gian đã chọn.
            </Text>
            <Text style={styles.infoLine}>
              Thời gian áp dụng:{' '}
              <Text style={styles.bold}>
                {formatDateVN(startDate)} - {formatDateVN(endDate)}
              </Text>
            </Text>
          </View>
        </View>

        {/* Price */}
        <View style={styles.section}>
          <Text style={styles.priceLabel}>Giá tạm tính:</Text>
          <Text style={styles.priceValue}>
            {estimatedPrice != null
              ? `${estimatedPrice.toLocaleString('vi-VN')}₫`
              : 'Liên hệ'}
          </Text>
        </View>

        {/* Rules */}
        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>Quy tắc đặt gói</Text>

          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>{'\u2022'}</Text>
            <Text style={styles.bulletText}>
              Không chọn ngày bắt đầu trong quá khứ.
            </Text>
          </View>

          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>{'\u2022'}</Text>
            <Text style={styles.bulletText}>
              Gói có hiệu lực từ 00:00 ngày bắt đầu đến 23:59 ngày kết thúc.
            </Text>
          </View>

          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>{'\u2022'}</Text>
            <Text style={styles.bulletText}>
              Trong thời gian hiệu lực, bác sĩ được đặt riêng cho người cao
              tuổi.
            </Text>
          </View>
        </View>

        {/* Continue */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleContinue}
          disabled={submitting}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? 'Đang tải bác sĩ...' : 'Tiếp tục chọn bác sĩ'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HealthPackageScheduleScreen;

// Styles giữ nguyên y chang
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
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
    color: '#4F7EFF',
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
    paddingHorizontal: 16,
  },
  selectedBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  selectedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  durationTabs: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    padding: 3,
  },
  durationTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationTabActive: {
    backgroundColor: '#4F7EFF',
  },
  durationTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  durationTabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  dateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  dateText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#111827',
  },
  infoLine: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  bold: {
    fontWeight: '600',
    color: '#111827',
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },
  rulesCard: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rulesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  bulletDot: {
    marginRight: 6,
    fontSize: 10,
    color: '#111827',
    marginTop: 4,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: 20,
    backgroundColor: '#4F7EFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
