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

import { PayOSService } from "../../services/payosService";
import QRCodeSVG from 'react-native-qrcode-svg';

const PaymentBookingScreen = ({ navigation, route }) => {
  const { supporter, bookingDraft, user } = route.params || {};
  const [userBooking, setUserBooking] = useState();
  const [method, setMethod] = useState(null); // 'cash' | 'online'
  const [service, setService] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showBankInfoModal, setShowBankInfoModal] = useState(false);
  const [note, setNote] = useState(''); // ✅ Ghi chú của người đặt lịch
  const [orderCode, setOrderCode] = useState(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrUrl, setQrUrl] = useState(null);
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    const fetchUserBooking = async () => {
      const profileRes = await userService.getUser();
      if (profileRes.success) {
        setUserBooking(profileRes.data);
      }
    };

    const fetchSupporterServices = async () => {
      if (!bookingDraft?.serviceId) return;
      const data = await supporterServicesService.getServiceById(
        bookingDraft.serviceId,
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

    if (!userBooking) {
      Alert.alert("Thông báo", "Không tìm thấy thông tin người dùng.");
      return;
    }

    if (method === 'online' && !qrCode) {
      Alert.alert(
        'Chưa có mã QR',
        'Vui lòng đợi mã QR được tạo trước khi xác nhận thanh toán online.',
      );
      return;
    }

    if (method === 'online') {
      const paymentSuccess = await checkPaymentStatus();
      if (!paymentSuccess) {
        Alert.alert(
          'Thanh toán chưa hoàn tất',
          'Vui lòng hoàn tất thanh toán trước khi xác nhận.',
        );
        return;
      }
    }

    try {
      const schedulingData = {
        supporter: supporter.user._id,
        elderly: user._id,
        registrant: userBooking._id,
        service: bookingDraft.serviceId,
        startDate: bookingDraft.startDate,  // ✅ Sử dụng từ bookingDraft
        endDate: bookingDraft.endDate,      // ✅ Sử dụng từ bookingDraft
        notes: note?.trim() || '',
        paymentMethod: method === 'online' ? 'bank_transfer' : 'cash',
        paymentStatus: method === 'online' ? 'paid' : 'unpaid',
        price: bookingDraft?.priceAtBooking || 0,
      };

      const res = await supporterSchedulingService.createScheduling(
        schedulingData,
      );

      if (method === 'cash') {
        // hiển thị modal custom
        setShowSuccessModal(true);
      } else {
        // online: vẫn dùng Alert đơn giản (bạn có thể đổi thành modal khác nếu muốn)
        setShowSuccessModal(true);

      }
    } catch (err) {
      console.error('createScheduling error:', err);
      Alert.alert('Lỗi', 'Không thể tạo lịch hỗ trợ. Vui lòng thử lại.');
    }
  };

  // Tạo QR khi chọn phương thức online 25/11/2025
  useEffect(() => {
    const fetchPayOSAndGenerateQR = async () => {
      setLoadingQR(true);
      setQrError("");
      try {
        // sinh orderCode ngẫu nhiên
        const newOrderCode =
          (Date.now() % 10_000_000_000_000) + Math.floor(Math.random() * 10_000);

        const paymentData = {
          orderCode: newOrderCode,
          amount: bookingDraft?.priceAtBooking || 0, // dùng tổng đã chuẩn hoá
          description: `Thanh toán dịch vụ hỗ trợ'}`,
          returnUrl: "https://your-app-url.com/payment-success", // Thay thế URL phù hợp
          cancelUrl: "https://your-app-url.com/payment-cancel", // Thay thế URL phù hợp
        };

        const result = await PayOSService.createPayment(paymentData);
        setQrCode(result.qrCode);
        setOrderCode(newOrderCode);

      } catch (error) {
        setQrUrl(null);
        setQrError(error?.message || "Không thể tạo thanh toán.");
        console.error("Error creating payment or generating QR:", error);
      } finally {
        setLoadingQR(false);
      }
    };

    if (bookingDraft && method === 'online' && bookingDraft?.priceAtBooking > 0) {
      fetchPayOSAndGenerateQR();
    }
  }, [bookingDraft, method]);

  // Check thanh toán PayOS 25/11/2025
  const checkPaymentStatus = async () => {
    try {
      const statusRes = await PayOSService.verifyPayment(orderCode);
      return statusRes.status === 'PAID';
    } catch (error) {
      console.error("Error verifying payment status:", error);
      return false;
    }
  };

  const handleSelectOnline = async () => {
    try {
      const response = await userService.getUserInfo();
      if (response?.success && response?.data) {
        const userData = response.data;
        if (userData.bankName && userData.bankAccountNumber) {
          // Có đủ thông tin ngân hàng, cho phép chọn
          setUserBooking(userData);
          setMethod('online');
        } else {
          // Thiếu thông tin ngân hàng, hiển thị modal yêu cầu cập nhật
          setShowBankInfoModal(true);
        }
      } else {
        setShowBankInfoModal(true);
      }
    } catch (error) {
      console.error('Error checking bank info:', error);
      setShowBankInfoModal(true);
    }
  };

  const handleGoHome = () => {
  setShowSuccessModal(false);

  // Ưu tiên role lấy từ userBooking (getUser), fallback sang user từ route
  const role = userBooking?.role || user?.role;

  if (role === 'elderly') {
    // Trang chủ người cao tuổi
    navigation.navigate('ElderHome');
  } else if (role === 'family') {
    // Trang chủ người thân
    navigation.navigate('FamilyMemberHome');
  } else {
    // Nếu không rõ role thì quay lại màn trước cho an toàn
    navigation.goBack();
  }
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

          <Text style={styles.label}>Thời hạn:</Text>
          <Text style={styles.value}>
            {bookingDraft?.numberOfDays || 0} ngày
          </Text>

          <Text style={styles.label}>Ngày bắt đầu:</Text>
          <Text style={styles.value}>
            {bookingDraft?.startDate
              ? new Date(bookingDraft.startDate).toLocaleDateString('vi-VN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Không rõ'}
          </Text>

          <Text style={styles.label}>Ngày kết thúc:</Text>
          <Text style={styles.value}>
            {bookingDraft?.endDate
              ? new Date(bookingDraft.endDate).toLocaleDateString('vi-VN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Không rõ'}
          </Text>

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
              style={[styles.optionText, method === 'cash' && styles.optionTextActive]}
            >
              Tiền mặt
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, method === 'online' && styles.optionActive]}
            onPress={handleSelectOnline}
          >
            <Icon
              name="qr-code-outline"
              size={28}
              color={method === 'online' ? '#fff' : '#2563eb'}
            />
            <Text
              style={[styles.optionText, method === 'online' && styles.optionTextActive]}
            >
              Online
            </Text>
          </TouchableOpacity>
        </View>

        {/* QR hiển thị khi chọn online */}
        {method === 'online' && (
          <View style={styles.qrContainer}>
            <Text style={styles.qrLabel}>Quét mã QR để thanh toán</Text>
            {loadingQR ? (
              <Text style={styles.qrLabel}>Đang tải mã QR...</Text>
            ) : qrError ? (
              <Text style={{ color: 'red' }}>{qrError}</Text>
            ) : qrCode ? (
              <QRCodeSVG value={qrCode} size={200} />
            ) : null}
            <Text style={styles.note}>
              Hãy chụp màn hình mã QR và thanh toán qua ứng dụng ngân hàng của bạn.
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
            {method === 'cash' ? (
              <Text style={styles.modalMessage}>
                Lịch hỗ trợ đã được tạo. Vui lòng chuẩn bị tiền mặt để thanh toán
              </Text>
            ) : (
              <Text style={styles.modalMessage}>
                Thanh toán online đã được ghi nhận.
              </Text>
            )}

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleGoHome}
            >
              <Text style={styles.modalButtonText}>Về trang chủ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal yêu cầu cập nhật thông tin ngân hàng */}
      <Modal
        visible={showBankInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBankInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Icon name="card-outline" size={60} color="#f59e0b" />
            </View>
            <Text style={styles.modalTitle}>Yêu cầu thông tin thanh toán</Text>
            <Text style={styles.modalMessage}>
              Bạn cần cập nhật thông tin tài khoản ngân hàng để sử dụng phương thức thanh toán online.
            </Text>

            <View style={styles.modalButtonGroup}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  setShowBankInfoModal(false);
                  navigation.navigate('BankAccount');
                }}
              >
                <Text style={styles.modalButtonText}>Cập nhật ngay</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowBankInfoModal(false)}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>Bỏ qua</Text>
              </TouchableOpacity>
            </View>
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
  note: { fontSize: 12, color: '#ff0000ff', paddingTop: 8, textAlign: 'center' },

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
  modalButtonGroup: {
    width: '100%',
    gap: 10,
  },
  modalButtonPrimary: {
    backgroundColor: '#2563eb',
  },
  modalButtonSecondary: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modalButtonTextSecondary: {
    color: '#475569',
  },
});
