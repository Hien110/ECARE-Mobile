import { useNavigation, useRoute } from '@react-navigation/native';
import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import QRCodeSVG from 'react-native-qrcode-svg';

import { doctorBookingService } from '../../services/doctorBookingService';
import userService from '../../services/userService';
import { PayOSService } from '../../services/payosService';

const PaymentServiceScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const {
    registration: registrationParam,
    family,
    elderly: elderlyParam,
    doctor: doctorParam,
    scheduledDate: scheduledDateParam,
    slotLabel: slotLabelParam,
    slot,
    price: priceParam,
  } = route.params || {};

  const [userRole, setUserRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [orderCode, setOrderCode] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [qrError, setQrError] = useState('');
  const [defaultPrice, setDefaultPrice] = useState(null);

  useEffect(() => {
    const fetchDefaultPriceIfNeeded = async () => {
      const hasPriceParam =
        priceParam != null && !Number.isNaN(Number(priceParam));
      const hasRegistrationPrice =
        registration &&
        registration.price != null &&
        !Number.isNaN(Number(registration.price));

      if (hasPriceParam || hasRegistrationPrice) {
        return;
      }

      try {
        const res = await doctorBookingService.getDefaultConsultationPrice();
        if (res?.success && typeof res.data === 'number') {
          setDefaultPrice(res.data);
        }
      } catch (e) {
        // bỏ qua, sẽ hiển thị "-" nếu không có giá
      }
    };

    fetchDefaultPriceIfNeeded();
  }, [priceParam, registration]);

  useEffect(() => {
    userService
      .getUser()
      .then(res => {
        const r = res?.data?.role || null;
        setUserRole(r);
        setCurrentUser(res?.data || null);
      })
      .catch(() => {
        setUserRole(null);
        setCurrentUser(null);
      });
  }, []);

  const registration = registrationParam || {};
  const doctor = registration.doctor || doctorParam || {};
  const registrant = registration.registrant || family || {};
  const beneficiary = registration.beneficiary || elderlyParam || {};

  const scheduledDateIso =
    scheduledDateParam ||
    (registration.scheduledDate
      ? new Date(registration.scheduledDate).toISOString().slice(0, 10)
      : '');

  const formatDate = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const displayDate = formatDate(scheduledDateIso);

  const supporterName =
    registrant.fullName ||
    registrant.name ||
    (currentUser && currentUser.fullName) ||
    '';

  const rawElderlyName =
    beneficiary.fullName ||
    beneficiary.name ||
    (beneficiary.elderly &&
      (beneficiary.elderly.fullName || beneficiary.elderly.name)) ||
    (beneficiary.user &&
      (beneficiary.user.fullName || beneficiary.user.name)) ||
    '';

  const normalizedRole =
    (route?.params?.role || userRole || '')?.toString().toLowerCase() || '';

  const isElderlySelfBooking = normalizedRole === 'elderly';

  const elderlyName =
    rawElderlyName ||
    (isElderlySelfBooking && currentUser && currentUser.fullName) ||
    '';

  const registrantLabel = isElderlySelfBooking
    ? 'Người đặt khám:'
    : 'Người đăng ký:';

  const registrantDisplayName = isElderlySelfBooking
    ? elderlyName || supporterName
    : supporterName || elderlyName;

  const displayServiceName = 'Dịch vụ tư vấn bác sĩ';

  const displayHireType = 'Tư vấn bác sĩ theo lịch hẹn';

  const displayShift = slotLabelParam || slot || '';

  const doctorName =
    doctor.fullName ||
    doctor.name ||
    (doctor.user && doctor.user.fullName) ||
    '';
  const doctorSpecializations =
    doctor.specializations ||
    (doctor.profile && doctor.profile.specializations) ||
    (doctor.user && doctor.user.specializations) ||
    '';
  const doctorHospital =
    doctor.hospitalName ||
    (doctor.profile && doctor.profile.hospitalName) ||
    '';

  const rawPriceNumber = useMemo(() => {
    const fromParam =
      priceParam != null && !Number.isNaN(Number(priceParam))
        ? Number(priceParam)
        : null;
    const fromRegistration =
      registration &&
      registration.price != null &&
      !Number.isNaN(Number(registration.price))
        ? Number(registration.price)
        : null;

    const fromDefault =
      defaultPrice != null && !Number.isNaN(Number(defaultPrice))
        ? Number(defaultPrice)
        : null;

    const num = fromParam ?? fromRegistration ?? fromDefault ?? 0;
    if (!num || Number.isNaN(num)) return 0;
    return num;
  }, [priceParam, registration, defaultPrice]);

  const displayPrice = useMemo(() => {
    if (!rawPriceNumber) return '';
    return rawPriceNumber.toLocaleString('vi-VN');
  }, [rawPriceNumber]);

  const doctorId =
    doctor.doctorId ||
    doctor._id ||
    doctor.userId ||
    (doctor.user && doctor.user._id) ||
    null;

  const elderlyIdFromSelection =
    (beneficiary &&
      typeof beneficiary === 'object' &&
      (beneficiary._id ||
        beneficiary.elderlyId ||
        (beneficiary.elderly && beneficiary.elderly._id) ||
        (beneficiary.user && beneficiary.user._id))) ||
    (elderlyParam &&
      typeof elderlyParam === 'object' &&
      (elderlyParam._id || elderlyParam.elderlyId)) ||
    (typeof elderlyParam === 'string' ? elderlyParam : null);

  const elderlyId =
    isElderlySelfBooking && currentUser && currentUser._id
      ? currentUser._id
      : elderlyIdFromSelection || null;

  const handleBack = () => navigation.goBack();

  const validatePayload = () => {
    if (!elderlyId) {
      Alert.alert(
        'Lỗi dữ liệu',
        'Thiếu thông tin người được khám (elderlyId).',
      );
      return false;
    }
    if (!doctorId) {
      Alert.alert('Lỗi dữ liệu', 'Thiếu thông tin bác sĩ.');
      return false;
    }
    if (!scheduledDateIso) {
      Alert.alert('Lỗi dữ liệu', 'Thiếu ngày khám.');
      return false;
    }
    if (!rawPriceNumber || rawPriceNumber <= 0) {
      Alert.alert('Lỗi dữ liệu', 'Giá dịch vụ không hợp lệ.');
      return false;
    }
    return true;
  };

  useEffect(() => {
    const generateQRCode = async () => {
      if (selectedMethod !== 'qr') {
        setQrCode(null);
        setOrderCode(null);
        setQrError('');
        return;
      }

      if (!rawPriceNumber || rawPriceNumber <= 0) {
        setQrError('Không xác định được số tiền thanh toán.');
        setQrCode(null);
        return;
      }

      setLoadingQR(true);
      setQrError('');
      try {
        const newOrderCode =
          (Date.now() % 10_000_000_000_000) + Math.floor(Math.random() * 10_000);

        const MAX_DESC_LEN = 25;

        let shortDesc = `Goi kham BS - ${elderlyName || 'NCT'}`;

        if (shortDesc.length > MAX_DESC_LEN) {
          shortDesc = shortDesc.slice(0, MAX_DESC_LEN);
        }

        const paymentData = {
          orderCode: newOrderCode,
          amount: rawPriceNumber,
          description: shortDesc, 
          returnUrl: 'https://your-app-url.com/doctor-payment-success',
          cancelUrl: 'https://your-app-url.com/doctor-payment-cancel',
        };

        const result = await PayOSService.createPayment(paymentData);

        const qr =
          result?.qrCode ||
          result?.data?.qrCode ||
          result?.data?.qr_link ||
          null;

        if (!qr) {
          setQrError('Không nhận được mã QR từ PayOS.');
          setQrCode(null);
        } else {
          setQrCode(qr);
          setOrderCode(newOrderCode);
        }
      } catch (error) {
        const friendlyMessage =
          error?.response?.data?.message ||
          'Không thể tạo thanh toán QR. Vui lòng thử lại sau.';
        setQrError(friendlyMessage);
        setQrCode(null);
      } finally {
        setLoadingQR(false);
      }
    };

    generateQRCode();
  }, [selectedMethod, rawPriceNumber, elderlyName]);

  const checkPaymentStatus = async () => {
    if (!orderCode) {
      return false;
    }
    try {
      const statusRes = await PayOSService.verifyPayment(orderCode);

      const status =
        statusRes?.status ||
        statusRes?.data?.status ||
        statusRes?.payment?.status ||
        '';

      return (
        status === 'PAID' ||
        status === 'paid' ||
        status === 'SUCCESS' ||
        status === 'success'
      );
    } catch {
      return false;
    }
  };

  const handlePayment = async method => {
    if (submitting) return;
    if (!method) {
      Alert.alert(
        'Chưa chọn phương thức',
        'Vui lòng chọn phương thức thanh toán trước.',
      );
      return;
    }
    if (!validatePayload()) return;

    try {
      setSubmitting(true);

      const backendPaymentMethod = method === 'qr' ? 'bank_transfer' : method;

      const payload = {
        doctorId,
        elderlyId,
        scheduledDate: scheduledDateIso,
        slot: slot || 'morning',
        paymentMethod: backendPaymentMethod,
      };

      const res = await doctorBookingService.createRegistration(payload);

      if (res?.success) {
        setShowSuccessModal(true);
      } else {
        Alert.alert(
          'Thanh toán thất bại',
          res?.message || 'Không thể tạo booking.',
        );
      }
    } catch {
      Alert.alert(
        'Lỗi hệ thống',
        'Không thể xử lý thanh toán. Vui lòng thử lại sau.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedMethod) {
      Alert.alert(
        'Chưa chọn phương thức',
        'Vui lòng chọn phương thức thanh toán trước.',
      );
      return;
    }

    if (selectedMethod === 'qr') {
      if (!qrCode) {
        Alert.alert(
          'Chưa có mã QR',
          'Vui lòng đợi mã QR được tạo trước khi xác nhận thanh toán online.',
        );
        return;
      }

      const paymentSuccess = await checkPaymentStatus();
      if (!paymentSuccess) {
        Alert.alert(
          'Thanh toán chưa hoàn tất',
          'Vui lòng hoàn tất thanh toán qua ứng dụng ngân hàng trước khi xác nhận.',
        );
        return;
      }
    }

    await handlePayment(selectedMethod);
  };

  const handleGoHome = () => {
    setShowSuccessModal(false);

    if (isElderlySelfBooking) {
      navigation.navigate('ElderHome');
    } else {
      navigation.navigate('FamilyMemberHome');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1D4ED8" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thanh toán gói khám bác sĩ</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* THÔNG TIN ĐƠN ĐẶT LỊCH */}
        <View style={styles.infoCard}>
          <InfoRow label={registrantLabel} value={registrantDisplayName} />
          <InfoRow label="Gói khám:" value={displayServiceName} />
          <InfoRow label="Hình thức thuê:" value={displayHireType} />

          <View style={styles.sectionSeparator} />
          <Text style={styles.sectionTitle}>Bác sĩ phụ trách</Text>
          <InfoRow label="Họ và tên:" value={doctorName} />
          <InfoRow label="Chuyên khoa:" value={doctorSpecializations} />
          <InfoRow label="Bệnh viện / cơ sở:" value={doctorHospital} />

          <View style={styles.sectionSeparator} />
          <Text style={styles.sectionTitle}>Thông tin thời gian</Text>
          <InfoRow label="Ngày khám dự kiến:" value={displayDate} />
          <InfoRow label="Ca khám:" value={displayShift} />

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Giá gói khám:</Text>
            <Text style={styles.priceValue}>
              {displayPrice ? `${displayPrice} đ` : '—'}
            </Text>
          </View>

        </View>

        {/* CHỌN PHƯƠNG THỨC THANH TOÁN */}
        <Text style={styles.paymentTitle}>Chọn phương thức thanh toán</Text>

        <View style={styles.paymentRow}>
          <TouchableOpacity
            style={[
              styles.payMethodCard,
              selectedMethod === 'cash' && styles.payMethodCardActive,
            ]}
            activeOpacity={0.8}
            onPress={() => setSelectedMethod('cash')}
            disabled={submitting}
          >
            <View style={styles.iconCircle}>
              <Icon name="cash-outline" size={26} color="#2563EB" />
            </View>
            <Text
              style={[
                styles.payMethodTitle,
                selectedMethod === 'cash' && styles.payMethodTitleActive,
              ]}
            >
              Tiền mặt
            </Text>
            <Text style={styles.payMethodDesc}>
              Thanh toán trực tiếp sau khi hoàn thành dịch vụ.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.payMethodCard,
              selectedMethod === 'qr' && styles.payMethodCardActive,
              { marginRight: 0 },
            ]}
            activeOpacity={0.8}
            onPress={() => setSelectedMethod('qr')}
            disabled={submitting}
          >
            <View style={styles.iconCircle}>
              <Icon name="qr-code-outline" size={26} color="#2563EB" />
            </View>
            <Text
              style={[
                styles.payMethodTitle,
                selectedMethod === 'qr' && styles.payMethodTitleActive,
              ]}
            >
              Online
            </Text>
            <Text style={styles.payMethodDesc}>
              Quét mã QR để thanh toán qua ví điện tử / mobile banking.
            </Text>
          </TouchableOpacity>
        </View>

        {selectedMethod === 'qr' && (
          <View style={styles.qrContainer}>
            <Text style={styles.qrTitle}>Mã QR thanh toán</Text>

            <View style={styles.qrAmountRow}>
              <Text style={styles.qrAmountLabel}>Số tiền cần thanh toán:</Text>
              <Text style={styles.qrAmountValue}>
                {displayPrice ? `${displayPrice} đ` : '—'}
              </Text>
            </View>

            <View style={styles.qrBox}>
              {loadingQR ? (
                <Text>Đang tạo mã QR...</Text>
              ) : qrError ? (
                <Text style={{ color: '#DC2626', textAlign: 'center' }}>
                  {qrError}
                </Text>
              ) : qrCode ? (
                <QRCodeSVG value={qrCode} size={180} />
              ) : (
                <Icon name="qr-code-outline" size={80} color="#111827" />
              )}
            </View>
            <Text style={styles.qrHint}>
              Vui lòng quét mã QR bằng ứng dụng ngân hàng hoặc ví điện tử trước
              khi bấm &quot;Xác nhận thanh toán&quot;.
            </Text>
          </View>
        )}

        <View style={styles.confirmWrapper}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!selectedMethod || submitting) && styles.confirmButtonDisabled,
            ]}
            activeOpacity={0.8}
            disabled={!selectedMethod || submitting}
            onPress={handleConfirmPayment}
          >
            <Text style={styles.confirmButtonText}>
              {submitting
                ? 'Đang xử lý...'
                : displayPrice
                ? `Xác nhận thanh toán ${displayPrice} đ`
                : 'Xác nhận thanh toán'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={showSuccessModal}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconCircle}>
              <Icon name="checkmark" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.modalTitle}>Đặt lịch thành công</Text>
            <Text style={styles.modalSubtitle}>
              {selectedMethod === 'qr'
                ? 'Thanh toán online đã được ghi nhận.'
                : 'Tiền dịch vụ sẽ được thu sau khi dịch vụ hỗ trợ hoàn thành.'}
            </Text>

            <TouchableOpacity
              style={styles.modalPrimaryButton}
              onPress={handleGoHome}
            >
              <Text style={styles.modalPrimaryButtonText}>Về trang chủ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default PaymentServiceScreen;

const InfoRow = ({ label, value }) => {
  if (!label && !value) return null;
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
};

InfoRow.propTypes = {
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.node,
    PropTypes.number,
  ]),
};

InfoRow.defaultProps = {
  label: '',
  value: '',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#1D4ED8',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  infoRow: {
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  sectionSeparator: {
    marginTop: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  priceValue: {
    marginLeft: 4,
    fontSize: 15,
    fontWeight: '700',
    color: '#16A34A',
  },
  noteLabel: {
    marginTop: 10,
    fontSize: 12,
    color: '#6B7280',
  },
  noteInputWrapper: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  noteInput: {
    minHeight: 70,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    textAlignVertical: 'top',
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  payMethodCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  payMethodCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  payMethodTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  payMethodTitleActive: {
    color: '#2563EB',
  },
  payMethodDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qrTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  qrAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  qrAmountLabel: {
    fontSize: 12,
    color: '#4B5563',
  },
  qrAmountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16A34A',
  },
  qrBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 16,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  qrHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  confirmWrapper: {
    marginBottom: 24,
  },
  confirmButton: {
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalPrimaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  modalPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
 