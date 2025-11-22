import React, { useEffect, useState, useCallback } from 'react';
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

const ROUTES = {
  supporter: 'BookingDetails', // sửa theo route dự án của bạn
  doctorList: 'DoctorBookingHistoryScreen',
};

/**
 * SESSION_SLOTS = ['morning', 'afternoon', 'evening']
 * (bỏ night vì model không có)
 */
const scheduleTimeMap = {
  morning: 'Buổi sáng: 8h - 12h',
  afternoon: 'Buổi chiều: 13h - 17h',
  evening: 'Buổi tối: 18h - 21h',
};

// Label ngắn gọn cho hiển thị theo tháng
const scheduleTimeShortMap = {
  morning: 'Buổi sáng',
  afternoon: 'Buổi chiều',
  evening: 'Buổi tối',
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

/**
 * paymentStatus: ['unpaid', 'paid', 'refunded']
 * -> đổi mapping cho đúng với model
 */
const paymentStatusColors = {
  unpaid: {
    bg: '#FFF7E6',
    text: '#B46900',
    border: '#FFE1B6',
    label: 'Chưa thanh toán',
  },
  paid: {
    bg: '#E6FFFB',
    text: '#00796B',
    border: '#B2F5EA',
    label: 'Đã thanh toán',
  },
  refunded: {
    bg: '#FFF5F5',
    text: '#C53030',
    border: '#FED7D7',
    label: 'Đã hoàn tiền',
  },
  default: { bg: '#EDF2F7', text: '#4A5568', border: '#E2E8F0', label: 'Khác' },
};

const bookingTypeLabels = {
  session: 'Theo buổi',
  day: 'Theo ngày',
  month: 'Theo tháng',
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

// chỉ lấy phần ngày dd/mm/yyyy
function formatDateOnlyVN(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', { timeZone: VN_TZ });
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

const SupporterBookingListScreen = ({ navigation, route }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);

  // Tab: supporter | doctor (UI)
  const [activeTab, setActiveTab] = useState('supporter');

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
      const response = await supporterSchedulingService.getSchedulingsByUserId(
        userId,
      );
      if (response?.success) {
        console.log(response.data);

        // Đảo ngược danh sách để mới nhất lên trên
        setBookings(Array.isArray(response.data) ? response.data.reverse() : []);
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

  /* ===== Header đẹp hơn ===== */
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
          <Text style={styles.headerSubtitle}>Theo dõi & quản lý đặt lịch</Text>
        </View>

        <TouchableOpacity
          onPress={onRefresh}
          style={styles.iconBtn}
          activeOpacity={0.8}
        >
          <Feather name="refresh-ccw" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderBookingItem = ({ item }) => {
    const id = item?._id;
    const supporterName = item?.supporter?.fullName || '—';
    const supporterAvatar = item?.supporter?.avatar;
    const elderlyName = item?.elderly?.fullName || '—';
    const elderlyAvatar = item?.elderly?.avatar;

    const bookingType = item?.bookingType || 'session';

    // Thời gian cho từng loại bookingType
    let mainTimeText = '';
    let subTimeText = '';

    if (bookingType === 'session') {
      const scheduleDate =
        formatDateISOToVN(item?.scheduleDate).split(' • ')[0] || '';
      const scheduleTime =
        scheduleTimeMap[item?.scheduleTime] || item?.scheduleTime || '';
      mainTimeText = scheduleDate;
      subTimeText = scheduleTime || 'Theo buổi';
    } else if (bookingType === 'day') {
      const scheduleDate =
        formatDateISOToVN(item?.scheduleDate).split(' • ')[0] || '';
      mainTimeText = scheduleDate || 'Theo ngày';
      subTimeText = 'Cả ngày';
    } else if (bookingType === 'month') {
      const start = formatDateOnlyVN(item?.monthStart);
      const end = formatDateOnlyVN(item?.monthEnd);
      mainTimeText =
        start && end ? `${start} - ${end}` : 'Theo tháng';

      if (Array.isArray(item?.monthSessionsPerDay) && item.monthSessionsPerDay.length) {
        const sessionsText = item.monthSessionsPerDay
          .map(slot => scheduleTimeShortMap[slot] || slot)
          .join(', ');
        subTimeText = `Buổi trong ngày: ${sessionsText}`;
      } else {
        subTimeText = 'Lịch theo tháng';
      }
    }

    const statusKey = (item?.status || 'default').toLowerCase();
    const statusScheme = statusColors[statusKey] || statusColors.default;

    // Dùng paymentStatus đúng với model: ['unpaid','paid','refunded']
    const paymentStatusKey = (item?.paymentStatus || 'unpaid').toLowerCase();
    const payScheme =
      paymentStatusColors[paymentStatusKey] || paymentStatusColors.default;

    const paymentMethod = item?.paymentMethod || 'cash'; // cash | bank_transfer
    const paymentMethodLabel =
      paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() =>
          navigation.navigate('BookingDetailScreen', { bookingId: item._id })
        }
      >
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              Đặt lịch #{id?.slice(-6) || ''}
            </Text>
            {/* Hiển thị loại lịch */}
          </View>
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
            <Text style={styles.timeText}>{mainTimeText}</Text>
            {subTimeText ? (
              <Text style={styles.timeSub}>{subTimeText}</Text>
            ) : null}
            <Text style={[styles.timeSub, { marginTop: 4 }]}>
              Phương thức: {paymentMethodLabel}
            </Text>
          </View>
          <Chip scheme={payScheme} text={payScheme.label} />
        </View>
      </TouchableOpacity>
    );
  };

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

  if (!bookings?.length) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Chưa có đặt lịch nào</Text>
          <Text style={styles.emptySub}>
            Khi có lịch mới, bạn sẽ thấy chúng tại đây.
          </Text>
          <TouchableOpacity onPress={fetchBookings} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Làm mới</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header tách riêng để full width */}
      <Header />
      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.tabBtn,
            activeTab === 'supporter' ? styles.tabActive : styles.tabInactive,
          ]}
          onPress={() => setActiveTab('supporter')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'supporter'
                ? styles.tabTextActive
                : styles.tabTextInactive,
            ]}
          >
            Lịch hỗ trợ
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.tabBtn,
            activeTab === 'doctor' ? styles.tabActive : styles.tabInactive,
          ]}
          onPress={() => {
            setActiveTab('doctor');
            navigation.navigate(ROUTES.doctorList);
          }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'doctor'
                ? styles.tabTextActive
                : styles.tabTextInactive,
            ]}
          >
            Lịch khám bác sĩ
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={bookings}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },

  // Padding chỉ áp cho list, KHÔNG áp cho Header
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  /* ===== Header mới ===== */
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

  /* Tabs */
  tabRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 12,
    marginLeft: 16,
    marginRight: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#335CFF', borderColor: '#335CFF' },
  tabInactive: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  tabText: { fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },
  tabTextInactive: { color: '#0F172A' },

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
});

export default SupporterBookingListScreen;
