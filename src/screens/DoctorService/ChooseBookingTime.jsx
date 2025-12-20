import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { doctorBookingService } from '../../services/doctorBookingService';

const pad = (n) => String(n).padStart(2, '0');

const formatDate = (d) => {
  if (!d) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const weekdayName = (d) => {
  if (!d) return '';
  return d.toLocaleDateString('vi-VN', { weekday: 'long' });
};

const ChooseBookingTime = ({ navigation, route }) => {
  // Parse scheduledDate from route params as local midnight if provided as YYYY-MM-DD string.
  const _scheduled = route?.params?.scheduledDate;
  let initial;
  if (_scheduled) {
    if (typeof _scheduled === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(_scheduled)) {
      const [yy, mm, dd] = _scheduled.split('-').map(Number);
      initial = new Date(yy, mm - 1, dd);
    } else {
      initial = new Date(_scheduled);
      if (isNaN(initial.getTime())) initial = new Date();
    }
  } else {
    initial = new Date();
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (initial && initial < today) {
    initial.setTime(today.getTime());
  }

  const [date, setDate] = useState(initial);
  const [slot, setSlot] = useState(route?.params?.slot || 'morning');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [loading, setLoading] = useState(false);

  const changeDay = (delta) => {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    if (next < today) {
      return;
    }
    setDate(next);
  };

  const slotStartHour = (s) => (s === 'morning' ? 8 : 14);
  const isSlotBookable = (d, s) => {
    if (!d || !s) return false;
    const now = new Date();
    const todayNorm = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetNorm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (targetNorm > todayNorm) return true;

    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), slotStartHour(s), 0, 0);
    const limit = new Date(start.getTime() - 60 * 60 * 1000);
    return now < limit;
  };

  const handleContinue = () => {
    if (!isSlotBookable(date, slot)) {
      Alert.alert('Thông báo', 'Ca khám đã bắt đầu hoặc không còn đủ thời gian (ít nhất 1 giờ trước ca). Vui lòng chọn ca khác hoặc ngày khác.');
      return;
    }

    (async () => {
      const y = date.getFullYear();
      const m = pad(date.getMonth() + 1);
      const d = pad(date.getDate());
      const scheduledDate = `${y}-${m}-${d}`;

      setLoading(true);
      try {
        const res = await doctorBookingService.getAvailableDoctors({ scheduledDate, slot, specialization: route?.params?.specialization || null });
        const doctors = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.doctors) ? res.data.doctors : [];

        navigation.navigate('AvailableDoctors', {
          scheduledDate,
          slot,
          specialization: route?.params?.specialization || null,
          elderly: route?.params?.elderly || null,
          family: route?.params?.family || null,
          availableDoctors: doctors,
        });
      } catch (e) {
        // Nếu lỗi call API, vẫn điều hướng và hiển thị thông báo
        navigation.navigate('AvailableDoctors', {
          scheduledDate,
          slot,
          specialization: route?.params?.specialization || null,
          elderly: route?.params?.elderly || null,
          family: route?.params?.family || null,
        });
      } finally {
        setLoading(false);
      }
    })();
  };

  // Calendar helpers
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const prevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  const selectDay = (day) => {
    const picked = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    // prevent selecting past days
    const pickedNorm = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate());
    if (pickedNorm < today) return;
    setDate(pickedNorm);
    setShowCalendar(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Chọn ngày và ca khám</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.container}>
        <Text style={styles.label}>Ngày khám</Text>

        <View style={styles.card}>
          <View style={styles.rowCenterLarge}>
            <TouchableOpacity
              style={[styles.chevBtn, date <= today && styles.chevDisabled]}
              onPress={() => changeDay(-1)}
              disabled={date <= today}
            >
              <Icon name="chevron-back" size={20} color="#374151" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.datePill} onPress={() => setShowCalendar(true)}>
              <Text style={styles.weekday}>{weekdayName(date)}</Text>
              <Text style={styles.dateLarge}>{formatDate(date)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.chevBtn} onPress={() => changeDay(1)}>
              <Icon name="chevron-forward" size={20} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.label, { marginTop: 20 }]}>Chọn ca</Text>
        <View style={styles.slotRowNew}>
          <TouchableOpacity
            style={[styles.slotBtnNew, slot === 'morning' && styles.slotActiveNew, !isSlotBookable(date, 'morning') && styles.slotDisabled]}
            onPress={() => setSlot('morning')}
            disabled={!isSlotBookable(date, 'morning')}
          >
            <Text style={[styles.slotTextNew, slot === 'morning' && styles.slotTextActive]}>Sáng • 08:00 - 11:00</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.slotBtnNew, slot === 'afternoon' && styles.slotActiveNew, !isSlotBookable(date, 'afternoon') && styles.slotDisabled]}
            onPress={() => setSlot('afternoon')}
            disabled={!isSlotBookable(date, 'afternoon')}
          >
            <Text style={[styles.slotTextNew, slot === 'afternoon' && styles.slotTextActive]}>Chiều • 14:00 - 17:00</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.continueNew, (date < today || loading || !isSlotBookable(date, slot)) && styles.continueDisabled]}
          onPress={handleContinue}
          disabled={loading || date < today || !isSlotBookable(date, slot)}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueTextNew}>Tiếp tục</Text>}
        </TouchableOpacity>

        <Modal visible={showCalendar} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={prevMonth} style={styles.modalNav}>
                  <Icon name="chevron-back" size={20} color="#111" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{calendarMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</Text>
                <TouchableOpacity onPress={nextMonth} style={styles.modalNav}>
                  <Icon name="chevron-forward" size={20} color="#111" />
                </TouchableOpacity>
              </View>

              <View style={styles.weekdaysRow}>
                {['T2','T3','T4','T5','T6','T7','CN'].map((w) => (
                  <Text key={w} style={styles.weekdayCell}>{w}</Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {(() => {
                  const first = startOfMonth(calendarMonth);
                  const offset = (first.getDay() + 6) % 7; // make Monday index 0
                  const total = daysInMonth(calendarMonth);
                  const cells = [];
                  for (let i = 0; i < offset; i++) cells.push(null);
                  for (let d = 1; d <= total; d++) cells.push(d);

                  return cells.map((day, idx) => {
                    if (day == null) return <View key={`blank-${idx}`} style={styles.dayCell} />;
                    const dayDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                    const dayNorm = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
                    const isSelected = date.getFullYear() === calendarMonth.getFullYear() && date.getMonth() === calendarMonth.getMonth() && date.getDate() === day;
                    const isPast = dayNorm < today;
                    return (
                      <TouchableOpacity
                        key={`day-${day}-${idx}`}
                        style={[styles.dayCell, isSelected && styles.dayCellActive, isPast && styles.dayCellDisabled]}
                        onPress={() => selectDay(day)}
                        disabled={isPast}
                      >
                        <Text style={[styles.dayText, isSelected && styles.dayTextActive, isPast && styles.dayTextDisabled]}>{day}</Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>

              <TouchableOpacity style={styles.modalClose} onPress={() => setShowCalendar(false)}>
                <Text style={styles.modalCloseText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

// Insert calendar modal JSX by editing file end: we'll append Modal render inside component via HOC-like wrapper


// Calendar modal render function placed after component to keep file organized
// We render modal inside the same file via JSX below using state

export default ChooseBookingTime;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F6FB' },
  header: {
    height: 56,
    backgroundColor: '#fff',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  back: { width: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 16 },
  container: { padding: 18 },
  label: { color: '#6B7280', marginBottom: 8, fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  rowCenterLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chevBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFF',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    elevation: 1,
  },
  datePill: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: { color: '#6B7280', fontSize: 13, textTransform: 'capitalize' },
  dateLarge: { fontSize: 18, fontWeight: '800', marginTop: 6 },
  slotRowNew: { flexDirection: 'row', marginTop: 8, gap: 12 },
  slotBtnNew: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  slotActiveNew: { borderWidth: 1, borderColor: '#4F7EFF', backgroundColor: '#EEF2FF' },
  slotTextNew: { fontWeight: '700', color: '#111827' },
  slotTextActive: { color: '#1D4ED8' },
  slotSub: { color: '#6B7280', fontSize: 12, marginTop: 6 },
  continueNew: {
    marginTop: 28,
    backgroundColor: '#4F7EFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2B6CB0',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  continueTextNew: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '92%', backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  modalNav: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontWeight: '700', fontSize: 16 },
  weekdaysRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  weekdayCell: { width: 36, textAlign: 'center', color: '#6B7280', fontSize: 12 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  dayText: { color: '#111827' },
  dayCellActive: { backgroundColor: '#EEF2FF', borderRadius: 8 },
  dayTextActive: { color: '#1D4ED8', fontWeight: '700' },
  dayCellDisabled: { opacity: 0.35 },
  dayTextDisabled: { color: '#9CA3AF' },
  modalClose: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  modalCloseText: { color: '#4F7EFF', fontWeight: '700' },
  chevDisabled: { opacity: 0.4 },
  continueDisabled: { backgroundColor: '#7ea0ff' },
  slotDisabled: { opacity: 0.5, backgroundColor: '#F8FAFF' },
});
