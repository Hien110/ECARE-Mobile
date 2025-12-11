import React, { useEffect, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
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

import doctorBookingService from '../../services/doctorBookingService';
import userService from '../../services/userService';

const HEADER_COLOR = '#4F7EFF';
const VN_TZ = 'Asia/Ho_Chi_Minh';

const TAG_ROOT = '[DoctorMyBookingListScreen]';

function formatDateISOToVN(iso) {
  if (!iso) {
    console.log(
      `${TAG_ROOT}[formatDateISOToVN] iso is empty or falsy => return ''`,
    );
    return '';
  }
  try {
    const d = new Date(iso);
    const dd = d.toLocaleDateString('vi-VN', { timeZone: VN_TZ });
    const tt = d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: VN_TZ,
    });
    console.log(`${TAG_ROOT}[formatDateISOToVN]`, {
      iso,
      timestamp: d.getTime(),
      dd,
      tt,
    });
    return `${dd} • ${tt}`;
  } catch (err) {
    console.log(
      `${TAG_ROOT}[formatDateISOToVN][ERROR] iso =`,
      iso,
      'message =',
      err?.message || err,
    );
    return iso;
  }
}

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
    label: 'Chờ khám',
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
  card: {
    bg: '#E0E7FF',
    text: '#3730A3',
    border: '#C7D2FE',
    label: 'Thẻ',
  },
  default: { bg: '#EDF2F7', text: '#4A5568', border: '#E2E8F0', label: 'Khác' },
};

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
  text: PropTypes.string.isRequired,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
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

Avatar.propTypes = {
  uri: PropTypes.string,
  fallback: PropTypes.string,
  size: PropTypes.number,
};

Avatar.defaultProps = {
  uri: null,
  fallback: null,
  size: 44,
};

// ==== helper lấy người đặt lịch (y như detail screen) ====
function safeName(obj) {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;

  if (obj.fullName) return obj.fullName;
  if (obj.name) return obj.name;

  if (obj.user?.fullName) return obj.user.fullName;
  if (obj.user?.name) return obj.user.name;

  if (obj.family?.fullName) return obj.family.fullName;
  if (obj.family?.name) return obj.family.name;

  if (obj.profile?.fullName) return obj.profile.fullName;
  if (obj.profile?.name) return obj.profile.name;

  return null;
}

function safeAvatar(obj) {
  if (!obj) return null;
  if (obj.avatar) return obj.avatar;
  if (obj.user?.avatar) return obj.user.avatar;
  if (obj.family?.avatar) return obj.family.avatar;
  if (obj.profile?.avatar) return obj.profile.avatar;
  return null;
}

function resolveCreatorInfo(booking) {
  if (!booking) {
    return { name: '—', avatar: null, roleLabel: 'Người đặt lịch' };
  }

  const createdBy = booking.createdBy;
  const registrant =
    booking.registrant || booking.family || booking.bookedByFamily || null;
  const beneficiary = booking.beneficiary || booking.elderly || null;

  let creator = null;
  let roleLabel = 'Người đặt lịch';

  if (createdBy) {
    creator = createdBy;

    const createdId = String(createdBy._id || createdBy.user?._id || '');
    const beneId = String(beneficiary?._id || beneficiary?.user?._id || '');
    const regId = String(registrant?._id || registrant?.user?._id || '');

    if (createdId && beneId && createdId === beneId) {
      roleLabel = 'Người cao tuổi (tự đặt)';
    } else if (createdId && regId && createdId === regId) {
      roleLabel = 'Người thân đặt lịch';
    } else {
      roleLabel = 'Người đặt lịch';
    }
  } else if (registrant && beneficiary) {
    const regId = String(registrant._id || registrant.user?._id || '');
    const beneId = String(beneficiary._id || beneficiary.user?._id || '');

    if (regId && beneId && regId === beneId) {
      creator = registrant;
      roleLabel = 'Người cao tuổi (tự đặt)';
    } else {
      creator = registrant;
      roleLabel = 'Người thân đặt lịch';
    }
  } else if (registrant) {
    creator = registrant;
    const role = (registrant.role || registrant.user?.role || '').toLowerCase();
    if (role === 'elderly') {
      roleLabel = 'Người cao tuổi (tự đặt)';
    } else if (role === 'family' || role === 'supporter') {
      roleLabel = 'Người thân đặt lịch';
    } else {
      roleLabel = 'Người đặt lịch';
    }
  } else if (beneficiary) {
    creator = beneficiary;
    roleLabel = 'Người cao tuổi (tự đặt)';
  }

  const name = safeName(creator) || '—';
  const avatar = safeAvatar(creator) || null;

  return { name, avatar, roleLabel };
}

