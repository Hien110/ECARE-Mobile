// src/screens/doctorBooking/DoctorConsultationDetailScreen.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  Modal,
  Pressable,
  Animated,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';

import { doctorBookingService } from '../../services/doctorBookingService';
import userService from '../../services/userService';
import conversationService from '../../services/conversationService';
import doctorService from '../../services/doctorService';
import ratingService from '../../services/ratingService';

const TAG = '[DoctorConsultationDetail]';
const VN_TZ = 'Asia/Ho_Chi_Minh';

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
  cancelled: {
    bg: '#FFF5F5',
    text: '#C53030',
    border: '#FED7D7',
    label: 'Đã hủy',
  },
  default: { bg: '#EDF2F7', text: '#4A5568', border: '#E2E8F0', label: 'Khác' },
};

const paymentColors = {
  unpaid: {
    bg: '#FEF2F2',
    text: '#B91C1C',
    border: '#FECACA',
    label: 'Chưa thanh toán',
  },
  paid: {
    bg: '#ECFDF3',
    text: '#166534',
    border: '#BBF7D0',
    label: 'Đã thanh toán',
  },
  completed: {
    bg: '#ECFDF3',
    text: '#166534',
    border: '#BBF7D0',
    label: 'Đã thanh toán',
  },
  refunded: {
    bg: '#EFF6FF',
    text: '#1D4ED8',
    border: '#BFDBFE',
    label: 'Đã hoàn tiền',
  },
  default: { bg: '#EDF2F7', text: '#4A5568', border: '#E2E8F0', label: 'Khác' },
};

const paymentMethodLabelMap = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản ngân hàng',
  qr: 'QR / online',
  online: 'Online',
};

// Trạng thái thời gian khám theo giờ (local time): 'before' | 'within' | 'after' | 'unknown'
const getConsultationWindowStateUtc = (scheduledDate, slot) => {
  if (!scheduledDate || !slot) return 'unknown';

  let base;
  if (
    typeof scheduledDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)
  ) {
    const [yStr, mStr, dStr] = scheduledDate.split('-');
    const y = Number(yStr);
    const m = Number(mStr) - 1;
    const d = Number(dStr);
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return 'unknown';
    base = new Date(y, m, d);
  } else {
    base = new Date(scheduledDate);
  }
  if (Number.isNaN(base.getTime())) return 'unknown';

  const year = base.getFullYear();
  const month = base.getMonth();
  const day = base.getDate();

  let startHour;
  let endHour;
  if (slot === 'morning') {
    startHour = 8;
    endHour = 10;
  } else if (slot === 'afternoon') {
    startHour = 14;
    endHour = 16;
  } else {
    return 'unknown';
  }

  const start = new Date(year, month, day, startHour, 0, 0, 0);
  const end = new Date(year, month, day, endHour, 0, 0, 0);
  const now = new Date();

  if (typeof console !== 'undefined' && console.log) {
    console.log(
      '[DoctorConsultationDetail] scheduledDate=',
      scheduledDate,
      'slot=',
      slot,
      'start=',
      start.toString(),
      'end=',
      end.toString(),
      'now=',
      now.toString(),
    );
  }

  if (now.getTime() < start.getTime()) return 'before';
  if (now.getTime() > end.getTime()) return 'after';
  return 'within';
};

function formatDateLongVN(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);

  const fmt = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TZ,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return fmt.format(d);
}

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

/** =========================
 * UI helpers (new)
 * ========================= */
const Divider = () => <View style={styles.divider} />;

const SectionCard = ({ title, right, children }) => (
  <View style={styles.card}>
    {title || right ? (
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {right}
      </View>
    ) : null}
    {children}
  </View>
);

SectionCard.propTypes = {
  title: PropTypes.string,
  right: PropTypes.node,
  children: PropTypes.node,
};
SectionCard.defaultProps = { title: '', right: null, children: null };

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
Chip.defaultProps = { scheme: null, style: null };

const RowItem = ({ label, value, right, icon }) => (
  <View style={styles.rowBetween}>
    <View
      style={{
        flex: 1,
        paddingRight: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
    >
      {icon ? <View style={styles.rowIconWrap}>{icon}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.itemLabel}>{label}</Text>
        <Text style={styles.itemValue}>{value || '—'}</Text>
      </View>
    </View>
    {right}
  </View>
);

RowItem.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  right: PropTypes.node,
  icon: PropTypes.node,
};
RowItem.defaultProps = { value: null, right: null, icon: null };

const AvatarLine = ({
  title,
  name,
  role,
  avatar,
  showHistoryButton,
  onPressHistory,
}) => (
  <View style={{ marginTop: 14 }}>
    <Text style={styles.sectionLabel}>{title}</Text>

    <View style={styles.personRow}>
      <View style={styles.personLeft}>
        <View style={styles.avatarWrap}>
          {avatar ? (
            <Image
              source={{ uri: avatar }}
              resizeMode="cover"
              style={styles.avatarImg}
            />
          ) : (
            <Feather name="user" size={22} color="#94A3B8" />
          )}
        </View>

        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.personName} numberOfLines={1}>
            {name || '—'}
          </Text>
          <Text style={styles.personSub} numberOfLines={1}>
            {role}
          </Text>
        </View>
      </View>

      {showHistoryButton ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPressHistory}
          style={styles.historyBtn}
        >
          <Feather name="clock" size={14} color="#FFFFFF" />
          <Text style={styles.historyBtnText} numberOfLines={1}>
            Lịch sử
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  </View>
);

