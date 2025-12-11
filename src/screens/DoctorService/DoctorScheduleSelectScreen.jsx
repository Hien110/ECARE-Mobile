import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doctorBookingService } from '../../services/doctorBookingService';

const formatDate = (date) => {
  if (!(date instanceof Date)) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const DoctorScheduleSelectScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const { elderly, family, doctor } = route.params || {};

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [freeSlots, setFreeSlots] = useState([]); 
  const [selectedSlot, setSelectedSlot] = useState(null); 

  const doctorId = doctor?.doctorId || doctor?._id;

  const handleBack = () => {
    navigation.goBack();
  };

  const fetchFreeSchedule = async (targetDate) => {
    if (!doctorId) {
      setError('Thiếu thông tin bác sĩ.');
      return;
    }

    const dateStr = formatDate(targetDate);

    try {
      setLoading(true);
      setError('');

      const res = await doctorBookingService.getDoctorFreeSchedule(doctorId, {
        fromDate: dateStr,
        toDate: dateStr,
      });

      const list = Array.isArray(res?.data) ? res.data : [];

      setFreeSlots(list);

      if (!res?.success || !list.length) {
        setError(
          res?.message || 'Bác sĩ hôm nay đã hết lịch làm việc.',
        );
      } else {
        setError('');
      }
    } catch (err) {
      setError('Không lấy được lịch trống của bác sĩ. Vui lòng thử lại.');
      setFreeSlots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFreeSchedule(selectedDate);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFreeSchedule(selectedDate);
    setRefreshing(false);
  };

  const openDatePicker = () => {
    setShowDatePicker(true);
  };

  const handleSelectSlot = (dateKey, slotKey) => {
    // Lưu đúng dateKey trả về từ backend để khớp khi highlight
    setSelectedSlot({ date: dateKey, slot: slotKey });
  };

  const handleConfirm = () => {
    if (!selectedSlot || !doctorId) {
      Alert.alert('Thông báo', 'Vui lòng chọn ngày và buổi khám.');
      return;
    }

    navigation.navigate('PaymentServiceScreen', {
      elderly,
      family,
      doctor,
      scheduledDate: selectedSlot.date,
      slot: selectedSlot.slot,
      slotLabel:
        selectedSlot.slot === 'morning'
          ? 'Sáng (08:00 - 11:00)'
          : 'Chiều (14:00 - 17:00)',
    });
  };

  const renderSlotsForDay = (day) => {
    const { date, freeSlots: slots } = day;

    if (!slots || !slots.length) return null;

    const hasMorning = slots.some((s) => s.slot === 'morning');
    const hasAfternoon = slots.some((s) => s.slot === 'afternoon');

    return (
      <View key={date} style={styles.slotCard}>
        <Text style={styles.slotDate}>Ngày {formatDate(selectedDate)}</Text>

        <View style={styles.slotRow}>
          <TouchableOpacity
            disabled={!hasMorning}
            style={[
              styles.slotButton,
              !hasMorning && styles.slotButtonDisabled,
              selectedSlot &&
                selectedSlot.date === date &&
                selectedSlot.slot === 'morning' &&
                styles.slotButtonActive,
            ]}
            onPress={() => hasMorning && handleSelectSlot(date, 'morning')}
          >
            <Text
              style={[
                styles.slotButtonText,
                !hasMorning && styles.slotButtonTextDisabled,
                selectedSlot &&
                  selectedSlot.date === date &&
                  selectedSlot.slot === 'morning' &&
                  styles.slotButtonTextActive,
              ]}
            >
              Sáng (08:00h - 11:00h)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={!hasAfternoon}
            style={[
              styles.slotButton,
              !hasAfternoon && styles.slotButtonDisabled,
              selectedSlot &&
                selectedSlot.date === date &&
                selectedSlot.slot === 'afternoon' &&
                styles.slotButtonActive,
            ]}
            onPress={() => hasAfternoon && handleSelectSlot(date, 'afternoon')}
          >
            <Text
              style={[
                styles.slotButtonText,
                !hasAfternoon && styles.slotButtonTextDisabled,
                selectedSlot &&
                  selectedSlot.date === date &&
                  selectedSlot.slot === 'afternoon' &&
                  styles.slotButtonTextActive,
              ]}
            >
              Chiều (14:00h - 17:00h)
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F7EFF" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn lịch khám</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.stepContainer}>
        <View style={styles.stepItem}>
          <Text style={styles.stepLabel}>1. Chọn bác sĩ</Text>
        </View>
        <View style={styles.stepDivider} />
        <View style={[styles.stepItem, styles.stepItemActive]}>
          <Text style={styles.stepLabelActive}>2. Chọn lịch khám</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bác sĩ đã chọn</Text>
          <Text style={styles.doctorName}>{doctor?.fullName || 'Bác sĩ'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chọn ngày</Text>

          <View style={styles.dateCard}>
            <TouchableOpacity
              style={styles.dateRow}
              activeOpacity={0.8}
              onPress={openDatePicker}
            >
              <Icon name="calendar-outline" size={18} color="#6B7280" />
              <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, picked) => {
                  setShowDatePicker(false);
                  if (event?.type === 'dismissed') return;
                  if (picked) {
                    const normalized = new Date(
                      picked.getFullYear(),
                      picked.getMonth(),
                      picked.getDate(),
                      0,
                      0,
                      0,
                      0,
                    );
                    setSelectedDate(normalized);
                    setSelectedSlot(null);
                    fetchFreeSchedule(normalized);
                  }
                }}
              />
            )}

            <Text style={styles.infoLine}>
              Chỉ hiển thị các buổi còn trống của bác sĩ trong ngày.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Các buổi còn trống</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1D4ED8" />
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : !freeSlots.length ? (
            <Text style={styles.infoLine}>
              Không có buổi trống trong ngày này.
            </Text>
          ) : (
            freeSlots.map(renderSlotsForDay)
          )}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleConfirm}
          disabled={!selectedSlot}
        >
          <Text style={styles.primaryButtonText}>
            {selectedSlot ? 'Xác nhận lịch khám' : 'Chọn ngày & buổi khám'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DoctorScheduleSelectScreen;

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
    paddingHorizontal: 16,
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
  doctorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
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
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 13,
    color: 'red',
  },
  slotCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  slotDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  slotButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  slotButtonDisabled: {
    backgroundColor: '#E5E7EB',
    opacity: 0.6,
  },
  slotButtonActive: {
    backgroundColor: '#4F7EFF',
    borderColor: '#1D4ED8',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  slotButtonText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  slotButtonTextDisabled: {
    color: '#9CA3AF',
  },
  slotButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 24,
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
