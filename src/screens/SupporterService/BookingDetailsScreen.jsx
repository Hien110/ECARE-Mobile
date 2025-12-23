// screens/BookingDetailScreen.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  TextInput,
  Animated,
  Platform,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';

import supporterSchedulingService from '../../services/supporterSchedulingService';
import relationshipService from '../../services/relationshipService';
import userService from '../../services/userService';
import conversationService from '../../services/conversationService';
import ratingService from '../../services/ratingService';

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
  canceled: {
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
};

const paymentStatusLabelMap = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  refunded: 'Đã hoàn tiền',
};

function formatVNDateLong(iso, { includeTime = false } = {}) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);

  const fmt = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TZ,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime
      ? { hour: '2-digit', minute: '2-digit', hour12: false }
      : {}),
  });

  const parts = fmt.formatToParts(d).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});

  const weekdayMap = {
    'chủ nhật': 'Chủ nhật',
    'thứ hai': 'Thứ 2',
    'thứ ba': 'Thứ 3',
    'thứ tư': 'Thứ 4',
    'thứ năm': 'Thứ 5',
    'thứ sáu': 'Thứ 6',
    'thứ bảy': 'Thứ 7',
  };

  const wkey = (parts.weekday || '').toLowerCase();
  const weekday = weekdayMap[wkey] || parts.weekday || '';

  const dd = parts.day || '';
  const mm = parts.month || '';
  const yyyy = parts.year || '';
  const time =
    includeTime && parts.hour && parts.minute
      ? ` • ${parts.hour}:${parts.minute}`
      : '';

  return `${weekday}, ngày ${dd}/${mm}/${yyyy}${time}`;
}

function renderBookingTime(booking) {
  if (!booking) return '—';
  const startDate = booking?.startDate;
  const endDate = booking?.endDate;
  if (!startDate || !endDate) return '—';

  const startFormatted = formatVNDateLong(startDate);
  const endFormatted = formatVNDateLong(endDate);

  const startDay = new Date(startDate).toLocaleDateString('vi-VN', {
    timeZone: VN_TZ,
  });
  const endDay = new Date(endDate).toLocaleDateString('vi-VN', {
    timeZone: VN_TZ,
  });

  if (startDay === endDay) return startFormatted;
  return `Từ: ${startFormatted}\nĐến: ${endFormatted}`;
}

/** =========================
 * UI helpers (match mẫu)
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

/** =========================
 * Screen
 * ========================= */
