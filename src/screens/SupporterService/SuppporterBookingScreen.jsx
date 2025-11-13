// SupporterBooking.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import supporterSchedulingService from '../../services/supporterSchedulingService';
import userService from '../../services/userService';

/* ================== Constants & helpers ================== */
const VN_WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const VN_MONTH_LABELS = [
  'Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12',
];
const mapJS2Schema = jsDay => (jsDay === 0 ? 8 : jsDay + 1);

const SESSION_LABELS = {
  morning: 'Buổi sáng (08:00-12:00)',
  afternoon: 'Buổi chiều (13:00-17:00)',
  evening: 'Buổi tối (18:00-21:00)',
};
const SESSION_ORDER = { morning: 0, afternoon: 1, evening: 2 };
const VALID_BOOKING_STATUSES = ['pending', 'confirmed', 'completed'];

const money = n =>
  typeof n === 'number'
    ? n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })
    : '—';

const getSupporterId = supporter => supporter?.profile?.user?._id;

const normalizeSupporter = supporter => {
  if (!supporter) return null;
  return {
    ...supporter,
    schedule: supporter?.profile?.schedule ?? supporter?.schedule ?? [],
    sessionFee: supporter?.profile?.sessionFee ?? supporter?.sessionFee ?? {},
    serviceArea: supporter?.profile?.serviceArea ?? supporter?.serviceArea,
    ratingStats: supporter?.profile?.ratingStats ?? supporter?.ratingStats,
    experience:
      supporter?.profile?.experience?.description ?? supporter?.experience,
    totalYears:
      supporter?.profile?.experience?.totalYears ?? supporter?.totalYears,
  };
};

const getSessionsForDate = (normalizedSupporter, date) => {
  const jsDay = date.getDay();
  const schemaDay = mapJS2Schema(jsDay);
  const schedule = normalizedSupporter?.schedule || [];
  const slots = schedule
    .filter(s => s?.dayOfWeek === schemaDay)
    .flatMap(s => s?.timeSlots || []);
  return Array.from(new Set(slots));
};

const feeForSession = (normalizedSupporter, sessionKey) =>
  normalizedSupporter?.sessionFee?.[sessionKey] ?? null;

const formatDateVN = d => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const wd = VN_WEEKDAY_LABELS[d.getDay()];
  return `${wd}, ${dd}/${mm}/${yyyy}`;
};

const startOfDay = d => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const buildMonthMatrix = (year, month) => {
  const first = new Date(year, month, 1);
  const firstDow = first.getDay(); // 0..6 (CN..T7)
  const matrix = [];
  let current = 1 - firstDow;

  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(year, month, current);
      week.push(date);
      current += 1;
    }
    matrix.push(week);
  }
  return matrix;
};

