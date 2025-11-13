import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  StatusBar,
  Modal,
  TextInput, // ✅ THÊM
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import userService from '../../services/userService';
import supporterServicesService from '../../services/supporterServicesService';
import supporterSchedulingService from '../../services/supporterSchedulingService';

const PaymentBookingScreen = ({ navigation, route }) => {
  const { supporter, bookingDraft, user } = route.params || {};
  const [userBooking, setUserBooking] = useState();
  const [method, setMethod] = useState(null); // 'cash' | 'online'
  const [service, setService] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [note, setNote] = useState(''); // ✅ Ghi chú của người đặt lịch

  console.log('User in PaymentBookingScreen:', user);
  console.log('Booking Draft in PaymentBookingScreen:', bookingDraft);
  console.log('Supporter in PaymentBookingScreen:', supporter);

  useEffect(() => {
    const fetchUserBooking = async () => {
      const profileRes = await userService.getUser();
      if (profileRes.success) {
        console.log('User booking', profileRes.data);
        setUserBooking(profileRes.data);
      }
    };

    const fetchSupporterServices = async () => {
      if (!bookingDraft?.serviceId) return;
      const data = await supporterServicesService.getServiceById(
        bookingDraft.serviceId,
      );
      console.log(
        'Supporter service data:',
        data.data.byMonth?.sessionsPerDay,
      );
      setService(data.data);
    };

    fetchUserBooking();
    fetchSupporterServices();
  }, [bookingDraft?.serviceId]);

  const handleConfirm = async () => {
    if (!method) {
      Alert.alert(
        'Chưa chọn hình thức',
        'Vui lòng chọn phương thức thanh toán',
      );
      return;
    }

    try {
      const schedulingData = {
        supporter: supporter.user._id,
        elderly: user._id,
        createdBy: userBooking._id,
        service: bookingDraft.serviceId,
        address: user.currentAddress,
        notes: note?.trim() || '', // ✅ Lưu ghi chú từ input
        paymentStatus: 'unpaid', // 'unpaid'|'paid'|'refunded'
        paymentMethod: method === 'online' ? 'bank_transfer' : 'cash', // ✅ khớp model
        bookingType: bookingDraft?.packageType, // 'session'|'day'|'month'
        scheduleDate:
          bookingDraft?.session?.date || bookingDraft?.day?.date || null,
        scheduleTime: bookingDraft?.session?.slot || null,
        monthStart: bookingDraft?.month?.start || null,
        monthEnd: bookingDraft?.month?.end || null,
        monthSessionsPerDay: service?.byMonth?.sessionsPerDay || [],
        priceAtBooking: bookingDraft?.priceAtBooking || undefined,
      };

      console.log('schedulingData:', schedulingData);
      const res = await supporterSchedulingService.createScheduling(
        schedulingData,
      );
      console.log('createScheduling res:', res);

      if (method === 'cash') {
        // hiển thị modal custom
        setShowSuccessModal(true);
      } else {
        // online: vẫn dùng Alert đơn giản (bạn có thể đổi thành modal khác nếu muốn)
        Alert.alert('Xác nhận', 'Thanh toán online đã được ghi nhận (demo).');
      }
    } catch (err) {
      console.error('createScheduling error:', err);
      Alert.alert('Lỗi', 'Không thể tạo lịch hỗ trợ. Vui lòng thử lại.');
    }
  };

  const handleGoHome = () => {
    setShowSuccessModal(false);
    navigation.navigate('FamilyMemberHome');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#2563eb" barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thanh toán dịch vụ</Text>
        </View>

        {/* Thông tin cơ bản */}
        <View style={styles.section}>
          <Text style={styles.label}>Người hỗ trợ:</Text>
          <Text style={styles.value}>{supporter?.name || 'Không rõ'}</Text>

          <Text style={styles.label}>Người được hỗ trợ:</Text>
          <Text style={styles.value}>{user?.fullName || 'Không rõ'}</Text>

          <Text style={styles.label}>Địa chỉ hỗ trợ:</Text>
          <Text style={styles.value}>{user?.currentAddress || 'Không rõ'}</Text>

          <Text style={styles.label}>Dịch vụ:</Text>
          <Text style={styles.value}>
            {bookingDraft?.serviceName || 'Không rõ'}
          </Text>

          <Text style={styles.label}>Loại thuê:</Text>
          <Text style={styles.value}>
            Thuê
            {bookingDraft?.session !== undefined
              ? ' theo ca'
              : bookingDraft?.day !== undefined
              ? ' theo ngày'
              : bookingDraft?.month !== undefined
              ? ' theo tháng'
              : ' Không rõ'}
          </Text>

          {bookingDraft.session !== undefined && (
            <View>
              <Text style={styles.label}>Ngày hỗ trợ:</Text>
              <Text style={styles.value}>
                {new Date(bookingDraft?.session?.date).toLocaleDateString(
                  'vi-VN',
                  {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  },
                )}
              </Text>

              <Text style={styles.label}>Ca làm việc:</Text>
              <Text style={styles.value}>
                {bookingDraft?.session?.slot === 'morning'
                  ? 'Buổi sáng'
                  : bookingDraft?.session?.slot === 'afternoon'
                  ? 'Buổi chiều'
                  : 'Buổi tối'}
              </Text>
            </View>
          )}

          {bookingDraft.day !== undefined && (
            <View>
              <Text style={styles.label}>Ngày hỗ trợ:</Text>
              <Text style={styles.value}>
                {new Date(bookingDraft?.day.date).toLocaleDateString('vi-VN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
          )}

          {bookingDraft.month !== undefined && (
            <View>
              <Text style={styles.label}>Ngày bắt đầu hỗ trợ:</Text>
              <Text style={styles.value}>
                {new Date(bookingDraft?.month.start).toLocaleDateString(
                  'vi-VN',
                  {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  },
                )}
              </Text>
              <Text style={styles.label}>Ngày kết thúc hỗ trợ:</Text>
              <Text style={styles.value}>
                {new Date(bookingDraft?.month.end).toLocaleDateString('vi-VN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
          )}

          <Text style={styles.label}>Giá dịch vụ:</Text>
          <Text style={[styles.value, { color: '#16a34a', fontWeight: '700' }]}>
            {bookingDraft?.priceAtBooking?.toLocaleString('vi-VN')} ₫
          </Text>

          {/* ✅ Ô nhập ghi chú */}
          <Text style={[styles.label, { marginTop: 10 }]}>Ghi chú cho người hỗ trợ (không bắt buộc):</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Ví dụ: Bố hơi khó ngủ, nhớ nhắc uống thuốc lúc 9h…"
            placeholderTextColor="#94a3b8"
            multiline
            value={note}
            onChangeText={setNote}
          />
        </View>

        {/* Chọn phương thức */}
        <Text style={styles.sectionTitle}>Chọn phương thức thanh toán</Text>
        <View style={styles.paymentOptions}>
          <TouchableOpacity
            style={[styles.option, method === 'cash' && styles.optionActive]}
            onPress={() => setMethod('cash')}
          >
            <Icon
              name="cash-outline"
              size={28}
              color={method === 'cash' ? '#fff' : '#2563eb'}
            />
            <Text
              style={[
                styles.optionText,
                method === 'cash' && styles.optionTextActive,
              ]}
            >
              Tiền mặt
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, method === 'online' && styles.optionActive]}
            onPress={() => setMethod('online')}
          >
            <Icon
              name="qr-code-outline"
              size={28}
              color={method === 'online' ? '#fff' : '#2563eb'}
            />
            <Text
              style={[
                styles.optionText,
                method === 'online' && styles.optionTextActive,
              ]}
            >
              Online
            </Text>
          </TouchableOpacity>
        </View>

        {/* QR hiển thị khi chọn online */}
        {method === 'online' && (
          <View style={styles.qrContainer}>
            <Text style={styles.qrLabel}>Quét mã QR để thanh toán</Text>
            <Image
              source={{
                uri: 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=PAYMENT_TEST_12345',
              }}
              style={styles.qrImage}
            />
            <Text style={styles.note}>
              * Đây là mã QR minh hoạ để test giao diện
            </Text>
          </View>
        )}

        {/* Nút xác nhận */}
        <TouchableOpacity style={styles.btnConfirm} onPress={handleConfirm}>
          <Text style={styles.btnConfirmText}>Xác nhận thanh toán</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal thông báo thành công cho phương thức tiền mặt */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Icon name="checkmark-circle" size={60} color="#22c55e" />
            </View>
            <Text style={styles.modalTitle}>Đặt lịch thành công</Text>
            <Text style={styles.modalMessage}>
              Tiền dịch vụ sẽ được thu sau khi dịch vụ hỗ trợ hoàn thành.
            </Text>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleGoHome}
            >
              <Text style={styles.modalButtonText}>Về trang chủ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default PaymentBookingScreen;

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { paddingBottom: 40 },
  header: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  section: {
    backgroundColor: '#fff',
    margin: 14,
    padding: 14,
    borderRadius: 10,
    elevation: 2,
  },
  label: { fontSize: 14, color: '#475569', marginTop: 6 },
  value: { fontSize: 15, color: '#0f172a', fontWeight: '600' },

  sectionTitle: {
    marginHorizontal: 14,
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  paymentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 14,
    marginHorizontal: 10,
  },
  option: {
    width: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2563eb',
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  optionActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  optionText: { fontSize: 15, fontWeight: '600', color: '#2563eb' },
  optionTextActive: { color: '#fff' },

  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 14,
    padding: 20,
    borderRadius: 10,
    elevation: 1,
  },
  qrLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 10,
  },
  qrImage: { width: 220, height: 220, marginBottom: 10 },
  note: { fontSize: 12, color: '#64748b' },

  btnConfirm: {
    backgroundColor: '#2563eb',
    marginHorizontal: 14,
    marginTop: 20,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14,
  },
  btnConfirmText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Input ghi chú
  noteInput: {
    marginTop: 6,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
    textAlignVertical: 'top',
    backgroundColor: '#f9fafb',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  modalIconWrap: {
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#022c22',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    minWidth: '70%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