// ===== helper chuẩn hoá trạng thái từ consultation / booking =====
function getStatusKeyFromItem(item) {
  const TAG = `${TAG_ROOT}[getStatusKeyFromItem]`;
  const bookingId = item?._id;

  const bookingStatus =
    item?.status ||
    item?.bookingStatus ||
    item?.booking_status ||
    null;

  const consultationStatus =
    item?.consultation?.status ||
    item?.consultationStatus ||
    item?.consultation_status ||
    null;

  console.log(TAG, {
    bookingId,
    bookingStatus,
    consultationStatus,
  });

  // ❗Ưu tiên booking.status trước
  let raw = (bookingStatus || consultationStatus || '')
    .toString()
    .toLowerCase()
    .trim();

  if (!raw) return 'pending';

  if (['pending', 'wait', 'waiting', 'unconfirmed'].includes(raw))
    return 'pending';

  if (['confirmed', 'accepted', 'xacnhan', 'xac_nhan'].includes(raw))
    return 'confirmed';

  if (['in_progress', 'in-progress', 'ongoing'].includes(raw))
    return 'in_progress';

  if (['completed', 'done', 'finished'].includes(raw))
    return 'completed';

  if (['canceled', 'cancelled', 'huy'].includes(raw))
    return 'canceled';

  return 'default';
}

// ===== helper lấy ngày chính dùng để sort / hiển thị =====
function getPrimaryDateIso(item) {
  if (!item) return null;

  return (
    item?.consultation?.scheduledDate ||
    item?.scheduledDate ||
    item?.consultationDate ||
    item?.startDate ||
    item?.packageInfo?.startDate ||
    item?.createdAt ||
    null
  );
}

// ===== Tabs lọc trạng thái (3 trạng thái chính) =====
const STATUS_TABS = [
  { value: 'confirmed', label: statusColors.confirmed.label },
  { value: 'completed', label: statusColors.completed.label },
  { value: 'canceled', label: statusColors.canceled.label },
];

// helper payment
const getPaymentMethodRaw = item => {
  return (
    item.paymentMethod ||
    item.payment?.method ||
    item.payment?.paymentMethod ||
    item.consultation?.payment?.method ||
    'cash'
  );
};

