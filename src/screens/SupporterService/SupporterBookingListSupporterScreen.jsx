import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

import supporterSchedulingService from '../../services/supporterSchedulingService';
import userService from '../../services/userService';

const HEADER_COLOR = '#4F7EFF';
const VN_TZ = 'Asia/Ho_Chi_Minh';


const scheduleTimeMap = {
  morning: 'Buổi sáng: 8h - 12h',
  afternoon: 'Buổi chiều: 13h - 17h',
  evening: 'Buổi tối: 18h - 21h',
  night: 'Buổi đêm: 22h - 24h',
};

const statusColors = {
  pending: {
    bg: '#FFF7E6',
    text: '#B46900',
    border: '#FFE1B6',
    label: 'Chờ xác nhận',
  },
  confirmed: {
    bg: '#E6FFFB',
    text: '#00796B',
    border: '#B2F5EA',
    label: 'Đã xác nhận',
  },
  in_progress: {
    bg: '#FFFAEB',
    text: '#D97706',
    border: '#FDE68A',
    label: 'Đang tiến hành',
  },
  completed: {
    bg: '#F0FFF4',
    text: '#2F855A',
    border: '#C6F6D5',
    label: 'Hoàn thành',
  },
  canceled: {
    bg: '#FFF5F5',
    text: '#C53030',
    border: '#FED7D7',
    label: 'Đã hủy',
  },
  default: { bg: '#EDF2F7', text: '#4A5568', border: '#E2E8F0', label: 'Khác' },
};

const paymentColors = {
  cash: {
    bg: '#F3E8FF',
    text: '#6B21A8',
    border: '#E9D5FF',
    label: 'Tiền mặt',
  },
  bank_transfer: {
    bg: '#ECFEFF',
    text: '#155E75',
    border: '#CFFAFE',
    label: 'Đã trả trước',
  },
  card: { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE', label: 'Thẻ' },
  default: { bg: '#EDF2F7', text: '#4A5568', border: '#E2E8F0', label: 'Khác' },
};

function formatDateISOToVN(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const dd = d.toLocaleDateString('vi-VN', { timeZone: VN_TZ });
    const tt = d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: VN_TZ,
    });
    return `${dd} • ${tt}`;
  } catch {
    return iso;
  }
}

const Chip = ({ scheme, text, style }) => {
  const s = scheme || statusColors.default;
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: s.bg, borderColor: s.border },
        style,
      ]}
    >
      <Text style={[styles.chipText, { color: s.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
};

const Avatar = ({ uri, fallback, size = 44 }) => (
  <Image
    source={{ uri }}
    resizeMode="cover"
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#E2E8F0',
    }}
    accessibilityLabel={fallback || 'avatar'}
  />
);

// ===== Các lựa chọn lọc trạng thái =====
const STATUS_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: statusColors.pending.label },
  { value: 'confirmed', label: statusColors.confirmed.label },
  { value: 'in_progress', label: statusColors.in_progress.label },
  { value: 'completed', label: statusColors.completed.label },
  { value: 'canceled', label: statusColors.canceled.label },
];

