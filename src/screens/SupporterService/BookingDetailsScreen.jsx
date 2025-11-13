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
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import supporterSchedulingService from '../../services/supporterSchedulingService';
import relationshipService from '../../services/relationshipService';
import userService from '../../services/userService';
import conversationService from '../../services/conversationService';

const VN_TZ = 'Asia/Ho_Chi_Minh';

const SESSION_SLOTS = ['morning', 'afternoon', 'evening'];

const scheduleTimeMap = {
  morning: 'Buổi sáng: 8h–12h',
  afternoon: 'Buổi chiều: 13h–17h',
  evening: 'Buổi tối: 18h–21h',
};

const bookingTypeLabelMap = {
  session: 'Theo buổi',
  day: 'Theo ngày',
  month: 'Theo tháng',
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

// 🔧 format hiển thị thời gian theo bookingType + field mới
function renderBookingTime(booking) {
  if (!booking) return '—';
  const type = booking.bookingType || 'session';

  if (type === 'session') {
    const date = formatVNDateLong(booking.scheduleDate);
    const timeLabel = booking.scheduleTime
      ? scheduleTimeMap[booking.scheduleTime] || booking.scheduleTime
      : '';
    if (date && timeLabel) return `${date}\n${timeLabel}`;
    if (date) return date;
    if (timeLabel) return timeLabel;
    return '—';
  }

  if (type === 'day') {
    const date = formatVNDateLong(booking.scheduleDate);
    return date || '—';
  }

  if (type === 'month') {
    const start = booking.monthStart
      ? formatVNDateLong(booking.monthStart)
      : '';
    const end = booking.monthEnd ? formatVNDateLong(booking.monthEnd) : '';
    const range = start && end ? `${start}\nđến\n${end}` : start || end || '';
    const sessions =
      Array.isArray(booking.monthSessionsPerDay) &&
      booking.monthSessionsPerDay.length
        ? `Buổi trong ngày: ${booking.monthSessionsPerDay
            .map(s => scheduleTimeMap[s] || s)
            .join(', ')}`
        : '';
    return [range, sessions].filter(Boolean).join('\n');
  }

  return '—';
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

  useEffect(() => {
    loadUserRole();
    loadDetails();
  }, [loadUserRole, loadDetails]);

  const reloadPage = useCallback(async () => {
    await loadDetails();
  }, [loadDetails]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadUserRole(), loadDetails()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadUserRole, loadDetails]);

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

            console.log('conversation xin chào', conversationArg);

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

  // Elderly/Family: hủy giống cũ (trừ khi canceled/completed/in_progress)
  const disabledCancelBase = ['canceled', 'completed', 'in_progress'].includes(
    statusKey,
  );
  const canCancel =
    isElderly || isFamily
      ? !disabledCancelBase
      : isSupporter
      ? statusKey === 'pending'
      : false;

  // Supporter flow buttons
  const canAccept = isSupporter && statusKey === 'pending';
  const canStart = isSupporter && statusKey === 'confirmed';
  const canComplete = isSupporter && statusKey === 'in_progress';

  const bookingTypeLabel =
    bookingTypeLabelMap[booking?.bookingType] || 'Không xác định';

  const priceText =
    typeof booking?.priceAtBooking === 'number'
      ? `${booking.priceAtBooking.toLocaleString('vi-VN')} đ`
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          // Điều hướng về trang list đặt lịch
          onPress={() => navigation.navigate('SupporterBookingListScreen')}
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
                Đặt lịch #{booking?._id?.slice(-6) || ''}
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
              name={booking?.createdBy?.fullName}
              role="Vai trò: Người đặt lịch"
              avatar={booking?.createdBy?.avatar}
            />

            <View style={{ height: 16 }} />

            <RowItem label="Loại đặt lịch" value={bookingTypeLabel} />

            <RowItem
              label="Thời gian"
              value={renderBookingTime(booking)}
            />

            <RowItem
              label="Địa chỉ hỗ trợ"
              value={`${booking?.address || '—'}`}
            />

            <RowItem
              label="Thanh toán"
              value={paymentDisplayText}
              right={
                <Chip
                  scheme={payScheme}
                  text={paymentStatusLabel}
                />
              }
            />

            {priceText && (
              <RowItem
                label="Giá tại thời điểm đặt"
                value={priceText}
              />
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

            {booking?.status === 'canceled' && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionLabel}>Lý do hủy</Text>
                <Text style={styles.noteText}>
                  {booking.cancelReason || 'Không có lý do'}
                </Text>
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
          </View>

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

      {/* Modal xác nhận hủy */}
      <Modal
        transparent
        visible={confirmVisible}
        animationType="fade"
        onRequestClose={closeCancelModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeCancelModal} />
        <View style={styles.modalSheetWrap} pointerEvents="box-none">
          <View style={styles.modalSheet}>
            <View style={styles.modalGrabber} />
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

  // Modal
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
  modalGrabber: { display: 'none' },
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
});

export default BookingDetailScreen;
