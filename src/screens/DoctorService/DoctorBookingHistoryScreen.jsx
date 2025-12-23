import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  heightPercentageToDP as hp,
  widthPercentageToDP as wp,
} from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import Icon from 'react-native-vector-icons/Ionicons';

import { doctorBookingService } from '../../services/doctorBookingService';
import userService from '../../services/userService';

const HEADER_COLOR = '#4F7EFF';
const VN_TZ = 'Asia/Ho_Chi_Minh';

// ==== STATUS MAPPING (booking + payment) ====
const statusColors = {
  confirmed: {
    bg: '#E6FFFB',
    text: '#00796B',
    border: '#B2F5EA',
    label: 'Đã xác nhận',
  },
  completed: {
    bg: '#F0FFF4',
    text: '#2F855A',
    border: '#C6F6D5',
    label: 'Hoàn thành',
  },
  cancelled: {
    bg: '#FFF5F5',
    text: '#C53030',
    border: '#FED7D7',
    label: 'Đã hủy',
  },
  default: {
    bg: '#EDF2F7',
    text: '#4A5568',
    border: '#E2E8F0',
    label: 'Khác',
  },
};

const paymentStatusColors = {
  unpaid: {
    bg: '#FFF7E6',
    text: '#B46900',
    border: '#FFE1B6',
    label: 'Chưa thanh toán',
  },
  pending: {
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
  completed: {
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
  default: {
    bg: '#EDF2F7',
    text: '#4A5568',
    border: '#E2E8F0',
    label: 'Khác',
  },
};

// ==== HELPER COMPONENTS ====
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

Chip.propTypes = {
  scheme: PropTypes.shape({
    bg: PropTypes.string,
    text: PropTypes.string,
    border: PropTypes.string,
    label: PropTypes.string,
  }),
  text: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

Chip.defaultProps = {
  scheme: statusColors.default,
  text: '',
  style: undefined,
};

const Avatar = ({ uri, fallback, size = 44 }) => {
  if (!uri) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#E2E8F0',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="person-outline" size={size * 0.5} color="#9CA3AF" />
      </View>
    );
  }
  return (
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
};

Avatar.propTypes = {
  uri: PropTypes.string,
  fallback: PropTypes.string,
  size: PropTypes.number,
};

Avatar.defaultProps = {
  uri: null,
  fallback: '',
  size: 44,
};

// ==== DATE HELPERS ====
const formatDateOnlyVN = iso => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', { timeZone: VN_TZ });
  } catch {
    return iso;
  }
};

// ==== DURATION HELPERS ====
const getDurationLabel = item => {
  try {
    const days = item?.durationDays ?? 7; // Default 7 days theo model
    const n = Number(days);
    if (!Number.isFinite(n) || n <= 0) {
      return '—';
    }
    return n === 1 ? '1 ngày' : `${n} ngày`;
  } catch {
    return '—';
  }
};

// ==== PAYMENT HELPERS ====
const normalizePaymentStatusKey = raw => {
  const key = String(raw || '').toLowerCase();
  if (!key) return 'unpaid';
  if (['unpaid', 'pending'].includes(key)) return 'unpaid';
  if (['paid', 'completed', 'success', 'successful'].includes(key)) {
    return 'completed';
  }
  if (['refunded', 'refund'].includes(key)) return 'refunded';
  return 'default';
};

const getPaymentMethodRaw = item => {
  return (
    item?.paymentMethod ??
    item?.payment?.method ??
    item?.payment?.paymentMethod ??
    'cash'
  );
};

const getPaymentMethodLabel = item => {
  const raw = String(getPaymentMethodRaw(item) || '').toLowerCase();

  if (raw === 'bank_transfer') {
    return 'Chuyển khoản';
  }
  return 'Tiền mặt';
};

const getConsultationDate = item => {
  // Lấy scheduledDate từ model RegistrationConsulation
  return item?.scheduledDate || item?.registeredAt || item?.createdAt || null;
};

const getSlotLabel = item => {
  const slot = item?.slot;
  if (slot === 'morning') return 'Buổi sáng (8h-11h)';
  if (slot === 'afternoon') return 'Buổi chiều (14h-17h)';
  return '—';
};