const BookingDetailScreen = ({ route, navigation }) => {
  const bookingId = route?.params?.bookingId;

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [error, setError] = useState(null);

  // action states
  const [cancelling, setCancelling] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('unknown');

  // rating
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [ratings, setRatings] = useState([]);

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

  const showToast = (message, type = 'success') => {
    setToastMessage(message);
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
      }, 1500);
    });
  };

  const loadUserRole = useCallback(async () => {
    try {
      const res = await userService.getUser();
      const role = res?.data?.role || res?.role || 'unknown';
      setUserRole(role);
      setCurrentUser(res?.data || null);
    } catch {
      setUserRole('unknown');
      setCurrentUser(null);
    }
  }, []);

  const loadDetails = useCallback(async () => {
    if (!bookingId) {
      setError('Thiếu mã đặt lịch.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setLoading(true);

      const res = await supporterSchedulingService.getSchedulingById(bookingId);

      if (res?.success && res?.data) {
        setBooking(res.data);

        if (res.data.status !== 'pending') {
          try {
            const resp =
              await conversationService.getConversationByParticipants(
                res.data.supporter?._id,
                res.data.elderly?._id,
              );
            if (resp?.success && resp?.data) setConversation(resp.data);
          } catch (e) {
            console.log(
              'Lỗi tải conversation:',
              e?.response?.data || e?.message || e,
            );
          }
        }
      } else {
        setError('Không thể tải chi tiết đặt lịch.');
      }
    } catch (e) {
      setError('Không thể tải chi tiết đặt lịch.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  const loadRatings = useCallback(async () => {
    if (!bookingId) return;
    try {
      const currentUserRes = await userService.getUser();
      const res = await ratingService.getRatingsByServiceSupportIdAndReviewer(
        bookingId,
        currentUserRes.data._id,
      );
      if (res?.success && Array.isArray(res.data)) setRatings(res.data);
      else setRatings([]);
    } catch {
      setRatings([]);
    }
  }, [bookingId]);

  useEffect(() => {
    loadUserRole();
    loadDetails();
    loadRatings();
  }, [loadUserRole, loadDetails, loadRatings]);

  const reloadPage = useCallback(async () => {
    await loadDetails();
  }, [loadDetails]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadUserRole(), loadDetails(), loadRatings()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadUserRole, loadDetails, loadRatings]);

  const openCancelModal = () => setConfirmVisible(true);
  const closeCancelModal = () => {
    if (!cancelling) setConfirmVisible(false);
  };

  const updateStatus = useCallback(
    async (nextStatus, setBusy, conversationArg) => {
      if (!booking?._id) return;
      try {
        setBusy(true);
        const resp = await supporterSchedulingService.updateSchedulingStatus(
          booking._id,
          nextStatus,
        );

        if (resp?.success) {
          setConfirmVisible(false);

          const checkDoneTask =
            await supporterSchedulingService.checkAllCompletedOrCanceled(
              booking?.supporter?._id,
              booking?.elderly?._id,
            );

          if (nextStatus === 'completed' && checkDoneTask?.data === true) {
            try {
              await relationshipService.cancelByElderlyAndFamily(
                booking?.elderly?._id,
                booking?.supporter?._id,
              );
            } catch (e) {
              console.log('Lỗi ngắt kết nối supporter - elderly', e);
            }

            if (conversationArg?._id) {
              try {
                const res =
                  await conversationService.deleteConversationAndMessages(
                    conversationArg._id,
                  );
                if (res?.success) setConversation(null);
              } catch (e) {
                console.log('Lỗi xóa conversation', e);
              }
            }
          }

          if (nextStatus === 'canceled') {
            try {
              if (conversationArg?._id) {
                try {
                  await conversationService.deleteConversationAndMessages(
                    conversationArg._id,
                  );
                  setConversation(null);
                } catch (e) {
                  console.log('Lỗi xóa conversation supporter - elderly', e);
                }
              }

              try {
                const respConv =
                  await conversationService.getConversationByParticipants(
                    booking?.supporter?._id,
                    booking?.registrant?._id,
                  );
                if (respConv?.success && respConv?.data?._id) {
                  await conversationService.deleteConversationAndMessages(
                    respConv.data._id,
                  );
                }
              } catch (e) {
                console.log('Lỗi xóa conversation supporter - registrant', e);
              }

              try {
                await relationshipService.cancelByElderlyAndFamily(
                  booking?.elderly?._id,
                  booking?.supporter?._id,
                );
              } catch (e) {
                console.log('Lỗi đổi relationship supporter - elderly', e);
              }

              try {
                await relationshipService.cancelByElderlyAndFamily(
                  booking?.registrant?._id,
                  booking?.supporter?._id,
                );
              } catch (e) {
                console.log('Lỗi đổi relationship supporter - registrant', e);
              }
            } catch (e) {
              console.log('Lỗi xử lý hủy lịch', e);
            }
          }

          if (nextStatus === 'confirmed' && !conversationArg) {
            try {
              await relationshipService.connectSupporterToElderly({
                elderlyId: booking?.elderly?._id,
              });
            } catch (e) {
              console.log('Lỗi tạo kết nối supporter - elderly', e);
            }
          }

          await reloadPage();
        }
      } catch (e) {
        console.log(e);
      } finally {
        setBusy(false);
      }
    },
    [booking?._id, booking?.supporter?._id, booking?.elderly?._id, reloadPage],
  );

  const onConfirmCancel = () =>
    updateStatus('canceled', setCancelling, conversation);
  const onAcceptBooking = () =>
    updateStatus('confirmed', setAccepting, conversation);
  const onStartWorking = () =>
    updateStatus('in_progress', setStarting, conversation);
  const onCompleteWorking = () =>
    updateStatus('completed', setCompleting, conversation);

  const onGoToChat = () => {
    if (conversation?._id) {
      const other = conversation?.participants?.find(
        p => p.user?._id !== currentUser?._id,
      );
      navigation.navigate('Chat', {
        conversationId: conversation?._id,
        otherParticipant: other,
      });
    }
  };

  /** =========================
   * Derived UI data
   * ========================= */
  const statusKeyRaw = String(booking?.status || 'default').toLowerCase();
  const statusScheme = statusColors[statusKeyRaw] || statusColors.default;

  const payKeyRaw = String(booking?.paymentStatus || 'default').toLowerCase();
  const payScheme = paymentColors[payKeyRaw] || paymentColors.default;
  const isPaid = payKeyRaw === 'paid';

  const paymentMethodLabel =
    paymentMethodLabelMap[String(booking?.paymentMethod || '').toLowerCase()] ||
    'Không rõ';
  const paymentStatusLabel =
    paymentStatusLabelMap[String(booking?.paymentStatus || '').toLowerCase()] ||
    payScheme.label;

  const paymentDisplayText = `${paymentMethodLabel}`;

  const isSupporter = userRole?.toLowerCase() === 'supporter';
  const isElderly = userRole?.toLowerCase() === 'elderly';
  const isFamily = userRole?.toLowerCase() === 'family';

  const isBookingReviewer =
    !!currentUser?._id &&
    (String(currentUser._id) === String(booking?.elderly?._id) ||
      String(currentUser._id) === String(booking?.registrant?._id));

  const now = new Date();
  const startDate = booking?.startDate ? new Date(booking.startDate) : null;
  const endDate = booking?.endDate ? new Date(booking.endDate) : null;

  const isBeforeStartDate = startDate ? now < startDate : false;

  const isSameStartDate = startDate
    ? now.toLocaleDateString('vi-VN', { timeZone: VN_TZ }) ===
      startDate.toLocaleDateString('vi-VN', { timeZone: VN_TZ })
    : false;

  const isSameEndDate = endDate
    ? now.toLocaleDateString('vi-VN', { timeZone: VN_TZ }) ===
      endDate.toLocaleDateString('vi-VN', { timeZone: VN_TZ })
    : false;

  const disabledCancelBase = ['canceled', 'completed'].includes(statusKeyRaw);

  const canCancel =
    isElderly || isFamily
      ? !disabledCancelBase && isBeforeStartDate
      : isSupporter
      ? statusKeyRaw === 'pending' && isBeforeStartDate
      : false;

  const canAccept = isSupporter && statusKeyRaw === 'pending';
  const canStart =
    isSupporter && statusKeyRaw === 'confirmed' && isSameStartDate;
  const canComplete =
    isSupporter && statusKeyRaw === 'in_progress' && isSameEndDate;

  const priceText =
    typeof booking?.price === 'number'
      ? `${booking.price.toLocaleString('vi-VN')} đ`
      : null;

  const canReview =
    booking && booking.status === 'completed' && isBookingReviewer;

  const timeDisplay = booking ? renderBookingTime(booking) : '—';
  const headerSub = booking ? timeDisplay.replace('\n', ' • ') : ' ';

  /** =========================
   * Rating actions
   * ========================= */
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
    if (!booking?._id)
      return showToast('Không tìm thấy mã đặt lịch để đánh giá.', 'error');
    if (!currentUser?._id)
      return showToast('Không tìm thấy thông tin người dùng.', 'error');
    if (!booking?.supporter?._id)
      return showToast(
        'Không tìm thấy thông tin người hỗ trợ để đánh giá.',
        'error',
      );
    if (!rating) return showToast('Vui lòng chọn số sao đánh giá.', 'error');
    if (submittingReview) return;

    try {
      setSubmittingReview(true);

      let result;
      if (editingRating) {
        result = await ratingService.updateRatingById(
          editingRating._id,
          rating,
          comment,
        );
      } else {
        const fromUserId = currentUser._id;
        const toUserId = booking.supporter._id;

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
          : 'Bạn đã đánh giá người hỗ trợ.',
        'success',
      );

      setReviewModalVisible(false);
      setEditingRating(null);

      await loadRatings();
    } catch (error) {
      console.error('Lỗi khi gửi/cập nhật đánh giá:', error);
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
    if (!deletingRating?._id)
      return showToast('Không tìm thấy đánh giá để xóa.', 'error');

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
      console.error('Lỗi khi xóa đánh giá:', e);
      showToast(
        'Đã có lỗi xảy ra khi xóa đánh giá. Vui lòng thử lại sau.',
        'error',
      );
    } finally {
      setDeletingRatingLoading(false);
    }
  };

  /** =========================
   * Action bar (giống mẫu)
   * ========================= */
  const primaryActions = useMemo(() => {
    if (!booking) return [];

    const actions = [];

    // Supporter actions
    if (canAccept) {
      actions.push({
        key: 'accept',
        label: 'Nhận lịch',
        type: 'primary',
        onPress: onAcceptBooking,
        loading: accepting,
      });
      if (canCancel) {
        actions.push({
          key: 'reject',
          label: 'Từ chối lịch đặt',
          type: 'danger',
          onPress: openCancelModal,
          loading: cancelling,
        });
      }
      return actions;
    }

    if (canStart) {
      actions.push({
        key: 'contact',
        label: 'Liên hệ',
        type: 'secondary',
        onPress: onGoToChat,
      });
      actions.push({
        key: 'start',
        label: 'Tiến hành làm việc',
        type: 'primary',
        onPress: onStartWorking,
        loading: starting,
      });
      return actions;
    }

    if (canComplete) {
      actions.push({
        key: 'complete',
        label: 'Đã hoàn thành công việc',
        type: 'primary',
        onPress: onCompleteWorking,
        loading: completing,
      });
      return actions;
    }

    // Elderly/Family cancel
    if (!canAccept && canCancel) {
      actions.push({
        key: 'cancel',
        label: 'Hủy đặt lịch',
        type: 'danger',
        onPress: openCancelModal,
        loading: cancelling,
      });
    }

    return actions;
  }, [
    booking,
    canAccept,
    canCancel,
    canStart,
    canComplete,
    accepting,
    cancelling,
    starting,
    completing,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Toast */}
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

      {/* Header giống mẫu */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.85}
        >
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Chi tiết đặt lịch</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {booking ? headerSub : ' '}
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Đang tải…</Text>
        </View>
      ) : error ? (
        <ScrollView contentContainerStyle={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadDetails} style={styles.retryBtn}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : !booking ? (
        <ScrollView contentContainerStyle={styles.center}>
          <Text style={styles.errorText}>Không tìm thấy đặt lịch.</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Quay lại</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Tổng quan */}
          <SectionCard
            title="Tổng quan"
            right={<Chip scheme={statusScheme} text={statusScheme.label} />}
          >
            <RowItem
              label="Thời gian hỗ trợ"
              value={timeDisplay}
              icon={<Feather name="calendar" size={16} color="#64748B" />}
            />
            <Divider />

            <RowItem
              label="Địa chỉ hỗ trợ"
              value={booking?.elderly?.currentAddress || '—'}
              icon={<Feather name="map-pin" size={16} color="#64748B" />}
            />
            <Divider />

            <RowItem
              label="Thanh toán"
              value={paymentDisplayText}
              icon={<Feather name="credit-card" size={16} color="#64748B" />}
              right={<Chip scheme={payScheme} text={paymentStatusLabel} />}
            />

            {priceText ? (
              <>
                <Divider />
                <RowItem
                  label="Giá dịch vụ"
                  value={priceText}
                  icon={<Feather name="tag" size={16} color="#64748B" />}
                />
              </>
            ) : null}

            {/* Hoàn tiền (giống mẫu tư vấn) */}
            {isPaid && booking?.status === 'canceled' ? (
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

          {/* Thông tin người liên quan */}
          <SectionCard title="Thông tin người liên quan">
            <AvatarLine
              title="Người hỗ trợ"
              name={booking?.supporter?.fullName}
              role="Người hỗ trợ"
              avatar={booking?.supporter?.avatar}
            />

            <AvatarLine
              title="Người cao tuổi"
              name={booking?.elderly?.fullName}
              role="Người được hỗ trợ"
              avatar={booking?.elderly?.avatar}
              // nếu bạn có màn lịch sử hỗ trợ thì bật:
              showHistoryButton={false}
            />

            <AvatarLine
              title="Người đặt lịch"
              name={booking?.registrant?.fullName}
              role="Người thân đặt lịch"
              avatar={booking?.registrant?.avatar}
            />
          </SectionCard>

          {/* Ghi chú */}
          <SectionCard title="Ghi chú">
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                {booking?.notes ? booking.notes : 'Không có ghi chú'}
              </Text>
            </View>
          </SectionCard>

          {/* Đánh giá */}
          <SectionCard title="Đánh giá">
            {canReview && ratings.length === 0 ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={openReviewModal}
                style={[styles.actionBtn, { marginTop: 6 }]}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>
                    Đánh giá người hỗ trợ
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}

            {isBookingReviewer && ratings.length > 0 ? (
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
                      {ratings?.[0]?.rating || 0} ★
                    </Text>
                  </View>
                </View>

                <Text style={styles.ratingComment}>
                  {ratings?.[0]?.comment
                    ? ratings[0].comment
                    : 'Không có nhận xét'}
                </Text>

                <View style={styles.ratingActionsRow}>
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => onEditRating(ratings[0])}
                    activeOpacity={0.85}
                  >
                    <Feather name="edit-2" size={14} color="#334155" />
                    <Text style={styles.smallBtnText}>Chỉnh sửa</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.smallBtn, styles.smallBtnDanger]}
                    onPress={() => onDeleteRating(ratings[0])}
                    activeOpacity={0.85}
                    disabled={deletingRatingLoading}
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

          {/* cảnh báo ngày (giữ logic cũ) */}
          {isSupporter && statusKeyRaw === 'confirmed' && !isSameStartDate ? (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>
                Bạn chỉ có thể tiến hành làm việc vào ngày{' '}
                {startDate ? formatVNDateLong(startDate) : '—'}
              </Text>
            </View>
          ) : null}

          {isSupporter && statusKeyRaw === 'in_progress' && !isSameEndDate ? (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>
                Bạn chỉ có thể hoàn thành công việc vào ngày{' '}
                {endDate ? formatVNDateLong(endDate) : '—'}
              </Text>
            </View>
          ) : null}

          {/* Action bar (dạng sticky giả: đặt cuối content) */}
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
                ];

                return (
                  <TouchableOpacity
                    key={a.key}
                    style={btnStyle}
                    onPress={a.onPress}
                    activeOpacity={0.9}
                    disabled={a.loading}
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
      )}

      {/* Modal xác nhận hủy booking */}
      <Modal
        transparent
        visible={confirmVisible}
        animationType="fade"
        onRequestClose={closeCancelModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeCancelModal} />
        <View style={styles.modalSheetWrap} pointerEvents="box-none">
          <View style={styles.modalSheet}>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={styles.modalIconDanger}>
                <Feather name="x-circle" size={20} color="#FFFFFF" />
              </View>
            </View>

            <Text style={styles.modalTitle}>Xác nhận hủy</Text>
            <Text style={styles.modalSub}>
              Bạn có chắc chắn muốn hủy đặt lịch?
            </Text>

            {isPaid ? (
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

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={closeCancelModal}
                disabled={cancelling}
                style={[styles.modalBtn, styles.modalBtnGhost]}
              >
                <Text style={styles.modalBtnGhostText}>Không</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onConfirmCancel}
                disabled={cancelling}
                style={[styles.modalBtn, styles.modalBtnDanger]}
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
        <View style={styles.modalSheetWrap} pointerEvents="box-none">
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
                  <ActivityIndicator color="#fff" />
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
        <View style={styles.modalSheetWrap} pointerEvents="box-none">
          <View style={styles.reviewSheet}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>Đánh giá người hỗ trợ</Text>
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
                  <Text style={styles.reviewSubmitText}>
                    {editingRating ? 'Cập nhật' : 'Gửi đánh giá'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

/** =========================
 * Styles (match mẫu tư vấn)
 * ========================= */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },

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
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  headerSub: { marginTop: 2, fontSize: 12, color: '#64748B' },

  scrollContent: { padding: 16, paddingBottom: 24 },

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

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 160,
  },
  chipText: { fontSize: 12, fontWeight: '800' },

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
  alertTitle: { fontSize: 12, fontWeight: '900', color: '#1D4ED8' },
  alertText: {
    fontSize: 13,
    color: '#1D4ED8',
    lineHeight: 19,
    fontWeight: '600',
  },

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

  // Action bar
  actionBar: {
    paddingTop: 12,
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

  // Loading/Error
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
  retryBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: '#991B1B', fontWeight: '700' },

  // Fallback primary
  primaryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },

  // Modal (giống mẫu)
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

  // Review modal
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
  toastText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  // Warning box
  warnBox: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  warnText: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});

export default BookingDetailScreen;