const SupporterBookingListScreen = ({ navigation, route }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);

  // Lọc theo status
  const [filterStatus, setFilterStatus] = useState(route?.params?.filterStatus || 'all');
  const [filterOpen, setFilterOpen] = useState(false);

  // 1) Lấy userId (ưu tiên route, fallback API)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const idFromRoute = route?.params?.userId;
      if (idFromRoute) {
        if (!cancelled) setUserId(idFromRoute);
        return;
      }
      const userResponse = await userService.getUser();
      if (cancelled) return;
      if (userResponse?.success && userResponse?.data?._id) {
        setUserId(userResponse.data._id);
      } else {
        setError('Không thể lấy thông tin người dùng. Vui lòng đăng nhập lại.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route?.params?.userId]);

  // 2) Tải bookings khi đã có userId
  const fetchBookings = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const response =
        await supporterSchedulingService.getSchedulingsBySupporterId(userId);
      if (response?.success) {
        setBookings(Array.isArray(response.data) ? response.data : []);
      } else {
        setError('Không thể tải danh sách đặt lịch.');
        setBookings([]);
      }
    } catch (err) {
      setError('Không thể tải danh sách đặt lịch.');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchBookings();
  }, [userId, fetchBookings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchBookings();
    } finally {
      setRefreshing(false);
    }
  }, [fetchBookings]);

  // Tính toán đếm theo status & danh sách đã lọc
  const statusCounts = useMemo(() => {
    const counts = { all: bookings.length };
    for (const key of [
      'pending',
      'confirmed',
      'in_progress',
      'completed',
      'canceled',
    ]) {
      counts[key] = bookings.filter(
        b => (b?.status || '').toLowerCase() === key,
      ).length;
    }
    return counts;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (filterStatus === 'all') return bookings;
    return bookings.filter(
      b => (b?.status || '').toLowerCase() === filterStatus,
    );
  }, [bookings, filterStatus]);

  /* ===== Header đẹp hơn + Nút lọc ===== */
  const Header = () => (
    <View style={styles.headerWrap}>
      <View style={styles.headerRow}>
        {navigation.canGoBack() ? (
          <TouchableOpacity
            onPress={navigation.goBack}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <Feather name="chevron-left" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtnPlaceholder} />
        )}

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Danh sách lịch đặt</Text>
          <Text style={styles.headerSubtitle}>
            {STATUS_FILTERS.find(f => f.value === filterStatus)?.label ||
              'Tất cả'}{' '}
            • {filteredBookings.length} lịch
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Nút lọc */}
          {/* Nút refresh */}
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <Feather name="refresh-ccw" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderBookingItem = ({ item }) => {
    const id = item?._id;
    const supporterName = item?.supporter?.fullName || '—';
    const supporterAvatar = item?.supporter?.avatar;
    const elderlyName = item?.elderly?.fullName || '—';
    const elderlyAvatar = item?.elderly?.avatar;
    const scheduleDate =
      formatDateISOToVN(item?.scheduleDate).split(' • ')[0] || '';
    const scheduleTime =
      scheduleTimeMap[item?.scheduleTime] || item?.scheduleTime || '';
    const statusKey = (item?.status || 'default').toLowerCase();
    const statusScheme = statusColors[statusKey] || statusColors.default;
    const paymentKey = (item?.paymentMethod || 'default').toLowerCase();
    const payScheme = paymentColors[paymentKey] || paymentColors.default;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() =>
          navigation.navigate('BookingDetailScreen', { bookingId: item._id })
        }
      >
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            Lịch đặt
          </Text>
          <Chip scheme={statusScheme} text={statusScheme.label} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Người hỗ trợ</Text>
          <View style={styles.row}>
            <Avatar uri={supporterAvatar} fallback={supporterName} />
            <View style={styles.personInfo}>
              <Text style={styles.personName} numberOfLines={1}>
                {supporterName}
              </Text>
              <Text style={styles.personSub} numberOfLines={1}>
                Vai trò: Người hỗ trợ
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Người cao tuổi</Text>
          <View style={styles.row}>
            <Avatar uri={elderlyAvatar} fallback={elderlyName} />
            <View style={styles.personInfo}>
              <Text style={styles.personName} numberOfLines={1}>
                {elderlyName}
              </Text>
              <Text style={styles.personSub} numberOfLines={1}>
                Vai trò: Người cao tuổi
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.section,
            styles.rowBetween,
            { alignItems: 'flex-start' },
          ]}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.sectionLabel}>Thời gian</Text>
            <Text style={styles.timeText}>{scheduleDate}</Text>
            {scheduleTime ? (
              <Text style={styles.timeSub}>{scheduleTime}</Text>
            ) : null}
          </View>
          <Chip scheme={payScheme} text={payScheme.label} />
        </View>
      </TouchableOpacity>
    );
  };

  // ======= Render =======
  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Đang tải danh sách đặt lịch…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchBookings} style={styles.retryBtn}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isEmpty = !filteredBookings?.length;

  return (
    <SafeAreaView style={styles.screen}>
      <Header />

      {/* Hàng hiển thị chip bộ lọc hiện tại (tùy chọn) */}
      <View style={styles.filterBar}>
        <Pressable
          onPress={() => setFilterOpen(true)}
          style={styles.filterPill}
        >
          <Feather name="filter" size={14} color="#1F2937" />
          <Text style={styles.filterPillText} numberOfLines={1}>
            {STATUS_FILTERS.find(f => f.value === filterStatus)?.label ||
              'Tất cả'}
          </Text>
          <View style={styles.filterCount}>
            <Text style={styles.filterCountText}>
              {statusCounts[filterStatus] ?? 0}
            </Text>
          </View>
        </Pressable>

        {/* (tuỳ chọn) Đi tới lịch bác sĩ nếu cần */}
        {/* <TouchableOpacity
          activeOpacity={0.9}
          style={styles.gotoBtn}
          onPress={() => navigation.navigate(ROUTES.doctorList)}
        >
          <Feather name="stethoscope" size={14} color="#335CFF" />
          <Text style={styles.gotoBtnText}>Lịch khám bác sĩ</Text>
        </TouchableOpacity> */}
      </View>

      {isEmpty ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Không có lịch trong bộ lọc</Text>
          <Text style={styles.emptySub}>
            Thử chọn trạng thái khác hoặc làm mới danh sách.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setFilterStatus('all')}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Xóa lọc</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={fetchBookings} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Làm mới</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          renderItem={renderBookingItem}
          keyExtractor={item =>
            item?._id?.toString() ?? Math.random().toString(36).slice(2)
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal chọn trạng thái */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setFilterOpen(false)}
        />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Lọc theo trạng thái</Text>
          {STATUS_FILTERS.map(opt => {
            const isActive = filterStatus === opt.value;
            const count = statusCounts[opt.value] ?? 0;
            const scheme =
              opt.value === 'all'
                ? null
                : statusColors[opt.value] || statusColors.default;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionRow, isActive && styles.optionRowActive]}
                activeOpacity={0.9}
                onPress={() => {
                  setFilterStatus(opt.value);
                  setFilterOpen(false);
                }}
              >
                <View style={styles.optionLeft}>
                  <Text
                    style={[
                      styles.optionText,
                      isActive && styles.optionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {scheme ? (
                    <Chip
                      scheme={scheme}
                      text={scheme.label}
                      style={{ marginLeft: 8 }}
                    />
                  ) : null}
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.sheetFooter}>
            <TouchableOpacity
              onPress={() => {
                setFilterStatus('all');
                setFilterOpen(false);
              }}
              style={[styles.footerBtn, styles.footerBtnGhost]}
            >
              <Text style={styles.footerBtnGhostText}>Xóa lọc</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterOpen(false)}
              style={[styles.footerBtn, styles.footerBtnPrimary]}
            >
              <Text style={styles.footerBtnPrimaryText}>Xong</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },

  // List padding
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },

  /* ===== Header ===== */
  headerWrap: {
    backgroundColor: HEADER_COLOR,
    paddingHorizontal: wp('4%'),
    paddingTop: hp('1%'),
    paddingBottom: hp('2.4%'),
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: HEADER_COLOR,
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnPlaceholder: { width: 40, height: 40 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: wp('3.4%'),
    marginTop: 2,
  },

  /* ===== Filter bar dưới header ===== */
  filterBar: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 16,
    marginRight: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  filterPillText: { fontWeight: '700', color: '#1F2937', maxWidth: 180 },
  filterCount: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  filterCountText: { fontSize: 12, fontWeight: '700', color: '#111827' },

  // (tuỳ chọn) nút đi tới lịch bác sĩ
  gotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9E2F1',
    backgroundColor: '#EEF4FF',
  },
  gotoBtnText: { color: '#335CFF', fontWeight: '700' },

  /* Cards & common */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: '70%',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  section: { marginTop: 14 },
  sectionLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  personInfo: { marginLeft: 12, flex: 1 },
  personName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  personSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  timeText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  timeSub: { fontSize: 13, color: '#334155', marginTop: 2 },

  /* States */
  center: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: { marginTop: 12, color: '#475569' },
  errorText: {
    fontSize: 15,
    color: '#B91C1C',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: '#991B1B', fontWeight: '600' },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySub: { color: '#475569', marginBottom: 16, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: '#335CFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  secondaryBtnText: { color: '#111827', fontWeight: '700' },

  /* Modal filter */
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  optionRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionRowActive: { backgroundColor: '#F3F4FF' },
  optionLeft: { flexDirection: 'row', alignItems: 'center' },
  optionText: { fontSize: 14, color: '#1F2937', fontWeight: '600' },
  optionTextActive: { color: '#335CFF' },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#EEF2F6',
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#111827' },
  sheetFooter: { marginTop: 8, flexDirection: 'row', gap: 10 },
  footerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnGhost: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  footerBtnGhostText: { color: '#111827', fontWeight: '700' },
  footerBtnPrimary: { backgroundColor: '#335CFF' },
  footerBtnPrimaryText: { color: '#fff', fontWeight: '700' },
});

export default SupporterBookingListScreen;
