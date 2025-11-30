// src/screens/doctorBooking/DoctorConsultationDetailScreen.jsx
import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';

import { doctorBookingService } from '../../services/doctorBookingService';
import userService from '../../services/userService';
import conversationService from '../../services/conversationService';
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

// ====== helpers format ngày giờ ======
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

// ====== helpers bóc tên / avatar sâu nhiều tầng ======
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

Chip.defaultProps = {
  scheme: null,
  style: null,
};

const RowItem = ({ label, value, right }) => (
  <View style={styles.rowBetween}>
    <View style={{ flex: 1, paddingRight: 8 }}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={styles.itemValue}>{value || '—'}</Text>
    </View>
    {right}
  </View>
);

RowItem.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  right: PropTypes.node,
};

RowItem.defaultProps = {
  value: null,
  right: null,
};

const AvatarLine = ({ title, name, role, avatar }) => (
  <View style={{ marginTop: 16 }}>
    <Text style={styles.sectionLabel}>{title}</Text>
    <View style={styles.row}>
      <View style={styles.avatarWrap}>
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            resizeMode="cover"
            style={styles.avatarImg}
          />
        ) : (
          <Feather name="user" size={24} color="#9CA3AF" />
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
  </View>
);

AvatarLine.propTypes = {
  title: PropTypes.string.isRequired,
  name: PropTypes.string,
  role: PropTypes.string,
  avatar: PropTypes.string,
};

AvatarLine.defaultProps = {
  name: null,
  role: '',
  avatar: null,
};