const DoctorMyBookingListScreen = ({ navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [, setUserRole] = useState('unknown');

  const [filterStatus, setFilterStatus] = useState('confirmed');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await userService.getUser();
        if (cancelled) return;
        setUserRole(res?.data?.role || 'unknown');
      } catch (e) {
        if (cancelled) return;
        setUserRole('unknown');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchBookings = useCallback(async () => {
    const TAG = `${TAG_ROOT}[fetchBookings]`;
    try {
      setError(null);
      setLoading(true);

      const res = await doctorBookingService.getMyBookings?.();

      console.log(TAG, 'RAW_RESULT =', res);

      if (res?.success) {
        const list = Array.isArray(res.data) ? res.data : [];
        console.log(TAG, 'PARSED_BOOKINGS_COUNT =', list.length);

        list.forEach(b => {
          console.log(TAG, '[BOOKING_ITEM]', {
            id: b?._id,
            code: b?.code,
            status: b?.status,
            consultationStatus: b?.consultation?.status,
            createdAt: b?.createdAt,
            scheduledDate_top: b?.scheduledDate,
            scheduledDate_consultation: b?.consultation?.scheduledDate,
            consultationDate: b?.consultationDate,
            packageStartDate: b?.packageInfo?.startDate,
          });
          console.log(
            TAG,
            '[BOOKING_STATUS]',
            'bookingId =',
            b?._id,
            'statusKey =',
            getStatusKeyFromItem(b),
          );
        });

        setBookings(list);
      } else {
        setBookings([]);
        setError(
          res?.message ||
            'Không thể tải danh sách lịch tư vấn. Vui lòng thử lại.',
        );
      }
    } catch (err) {
      console.log(TAG, 'ERROR =', err?.message || err);
      setBookings([]);
      setError('Không thể tải danh sách lịch tư vấn. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // focus listener: khi từ trang chi tiết quay lại sẽ tự refetch
  useEffect(() => {
    const TAG = `${TAG_ROOT}[focusListener]`;
    if (!navigation?.addListener) return;

    const unsubscribe = navigation.addListener('focus', () => {
      console.log(TAG, 'Screen focused -> refetch bookings');
      fetchBookings();
    });

    return () => {
      console.log(TAG, 'Cleanup focus listener');
      unsubscribe && unsubscribe();
    };
  }, [navigation, fetchBookings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchBookings();
    } finally {
      setRefreshing(false);
    }
  }, [fetchBookings]);

  const filteredBookings = useMemo(() => {
    const nowUtc = Date.now();

    return bookings
      .filter(b => getStatusKeyFromItem(b) === filterStatus)
      .slice()
      .sort((a, b) => {
        const aIso = getPrimaryDateIso(a);
        const bIso = getPrimaryDateIso(b);

        const aTime = aIso ? new Date(aIso).getTime() : Number.POSITIVE_INFINITY;
        const bTime = bIso ? new Date(bIso).getTime() : Number.POSITIVE_INFINITY;

        const aDiff = Math.abs(aTime - nowUtc);
        const bDiff = Math.abs(bTime - nowUtc);

        return aDiff - bDiff;
      });
  }, [bookings, filterStatus]);

  const Header = () => (
    <View style={styles.headerWrap}>
      <View style={styles.headerRow}>
        {navigation?.canGoBack?.() ? (
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
            {STATUS_TABS.find(f => f.value === filterStatus)?.label ||
              'Chờ khám'}{' '}
            • {filteredBookings.length} lịch
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
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
    const TAG = `${TAG_ROOT}[renderItem]`;
    const id = item?._id;

    const elderly =
      item?.elderly || item?.beneficiary || item?.elderlyProfile || null;
    const elderlyName = safeName(elderly) || '—';
    const elderlyAvatar = safeAvatar(elderly);
    const elderlyAddress = elderly?.currentAddress || '';

    const creatorInfo = resolveCreatorInfo(item);

    // ===== CHỌN NGÀY TƯ VẤN (ưu tiên ngày bác sĩ tư vấn, không phải createdAt) =====
    const dateIso = getPrimaryDateIso(item);

    // Log chi tiết
    console.log(`${TAG}[DATE_SYNC]`, {
      bookingId: item?._id,
      consultationScheduled: item?.consultation?.scheduledDate,
      scheduledDate: item?.scheduledDate,
      consultationDate: item?.consultationDate,
      startDate: item?.startDate,
      packageStart: item?.packageInfo?.startDate,
      createdAt: item?.createdAt,
      chosen: dateIso,
    });

    const formattedFull = formatDateISOToVN(dateIso);
    const [dateLabel] = formattedFull.split(' • ');

    const slotRaw = item?.slot || item?.consultation?.slot || null;
    const sessionLabel =
      slotRaw === 'morning'
        ? 'Buổi sáng'
        : slotRaw === 'afternoon'
        ? 'Buổi chiều'
        : '';

    const statusKey = getStatusKeyFromItem(item);
    const statusScheme = statusColors[statusKey] || statusColors.default;

    console.log(TAG, '[DATE_RESOLVE]', {
      bookingId: id,
      consultationScheduled: item?.consultation?.scheduledDate,
      scheduledDate: item?.scheduledDate,
      consultationDate: item?.consultationDate,
      startDate: item?.startDate,
      packageStart: item?.packageInfo?.startDate,
      createdAt: item?.createdAt,
      chosenDateIso: dateIso,
      formattedFull,
      dateLabel,
    });

    console.log(
      TAG,
      'bookingId =',
      id,
      'statusKey =',
      statusKey,
      'label =',
      statusScheme.label,
    );

    const rawMethod = String(getPaymentMethodRaw(item) || '').toLowerCase();
    let paymentKey = 'cash';
    if (['qr', 'online', 'bank_transfer', 'bank-transfer'].includes(rawMethod)) {
      paymentKey = 'bank_transfer';
    } else if (rawMethod === 'card') {
      paymentKey = 'card';
    }
    const payScheme = paymentColors[paymentKey] || paymentColors.default;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onPress={() =>
          navigation.navigate('DoctorConsultationDetailScreen', {
            bookingId: item._id,
          })
        }
      >
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            Lịch khám
          </Text>
          <Chip scheme={statusScheme} text={statusScheme.label} />
        </View>

        {/* Người cao tuổi */}
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
              {!!elderlyAddress && (
                <Text style={styles.personSub} numberOfLines={1}>
                  Địa chỉ: {elderlyAddress}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Người đặt lịch */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Người đặt lịch</Text>
          <View style={styles.row}>
            <Avatar uri={creatorInfo.avatar} fallback={creatorInfo.name} />
            <View style={styles.personInfo}>
              <Text style={styles.personName} numberOfLines={1}>
                {creatorInfo.name}
              </Text>
              <Text style={styles.personSub} numberOfLines={1}>
                Vai trò: {creatorInfo.roleLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Thời gian + thanh toán */}
        <View
          style={[
            styles.section,
            styles.rowBetween,
            { alignItems: 'flex-start' },
          ]}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.sectionLabel}>Ngày khám</Text>
            <Text style={styles.timeText}>
              {dateLabel || '—'}
              {sessionLabel ? ` • ${sessionLabel}` : ''}
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
          <Text style={styles.loadingText}>Đang tải danh sách lịch…</Text>
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

      {/* Tabs lọc 3 trạng thái: Chờ khám / Hoàn thành / Đã hủy */}
      <View style={styles.filterBar}>
        {STATUS_TABS.map(tab => {
          const isActive = filterStatus === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              style={[
                styles.statusTab,
                isActive && styles.statusTabActive,
              ]}
              activeOpacity={0.9}
              onPress={() => setFilterStatus(tab.value)}
            >
              <Text
                style={[
                  styles.statusTabText,
                  isActive && styles.statusTabTextActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isEmpty ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Không có lịch trong bộ lọc</Text>
          <Text style={styles.emptySub}>
            Thử chọn trạng thái khác hoặc làm mới danh sách.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
           
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
    </SafeAreaView>
  );
};

DoctorMyBookingListScreen.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func,
    goBack: PropTypes.func,
    addListener: PropTypes.func,
    canGoBack: PropTypes.func,
  }).isRequired,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },

  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },

  // Header
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

  // Filter bar
  filterBar: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginLeft: 16,
    marginRight: 16,
  },
  statusTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  statusTabActive: {
    backgroundColor: '#335CFF',
    borderColor: '#335CFF',
  },
  statusTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusTabTextActive: {
    color: '#FFFFFF',
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

  // Card
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

  // States
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

  // Modal filter
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

export default DoctorMyBookingListScreen;