AvatarLine.propTypes = {
  title: PropTypes.string.isRequired,
  name: PropTypes.string,
  role: PropTypes.string,
  avatar: PropTypes.string,
  showHistoryButton: PropTypes.bool,
  onPressHistory: PropTypes.func,
};
AvatarLine.defaultProps = {
  name: null,
  role: null,
  avatar: null,
  showHistoryButton: false,
  onPressHistory: undefined,
};

function resolveCreatorInfo(booking) {
  if (!booking) {
    return { name: '—', avatar: null, roleLabel: 'Người đặt lịch' };
  }

  const createdBy = booking.createdBy;
  const registrant =
    booking.registrant || booking.family || booking.bookedByFamily || null;
  const beneficiary = booking.beneficiary || booking.elderly || null;

  console.log(`${TAG}[resolveCreator] raw fields =`, {
    createdBy,
    registrant,
    beneficiary,
  });

  let creator = null;
  let roleLabel = 'Người đặt lịch';
  let source = 'none';

  if (createdBy) {
    creator = createdBy;
    source = 'createdBy';

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
      source = 'registrant === beneficiary';
    } else {
      creator = registrant;
      roleLabel = 'Người thân đặt lịch';
      source = 'registrant != beneficiary';
    }
  } else if (registrant) {
    creator = registrant;
    const role = (registrant.role || registrant.user?.role || '').toLowerCase();
    if (role === 'elderly') roleLabel = 'Người cao tuổi (tự đặt)';
    else if (role === 'family' || role === 'supporter')
      roleLabel = 'Người thân đặt lịch';
    else roleLabel = 'Người đặt lịch';
    source = 'registrant only';
  } else if (beneficiary) {
    creator = beneficiary;
    roleLabel = 'Người cao tuổi (tự đặt)';
    source = 'beneficiary fallback';
  }

  const name = safeName(creator) || '—';
  const avatar = safeAvatar(creator) || null;

  console.log(`${TAG}[resolveCreator] result =`, {
    name,
    avatar,
    roleLabel,
    source,
  });

  return { name, avatar, roleLabel };
}