// =================== MAIN SCREEN ===================
const DoctorBookingHistoryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('doctor');
  const [elderlyId, setElderlyId] = useState(null);
  const [userRole, setUserRole] = useState(null); // ➕ role hiện tại

  const normalizedRole = (userRole || '').toLowerCase();
  const showTabs = normalizedRole === 'family';

  // ---- FORMAT HELPERS (bookings) ----
  const getBookingCode = item => {
    if (item._id) return `Lịch tư vấn `;
    return 'Lịch tư vấn';
  };

  const getElderlyName = item =>
    item.beneficiary?.fullName ||
    item.beneficiary?.name ||
    'Người cao tuổi';

  const getElderlyAvatar = item =>
    item.beneficiary?.avatar || null;

  const getDoctorName = item =>
    item.doctor?.fullName || item.doctor?.name || 'Bác sĩ';

  const getStatusLabelAndStyle = item => {
    const rawStatus = item.status || 'confirmed';
    const statusKey = String(rawStatus).toLowerCase();
    const bookScheme = statusColors[statusKey] || statusColors.default;

    const rawPayStatus =
      item?.paymentStatus ?? item?.payment?.status ?? item?.payStatus ?? 'unpaid';
    const payKey = normalizePaymentStatusKey(rawPayStatus);
    let payScheme = paymentStatusColors[payKey] || paymentStatusColors.default;

    // Nếu đã hủy và đã thanh toán -> hiển thị đã hoàn tiền
    if (statusKey === 'cancelled' && rawPayStatus === 'paid') {
      payScheme = paymentStatusColors.refunded;
    }
    return { bookScheme, payScheme };
  };

  // ===== 1. Resolve elderlyId + role =====
  useEffect(() => {
    let cancelled = false;

    const resolveElderlyId = async () => {
      try {

        const userRes = await userService.getUser();
        if (cancelled) return;
        const role = (userRes?.data?.role || '').toLowerCase();
        if (!cancelled) {
          setUserRole(role);
        }

        const fromRoute = route?.params?.elderlyId;
        if (fromRoute) {
          if (!cancelled) setElderlyId(fromRoute);
          return;
        }

        if (userRes?.success && userRes?.data?._id) {
          if (role === 'elderly') {
            setElderlyId(userRes.data._id);
          } else {
            setError(
              'Không xác định được người cao tuổi để xem lịch tư vấn bác sĩ.',
            );
            setLoading(false);
          }
        } else {
          setError('Không lấy được thông tin người dùng. Vui lòng đăng nhập lại.');
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError('Không lấy được thông tin người dùng.');
          setLoading(false);
        }
      }
    };

    resolveElderlyId();
    return () => {
      cancelled = true;
    };
  }, [route?.params?.elderlyId]);

  // ===== 2. Gọi API lấy bookings theo elderlyId =====
  const fetchBookings = useCallback(
    async (opts = { showLoading: true }) => {
      const { showLoading } = opts;

      if (!elderlyId) {
        if (showLoading) setLoading(false);
        return;
      }

      try {
        if (showLoading) setLoading(true);
        setError('');
        const res =
          await doctorBookingService.getBookingsByElderlyId(elderlyId);
        if (res?.success && Array.isArray(res.data)) {
          setBookings(res.data);
        } else {
          setBookings([]);
          setError(
            res?.message ||
              'Không lấy được danh sách lịch tư vấn bác sĩ. Vui lòng thử lại.',
          );
        }
      } catch (err) {
        setError(
          'Không lấy được danh sách lịch tư vấn bác sĩ. Vui lòng thử lại.',
        );
        setBookings([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [elderlyId],
  );

  useEffect(() => {
    if (!elderlyId) return;
    fetchBookings({ showLoading: true });
  }, [elderlyId, fetchBookings]);

  useFocusEffect(
    useCallback(() => {
      fetchBookings({ showLoading: false });
    }, [fetchBookings]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchBookings({ showLoading: false });
    } finally {
      setRefreshing(false);
    }
  }, [fetchBookings]);

  // ---- HEADER ----
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
          <Text style={styles.headerTitle}>Danh sách lịch tư vấn</Text>
          <Text style={styles.headerSubtitle}>
            Theo dõi &amp; quản lý lịch tư vấn bác sĩ
          </Text>
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

  // ---- NAV TABS ----
  const renderTabs = () => (
    <View style={styles.tabRow}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.tabBtn,
          activeTab === 'supporter' ? styles.tabActive : styles.tabInactive,
        ]}
        onPress={() => {
          setActiveTab('supporter');
          navigation.navigate('SupporterBookingListScreen', {
            userId: elderlyId,
          });
        }}
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
        onPress={() => setActiveTab('doctor')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'doctor'
              ? styles.tabTextActive
              : styles.tabTextInactive,
          ]}
        >
          Lịch tư vấn bác sĩ
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ---- RENDER CARD ----
  const renderBookingItem = ({ item }) => {
    const { bookScheme, payScheme } = getStatusLabelAndStyle(item);
    const startDate = getConsultationDate(item);

    const methodLabel = getPaymentMethodLabel(item);
    const elderlyName = getElderlyName(item);
    const elderlyAvatar = getElderlyAvatar(item);
    const doctorName = getDoctorName(item);
    const slotLabel = getSlotLabel(item);
    const durationLabel = getDurationLabel(item);

    const canRate =
      (item?.status || '').toLowerCase() === 'completed' &&
      (item?.canRateDoctor === true || item?.alreadyRatedDoctor !== true);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() =>
          navigation.navigate('DoctorConsultationDetailScreen', {
            bookingId: item._id,
            elderlyId,
            initialBooking: item,
          })
        }
      >
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {getBookingCode(item)}
          </Text>
          <Chip scheme={bookScheme} text={bookScheme.label} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NGƯỜI CAO TUỔI</Text>
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

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BÁC SĨ PHỤ TRÁCH</Text>
          <View style={styles.row}>
            <Avatar
              uri={item?.doctor?.avatar || item?.doctor?.user?.avatar || null}
              fallback={doctorName}
              size={40}
            />
            <View style={styles.personInfo}>
              <Text style={styles.personName} numberOfLines={1}>
                {doctorName}
              </Text>
              <Text style={styles.personSub} numberOfLines={1}>
                Dịch vụ tư vấn bác sĩ
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
            <Text style={styles.sectionLabel}>THỜI GIAN</Text>
            <Text style={styles.timeText}>{formatDateOnlyVN(startDate)}</Text>
            <Text style={styles.timeSub}>{slotLabel}</Text>
            <Text style={styles.timeSub}>Thời hạn hỗ trợ: {durationLabel}</Text>
            <Text style={[styles.timeSub, { marginTop: 4 }]}>
              Thanh toán: {methodLabel}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Chip scheme={payScheme} text={payScheme.label} />
          </View>
        </View>

        {canRate && (
          <View style={styles.completedNotice}>
            <Feather
              name="check-circle"
              size={16}
              color="#16A34A"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.completedNoticeText}>
              Dịch vụ tư vấn của bạn đã hoàn thành. Nhấn vào chi tiết để đánh giá.
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ====== RENDER SCREEN STATES ======
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        {showTabs && renderTabs()}
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            Đang tải danh sách lịch tư vấn bác sĩ…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !bookings.length) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        {showTabs && renderTabs()}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => fetchBookings({ showLoading: true })}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Header />
      {showTabs && renderTabs()}

      {bookings.length ? (
        <FlatList
          data={bookings}
          renderItem={renderBookingItem}
          keyExtractor={item =>
            item?._id?.toString() ??
            Math.random().toString(36).slice(2)
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            Hiện tại chưa có lịch tư vấn bác sĩ nào.
          </Text>
          <Text style={styles.emptySub}>
            Khi có lịch mới, bạn sẽ thấy chúng tại đây.
          </Text>
          <TouchableOpacity
            onPress={() => fetchBookings({ showLoading: true })}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Làm mới</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default DoctorBookingHistoryScreen;

// =================== STYLES ===================
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },

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
      android: {
        elevation: 8,
      },
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
  iconBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
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

  tabRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginHorizontal: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabInactive: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  tabTextInactive: {
    color: '#64748B',
  },

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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginTop: 14,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  personInfo: {
    marginLeft: 12,
    flex: 1,
  },
  personName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  personSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  timeSub: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
  },
  doctorAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  center: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    color: '#475569',
  },
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
  retryText: {
    color: '#991B1B',
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    color: '#475569',
    marginBottom: 16,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#335CFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  completedNotice: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF3',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  completedNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
  },
});