/**
 * ====== resolve "Người đặt lịch" chính xác ======
 */
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
    if (role === 'elderly') {
      roleLabel = 'Người cao tuổi (tự đặt)';
    } else if (role === 'family' || role === 'supporter') {
      roleLabel = 'Người thân đặt lịch';
    } else {
      roleLabel = 'Người đặt lịch';
    }
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
  const bookingId = route?.params?.bookingId;

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [userRole, setUserRole] = useState('unknown');
  const [currentUser, setCurrentUser] = useState(null);

  const [conversation, setConversation] = useState(null);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ==== rating state ====
  const [ratings, setRatings] = useState([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editingRating, setEditingRating] = useState(null);
  const [deleteRatingModalVisible, setDeleteRatingModalVisible] =
    useState(false);
  const [deletingRating, setDeletingRating] = useState(null);
  const [deletingRatingLoading, setDeletingRatingLoading] = useState(false);

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

  const loadRatings = useCallback(async () => {
    if (!bookingId) return;
    try {
      const currentUserRes = await userService.getUser();
      const res =
        await ratingService.getRatingsByServiceSupportIdAndReviewer(
          bookingId,
          currentUserRes.data._id,
        );
      if (res?.success && Array.isArray(res.data)) {
        setRatings(res.data);
      } else {
        setRatings([]);
      }
    } catch (e) {
      console.log(`${TAG}[loadRatings][ERROR]`, e?.message || e);
      setRatings([]);
    }
  }, [bookingId]);

  /**
   * Lấy chi tiết booking
   */
  const loadDetails = useCallback(async () => {
    if (!bookingId) {
      console.log(`${TAG}[loadDetails][ERROR] thiếu bookingId`);
      setLoading(false);
      return;
    }

    console.log(`${TAG}[loadDetails] START bookingId =`, bookingId);

    try {
      setLoading(true);

      const detailRes =
        (await doctorBookingService.getRegistrationDetail?.(bookingId)) || {};
      console.log(`${TAG}[loadDetails] registration detail res =`, detailRes);

      if (detailRes.success && detailRes.data) {
        console.log(
          `${TAG}[loadDetails] registration detail data.status =`,
          detailRes.data.status,
        );
        setBooking(detailRes.data);

        const found = detailRes.data;
        if (found.doctor && (found.beneficiary || found.elderly)) {
          try {
            const convRes =
              await conversationService.getConversationByParticipants(
                found.doctor?._id || found.doctor?.user?._id,
                found.beneficiary?._id ||
                  found.beneficiary?.user?._id ||
                  found.elderly?._id ||
                  found.elderly?.user?._id,
              );
            if (convRes?.success && convRes.data) {
              setConversation(convRes.data);
            } else {
              setConversation(null);
            }
          } catch (e) {
            console.log(
              `${TAG}[loadDetails][conversation][ERROR]`,
              e?.message || e,
            );
            setConversation(null);
          }
        } else {
          setConversation(null);
        }

        console.log(
          `${TAG}[loadDetails] END with booking.status =`,
          detailRes.data.status,
        );
        return;
      }

      // Fallback
      console.log(
        `${TAG}[loadDetails][FALLBACK] dùng getMyBookings vì không lấy được detail theo id`,
      );

      const res = await doctorBookingService.getMyBookings?.();
      console.log(`${TAG}[loadDetails] raw res =`, res);

      if (res?.success && Array.isArray(res.data)) {
        const found = res.data.find(b => String(b._id) === String(bookingId));
        console.log(
          `${TAG}[loadDetails] found booking (fallback).status =`,
          found?.status,
        );

        if (found) {
          setBooking(found);

          if (found.status && found.status !== 'pending') {
            try {
              const convRes =
                await conversationService.getConversationByParticipants(
                  found.doctor?._id,
                  found.elderly?._id,
                );
              if (convRes?.success && convRes.data) {
                setConversation(convRes.data);
              } else {
                setConversation(null);
              }
            } catch (e) {
              console.log(
                `${TAG}[loadDetails][conversation][ERROR][fallback]`,
                e?.message || e,
              );
              setConversation(null);
            }
          } else {
            setConversation(null);
          }
        } else {
          console.log(
            `${TAG}[loadDetails][WARN] Không tìm thấy booking trong danh sách getMyBookings`,
          );
          setBooking(null);
        }
      } else {
        console.log(
          `${TAG}[loadDetails][WARN] getMyBookings không trả về mảng data`,
        );
        setBooking(null);
      }
    } catch (e) {
      console.log(`${TAG}[loadDetails][ERROR]`, e?.message || e);
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    console.log(`${TAG}[useEffect] route.params =`, route?.params);
    loadUserRole();
    loadDetails();
    loadRatings();
  }, [loadUserRole, loadDetails, loadRatings, route?.params]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadUserRole(), loadDetails(), loadRatings()]);
    setRefreshing(false);
  };

  // ====== logic hiển thị ======
  const statusKey = String(booking?.status || 'pending').toLowerCase();
  const statusScheme = statusColors[statusKey] || statusColors.default;

  // raw payment status từ backend
  const paymentStatusRaw =
    booking?.payment?.status || booking?.paymentStatus || 'unpaid';
  let paymentKey = String(paymentStatusRaw || 'unpaid').toLowerCase();

  // chuẩn hoá một số biến thể như "success", "successful"
  if (['success', 'successful'].includes(paymentKey)) {
    paymentKey = 'completed';
  }
  if (['pending'].includes(paymentKey)) {
    paymentKey = 'unpaid';
  }

  // raw method (tiền mặt / online / qr...)
  const paymentMethodRaw =
    booking?.payment?.method || booking?.paymentMethod || 'cash';
  const paymentMethodLower = String(paymentMethodRaw || '').toLowerCase();

  // override: nếu booking đã huỷ nhưng từng thanh toán online rồi
  // → luôn hiển thị "Đã thanh toán"
  const isOnlineMethod = ['qr', 'online', 'bank_transfer', 'bank-transfer'].includes(
    paymentMethodLower,
  );
  const isPaidRaw = ['paid', 'completed', 'success', 'successful'].includes(
    String(paymentStatusRaw || '').toLowerCase(),
  );

  const showRefundNotice = statusKey === 'cancelled' && (isOnlineMethod || isPaidRaw);

  if (statusKey === 'cancelled' && (isOnlineMethod || isPaidRaw)) {
    paymentKey = 'completed';
  }

  const payScheme =
    paymentColors[paymentKey] || paymentColors.unpaid || paymentColors.default;

  const paymentMethodLabel =
    paymentMethodLabelMap[paymentMethodLower] || paymentMethodLabelMap.cash;

  const canCancel =
    ['pending', 'confirmed'].includes(statusKey) &&
    ['elderly', 'family'].includes((userRole || '').toLowerCase());

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
          const merged = {
            ...base,
            ...backendData,
          };
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

  const priceText =
    typeof booking?.price === 'number'
      ? `${booking.price.toLocaleString('vi-VN')} đ`
      : '';

  const dateRaw =
    booking?.consultationDate ||
    booking?.scheduledDate ||
    booking?.packageInfo?.startDate ||
    booking?.startDate ||
    booking?.createdAt;
  const dateLabel = formatDateLongVN(dateRaw);

  const timeRaw =
    booking?.consultationTime ||
    booking?.appointmentTime ||
    booking?.scheduleTime ||
    null;

  const timeDisplay = dateLabel
    ? `${dateLabel}${timeRaw ? `\nLúc ${timeRaw}` : ''}`
    : '—';

  const creatorInfo = resolveCreatorInfo(booking);

  // ==== quyền đánh giá ====
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
    booking && booking.status === 'completed' && isBookingReviewer;

  const openReviewModal = () => {
    setEditingRating(null);
    setRating(0);
    setComment('');
    setReviewModalVisible(true);
  };

  const closeReviewModal = () => {
    if (!submittingReview) {
      setReviewModalVisible(false);
      setEditingRating(null);
    }
  };

  const handleSubmitReview = async () => {
    if (!booking?._id) {
      showToast('Không tìm thấy mã tư vấn để đánh giá.', 'error');
      return;
    }
    if (!currentUser?._id) {
      showToast('Không tìm thấy thông tin người dùng.', 'error');
      return;
    }
    if (!booking?.doctor?._id && !booking?.doctor?.user?._id) {
      showToast('Không tìm thấy thông tin bác sĩ để đánh giá.', 'error');
      return;
    }
    if (!rating) {
      showToast('Vui lòng chọn số sao đánh giá.', 'error');
      return;
    }
    if (submittingReview) return;

    try {
      setSubmittingReview(true);

      let result;

      if (editingRating) {
        // update
        result = await ratingService.updateRatingById(
          editingRating._id,
          rating,
          comment,
        );
      } else {
        const fromUserId = currentUser._id;
        const toUserId = booking.doctor._id || booking.doctor.user._id;

        // ⚠️ dùng cùng serviceType như màn Hỗ trợ để đúng với backend hiện tại
        result = await ratingService.createRating(
          fromUserId,
          toUserId,
          'support_service',
          rating,
          comment,
          bookingId,
        );
      }

      if (!result?.success) {
        console.log(
          `${TAG}[handleSubmitReview][ERROR_RES]`,
          result?.message,
          result,
        );
        showToast(
          result?.message ||
            'Đã có lỗi xảy ra khi gửi đánh giá. Vui lòng thử lại sau.',
          'error',
        );
        return;
      }

      showToast(
        editingRating
          ? 'Bạn đã cập nhật đánh giá.'
          : 'Bạn đã đánh giá dịch vụ tư vấn.',
        'success',
      );

      setReviewModalVisible(false);
      setEditingRating(null);

      await loadRatings();
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

  const onEditRating = r => {
    setEditingRating(r);
    setRating(r.rating);
    setComment(r.comment || '');
    setReviewModalVisible(true);
  };

  const onDeleteRating = r => {
    setDeletingRating(r);
    setDeleteRatingModalVisible(true);
  };

  const closeDeleteRatingModal = () => {
    if (!deletingRatingLoading) {
      setDeleteRatingModalVisible(false);
      setDeletingRating(null);
    }
  };

  const confirmDeleteRating = async () => {
    if (!deletingRating?._id) {
      showToast('Không tìm thấy đánh giá để xóa.', 'error');
      return;
    }

    try {
      setDeletingRatingLoading(true);
      const res = await ratingService.deleteRatingById(deletingRating._id);

      if (!res?.success) {
        showToast(
          res?.message || 'Xóa đánh giá thất bại. Vui lòng thử lại sau.',
          'error',
        );
        return;
      }

      showToast('Đã xóa đánh giá.', 'success');
      await loadRatings();
      setDeleteRatingModalVisible(false);
      setDeletingRating(null);
    } catch (e) {
      console.error(`${TAG}[confirmDeleteRating][ERROR]`, e);
      showToast(
        'Đã có lỗi xảy ra khi xóa đánh giá. Vui lòng thử lại sau.',
        'error',
      );
    } finally {
      setDeletingRatingLoading(false);
    }
  };

  console.log(`${TAG}[render] booking data =`, booking);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết tư vấn</Text>
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
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.card}>
            {/* mã tư vấn + trạng thái */}
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>
                Tư vấn #{booking?._id?.slice(-6) || ''}
              </Text>
              <Chip scheme={statusScheme} text={statusScheme.label} />
            </View>

            {/* Bác sĩ */}
            <AvatarLine
              title="Bác sĩ"
              name={booking?.doctor?.fullName || booking?.doctor?.name}
              role="Bác sĩ"
              avatar={booking?.doctor?.avatar}
            />

            {/* Người cao tuổi */}
            <AvatarLine
              title="Người cao tuổi"
              name={
                booking?.elderly?.fullName ||
                booking?.beneficiary?.fullName ||
                booking?.beneficiary?.name
              }
              role="Người được tư vấn"
              avatar={booking?.elderly?.avatar || booking?.beneficiary?.avatar}
            />

            {/* Người đặt lịch */}
            <AvatarLine
              title="Người đặt lịch"
              name={creatorInfo.name}
              role={creatorInfo.roleLabel}
              avatar={creatorInfo.avatar}
            />

            <View style={{ height: 16 }} />

            <RowItem label="Thời gian tư vấn" value={timeDisplay} />

            <RowItem
              label="Thanh toán"
              value={`${paymentMethodLabel} • ${payScheme.label}`}
              right={<Chip scheme={payScheme} text={payScheme.label} />}
            />

            {priceText ? <RowItem label="Chi phí" value={priceText} /> : null}

            {showRefundNotice && (
              <View style={styles.refundNotice}>
                <Text style={styles.refundNoticeText}>
                  Tiền sẽ được hoàn trả lại trong vòng{' '}
                  <Text style={styles.refundNoticeTextBold}>12h–24h.</Text>
                </Text>
              </View>
            )}

            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionLabel}>Ghi chú</Text>
              <Text style={styles.noteText}>
                {booking?.notes || 'Không có ghi chú'}
              </Text>
            </View>

            {/* nút đánh giá (chưa có rating) */}
            {canReview && ratings.length === 0 && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={openReviewModal}
                style={[styles.primaryBtn, { marginTop: 20 }]}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    Đánh giá người hỗ trợ
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Card hiển thị đánh giá của bạn */}
          {isBookingReviewer && ratings.length > 0 && (
            <View style={[styles.card, { marginTop: 16, padding: 16 }]}>
              <View style={{ marginTop: 20 }}>
                <Text style={styles.sectionLabel}>Đánh giá của bạn</Text>

                {ratings.map((r, index) => (
                  <View key={r._id || index} style={styles.ratingBox}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.ratingScore}>{r.rating} ★</Text>

                      <View style={styles.ratingActions}>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => onEditRating(r)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.editBtnText}>Chỉnh sửa</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => onDeleteRating(r)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.deleteBtnText}>Xóa</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.ratingComment}>
                      {r.comment || 'Không có nhận xét'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {(statusKey === 'confirmed' || statusKey === 'in_progress') &&
            conversation && (
              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 20 }]}
                onPress={goToChat}
              >
                <Text style={styles.primaryBtnText}>Nhắn tin với bác sĩ</Text>
              </TouchableOpacity>
            )}

          {canCancel && (
            <TouchableOpacity
              style={[styles.cancelBtn, { marginTop: 12 }]}
              onPress={() => setConfirmVisible(true)}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.cancelBtnText}>Hủy lịch tư vấn</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
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

      {/* Modal xác nhận xóa đánh giá */}
      <Modal
        transparent
        visible={deleteRatingModalVisible}
        animationType="fade"
        onRequestClose={closeDeleteRatingModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={closeDeleteRatingModal}
        />
        <View style={styles.modalSheetWrap}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Xóa đánh giá</Text>
            <Text style={styles.modalSub}>
              Bạn có chắc chắn muốn xóa đánh giá không?
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={closeDeleteRatingModal}
                disabled={deletingRatingLoading}
                style={[styles.modalBtn, styles.modalBtnGhost]}
              >
                <Text style={styles.modalBtnGhostText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={confirmDeleteRating}
                disabled={deletingRatingLoading}
                style={[styles.modalBtn, styles.modalBtnDanger]}
              >
                {deletingRatingLoading ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.modalBtnDangerText}>Xóa</Text>
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
            <Text style={styles.reviewTitle}>Đánh giá người hỗ trợ</Text>

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

            <Text style={[styles.reviewLabel, { marginTop: 16 }]}>
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
    }),
  }).isRequired,
  navigation: PropTypes.shape({
    goBack: PropTypes.func,
    navigate: PropTypes.func,
  }).isRequired,
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backText: { fontSize: 22, lineHeight: 22, color: '#111827' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
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
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },

  sectionLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  personName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  personSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  itemLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  itemValue: { fontSize: 15, color: '#0F172A', fontWeight: '600' },
  noteText: { fontSize: 14, color: '#334155', marginTop: 4 },

  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  primaryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800' },
  cancelBtn: {
    backgroundColor: '#991B1B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#FFFFFF', fontWeight: '800' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 12, color: '#475569' },
  errorText: {
    fontSize: 15,
    color: '#B91C1C',
    marginBottom: 12,
    textAlign: 'center',
  },

  // Modal & review
  modalBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  modalSheetWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSheet: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginTop: 8,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnGhost: { backgroundColor: '#F8FAFC' },
  modalBtnDanger: { backgroundColor: '#991B1B' },
  modalBtnGhostText: { color: '#0F172A', fontWeight: '700' },
  modalBtnDangerText: { color: '#FFFFFF', fontWeight: '700' },

  // Toast
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
  toastText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },

  // Rating UI
  ratingBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  ratingScore: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
    color: '#B45309',
    fontWeight: '700',
    fontSize: 14,
  },
  ratingComment: {
    marginTop: 10,
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  ratingActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8,
  },
  editBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  deleteBtnText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },

  reviewSheet: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  reviewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 4,
  },
  starTouchable: {
    marginHorizontal: 4,
  },
  commentInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlignVertical: 'top',
    color: '#0F172A',
  },
  reviewBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  reviewSubmitBtn: {
    backgroundColor: '#2563EB',
  },
  reviewSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default DoctorConsultationDetailScreen;
