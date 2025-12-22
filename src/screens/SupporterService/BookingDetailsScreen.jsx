// screens/BookingDetailScreen.jsx
import React, { useEffect, useState, useCallback } from 'react';
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

// ✅ paymentStatus: unpaid | paid | refunded
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
  if (isNaN(d)) return String(iso);

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

  return `${weekday}, ngày ${dd} tháng ${mm} năm ${yyyy}${time}`;
}

// 🔧 format hiển thị thời gian từ startDate và endDate (chỉ ngày, không có giờ)
function renderBookingTime(booking) {
  if (!booking) return '—';
  
  const startDate = booking?.startDate;
  const endDate = booking?.endDate;
  
  if (!startDate || !endDate) return '—';
  
  const startFormatted = formatVNDateLong(startDate);
  const endFormatted = formatVNDateLong(endDate);
  
  // Kiểm tra xem cùng ngày không
  const startDay = new Date(startDate).toLocaleDateString('vi-VN', { timeZone: VN_TZ });
  const endDay = new Date(endDate).toLocaleDateString('vi-VN', { timeZone: VN_TZ });
  
  if (startDay === endDay) {
    // Cùng ngày: chỉ hiển thị ngày
    return startFormatted;
  } else {
    // Khác ngày: hiển thị khoảng ngày
    return `Từ: ${startFormatted}\nĐến: ${endFormatted}`;
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

const RowItem = ({ label, value, right }) => (
  <View style={styles.rowBetween}>
    <View style={{ flex: 1, paddingRight: 10 }}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={styles.itemValue}>{value}</Text>
    </View>
    {right}
  </View>
);

const AvatarLine = ({ title, name, role, avatar }) => (
  <View style={{ marginTop: 16 }}>
    <Text style={styles.sectionLabel}>{title}</Text>
    <View style={styles.row}>
      <Image
        source={{ uri: avatar }}
        resizeMode="cover"
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#E5E7EB',
        }}
      />
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
  // role
  const [userRole, setUserRole] = useState('unknown');

  // === ĐÁNH GIÁ: state cho modal đánh giá ===
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [ratings, setRatings] = useState([]);

  // ➕ state cho edit / delete rating
  const [editingRating, setEditingRating] = useState(null); // null: tạo mới, object: đang sửa

  const [deleteRatingModalVisible, setDeleteRatingModalVisible] =
    useState(false);
  const [deletingRating, setDeletingRating] = useState(null);
  const [deletingRatingLoading, setDeletingRatingLoading] = useState(false);

  // === TOAST: thông báo nhỏ tự ẩn ===
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success'); // success | error
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
        }).start(() => {
          setToastVisible(false);
        });
      }, 1500); // hiện 1.5s rồi ẩn
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
          // Tải conversation (nếu có)
          try {
            const resp =
              await conversationService.getConversationByParticipants(
                res.data.supporter?._id,
                res.data.elderly?._id,
              );
            if (resp?.success && resp?.data) {
              console.log('Conversation 1231', resp.data);
              setConversation(resp.data);
            }
          } catch (e) {
            console.log(
              'Lỗi tải conversation:',
              e?.response?.data || e.message || e,
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
      if (res?.success && Array.isArray(res.data)) {
        console.log(res.data);
        setRatings(res.data);
      } else {
        setRatings([]);
      }
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
            // hoàn thành thì ngắt kết nối supporter - elderly
            try {
              const res = await relationshipService.cancelByElderlyAndFamily(
                booking?.elderly?._id,
                booking?.supporter?._id,
              );
              if (res?.success) {
                console.log('Ngắt kết nối supporter - elderly thành công');
              } else {
                console.log('Ngắt kết nối supporter - elderly thất bại');
              }
            } catch (e) {
              console.log('Lỗi ngắt kết nối supporter - elderly', e);
            }

            // Xóa conversation khi hoàn thành
            if (conversationArg?._id) {
              console.log(conversationArg._id);

              try {
                const res =
                  await conversationService.deleteConversationAndMessages(
                    conversationArg._id,
                  );
                if (res?.success) {
                  setConversation(null);
                }
              } catch (e) {
                console.log('Lỗi xóa conversation', e);
              }
            }
          }

          // ✅ Hủy đặt lịch: xóa conversation + đổi relationship thành cancelled
          if (nextStatus === 'canceled') {
            try {
              // Xóa conversation giữa supporter và elderly
              if (conversationArg?._id) {
                try {
                  await conversationService.deleteConversationAndMessages(
                    conversationArg._id,
                  );
                  setConversation(null);
                  console.log('Xóa conversation supporter - elderly thành công');
                } catch (e) {
                  console.log('Lỗi xóa conversation supporter - elderly', e);
                }
              }

              // Xóa conversation giữa supporter và registrant
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
                  console.log('Xóa conversation supporter - registrant thành công');
                }
              } catch (e) {
                console.log('Lỗi xóa conversation supporter - registrant', e);
              }

              // Đổi relationship với elderly thành cancelled
              try {
                await relationshipService.cancelByElderlyAndFamily(
                  booking?.elderly?._id,
                  booking?.supporter?._id,
                );
                console.log('Đổi relationship supporter - elderly thành cancelled');
              } catch (e) {
                console.log('Lỗi đổi relationship supporter - elderly', e);
              }

              // Đổi relationship với registrant thành cancelled
              try {
                await relationshipService.cancelByElderlyAndFamily(
                  booking?.registrant?._id,
                  booking?.supporter?._id,
                );
                console.log('Đổi relationship supporter - registrant thành cancelled');
              } catch (e) {
                console.log('Lỗi đổi relationship supporter - registrant', e);
              }

              console.log('Hủy lịch: xóa conversation + đổi relationship hoàn thành');
            } catch (e) {
              console.log('Lỗi xử lý hủy lịch', e);
            }
          }

          // tạo kết nối khi accept booking
          if (nextStatus === 'confirmed' && !conversationArg) {
            try {
              const res = await relationshipService.connectSupporterToElderly({
                elderlyId: booking?.elderly?._id,
              });
              if (res?.success) {
                console.log('Tạo kết nối supporter - elderly thành công');
              } else {
                console.log('Tạo kết nối supporter - elderly thất bại');
              }
            } catch (e) {
              console.log('Lỗi tạo kết nối supporter - elderly', e);
            }
          }

          await reloadPage(); // stay on page & refresh UI
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

  const statusKey = (booking?.status || 'default').toLowerCase();
  const statusScheme = statusColors[statusKey] || statusColors.default;

  const payKey = (booking?.paymentStatus || 'default').toLowerCase();
  const payScheme = paymentColors[payKey] || paymentColors.default;
  const isPaid = payKey === 'paid';

  const paymentMethodLabel =
    paymentMethodLabelMap[booking?.paymentMethod] || 'Không rõ';
  const paymentStatusLabel =
    paymentStatusLabelMap[booking?.paymentStatus] || payScheme.label;
  const paymentDisplayText = `${paymentMethodLabel} • ${paymentStatusLabel}`;

  const isSupporter = userRole?.toLowerCase() === 'supporter';
  const isElderly = userRole?.toLowerCase() === 'elderly';
  const isFamily = userRole?.toLowerCase() === 'family';

  // ✅ Chỉ NGƯỜI ĐẶT LỊCH hoặc NGƯỜI HƯỞNG DỊCH VỤ mới được đánh giá
  const isBookingReviewer =
    !!currentUser?._id &&
    (currentUser._id === booking?.elderly?._id ||
      currentUser._id === booking?.registrant?._id);

  // Kiểm tra xem có được phép hủy không (chỉ hủy trước ngày bắt đầu)
  const now = new Date();
  const startDate = booking?.startDate ? new Date(booking.startDate) : null;
  const endDate = booking?.endDate ? new Date(booking.endDate) : null;
  const isBeforeStartDate = startDate ? now < startDate : false;
  
  // Kiểm tra xem ngày hôm nay có phải ngày startDate không (chỉ tiến hành làm việc khi bằng startDate)
  const isSameStartDate = startDate ? 
    (now.toLocaleDateString('vi-VN', { timeZone: VN_TZ }) === 
     startDate.toLocaleDateString('vi-VN', { timeZone: VN_TZ })) : false;
  
  // Kiểm tra xem ngày hôm nay có phải ngày endDate không (chỉ hoàn thành khi bằng endDate)
  const isSameEndDate = endDate ? 
    (now.toLocaleDateString('vi-VN', { timeZone: VN_TZ }) === 
     endDate.toLocaleDateString('vi-VN', { timeZone: VN_TZ })) : false;
  
  const disabledCancelBase = ['canceled', 'completed'].includes(statusKey);
  
  const canCancel =
    isElderly || isFamily
      ? !disabledCancelBase && isBeforeStartDate
      : isSupporter
      ? statusKey === 'pending' && isBeforeStartDate
      : false;

  // Supporter flow buttons
  const canAccept = isSupporter && statusKey === 'pending';
  const canStart = isSupporter && statusKey === 'confirmed' && isSameStartDate;
  const canComplete = isSupporter && statusKey === 'in_progress' && isSameEndDate;

  const priceText =
    typeof booking?.price === 'number'
      ? `${booking.price.toLocaleString('vi-VN')} đ`
      : null;

  // === ĐÁNH GIÁ: điều kiện được phép đánh giá ===
  // ✅ Chỉ người đặt lịch hoặc người hưởng dịch vụ + booking đã hoàn thành
  const canReview =
    booking && booking.status === 'completed' && isBookingReviewer;

  const openReviewModal = () => {
    setEditingRating(null); // tạo mới
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
      showToast('Không tìm thấy mã đặt lịch để đánh giá.', 'error');
      return;
    }
    if (!currentUser?._id) {
      showToast('Không tìm thấy thông tin người dùng.', 'error');
      return;
    }
    if (!booking?.supporter?._id) {
      showToast('Không tìm thấy thông tin người hỗ trợ để đánh giá.', 'error');
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
        // 🔁 cập nhật rating
        result = await ratingService.updateRatingById(
          editingRating._id,
          rating,
          comment,
        );
      } else {
        // 🆕 tạo rating mới
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
      console.error('Lỗi khi xóa đánh giá:', e);
      showToast(
        'Đã có lỗi xảy ra khi xóa đánh giá. Vui lòng thử lại sau.',
        'error',
      );
    } finally {
      setDeletingRatingLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* TOAST nhỏ nhảy xuống rồi tự ẩn */}
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết đặt lịch</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Đang tải chi tiết…</Text>
        </View>
      ) : error ? (
        <ScrollView contentContainerStyle={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadDetails} style={styles.retryBtn}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>
                Lịch hỗ trợ
              </Text>
              <Chip scheme={statusScheme} text={statusScheme.label} />
            </View>

            <AvatarLine
              title="Người hỗ trợ"
              name={booking?.supporter?.fullName}
              role="Vai trò: Người hỗ trợ"
              avatar={booking?.supporter?.avatar}
            />

            <AvatarLine
              title="Người cao tuổi"
              name={booking?.elderly?.fullName}
              role="Vai trò: Người cao tuổi"
              avatar={booking?.elderly?.avatar}
            />

            <AvatarLine
              title="Người đặt lịch"
              name={booking?.registrant?.fullName}
              role="Vai trò: Người đặt lịch"
              avatar={booking?.registrant?.avatar}
            />

            <View style={{ height: 16 }} />

            <RowItem label="Thời gian" value={renderBookingTime(booking)} />
            
            <RowItem 
              label="Địa chỉ hỗ trợ" 
              value={booking?.elderly?.currentAddress || '—'} 
            />

            <RowItem
              label="Thanh toán"
              value={paymentDisplayText}
              right={<Chip scheme={payScheme} text={paymentStatusLabel} />}
            />

            {priceText && (
              <RowItem label="Giá dịch vụ" value={priceText} />
            )}

            {booking?.notes ? (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionLabel}>Ghi chú</Text>
                <Text style={styles.noteText}>{booking.notes}</Text>
              </View>
            ) : (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionLabel}>Ghi chú</Text>
                <Text style={styles.noteText}>Không có ghi chú</Text>
              </View>
            )}

            {/* Thông báo hoàn tiền khi đã thanh toán */}
            {isPaid && booking?.status === 'canceled' && (
              <View style={styles.refundBox}>
                <Text style={styles.refundText}>
                  Tiền sẽ được hoàn trả lại trong vòng{' '}
                  <Text style={{ fontWeight: '700' }}>12h–24h</Text>.
                </Text>
              </View>
            )}

            {/* Nút đánh giá ở màn chi tiết (chỉ người đặt / người hưởng được thấy) */}
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

          {/* Card hiển thị đánh giá của bạn - chỉ hiển thị với người có quyền đánh giá */}
          {isBookingReviewer && ratings.length > 0 && (
            <View style={[styles.card, { marginTop: 16, padding: 16 }]}>
              <View style={{ marginTop: 20 }}>
                <Text style={styles.sectionLabel}>Đánh giá của bạn</Text>

                {ratings.map((r, index) => (
                  <View key={r._id || index} style={styles.ratingBox}>
                    {/* Hàng trên: điểm + nút hành động */}
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

                    {/* Nội dung bình luận */}
                    <Text style={styles.ratingComment}>
                      {r.comment || 'Không có nhận xét'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Hành động theo vai trò + trạng thái */}
          {canAccept || canStart || canComplete || canCancel ? (
            <View
              style={{
                marginTop: 20,
                flexDirection: 'row',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              {canAccept && (
                <>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={onAcceptBooking}
                    disabled={accepting}
                    style={[styles.primaryBtn, accepting && { opacity: 0.6 }]}
                  >
                    {accepting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Nhận lịch</Text>
                    )}
                  </TouchableOpacity>

                  {canCancel && (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={openCancelModal}
                      disabled={cancelling}
                      style={[styles.cancelBtn, cancelling && { opacity: 0.6 }]}
                    >
                      {cancelling ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.cancelBtnText}>
                          Từ chối lịch đặt
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}

              {canStart && (
                <View style={{ flex: 1, flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={onGoToChat}
                    disabled={starting}
                    style={{
                      backgroundColor: '#FFFFFF',
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: 'center',
                      flex: 1,
                      marginRight: 12,
                      borderWidth: 1,
                      borderColor: '#2563EB',
                    }}
                  >
                    {starting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text
                        style={{
                          backgroundColor: 'transparent',
                          color: '#2563EB',
                          fontWeight: '800',
                        }}
                      >
                        Liên hệ
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={onStartWorking}
                    disabled={starting}
                    style={[styles.primaryBtn, starting && { opacity: 0.6 }]}
                  >
                    {starting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        Tiến hành làm việc
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {isSupporter && statusKey === 'confirmed' && !isSameStartDate && (
                <View
                  style={{
                    backgroundColor: '#FEF3C7',
                    borderColor: '#FCD34D',
                    borderWidth: 1,
                    padding: 12,
                    borderRadius: 12,
                    marginTop: 20,
                  }}
                >
                  <Text style={{ color: '#92400E', fontSize: 14 }}>
                    Bạn chỉ có thể tiến hành làm việc vào ngày {startDate ? formatVNDateLong(startDate) : '—'}
                  </Text>
                </View>
              )}

              {isSupporter && statusKey === 'in_progress' && !isSameEndDate && (
                <View
                  style={{
                    backgroundColor: '#FEF3C7',
                    borderColor: '#FCD34D',
                    borderWidth: 1,
                    padding: 12,
                    borderRadius: 12,
                    marginTop: 20,
                  }}
                >
                  <Text style={{ color: '#92400E', fontSize: 14 }}>
                    Bạn chỉ có thể hoàn thành công việc vào ngày {endDate ? formatVNDateLong(endDate) : '—'}
                  </Text>
                </View>
              )}

              {canComplete && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={onCompleteWorking}
                  disabled={completing}
                  style={[styles.primaryBtn, completing && { opacity: 0.6 }]}
                >
                  {completing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      Đã hoàn thành công việc
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Elderly/Family có thể hủy ngoài pending, supporter chỉ hủy khi pending */}
              {!canAccept && canCancel && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={openCancelModal}
                  disabled={cancelling}
                  style={[
                    styles.cancelBtn,
                    { flex: 1 },
                    cancelling && { opacity: 0.6 },
                  ]}
                >
                  {cancelling ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.cancelBtnText}>Hủy đặt lịch</Text>
                  )}
                </TouchableOpacity>
              )}
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
            <Text style={styles.modalTitle}>Xác nhận hủy</Text>
            <Text style={styles.modalSub}>
              Bạn có chắc chắn muốn hủy đặt lịch?
            </Text>

            {isPaid && (
              <View style={styles.refundBox}>
                <Text style={styles.refundText}>
                  Tiền sẽ được hoàn trả lại trong vòng{' '}
                  <Text style={{ fontWeight: '700' }}>12h–24h</Text>.
                </Text>
              </View>
            )}

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
                  <ActivityIndicator />
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
                  <ActivityIndicator />
                ) : (
                  <Text style={styles.modalBtnDangerText}>Xóa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal đánh giá người hỗ trợ */}
      <Modal
        transparent
        visible={reviewModalVisible}
        animationType="fade"
        onRequestClose={closeReviewModal}
      >
        <Pressable style={styles.reviewBackdrop} onPress={closeReviewModal} />
        <View style={styles.reviewSheetWrap} pointerEvents="box-none">
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
  noteText: { fontSize: 14, color: '#334155' },

  refundBox: {
    marginTop: 12,
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  refundText: { color: '#9A3412' },

  // Buttons
  primaryBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800' },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#991B1B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#FFFFFF', fontWeight: '800' },

  // States
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
  retryBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: '#991B1B', fontWeight: '600' },

  // Modal hủy booking / xóa đánh giá
  modalBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSheetWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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

  // Modal đánh giá
  reviewBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewSheetWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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

  // Toast
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#16A34A', // xanh cho success
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
});

export default BookingDetailScreen;
