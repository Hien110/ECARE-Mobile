// src/screens/doctorBooking/PaymentServiceScreen.jsx
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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { doctorBookingService } from '../../services/doctorBookingService';
import userService from '../../services/userService';

const TAG = '[PaymentServiceScreen]';

const PaymentServiceScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const {
    registration: registrationParam,
    family,
    elderly: elderlyParam,
    doctor: doctorParam,
    healthPackage: packageParam,
    durationDays: durationParam,
    startDate: startDateParam,
    shiftLabel: shiftLabelParam,
    address: addressParam,
    serviceName: serviceNameParam,
    hireTypeLabel: hireTypeLabelParam,
    price: priceParam,
  } = route.params || {};

  const [userRole, setUserRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    console.log(TAG, '[getUser] calling userService.getUser');
    userService
      .getUser()
      .then(res => {
        console.log(TAG, '[getUser] response =', res?.data);
        const r = res?.data?.role || null;
        setUserRole(r);
        setCurrentUser(res?.data || null);
      })
      .catch(err => {
        console.log(TAG, '[getUser] ERROR =', err?.message || err);
        setUserRole(null);
        setCurrentUser(null);
      });
  }, []);

  useEffect(() => {
    console.log(TAG, 'route.params =', route.params);
  }, [route.params]);

  const registration = registrationParam || {};
  const packageRef = registration.packageRef || packageParam || {};
  const doctor = registration.doctor || doctorParam || {};
  const registrant = registration.registrant || family || {};
  const beneficiary = registration.beneficiary || elderlyParam || {};

  const durationDays = durationParam || registration.durationDays || 0;

  const startDateIso =
    startDateParam ||
    (registration.registeredAt
      ? new Date(registration.registeredAt).toISOString().slice(0, 10)
      : '');

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // chọn phương thức thanh toán + popup thành công
  const [selectedMethod, setSelectedMethod] = useState(null); // 'cash' | 'qr'
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const formatDate = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const startDateObj = startDateIso ? new Date(startDateIso) : null;
  const endDateObj =
    startDateObj && durationDays
      ? new Date(
          startDateObj.getFullYear(),
          startDateObj.getMonth(),
          startDateObj.getDate() + Number(durationDays) - 1,
        )
      : null;

  const displayStartDate = formatDate(startDateIso);
  const displayEndDate = endDateObj
    ? formatDate(endDateObj.toISOString().slice(0, 10))
    : '';

  const displayDurationText = durationDays
    ? `${durationDays} ngày (~${Math.round(durationDays / 30)} tháng)`
    : '';

  // tên người đăng ký (family) – fallback currentUser.fullName
  const supporterName =
    registrant.fullName ||
    registrant.name ||
    (currentUser && currentUser.fullName) ||
    '';

  // tên người được khám (elderly) – fallback currentUser.fullName nếu elderly tự đặt
  const rawElderlyName =
    beneficiary.fullName ||
    beneficiary.name ||
    (beneficiary.elderly &&
      (beneficiary.elderly.fullName || beneficiary.elderly.name)) ||
    (beneficiary.user &&
      (beneficiary.user.fullName || beneficiary.user.name)) ||
    '';

  // role hiện tại (để biết elderly tự đặt hay family)
  const normalizedRole =
    (route?.params?.role || userRole || '')?.toString().toLowerCase() || '';

  const isElderlySelfBooking = normalizedRole === 'elderly';

  const elderlyName =
    rawElderlyName ||
    (isElderlySelfBooking && currentUser && currentUser.fullName) ||
    '';

  // Label & name hiển thị cho dòng "Người ..."
  const registrantLabel = isElderlySelfBooking
    ? 'Người đặt khám:'
    : 'Người đăng ký:';

  const registrantDisplayName = isElderlySelfBooking
    ? elderlyName || supporterName
    : supporterName || elderlyName;

  const displayAddress =
    addressParam ||
    beneficiary.currentAddress ||
    (beneficiary.elderly && beneficiary.elderly.currentAddress) ||
    registrant.currentAddress ||
    (currentUser && currentUser.currentAddress) ||
    '';

  const displayServiceName =
    serviceNameParam ||
    packageRef.title ||
    packageRef.name ||
    registration.description ||
    '';

  const displayHireType =
    hireTypeLabelParam ||
    registration.description ||
    'Gói khám sức khỏe tại nhà / tư vấn bác sĩ';

  const displayDate = displayStartDate;
  const displayShift = shiftLabelParam || '';

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

  const displayPrice = useMemo(() => {
    const num = Number(
      priceParam ?? registration.price ?? packageRef.price ?? 0,
    );
    if (!num || Number.isNaN(num)) return '';
    return num.toLocaleString('vi-VN');
  }, [priceParam, registration.price, packageRef.price]);

  const doctorId =
    doctor.doctorId ||
    doctor._id ||
    doctor.userId ||
    (doctor.user && doctor.user._id) ||
    null;

  const healthPackageId =
    packageRef._id ||
    packageParam?._id ||
    registration.packageRefId ||
    null;

  // ======== TÍNH ELDERLY ID =========
  // elderlyId lấy từ lựa chọn beneficiary / elderlyParam (dùng cho role family)
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

  // Nếu elderly tự đặt, ưu tiên dùng _id của currentUser
  const elderlyId =
    isElderlySelfBooking && currentUser && currentUser._id
      ? currentUser._id
      : elderlyIdFromSelection || null;

  // Log chi tiết để debug tên / role / elderlyId
  useEffect(() => {
    console.log(TAG, '--- DEBUG BOOKING NAME / ROLE ---');
    console.log(TAG, 'route.params.role =', route?.params?.role);
    console.log(TAG, 'userRole from API =', userRole);
    console.log(TAG, 'normalizedRole =', normalizedRole);
    console.log(TAG, 'isElderlySelfBooking =', isElderlySelfBooking);
    console.log(TAG, 'currentUser._id =', currentUser?._id);
    console.log(TAG, 'elderlyIdFromSelection =', elderlyIdFromSelection);
    console.log(TAG, '=> elderlyId (final) =', elderlyId);
    console.log(TAG, 'supporterName (registrant.fullName/name) =', supporterName);
    console.log(TAG, 'rawElderlyName (beneficiary...) =', rawElderlyName);
    console.log(TAG, 'elderlyName (after fallback) =', elderlyName);
    console.log(TAG, 'registrantLabel =', registrantLabel);
    console.log(TAG, 'registrantDisplayName =', registrantDisplayName);
    console.log(TAG, 'registrant object =', registrant);
    console.log(TAG, 'beneficiary object =', beneficiary);
    console.log(TAG, 'displayAddress =', displayAddress);
    console.log(TAG, 'displayServiceName =', displayServiceName);
    console.log(TAG, '----------------------------');
  }, [
    route?.params,
    userRole,
    normalizedRole,
    isElderlySelfBooking,
    supporterName,
    rawElderlyName,
    elderlyName,
    registrantLabel,
    registrantDisplayName,
    registrant,
    beneficiary,
    displayAddress,
    displayServiceName,
    currentUser,
    elderlyIdFromSelection,
    elderlyId,
  ]);

  useEffect(() => {
    console.log(TAG, 'Derived entities:', {
      registrant,
      beneficiary,
      packageRef,
      doctor,
      durationDays,
      startDateIso,
      elderlyName,
      elderlyId,
    });
    console.log(TAG, 'IDs:', { doctorId, healthPackageId });
  }, [
    registrant,
    beneficiary,
    packageRef,
    doctor,
    durationDays,
    startDateIso,
    doctorId,
    healthPackageId,
    elderlyName,
    elderlyId,
  ]);

  const handleBack = () => navigation.goBack();

  const validatePayload = () => {
    if (!elderlyId) {
      console.warn(TAG, 'Missing elderlyId', {
        beneficiary,
        elderlyParam,
        currentUser,
        isElderlySelfBooking,
      });
      Alert.alert(
        'Lỗi dữ liệu',
        'Thiếu thông tin người được khám (elderlyId).',
      );
      return false;
    }
    if (!healthPackageId) {
      console.warn(TAG, 'Missing healthPackageId', {
        packageRef,
        packageParam,
        registration,
      });
      Alert.alert('Lỗi dữ liệu', 'Thiếu thông tin gói khám.');
      return false;
    }
    if (!doctorId) {
      console.warn(TAG, 'Missing doctorId', doctor);
      Alert.alert('Lỗi dữ liệu', 'Thiếu thông tin bác sĩ.');
      return false;
    }
    if (!durationDays || !startDateIso) {
      console.warn(TAG, 'Missing durationDays or startDateIso', {
        durationDays,
        startDateIso,
      });
      Alert.alert(
        'Lỗi dữ liệu',
        'Thiếu thời lượng gói hoặc ngày bắt đầu.',
      );
      return false;
    }
    return true;
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

      const payload = {
        elderlyId,
        healthPackageId,
        durationDays,
        startDate: startDateIso,
        doctorId,
        paymentMethod: method,
        note,
        // gửi thêm thông tin cho backend phân biệt elderly tự đặt
        bookingRole: normalizedRole,
        isElderlySelfBooking,
      };

      console.log(TAG, 'Booking payload =', payload);

      let res = null;
      if (
        doctorBookingService &&
        typeof doctorBookingService.bookDoctor === 'function'
      ) {
        console.log(TAG, 'Calling doctorBookingService.bookDoctor');
        res = await doctorBookingService.bookDoctor(payload);
      } else if (
        doctorBookingService &&
        typeof doctorBookingService.createBooking === 'function'
      ) {
        console.log(TAG, 'bookDoctor not found, fallback to createBooking');
        res = await doctorBookingService.createBooking(payload);
      } else {
        console.error(
          TAG,
          'Không tìm thấy hàm bookDoctor / createBooking trong doctorBookingService',
          Object.keys(doctorBookingService || {}),
        );
        Alert.alert(
          'Lỗi cấu hình',
          'Không tìm thấy hàm đặt lịch trong doctorBookingService. Vui lòng kiểm tra lại service.',
        );
        return;
      }

      console.log(TAG, 'Booking response =', res);

      if (res?.success) {
        setShowSuccessModal(true);
      } else {
        Alert.alert(
          'Thanh toán thất bại',
          res?.message || 'Không thể tạo booking.',
        );
      }
    } catch (err) {
      console.log(TAG, '[handlePayment] ERROR =', err?.message || err);
      Alert.alert(
        'Lỗi hệ thống',
        'Không thể xử lý thanh toán. Vui lòng thử lại sau.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = () => {
    handlePayment(selectedMethod);
  };

  const handleGoHome = () => {
  setShowSuccessModal(false);

  if (isElderlySelfBooking) {
    // Người cao tuổi tự đặt → về trang ElderHome
    navigation.navigate('ElderHome');
  } else {
    // Người thân đặt cho elderly → giữ nguyên
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
          <InfoRow label="Thời lượng gói:" value={displayDurationText} />
          <InfoRow label="Ngày bắt đầu:" value={displayStartDate} />
          <InfoRow label="Ngày kết thúc dự kiến:" value={displayEndDate} />

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
              {displayPrice ? `${displayPrice} đ` : ''}
            </Text>
          </View>

          <Text style={styles.noteLabel}>
            Ghi chú cho bác sĩ (không bắt buộc):
          </Text>
          <View style={styles.noteInputWrapper}>
            <TextInput
              style={styles.noteInput}
              multiline
              value={note}
              onChangeText={setNote}
              placeholder="Ví dụ: Bố hơi khó ngủ, đang uống thuốc huyết áp buổi sáng..."
              placeholderTextColor="#9CA3AF"
            />
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

        {/* HIỂN THỊ QR KHI CHỌN ONLINE */}
        {selectedMethod === 'qr' && (
          <View style={styles.qrContainer}>
            <Text style={styles.qrTitle}>Mã QR thanh toán</Text>
            <View style={styles.qrBox}>
              <Icon name="qr-code-outline" size={80} color="#111827" />
            </View>
            <Text style={styles.qrHint}>
              Vui lòng quét mã QR bằng ứng dụng ngân hàng hoặc ví điện tử trước
              khi bấm &quot;Xác nhận thanh toán&quot;.
            </Text>
          </View>
        )}

        {/* NÚT XÁC NHẬN THANH TOÁN */}
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
              {submitting ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* POPUP ĐẶT LỊCH THÀNH CÔNG */}
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
              Tiền dịch vụ sẽ được thu sau khi dịch vụ hỗ trợ hoàn thành.
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
  if (!value) {
    console.log(
      TAG,
      '[InfoRow] skip render vì value rỗng, label =',
      label,
    );
    return null;
  }
  console.log(TAG, '[InfoRow] render row:', { label, value });
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

// styles giữ nguyên
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