/* ================== Mini Calendar Modal ================== */
const MiniCalendarModal = ({
  visible,
  value,
  minimumDate,
  onRequestClose,
  onConfirm,
}) => {
  const today = startOfDay(new Date());
  const minDate = minimumDate ? startOfDay(minimumDate) : null;
  const [cursor, setCursor] = useState(() => startOfDay(value || today));
  const matrix = useMemo(
    () => buildMonthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  useEffect(() => {
    if (visible) setCursor(startOfDay(value || today));
  }, [visible]);

  const prevMonth = () => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() - 1);
    setCursor(d);
  };
  const nextMonth = () => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + 1);
    setCursor(d);
  };

  const isDisabled = d => {
    if (minDate && startOfDay(d) < minDate) return true;
    return false;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.calendarCard}>
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Icon name="chevron-back" size={20} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.calHeaderText}>
              {VN_MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Icon name="chevron-forward" size={20} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {VN_WEEKDAY_LABELS.map(label => (
              <Text key={label} style={styles.weekLabel}>{label}</Text>
            ))}
          </View>

          {matrix.map((week, wi) => (
            <View key={wi} style={styles.dayRow}>
              {week.map((d, di) => {
                const inMonth = d.getMonth() === cursor.getMonth();
                const selected = value && sameDay(d, value);
                const disabled = !inMonth || isDisabled(d);
                return (
                  <TouchableOpacity
                    key={di}
                    disabled={disabled}
                    onPress={() => onConfirm(startOfDay(d))}
                    style={[
                      styles.dayCell,
                      selected && styles.dayCellSelected,
                      disabled && styles.dayCellDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !inMonth && { color: '#cbd5e1' },
                        selected && styles.dayTextSelected,
                        disabled && { color: '#cbd5e1' },
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity onPress={onRequestClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

/* ================== Error Modal ================== */
const ErrorModal = ({ visible, message, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <View style={styles.errorCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Icon name="warning-outline" size={22} color="#b91c1c" />
          <Text style={styles.errorTitle}>Thiếu thông tin</Text>
        </View>
        <Text style={styles.errorMessage}>{message}</Text>
        <TouchableOpacity onPress={onClose} style={styles.errorCloseBtn}>
          <Text style={styles.errorCloseText}>Đã hiểu</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

/* ================== Address Picker Modal (embedded) ================== */
/** Modal tự chứa: nhập địa chỉ, chọn xã/phường Đà Nẵng, lấy toạ độ (OSM + fallback).
 * onSave sẽ trả { address: string, location: { latitude, longitude } | null }
 */
const AddressPickerModal = ({
  visible,
  initialAddress,
  onClose,
  onSave,
}) => {
  const [address, setAddress] = useState('');
  const [communes, setCommunes] = useState([]);
  const [selectedCommune, setSelectedCommune] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCoordinates, setLoadingCoordinates] = useState(false);
  const [coords, setCoords] = useState(null);

  const extractCommuneFromAddress = (fullAddress, communesList) => {
    if (!fullAddress || !communesList?.length) return;
    const parts = fullAddress.split(',');
    if (parts.length > 1) {
      const communePart = parts[1].trim().toLowerCase();
      const found = communesList.find(c =>
        c.name.toLowerCase().includes(communePart) || communePart.includes(c.name.toLowerCase())
      );
      if (found) setSelectedCommune(found.code);
    }
  };

  const fetchCommunes = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://production.cas.so/address-kit/2025-07-01/provinces/48/communes');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = data.communes || [];
      setCommunes(list);
      extractCommuneFromAddress(initialAddress ?? undefined, list);
    } catch (e) {
      console.warn('fetchCommunes error', e);
      setCommunes([]);
      Alert.alert('Lỗi', 'Không thể tải danh sách xã/phường.');
    } finally {
      setLoading(false);
    }
  };

  const getCoordinatesFromAddress = async (fullAddress) => {
    try {
      setLoadingCoordinates(true);

      // Trung tâm Đà Nẵng (fallback)
      let base = { latitude: 16.0471, longitude: 108.2068 };

      const selected = communes.find(c => c.code === selectedCommune);
      if (selected) {
        const offset = parseInt(selected.code, 10) % 100;
        base.latitude += (offset * 0.001) - 0.05;
        base.longitude += (offset * 0.0015) - 0.075;
      }

      try {
        const encoded = encodeURIComponent(fullAddress);
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5000);
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1&countrycodes=vn`,
          { headers: { 'User-Agent': 'ECare-Mobile-App/1.0' }, signal: controller.signal }
        );
        clearTimeout(t);
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data) && data.length > 0) {
            base = { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
          }
        }
      } catch (e) {
        console.log('Geocoding failed, using base', e?.message);
      }

      setCoords(base);
      return base;
    } finally {
      setLoadingCoordinates(false);
    }
  };

  const buildFullAddress = () => {
    const communeName = communes.find(c => c.code === selectedCommune)?.name || '';
    return `${address.trim()}, ${communeName}, Đà Nẵng`;
  };

  const handleSave = async () => {
    if (!address.trim() || !selectedCommune) {
      Alert.alert('Thông báo', 'Vui lòng điền đầy đủ địa chỉ và chọn xã/phường.');
      return;
    }
    const fullAddress = buildFullAddress();
    let location = coords;
    if (!location) {
      location = await getCoordinatesFromAddress(`${fullAddress}, Việt Nam`).catch(() => null);
    }
    onSave({ address: fullAddress, location: location ?? null });
  };

  useEffect(() => {
    if (visible) {
      setAddress(() => {
        if (initialAddress) {
          const parts = initialAddress.split(',');
          return parts[0]?.trim() ?? '';
        }
        return '';
      });
      setCoords(null);
      setSelectedCommune('');
      fetchCommunes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.addrCard}>
          <View style={styles.addrHeader}>
            <Text style={styles.addrTitle}>Cập nhật địa chỉ hỗ trợ</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.addrLabel}>Số nhà, tên đường *</Text>
          <TextInput
            style={styles.addrInput}
            value={address}
            onChangeText={(t) => { setAddress(t); setCoords(null); }}
            placeholder="VD: 123 Nguyễn Văn Linh"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.addrLabel}>Tỉnh/Thành phố *</Text>
          <View style={[styles.addrInput, { opacity: 0.8 }]}>
            <Text style={{ color: '#6B7280', fontWeight: '500' }}>Đà Nẵng</Text>
          </View>

          <Text style={styles.addrLabel}>Xã/Phường *</Text>
          <View style={styles.addrSelect}>
            {loading ? (
              <ActivityIndicator size="small" color="#2196F3" />
            ) : (
              <FlatList
                data={communes}
                keyExtractor={(item) => item.code}
                style={{ maxHeight: 180 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.communeItem,
                      selectedCommune === item.code && styles.communeItemActive,
                    ]}
                    onPress={() => { setSelectedCommune(item.code); setCoords(null); }}
                  >
                    <Text style={[
                      styles.communeText,
                      selectedCommune === item.code && { fontWeight: '700', color: '#1d4ed8' }
                    ]}>
                      {item.name}
                    </Text>
                    {selectedCommune === item.code && <Icon name="checkmark" size={16} color="#1d4ed8" />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={{ color: '#6b7280', textAlign: 'center', padding: 12 }}>
                    Không có dữ liệu xã/phường
                  </Text>
                }
              />
            )}
          </View>

          <TouchableOpacity
            style={[styles.geoBtn, (!address.trim() || !selectedCommune) && { opacity: 0.6 }]}
            disabled={loadingCoordinates || !address.trim() || !selectedCommune}
            onPress={async () => {
              const full = `${buildFullAddress()}, Việt Nam`;
              const c = await getCoordinatesFromAddress(full);
              if (c) Alert.alert('Thành công', 'Đã lấy được toạ độ địa chỉ!');
            }}
          >
            {loadingCoordinates ? <ActivityIndicator color="#fff" /> : <Icon name="location" size={18} color="#fff" />}
            <Text style={styles.geoBtnText}>
              {loadingCoordinates ? 'Đang lấy toạ độ...' : 'Lấy toạ độ địa chỉ'}
            </Text>
          </TouchableOpacity>

          {coords && (
            <View style={styles.coordBox}>
              <Text style={styles.coordText}>
                📍 Lat: {coords.latitude.toFixed(6)}  Lng: {coords.longitude.toFixed(6)}
              </Text>
            </View>
          )}

          <View style={{ height: 8 }} />

          <View style={styles.addrActions}>
            <TouchableOpacity onPress={onClose} style={[styles.addrActionBtn, { backgroundColor: '#e5e7eb' }]}>
              <Text style={{ fontWeight: '700', color: '#111827' }}>Huỷ</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={[styles.addrActionBtn, { backgroundColor: '#2563eb' }]}>
              <Text style={{ fontWeight: '700', color: '#fff' }}>Lưu địa chỉ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* ================== Screen ================== */
const SupporterBookingScreen = ({ route, navigation }) => {
  const rawSupporter =
    route?.params?.supporter || route?.params?.supporterProfile || null;
  const supporter = useMemo(() => normalizeSupporter(rawSupporter), [rawSupporter]);
  const user = route?.params?.user || null;

  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [showPicker, setShowPicker] = useState(false);
  const [session, setSession] = useState(null); // 'morning' | 'afternoon' | 'evening'
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'bank'
  const [submitting, setSubmitting] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [userBookingInfo, setUserBookingInfo] = useState(null);

  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [listSchedulings, setListSchedulings] = useState([]);

  // Address modal integration
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [pickedAddress, setPickedAddress] = useState(null);
  const [pickedLocation, setPickedLocation] = useState(null);

  const needAddressInput =
    userBookingInfo?.role === 'family' && !userInfo?.currentAddress;

  const openError = msg => {
    setErrorMessage(msg || 'Vui lòng kiểm tra lại thông tin.');
    setErrorVisible(true);
  };

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        if (user?.elderlyId) {
          const res = await userService.getUserById(user.elderlyId);
          if (res?.success) {
            setUserInfo(res.data);
          } else {
            console.warn('Failed to fetch user info:', res);
          }
        }
      } catch (e) {
        console.error('Error fetching user info:', e);
      }
    };
    const fetchUserBookingInfo = async () => {
      try {
        const res = await userService.getUserInfo();
        setUserBookingInfo(res.data);
      } catch (e) {
        console.error('Error fetching user booking info:', e);
      }
    };

    const supporterId =
      getSupporterId(rawSupporter) || getSupporterId(supporter);

    const fetchSchedulings = async () => {
      try {
        const res =
          await supporterSchedulingService.getSchedulingsBySupporterId(
            supporterId,
          );
        if (res?.success) {
          setListSchedulings(res.data);
        } else {
          console.warn('Failed to fetch schedulings:', res);
        }
      } catch (e) {
        console.error('Error fetching schedulings:', e);
      }
    };

    fetchUserInfo();
    fetchUserBookingInfo();
    fetchSchedulings();
  }, [user?.elderlyId]);

  useEffect(() => {
    if (needAddressInput) {
      setShowAddressModal(true);
    }
  }, [needAddressInput]);

  const availableSessions = useMemo(
    () => getSessionsForDate(supporter, date),
    [supporter, date],
  );

  const bookingsForSelectedDate = useMemo(() => {
    if (!Array.isArray(listSchedulings)) return [];
    return listSchedulings
      .filter(item => {
        if (!item?.scheduleDate) return false;
        const d = new Date(item.scheduleDate);
        return (
          d.getFullYear() === date.getFullYear() &&
          d.getMonth() === date.getMonth() &&
          d.getDate() === date.getDate() &&
          (item.status ? VALID_BOOKING_STATUSES.includes(item.status) : true)
        );
      })
      .sort(
        (a, b) =>
          (SESSION_ORDER[a.scheduleTime] ?? 99) -
          (SESSION_ORDER[b.scheduleTime] ?? 99),
      );
  }, [listSchedulings, date]);

  const occupiedSessions = useMemo(
    () =>
      Array.from(
        new Set(
          bookingsForSelectedDate.map(b => b.scheduleTime).filter(Boolean),
        ),
      ),
    [bookingsForSelectedDate],
  );

  const selectableSessions = useMemo(
    () => availableSessions.filter(s => !occupiedSessions.includes(s)),
    [availableSessions, occupiedSessions],
  );

  useEffect(() => {
    if (session && !selectableSessions.includes(session)) setSession(null);
  }, [selectableSessions, session]);

  const onSubmit = async () => {
    if (!date) {
      openError('Bạn chưa chọn ngày. Vui lòng chọn ngày hẹn.');
      return;
    }
    if (!session) {
      openError('Bạn chưa chọn khung giờ. Vui lòng chọn khung giờ làm việc.');
      return;
    }

    const supporterId =
      getSupporterId(rawSupporter) || getSupporterId(supporter);
    if (!supporterId) {
      openError('Không xác định được người hỗ trợ. Vui lòng quay lại và thử lại.');
      return;
    }

    let addressToUse = pickedAddress || userInfo?.currentAddress;
    if (!addressToUse) {
      openError('Thiếu địa chỉ hỗ trợ. Vui lòng cập nhật địa chỉ trước khi đặt lịch.');
      return;
    }

    try {
      setSubmitting(true);
      const me = (await userService.getUser()).data;

      const schedulingData = {
        supporter: supporterId,
        elderly: user?.elderlyId,
        scheduleDate: date.toISOString(),
        scheduleTime: session,
        address: addressToUse,
        notes,
        paymentStatus: paymentMethod,
        createdBy: me._id,
      };

      // Gửi kèm toạ độ nếu có (đổi key theo BE nếu cần)
      if (pickedLocation) {
        schedulingData.addressLocation = pickedLocation; // hoặc currentLocation / location
      }

      const res = await supporterSchedulingService.createScheduling(
        schedulingData,
      );
      if (res?.success) {
        navigation.navigate('SuccessScreen', {
          title: 'Đặt lịch thành công',
          description:
            res.message || 'Bạn đã đặt lịch thành công! Quay lại trang chủ.',
          navigate: me.role === 'elderly' ? 'ElderHome' : 'FamilyMemberHome',
        });
      } else {
        openError('Không thể tạo lịch. Vui lòng thử lại.');
      }
    } catch (e) {
      console.error('createScheduling error', e);
      openError('Có lỗi xảy ra khi tạo lịch. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const price = session ? feeForSession(supporter, session) : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#2196F3" barStyle="light-content" />

      <ErrorModal
        visible={errorVisible}
        message={errorMessage}
        onClose={() => setErrorVisible(false)}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đặt lịch người hỗ trợ</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Supporter summary */}
        <View style={styles.profileCard}>
          <Image
            source={{
              uri:
                supporter?.user?.avatar ||
                rawSupporter?.user?.avatar ||
                rawSupporter?.avatar ||
                'https://cdn.sforum.vn/sforum/wp-content/uploads/2023/10/avatar-trang-4.jpg',
            }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {rawSupporter?.user?.fullName || rawSupporter?.name || 'Supporter'}
            </Text>
            <Text style={styles.meta}>Phạm vi: {supporter?.serviceArea ?? 10} km</Text>
            <Text style={styles.meta}>
              Đánh giá:{' '}
              {supporter?.ratingStats?.averageRating ?? rawSupporter?.rating ?? 0}{' '}
              ⭐ (
              {supporter?.ratingStats?.totalRatings ?? rawSupporter?.reviewCount ?? 0}
              )
            </Text>
          </View>
        </View>

        {/* Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chọn ngày</Text>
          <TouchableOpacity style={styles.row} onPress={() => setShowPicker(true)}>
            <Icon name="calendar" size={20} color="#2563eb" />
            <Text style={styles.rowText}>{formatDateVN(date)}</Text>
            <Icon name="chevron-down" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <MiniCalendarModal
            visible={showPicker}
            value={date}
            minimumDate={new Date()}
            onRequestClose={() => setShowPicker(false)}
            onConfirm={d => {
              setDate(d);
              setShowPicker(false);
            }}
          />
        </View>

        {/* Session */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chọn khung giờ</Text>
          {selectableSessions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                Người hỗ trợ không làm việc hoặc đã hết lịch ngày này. Vui lòng
                chọn ngày khác.
              </Text>
            </View>
          ) : (
            <View style={styles.sessionWrap}>
              {['morning', 'afternoon', 'evening'].map(key => {
                const disabled = !selectableSessions.includes(key);
                const reserved = occupiedSessions.includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    disabled={disabled}
                    onPress={() => setSession(key)}
                    style={[
                      styles.sessionChip,
                      session === key && styles.sessionChipActive,
                      (disabled || reserved) && styles.sessionChipDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sessionChipText,
                        session === key && styles.sessionChipTextActive,
                      ]}
                    >
                      {SESSION_LABELS[key]}
                      {reserved ? ' — ĐÃ ĐẶT' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Địa chỉ hỗ trợ</Text>

          {!!(pickedAddress || userInfo?.currentAddress) ? (
            <>
              <View style={styles.addressPill}>
                <Icon name="location" size={18} color="#2563eb" />
                <Text style={styles.addressText}>{pickedAddress || userInfo?.currentAddress}</Text>
              </View>
              {pickedLocation && (
                <View style={{ marginTop: 6 }}>
                  <Text style={{ color: '#334155', fontSize: 12 }}>
                    📍 Lat: {pickedLocation.latitude.toFixed(6)} — Lng: {pickedLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.changeAddressBtn}
                onPress={() => setShowAddressModal(true)}
                activeOpacity={0.9}
              >
                <Icon name="create-outline" size={20} color="#fff" />
                <Text style={styles.changeAddressText}>Đổi địa chỉ / lấy toạ độ lại</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ color: '#b91c1c', fontWeight: '700', marginBottom: 8 }}>
                Chưa có địa chỉ
              </Text>
              <TouchableOpacity onPress={() => setShowAddressModal(true)}>
                <Text style={styles.linkText}>Cập nhật địa chỉ</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ghi chú</Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="Ví dụ: cần hỗ trợ tắm rửa, đo huyết áp…"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
          <View style={styles.sessionWrap}>
            {[
              { key: 'cash', label: 'Tiền mặt' },
              { key: 'bank', label: 'Chuyển khoản' },
            ].map(m => (
              <TouchableOpacity
                key={m.key}
                onPress={() => setPaymentMethod(m.key)}
                style={[
                  styles.sessionChip,
                  paymentMethod === m.key && styles.sessionChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.sessionChipText,
                    paymentMethod === m.key && styles.sessionChipTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Tóm tắt</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ngày:</Text>
            <Text style={styles.summaryValue}>{formatDateVN(date)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Khung giờ:</Text>
            <Text style={styles.summaryValue}>
              {session ? SESSION_LABELS[session] : '—'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Giá:</Text>
            <Text style={styles.summaryValue}>
              {price != null ? money(price) : '—'}
            </Text>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!session || submitting || selectableSessions.length === 0) &&
              styles.submitBtnDisabled,
          ]}
          onPress={onSubmit}
          disabled={!session || submitting || selectableSessions.length === 0}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Xác nhận đặt lịch</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Address Modal */}
      <AddressPickerModal
        visible={showAddressModal}
        initialAddress={pickedAddress || userInfo?.currentAddress || null}
        onClose={() => setShowAddressModal(false)}
        onSave={({ address, location }) => {
          setPickedAddress(address);
          setPickedLocation(location || null);
          // giữ nguyên userInfo; chỉ dùng địa chỉ này cho booking hiện tại
          setShowAddressModal(false);
        }}
      />
    </SafeAreaView>
  );
};

/* ================== Styles ================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    elevation: 4,
  },
  backButton: { position: 'absolute', left: 16, top: 18, zIndex: 1 },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  content: { flex: 1, padding: 16 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  meta: { color: '#6b7280', marginTop: 2 },

  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  row: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowText: { flex: 1, marginHorizontal: 8, color: '#111827' },

  sessionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sessionChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  sessionChipActive: { borderColor: '#2563eb', backgroundColor: '#dbeafe' },
  sessionChipDisabled: { opacity: 0.4 },
  sessionChipText: { color: '#111827' },
  sessionChipTextActive: { color: '#1d4ed8', fontWeight: '700' },

  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    minHeight: 100,
    backgroundColor: '#f9fafb',
  },

  emptyBox: { padding: 12, backgroundColor: '#f8fafc', borderRadius: 10 },
  emptyText: { color: '#6b7280' },

  summaryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryTitle: { fontWeight: '700', marginBottom: 8, color: '#111827' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  summaryLabel: { color: '#6b7280' },
  summaryValue: { color: '#111827', fontWeight: '600' },

  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  /* ===== Calendar styles ===== */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 360,
    padding: 12,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navBtn: { padding: 6, borderRadius: 8 },
  calHeaderText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  weekLabel: { width: 36, textAlign: 'center', color: '#6b7280', fontSize: 12 },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  dayCellDisabled: { opacity: 0.4 },
  dayText: { color: '#111827', fontSize: 13 },
  dayTextSelected: { color: '#1d4ed8', fontWeight: '700' },
  closeBtn: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontWeight: '700' },
  linkText: { color: '#2563eb', marginTop: 8, fontWeight: '600' },

  /* ===== Error Modal styles ===== */
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 360,
    padding: 16,
  },
  errorTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  errorMessage: { color: '#111827', marginTop: 6 },
  errorCloseBtn: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  errorCloseText: { color: '#fff', fontWeight: '700' },

  /* ===== Address styles (modal) ===== */
  addrCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '90%', width: '100%', maxWidth: 380 },
  addrHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  addrTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  addrLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 10, marginBottom: 6 },
  addrInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, backgroundColor: '#F3F4F6' },
  addrSelect: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 8, backgroundColor: '#F3F4F6' },
  communeItem: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  communeItemActive: { backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  communeText: { color: '#111827' },
  geoBtn: { marginTop: 12, backgroundColor: '#8B5CF6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  geoBtnText: { color: '#fff', fontWeight: '600' },
  coordBox: { marginTop: 8, backgroundColor: '#F3E8FF', borderWidth: 1, borderColor: '#E9D5FF', padding: 10, borderRadius: 8 },
  coordText: { color: '#7C3AED', fontFamily: 'monospace' },
  addrActions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'flex-end' },
  addrActionBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10 },
});

export default SupporterBookingScreen;
