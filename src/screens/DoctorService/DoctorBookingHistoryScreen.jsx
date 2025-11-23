// src/screens/doctorBooking/DoctorBookingHistoryScreen.jsx
import { useNavigation } from '@react-navigation/native';
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

const TAG = '[DoctorBookingHistoryScreen]';
const HEADER_COLOR = '#4F7EFF';
const VN_TZ = 'Asia/Ho_Chi_Minh';

// ==== STATUS MAPPING (booking + payment) ====
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
  paid: {
    bg: '#E6FFFB',
    text: '#00796B',
    border: '#B2F5EA',
    label: 'Đã thanh toán',
  },
  completed: {
    // phòng khi backend trả "completed"
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
    // fallback icon nếu không có avatar
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

// =================== MAIN SCREEN ===================
const DoctorBookingHistoryScreen = () => {
  const navigation = useNavigation();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('doctor');

  // ---- FORMAT HELPERS (bookings) ----
  const getBookingCode = item => {
    if (item.code) return `Đặt lịch #${item.code}`;
    if (item._id) return `Đặt lịch #${String(item._id).slice(-6)}`;
    return 'Đặt lịch';
  };

  const getSupporterName = item =>
    item.supporter?.fullName ||
    item.bookedBy?.fullName || // consultation
    item.registrant?.fullName || // nếu backend populate
    'Bạn';

  const getSupporterAvatar = item =>
    item.supporter?.avatar || item.bookedBy?.avatar || null;

  const getElderlyName = item =>
    item.elderly?.fullName ||
    item.elderly?.name ||
    item.beneficiary?.fullName ||
    item.beneficiary?.name ||
    'Người cao tuổi';

  const getElderlyAvatar = item =>
    item.elderly?.avatar || item.beneficiary?.avatar || null;

  const getDoctorName = item =>
    item.doctor?.fullName || item.doctor?.name || 'Bác sĩ';

  const getStatusLabelAndStyle = item => {
    const statusKey = (item.status || 'pending').toLowerCase();
    const scheme = statusColors[statusKey] || statusColors.default;

    const payRaw =
      item.payment?.status || // consultation
      item.paymentStatus || // nếu registration có
      'unpaid';
    const payKey = String(payRaw).toLowerCase();
    const payScheme =
      paymentStatusColors[payKey] || paymentStatusColors.default;

    return { bookScheme: scheme, payScheme };
  };

  const getPaymentMethodLabel = item => {
    const method =
      item.payment?.method ||
      item.paymentMethod ||
      'cash';
    if (method === 'qr' || method === 'online' || method === 'bank_transfer') {
      return 'Online';
    }
    return 'Tiền mặt';
  };

  // ---- API ----
  const fetchBookings = useCallback(async () => {
    const TAG_FETCH = `${TAG}[fetchBookings]`;
    try {
      setLoading(true);
      setError('');

      const res = await doctorBookingService.getMyBookings?.();

      console.log(TAG_FETCH, 'RAW_RESULT =', res);

      if (res?.success && Array.isArray(res.data)) {
        console.log(
          TAG_FETCH,
          'DATA_FROM_API =',
          JSON.stringify(res.data, null, 2),
        );
        setBookings(res.data);
      } else {
        setBookings([]);
        setError(
          res?.message ||
            'Không lấy được danh sách lịch khám bác sĩ. Vui lòng thử lại.',
        );
      }
    } catch (err) {
      console.log(TAG_FETCH, 'ERROR =', err?.message || err);
      setError('Không lấy được danh sách lịch khám bác sĩ. Vui lòng thử lại.');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchBookings();
    } finally {
      setRefreshing(false);
    }
  }, [fetchBookings]);

  // ---- HEADER giống SupporterBookingListScreen ----
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
            Theo dõi & quản lý đặt lịch
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

  // ---- RENDER CARD GIỐNG ẢNH MẪU ----
  const renderBookingItem = ({ item }) => {
    const { bookScheme, payScheme } = getStatusLabelAndStyle(item);

    // Consultation: packageInfo.startDate | scheduledDate
    // RegistrationHealthPackage: registeredAt
    const startDate =
      item.packageInfo?.startDate ||
      item.scheduledDate ||
      item.registeredAt;

    const methodLabel = getPaymentMethodLabel(item);

    const supporterName = getSupporterName(item);
    const supporterAvatar = getSupporterAvatar(item);
    const elderlyName = getElderlyName(item);
    const elderlyAvatar = getElderlyAvatar(item);
    const doctorName = getDoctorName(item);
    const packageTitle =
      item.packageInfo?.title || item.packageRef?.title || 'Gói khám sức khỏe';

    return (
      <View style={styles.card}>
        {/* Mã lịch + trạng thái booking */}
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {getBookingCode(item)}
          </Text>
          <Chip scheme={bookScheme} text={bookScheme.label} />
        </View>

        {/* Người hỗ trợ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NGƯỜI HỖ TRỢ</Text>
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

        {/* Người cao tuổi */}
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

        {/* Thời gian + thanh toán */}
        <View
          style={[
            styles.section,
            styles.rowBetween,
            { alignItems: 'flex-start' },
          ]}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.sectionLabel}>THỜI GIAN</Text>
            <Text style={styles.timeText}>
              {formatDateOnlyVN(startDate)}
            </Text>
            <Text style={styles.timeSub}>Cả ngày</Text>
            <Text style={[styles.timeSub, { marginTop: 4 }]}>
              Phương thức: {methodLabel}
            </Text>
          </View>
          <Chip scheme={payScheme} text={payScheme.label} />
        </View>

        {/* Bác sĩ phụ trách */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BÁC SĨ PHỤ TRÁCH</Text>
          <View style={styles.row}>
            <View style={styles.doctorAvatarCircle}>
              <Icon name="medkit-outline" size={20} color="#F97316" />
            </View>
            <View style={styles.personInfo}>
              <Text style={styles.personName} numberOfLines={1}>
                {doctorName}
              </Text>
              <Text style={styles.personSub} numberOfLines={1}>
                Gói: {packageTitle}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ====== RENDER SCREEN STATES ======
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            Đang tải danh sách lịch khám bác sĩ…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !bookings.length) {
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

  return (
    <SafeAreaView style={styles.screen}>
      <Header />

      {/* Tabs giống supporter: tab Doctor đang active */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.tabBtn, 
          activeTab === 'supporter' ? styles.tabActive : styles.tabInactive,
        ]}
          onPress={() => {
            setActiveTab('supporter');
            navigation.navigate('SupporterBookingListScreen');
          }} 
        >
        <Text 
        style={[styles.tabText,
            activeTab === 'supporter' 
            ? styles.tabTextActive
            : styles.tabTextInactive
            ]}
        >
            Lịch hỗ trợ
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.tabBtn,
        activeTab === 'doctor' ? styles.tabActive : styles.tabInactive,
        ]}
        onPress={() => setActiveTab('doctor')}
        >
          <Text style={[styles.tabText,
            activeTab === 'doctor' 
            ? styles.tabTextActive
            : styles.tabTextInactive,
            ]}
        >
            Lịch khám bác sĩ
          </Text>
        </TouchableOpacity>
      </View>

      {bookings.length ? (
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
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Hiện tại chưa có lịch khám bác sĩ nào.</Text>
          <Text style={styles.emptySub}>
            Khi có lịch mới, bạn sẽ thấy chúng tại đây.
          </Text>
          <TouchableOpacity onPress={fetchBookings} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Làm mới</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default DoctorBookingHistoryScreen;

// =================== STYLES (đồng bộ với SupporterBookingListScreen) ===================
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

  // Tabs
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
  timeSub: { fontSize: 13, color: '#334155', marginTop: 2 },
  doctorAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

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
    textAlign: 'center',
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