const DoctorConsultationDetailScreen = ({ route, navigation }) => {
  const registrationIdFromRoute = route?.params?.registrationId || null;
  const bookingId = route?.params?.bookingId || registrationIdFromRoute;
  const elderlyIdFromRoute = route?.params?.elderlyId || null;
  const initialBooking = route?.params?.initialBooking || null;

  const [booking, setBooking] = useState(initialBooking || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [userRole, setUserRole] = useState('unknown');
  const [currentUser, setCurrentUser] = useState(null);

  const [conversation, setConversation] = useState(null);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ==== trạng thái update status tư vấn (doctor) ====
  const [updatingStatus] = useState(false);

  // ==== rating state ====
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hasRatedDoctor, setHasRatedDoctor] = useState(false);
  const [myDoctorReview, setMyDoctorReview] = useState(null); // { id, rating, comment, reviewerId }

  // toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const toastOpacity = React.useRef(new Animated.Value(0)).current;

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
    toastOpacity.setValue(0);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setToastVisible(false));
      }, 1600);
    });
  };

  const loadUserRole = useCallback(async () => {
    try {
      const res = await userService.getUser();
      console.log(`${TAG}[loadUserRole] res =`, res);
      setUserRole(res?.data?.role || 'unknown');
      setCurrentUser(res?.data || null);
    } catch (e) {
      console.log(`${TAG}[loadUserRole][ERROR]`, e?.message || e);
      setUserRole('unknown');
      setCurrentUser(null);
    }
  }, []);

  const resolveConversation = useCallback(async found => {
    if (!found?.doctor) {
      setConversation(null);
      return;
    }

    try {
      const doctorId =
        found.doctor?._id || found.doctor?.user?._id || found.doctor?.doctorId;
      const elderlyId =
        found.beneficiary?._id ||
        found.beneficiary?.user?._id ||
        found.elderly?._id ||
        found.elderly?.user?._id;

      if (!doctorId || !elderlyId) {
        setConversation(null);
        return;
      }

      const convRes = await conversationService.getConversationByParticipants(
        doctorId,
        elderlyId,
      );
      if (convRes?.success && convRes.data) setConversation(convRes.data);
      else setConversation(null);
    } catch (e) {
      console.log(`${TAG}[resolveConversation][ERROR]`, e?.message || e);
      setConversation(null);
    }
  }, []);

  const loadDetails = useCallback(async () => {
    if (!bookingId) {
      console.log(`${TAG}[loadDetails][ERROR] thiếu bookingId`);
      setLoading(false);
      return;
    }

    console.log(
      `${TAG}[loadDetails] START bookingId =`,
      bookingId,
      'elderlyIdFromRoute =',
      elderlyIdFromRoute,
    );

    try {
      setLoading(true);

      let detailRes = {};
      if (doctorBookingService.getRegistrationDetail) {
        detailRes =
          (await doctorBookingService.getRegistrationDetail(bookingId)) || {};
      }
      console.log(`${TAG}[loadDetails] registration detail res =`, detailRes);

      if (detailRes?.success && detailRes.data) {
        setBooking(prev => ({ ...(prev || {}), ...detailRes.data }));
        await resolveConversation(detailRes.data);
        return;
      }

      if (elderlyIdFromRoute) {
        console.log(
          `${TAG}[loadDetails][FALLBACK_BY_ELDERLY] dùng getBookingsByElderlyId`,
          { elderlyIdFromRoute },
        );
        try {
          const listRes =
            (await doctorBookingService.getBookingsByElderlyId?.(
              elderlyIdFromRoute,
            )) || {};
          if (listRes?.success && Array.isArray(listRes.data)) {
            const found = listRes.data.find(
              b => String(b._id) === String(bookingId),
            );
            if (found) {
              setBooking(prev => ({ ...(prev || {}), ...found }));
              await resolveConversation(found);
              return;
            }
          }
        } catch (err) {
          console.log(
            `${TAG}[loadDetails][FALLBACK_BY_ELDERLY][ERROR]`,
            err?.message || err,
          );
        }
      }

      console.log(
        `${TAG}[loadDetails][FALLBACK_MY_BOOKINGS] dùng getMyBookings`,
      );
      const res = await doctorBookingService.getMyBookings?.();

      if (res?.success && Array.isArray(res.data)) {
        const found = res.data.find(b => String(b._id) === String(bookingId));
        if (found) {
          setBooking(prev => ({ ...(prev || {}), ...found }));
          if (found.status && found.status !== 'pending')
            await resolveConversation(found);
          else setConversation(null);
        } else {
          setBooking(null);
          setConversation(null);
        }
      } else {
        setBooking(null);
        setConversation(null);
      }
    } catch (e) {
      console.log(`${TAG}[loadDetails][ERROR]`, e?.message || e);
      setBooking(null);
      setConversation(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId, elderlyIdFromRoute, resolveConversation]);

  useEffect(() => {
    console.log(`${TAG}[useEffect] route.params =`, route?.params);
    loadUserRole();
    loadDetails();
  }, [loadUserRole, loadDetails, route?.params]);

  // Load existing rating for this consultation (if any)
  useEffect(() => {
    const fetchConsultationRating = async () => {
      if (!booking?._id) return;
      try {
        const res = await ratingService.getRatingByConsultationId(booking._id);
        if (res?.success && res.data) {
          const r = res.data;
          setMyDoctorReview({
            id: r._id,
            rating: r.rating,
            comment: r.comment || '',
            reviewerId: r.reviewer?._id,
          });
          setHasRatedDoctor(
            Boolean(
              currentUser?._id &&
                String(r.reviewer?._id) === String(currentUser._id),
            ),
          );
        }
      } catch (e) {
        console.log(`${TAG}[fetchConsultationRating][ERROR]`, e?.message || e);
      }
    };

    fetchConsultationRating();
  }, [booking?._id, currentUser?._id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadUserRole(), loadDetails()]);
    setRefreshing(false);
  };

  /** =========================
   * Derived data
   * ========================= */
  const rawStatusKey = String(booking?.status || 'pending').toLowerCase();
  const statusKey = rawStatusKey === 'canceled' ? 'cancelled' : rawStatusKey;
  const statusScheme = statusColors[statusKey] || statusColors.default;
  const cancelReasonSafe = (booking?.cancelReason || '').trim();

  const isDoctorRole = (userRole || '').toLowerCase() === 'doctor';

  const paymentStatusRaw =
    booking?.payment?.status || booking?.paymentStatus || 'unpaid';
  let paymentKey = String(paymentStatusRaw || 'unpaid').toLowerCase();
  if (['success', 'successful'].includes(paymentKey)) paymentKey = 'completed';
  if (['pending'].includes(paymentKey)) paymentKey = 'unpaid';

  const paymentMethodRaw =
    booking?.payment?.method || booking?.paymentMethod || 'cash';
  const paymentMethodLower = String(paymentMethodRaw || '').toLowerCase();

  const isOnlineMethod = [
    'qr',
    'online',
    'bank_transfer',
    'bank-transfer',
  ].includes(paymentMethodLower);
  const isPaidRaw = ['paid', 'completed', 'success', 'successful'].includes(
    String(paymentStatusRaw || '').toLowerCase(),
  );
  const showRefundNotice =
    statusKey === 'cancelled' && (isOnlineMethod || isPaidRaw);
  if (statusKey === 'cancelled' && (isOnlineMethod || isPaidRaw))
    paymentKey = 'completed';

  const payScheme =
    paymentColors[paymentKey] || paymentColors.unpaid || paymentColors.default;
  const paymentMethodLabel =
    paymentMethodLabelMap[paymentMethodLower] || paymentMethodLabelMap.cash;

  const canCancel =
    ['pending', 'confirmed'].includes(statusKey) &&
    ['elderly', 'family'].includes((userRole || '').toLowerCase());

  const creatorInfo = useMemo(() => resolveCreatorInfo(booking), [booking]);

  const priceText =
    typeof booking?.price === 'number'
      ? `${booking.price.toLocaleString('vi-VN')} đ`
      : '';

  const dateIso =
    booking?.consultation?.scheduledDate ||
    booking?.scheduledDate ||
    booking?.consultationDate ||
    booking?.startDate ||
    booking?.packageInfo?.startDate ||
    booking?.createdAt;

  const dateLabel = formatDateLongVN(dateIso);

  const slotRaw = booking?.slot || booking?.consultation?.slot || null;
  const sessionLabel =
    slotRaw === 'morning'
      ? 'Buổi sáng'
      : slotRaw === 'afternoon'
      ? 'Buổi chiều'
      : '';

  const timeRaw =
    booking?.consultationTime ||
    booking?.appointmentTime ||
    booking?.scheduleTime ||
    null;

  const dateDisplay = dateLabel
    ? `${dateLabel}${sessionLabel ? ` • ${sessionLabel}` : ''}`
    : '—';
  const timeOnlyDisplay =
    timeRaw ||
    (slotRaw === 'morning'
      ? '8h - 11h'
      : slotRaw === 'afternoon'
      ? '14h - 17h'
      : '—');
  const timeDisplay = dateDisplay;

  const consultationWindowState = getConsultationWindowStateUtc(
    booking?.consultation?.scheduledDate || booking?.scheduledDate || null,
    booking?.slot || booking?.consultation?.slot || null,
  );
  const isWithinConsultationWindow = consultationWindowState === 'within';
  const summaryButtonLabel = isWithinConsultationWindow
    ? 'Điền phiếu khám'
    : 'Xem phiếu khám';

  const isBookingReviewer =
    !!currentUser?._id &&
    (String(currentUser._id) ===
      String(
        booking?.beneficiary?._id ||
          booking?.beneficiary?.user?._id ||
          booking?.elderly?._id ||
          booking?.elderly?.user?._id,
      ) ||
      String(currentUser._id) ===
        String(
          booking?.registrant?._id ||
            booking?.registrant?.user?._id ||
            booking?.family?._id ||
            booking?.family?.user?._id ||
            booking?.createdBy?._id ||
            booking?.createdBy?.user?._id,
        ));

  const canReview =
    !!booking &&
    (booking.canRateDoctor === true ||
      (booking.status === 'completed' && isBookingReviewer));

  /** =========================
   * Actions
   * ========================= */
  const onCancelBooking = async () => {
    if (!bookingId) return;
    try {
      setCancelling(true);
      const res = await doctorBookingService.cancelBooking?.(bookingId, {
        reason: 'Người dùng yêu cầu hủy',
      });

      if (res?.success) {
        const backendData =
          res?.data && typeof res.data === 'object' ? res.data : {};
        const backendStatus = backendData.status;

        setBooking(prev => {
          const base = prev || {};
          const merged = { ...base, ...backendData };
          merged.status = backendStatus || 'cancelled';
          return merged;
        });

        showToast('Đã hủy buổi tư vấn');
      } else {
        showToast('Hủy thất bại, vui lòng thử lại', 'error');
      }
    } catch (e) {
      console.log(`${TAG}[onCancelBooking][ERROR]`, e?.message || e);
      showToast('Hủy thất bại', 'error');
    } finally {
      setCancelling(false);
      setConfirmVisible(false);
    }
  };

  const goToChat = () => {
    if (!conversation || !currentUser) return;
    const other = conversation.participants?.find(
      p => String(p.user?._id) !== String(currentUser._id),
    );
    if (!other) return;

    navigation.navigate('Chat', {
      conversationId: conversation._id,
      otherParticipant: other,
    });
  };

  const goToConsultationSummary = () => {
    if (!booking?._id) return;

    const elderly = booking?.elderly || booking?.beneficiary || null;

    const patientName = elderly?.fullName || elderly?.name || '';
    const patientGender = elderly?.gender || '';
    const patientDob = elderly?.dateOfBirth || null;

    const scheduledDateForSummary =
      booking?.consultation?.scheduledDate ||
      booking?.scheduledDate ||
      booking?.consultationDate ||
      null;

    const slotForSummary = booking?.slot || booking?.consultation?.slot || null;

    navigation.navigate('ConsulationSummary', {
      registrationId: String(booking._id),
      patientName,
      patientGender,
      patientDob,
      scheduledDate: scheduledDateForSummary,
      slot: slotForSummary,
    });
  };

  const goToHistoryList = () => {
    const elderly = booking?.elderly || booking?.beneficiary || null;
    const elderlyId = elderly?._id || elderly?.user?._id || null;
    const elderlyName =
      elderly?.fullName ||
      elderly?.name ||
      booking?.beneficiary?.fullName ||
      booking?.beneficiary?.name ||
      '';

    if (!elderlyId) {
      showToast('Không tìm thấy thông tin người cao tuổi.', 'error');
      return;
    }

    navigation.navigate('ListSumary', { elderlyId, elderlyName });
  };

  const openReviewModal = () => {
    setRating(0);
    setComment('');
    setReviewModalVisible(true);
  };

  const closeReviewModal = () => {
    if (!submittingReview) setReviewModalVisible(false);
  };

  const handleSubmitReview = async () => {
    if (!booking?._id)
      return showToast('Không tìm thấy mã tư vấn để đánh giá.', 'error');
    if (!currentUser?._id)
      return showToast('Không tìm thấy thông tin người dùng.', 'error');
    if (!booking?.doctor?._id && !booking?.doctor?.user?._id)
      return showToast('Không tìm thấy thông tin bác sĩ để đánh giá.', 'error');
    if (!rating) return showToast('Vui lòng chọn số sao đánh giá.', 'error');
    if (submittingReview) return;

    try {
      setSubmittingReview(true);

      const doctorUserId = booking?.doctor?.user?._id || booking?.doctor?._id;
      if (!doctorUserId)
        return showToast('Không tìm thấy bác sĩ để đánh giá.', 'error');

      let res = null;
      if (myDoctorReview?.id) {
        res = await ratingService.updateRatingById(
          myDoctorReview.id,
          rating,
          comment,
        );
      } else {
        res = await doctorService.createDoctorReview(doctorUserId, {
          rating,
          comment,
          serviceConsultationId: booking._id,
        });
      }

      if (!res?.success) {
        showToast(
          res?.message ||
            'Đã có lỗi xảy ra khi gửi đánh giá. Vui lòng thử lại sau.',
          'error',
        );
        if (
          typeof res?.message === 'string' &&
          res.message.toLowerCase().includes('đánh giá bác sĩ này rồi')
        ) {
          setHasRatedDoctor(true);
        }
        return;
      }

      setHasRatedDoctor(true);
      const createdId = res?.data?.id || myDoctorReview?.id || null;
      setMyDoctorReview({
        id: createdId,
        rating,
        comment,
        reviewerId: currentUser?._id,
      });

      showToast('Bạn đã đánh giá bác sĩ.', 'success');
      setReviewModalVisible(false);
    } catch (e) {
      console.log(
        `${TAG}[handleSubmitReview][ERROR]`,
        e?.response?.data || e?.message || e,
      );
      showToast(
        'Đã có lỗi xảy ra khi gửi/cập nhật đánh giá. Vui lòng thử lại sau.',
        'error',
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!myDoctorReview?.id) return;
    try {
      setSubmittingReview(true);
      const res = await ratingService.deleteRatingById(myDoctorReview.id);
      if (res?.success) {
        setHasRatedDoctor(false);
        setMyDoctorReview(null);
        showToast('Đã xóa đánh giá', 'success');
      } else {
        showToast(res?.message || 'Xóa đánh giá thất bại', 'error');
      }
    } catch (e) {
      console.log(`${TAG}[handleDeleteReview][ERROR]`, e?.message || e);
      showToast('Xóa đánh giá thất bại', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const primaryActions = useMemo(() => {
    if (!booking) return [];

    const actions = [];

    // NON-DOCTOR: chat (confirmed/in_progress) + view summary
    if (!isDoctorRole) {
      if (
        (statusKey === 'confirmed' || statusKey === 'in_progress') &&
        conversation
      ) {
        actions.push({
          key: 'chat',
          label: 'Nhắn tin với bác sĩ',
          type: 'primary',
          onPress: goToChat,
        });
      }
      actions.push({
        key: 'summary',
        label: 'Xem phiếu khám',
        type: 'primary',
        onPress: goToConsultationSummary,
      });
      if (canCancel) {
        actions.push({
          key: 'cancel',
          label: 'Hủy lịch tư vấn',
          type: 'danger',
          onPress: () => setConfirmVisible(true),
          loading: cancelling,
        });
      }
      return actions;
    }

    // DOCTOR: chat (confirmed/in_progress) + fill/view summary
    if (
      (statusKey === 'confirmed' || statusKey === 'in_progress') &&
      conversation
    ) {
      actions.push({
        key: 'contact',
        label: 'Liên hệ',
        type: 'primary',
        onPress: goToChat,
        disabled: updatingStatus,
      });
    }

    actions.push({
      key: 'doctor-summary',
      label: summaryButtonLabel,
      type: 'primary',
      onPress: goToConsultationSummary,
    });

    return actions;
  }, [
    booking,
    isDoctorRole,
    statusKey,
    conversation,
    canCancel,
    cancelling,
    updatingStatus,
    summaryButtonLabel,
    goToChat,
    goToConsultationSummary,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      {toastVisible && (
        <Animated.View
          style={[
            styles.toastContainer,
            { opacity: toastOpacity },
            toastType === 'error' && { backgroundColor: '#DC2626' },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      <StatusBar barStyle="dark-content" />

      {/* Header (nicer) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.85}
        >
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Chi tiết tư vấn</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {booking ? timeDisplay : ' '}
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Đang tải…</Text>
        </View>
      ) : !booking ? (
        <ScrollView contentContainerStyle={styles.center}>
          <Text style={styles.errorText}>Không tìm thấy buổi tư vấn.</Text>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { marginTop: 12, paddingHorizontal: 18 },
            ]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.primaryBtnText}>Quay lại</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            {/* Overview card */}
            <SectionCard
              title="Tổng quan"
              right={<Chip scheme={statusScheme} text={statusScheme.label} />}
            >
              {statusKey === 'cancelled' && cancelReasonSafe ? (
                <View style={styles.alertDanger}>
                  <View style={styles.alertRow}>
                    <Feather name="alert-triangle" size={16} color="#B91C1C" />
                    <Text style={styles.alertTitle}>Lý do hủy</Text>
                  </View>
                  <Text style={styles.alertText}>{cancelReasonSafe}</Text>
                </View>
              ) : null}

              <RowItem
                label="Thời gian tư vấn"
                value={timeDisplay}
                icon={<Feather name="calendar" size={16} color="#64748B" />}
              />
              <Divider />
              <RowItem
                label="Giờ"
                value={timeOnlyDisplay}
                icon={<Feather name="clock" size={16} color="#64748B" />}
              />
              <Divider />
              <RowItem
                label="Thanh toán"
                value={`${paymentMethodLabel}`}
                icon={<Feather name="credit-card" size={16} color="#64748B" />}
                right={<Chip scheme={payScheme} text={payScheme.label} />}
              />
              {priceText ? (
                <>
                  <Divider />
                  <RowItem
                    label="Chi phí"
                    value={priceText}
                    icon={<Feather name="tag" size={16} color="#64748B" />}
                  />
                </>
              ) : null}

              {showRefundNotice ? (
                <View style={styles.alertInfo}>
                  <View style={styles.alertRow}>
                    <Feather name="info" size={16} color="#1D4ED8" />
                    <Text style={[styles.alertTitle, { color: '#1D4ED8' }]}>
                      Hoàn tiền
                    </Text>
                  </View>
                  <Text style={[styles.alertText, { color: '#1D4ED8' }]}>
                    Tiền sẽ được hoàn trả lại trong vòng{' '}
                    <Text style={{ fontWeight: '800' }}>12h–24h</Text>.
                  </Text>
                </View>
              ) : null}
            </SectionCard>

            {/* People card */}
            <SectionCard title="Thông tin người liên quan">
              <AvatarLine
                title="Bác sĩ"
                name={booking?.doctor?.fullName || booking?.doctor?.name}
                role="Bác sĩ"
                avatar={booking?.doctor?.avatar}
              />

              <AvatarLine
                title="Người cao tuổi"
                name={
                  booking?.elderly?.fullName ||
                  booking?.beneficiary?.fullName ||
                  booking?.beneficiary?.name
                }
                role="Người được tư vấn"
                avatar={
                  booking?.elderly?.avatar || booking?.beneficiary?.avatar
                }
                showHistoryButton
                onPressHistory={goToHistoryList}
              />

              {!!(
                booking?.elderly?.currentAddress ||
                booking?.beneficiary?.currentAddress
              ) ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.itemLabel}>Địa chỉ hiện tại</Text>
                  <Text
                    style={[
                      styles.itemValue,
                      { fontWeight: '600', lineHeight: 20 },
                    ]}
                  >
                    {booking?.elderly?.currentAddress ||
                      booking?.beneficiary?.currentAddress}
                  </Text>
                </View>
              ) : null}

              <AvatarLine
                title="Người đặt lịch"
                name={creatorInfo.name}
                role={creatorInfo.roleLabel}
                avatar={creatorInfo.avatar}
              />
            </SectionCard>

            {/* Note card */}
            {!!booking?.note ? (
              <SectionCard title="Ghi chú">
                <View style={styles.noteBox}>
                  <Text style={styles.noteText}>{booking.note}</Text>
                </View>
              </SectionCard>
            ) : null}

            {/* Rating card */}
            <SectionCard title="Đánh giá">
              {canReview && !hasRatedDoctor ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={openReviewModal}
                  style={[styles.primaryBtn, { marginTop: 6 }]}
                  disabled={submittingReview}
                >
                  {submittingReview ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Đánh giá bác sĩ</Text>
                  )}
                </TouchableOpacity>
              ) : null}

              {myDoctorReview ? (
                <View style={styles.ratingBox}>
                  <View style={styles.rowBetweenNoTop}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Feather name="star" size={16} color="#F59E0B" />
                      <Text style={styles.ratingTitle}>Đánh giá của bạn</Text>
                    </View>

                    <View style={styles.ratingPill}>
                      <Text style={styles.ratingPillText}>
                        {myDoctorReview.rating} ★
                      </Text>
                    </View>
                  </View>

                  {myDoctorReview.comment ? (
                    <Text style={styles.ratingComment}>
                      {myDoctorReview.comment}
                    </Text>
                  ) : null}

                  <View style={styles.ratingActionsRow}>
                    <TouchableOpacity
                      style={styles.smallBtn}
                      onPress={() => {
                        setRating(myDoctorReview.rating || 0);
                        setComment(myDoctorReview.comment || '');
                        setReviewModalVisible(true);
                      }}
                    >
                      <Feather name="edit-2" size={14} color="#334155" />
                      <Text style={styles.smallBtnText}>Chỉnh sửa</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.smallBtn, styles.smallBtnDanger]}
                      onPress={handleDeleteReview}
                      disabled={submittingReview}
                    >
                      <Feather name="trash-2" size={14} color="#B91C1C" />
                      <Text style={[styles.smallBtnText, { color: '#B91C1C' }]}>
                        Xóa
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.helperText}>
                  {canReview
                    ? 'Hãy chia sẻ trải nghiệm của bạn để giúp cải thiện chất lượng dịch vụ.'
                    : 'Chưa có đánh giá.'}
                </Text>
              )}
            </SectionCard>

         
            {/* Sticky Action Bar (new, nicer) */}
            {primaryActions?.length ? (
              <View style={styles.actionBar}>
                {primaryActions.map((a, idx) => {
                  const isDanger = a.type === 'danger';
                  const isSecondary = a.type === 'secondary';
                  const btnStyle = [
                    styles.actionBtn,
                    isSecondary && styles.actionBtnSecondary,
                    isDanger && styles.actionBtnDanger,
                    idx > 0 && { marginTop: 10 },
                  ];
                  const textStyle = [
                    styles.actionBtnText,
                    isSecondary && { color: '#0F172A' },
                    isDanger && { color: '#FFFFFF' },
                  ];
                  return (
                    <TouchableOpacity
                      key={a.key}
                      style={btnStyle}
                      onPress={a.onPress}
                      activeOpacity={0.9}
                      disabled={a.disabled || a.loading}
                    >
                      {a.loading ? (
                        <ActivityIndicator
                          color={isSecondary ? '#0F172A' : '#fff'}
                        />
                      ) : (
                        <Text style={textStyle}>{a.label}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        </>
      )}

      {/* Modal hủy */}
      <Modal
        transparent
        visible={confirmVisible}
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setConfirmVisible(false)}
        />
        <View style={styles.modalSheetWrap}>
          <View style={styles.modalSheet}>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={styles.modalIconDanger}>
                <Feather name="x-circle" size={20} color="#FFFFFF" />
              </View>
            </View>

            <Text style={styles.modalTitle}>Xác nhận hủy</Text>
            <Text style={styles.modalSub}>
              Bạn có chắc chắn muốn hủy buổi tư vấn?
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setConfirmVisible(false)}
                style={[styles.modalBtn, styles.modalBtnGhost]}
                disabled={cancelling}
              >
                <Text style={styles.modalBtnGhostText}>Không</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onCancelBooking}
                style={[styles.modalBtn, styles.modalBtnDanger]}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnDangerText}>Có</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal đánh giá */}
      <Modal
        transparent
        visible={reviewModalVisible}
        animationType="fade"
        onRequestClose={closeReviewModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeReviewModal} />
        <View style={styles.modalSheetWrap}>
          <View style={styles.reviewSheet}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>Đánh giá bác sĩ</Text>
              <TouchableOpacity
                onPress={closeReviewModal}
                disabled={submittingReview}
                style={styles.closeBtn}
              >
                <Feather name="x" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.reviewLabel}>Số sao</Text>
            <View style={styles.reviewStarsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                  key={star}
                  style={styles.starTouchable}
                  onPress={() => setRating(star)}
                  activeOpacity={0.8}
                  disabled={submittingReview}
                >
                  <Feather
                    name="star"
                    size={28}
                    color={star <= rating ? '#FBBF24' : '#CBD5E1'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.reviewLabel, { marginTop: 14 }]}>
              Bình luận
            </Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Nhập cảm nhận của bạn..."
              placeholderTextColor="#94A3B8"
              multiline
              value={comment}
              onChangeText={setComment}
              editable={!submittingReview}
            />

            <View style={styles.reviewBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={closeReviewModal}
                disabled={submittingReview}
              >
                <Text style={styles.modalBtnGhostText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.reviewSubmitBtn]}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.reviewSubmitText}>Gửi đánh giá</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

DoctorConsultationDetailScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      bookingId: PropTypes.string,
      registrationId: PropTypes.string,
      elderlyId: PropTypes.string,
      initialBooking: PropTypes.object,
    }),
  }).isRequired,
  navigation: PropTypes.shape({
    goBack: PropTypes.func,
    navigate: PropTypes.func,
  }).isRequired,
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },

  /** Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
    }),
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    marginRight: 10,
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', },
  headerSub: { marginTop: 2, fontSize: 12, color: '#64748B' },

  /** Scroll */
  scrollContent: { padding: 16, paddingBottom: 24 },

  /** Cards */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },

  divider: { height: 1, backgroundColor: '#EEF2F6', marginVertical: 10 },

  /** Chips */
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 160,
  },
  chipText: { fontSize: 12, fontWeight: '800' },

  /** Rows */
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  rowBetweenNoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  itemLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 3,
    fontWeight: '600',
  },
  itemValue: { fontSize: 15, color: '#0F172A', fontWeight: '800' },

  /** Person row */
  sectionLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  personLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  personName: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  personSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarImg: { width: 46, height: 46 },

  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#16A34A',
  },
  historyBtnText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF' },

  /** Alerts */
  alertDanger: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  alertInfo: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  alertTitle: { fontSize: 12, fontWeight: '900', color: '#B91C1C' },
  alertText: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 19,
    fontWeight: '600',
  },

  /** Note */
  noteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  noteText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '600',
  },

  /** Rating */
  helperText: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    fontWeight: '600',
  },
  ratingBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ratingTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A' },
  ratingPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
  },
  ratingPillText: { color: '#B45309', fontWeight: '900', fontSize: 13 },
  ratingComment: {
    marginTop: 10,
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
    fontWeight: '600',
  },
  ratingActionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },

  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  smallBtnDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  smallBtnText: { fontSize: 12, fontWeight: '900', color: '#334155' },

  /** Primary buttons (kept for fallback screens) */
  primaryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },

  /** Action bar */
  actionBar: {
    // position: 'absolute',
    // left: 0,
    // right: 0,
    // bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    // paddingBottom: 14,
    backgroundColor: 'rgba(248,250,252,0.92)',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  actionBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBtnDanger: { backgroundColor: '#991B1B' },
  actionBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },

  /** Loading/Error */
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 12, color: '#475569', fontWeight: '700' },
  errorText: {
    fontSize: 15,
    color: '#B91C1C',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '800',
  },

  /** Modal */
  modalBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  modalSheetWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalSheet: {
    width: '84%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 8 },
    }),
  },
  modalIconDanger: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#991B1B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
    lineHeight: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalBtnGhost: { backgroundColor: '#F1F5F9' },
  modalBtnDanger: { backgroundColor: '#991B1B' },
  modalBtnGhostText: { color: '#0F172A', fontWeight: '900' },
  modalBtnDangerText: { color: '#FFFFFF', fontWeight: '900' },

  /** Toast */
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#16A34A',
    borderRadius: 999,
    zIndex: 999,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  /** Review modal */
  reviewSheet: {
    width: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 8 },
    }),
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  reviewLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 4,
  },
  starTouchable: { marginHorizontal: 4 },
  commentInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  reviewBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 12,
  },
  reviewSubmitBtn: { backgroundColor: '#2563EB' },
  reviewSubmitText: { color: '#FFFFFF', fontWeight: '900' },
});

export default DoctorConsultationDetailScreen;
