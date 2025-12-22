import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import PropTypes from 'prop-types';
import { userService } from '../../services/userService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

// Danh sách 49 ngân hàng Việt Nam
const VIETNAM_BANKS = [
  { code: 'VCB', name: 'Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)' },
  { code: 'TCB', name: 'Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)' },
  { code: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)' },
  { code: 'VTB', name: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietinbank)' },
  { code: 'ACB', name: 'Ngân hàng TMCP Á Châu (ACB)' },
  { code: 'MB', name: 'Ngân hàng TMCP Quân đội (MB Bank)' },
  { code: 'VPB', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)' },
  { code: 'TPB', name: 'Ngân hàng TMCP Tiên Phong (TPBank)' },
  { code: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội (SHB)' },
  { code: 'SCB', name: 'Ngân hàng TMCP Sài Gòn (SCB)' },
  { code: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam (MSB)' },
  { code: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam (VIB)' },
  { code: 'OCB', name: 'Ngân hàng TMCP Phương Đông (OCB)' },
  { code: 'EIB', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam (Eximbank)' },
  { code: 'SEA', name: 'Ngân hàng TMCP Đông Nam Á (SeABank)' },
  { code: 'HDB', name: 'Ngân hàng TMCP Phát triển TP.HCM (HDBank)' },
  { code: 'VAB', name: 'Ngân hàng TMCP Việt Á (VietABank)' },
  { code: 'NAB', name: 'Ngân hàng TMCP Nam Á (Nam A Bank)' },
  { code: 'PGB', name: 'Ngân hàng TMCP Xăng dầu Petrolimex (PG Bank)' },
  { code: 'ABB', name: 'Ngân hàng TMCP An Bình (ABBANK)' },
  { code: 'BAB', name: 'Ngân hàng TMCP Bắc Á (Bac A Bank)' },
  { code: 'NCB', name: 'Ngân hàng TMCP Quốc Dân (NCB)' },
  { code: 'OJB', name: 'Ngân hàng TMCP Đại Dương (OceanBank)' },
  { code: 'LPB', name: 'Ngân hàng TMCP Bưu điện Liên Việt (LienVietPostBank)' },
  { code: 'KLB', name: 'Ngân hàng TMCP Kiên Long (Kienlongbank)' },
  { code: 'PVB', name: 'Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)' },
  { code: 'BAO', name: 'Ngân hàng TMCP Bảo Việt (BaoViet Bank)' },
  { code: 'GPB', name: 'Ngân hàng Thương mại TNHH MTV Dầu Khí Toàn Cầu (GPBank)' },
  { code: 'VRB', name: 'Ngân hàng Liên doanh Việt - Nga (VRB)' },
  { code: 'CAKE', name: 'Ngân hàng Số CAKE by VPBank' },
  { code: 'UBANK', name: 'Ngân hàng Số Ubank by VPBank' },
  { code: 'TIMO', name: 'Ngân hàng Số Timo by Ban Viet Bank' },
  { code: 'VIET', name: 'Ngân hàng TMCP Việt Nam Thương Tín (VietBank)' },
  { code: 'CBB', name: 'Ngân hàng Thương mại TNHH MTV Xây dựng Việt Nam (CBBank)' },
  { code: 'WRB', name: 'Ngân hàng TNHH MTV Woori Việt Nam' },
  { code: 'SGB', name: 'Ngân hàng TMCP Sài Gòn Công Thương (Saigonbank)' },
  { code: 'IVB', name: 'Ngân hàng TNHH Indovina (IVB)' },
  { code: 'KEB', name: 'Ngân hàng KEB Hana – Chi nhánh Hà Nội' },
  { code: 'SHN', name: 'Ngân hàng TNHH MTV Shinhan Việt Nam' },
  { code: 'IBK', name: 'Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh HN' },
  { code: 'UOB', name: 'Ngân hàng UOB Việt Nam' },
  { code: 'SCB_HN', name: 'Ngân hàng TNHH MTV Standard Chartered Bank Việt Nam' },
  { code: 'HSBC', name: 'Ngân hàng TNHH MTV HSBC Việt Nam' },
  { code: 'CIMB', name: 'Ngân hàng TNHH MTV CIMB Việt Nam' },
  { code: 'PUBLIC', name: 'Ngân hàng TNHH MTV Public Việt Nam' },
  { code: 'NONGHYUP', name: 'Ngân hàng Nonghyup - Chi nhánh Hà Nội' },
  { code: 'COOP', name: 'Ngân hàng Hợp tác xã Việt Nam (Co-opBank)' },
  { code: 'VBSP', name: 'Ngân hàng Chính sách Xã hội Việt Nam' },
  { code: 'VBARD', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam (Agribank)' },
];

// eslint-disable-next-line react/prop-types
const BankAccountScreen = ({ navigation }) => {
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolderName, setBankAccountHolderName] = useState('');
  const [selectedBank, setSelectedBank] = useState(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load user info and initialize bank account
  const loadUserInfo = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('ecare_token');
      
      if (!token) {
        console.error('No token found');
        return;
      }

      const response = await userService.getUserInfo(token);

      if (response?.success && response?.data) {
        const user = response.data;
        setCurrentUser(user);

        // Initialize existing bank info if available
        if (user.bankName) {
          const existingBank = VIETNAM_BANKS.find(
            bank => bank.name === user.bankName || bank.code === user.bankName
          );
          if (existingBank) {
            setSelectedBank(existingBank);
            setBankName(existingBank.name);
          } else {
            setBankName(user.bankName);
          }
        }

        if (user.bankAccountNumber) {
          setBankAccountNumber(user.bankAccountNumber);
        }

        if (user.bankAccountHolderName) {
          setBankAccountHolderName(user.bankAccountHolderName);
        }
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserInfo();
  }, []);

  const selectBank = bank => {
    setSelectedBank(bank);
    setBankName(bank.name);
    setShowBankModal(false);
  };

  const handleAccountNumberChange = text => {
    // Chỉ cho phép nhập số
    const numericText = text.replace(/[^0-9]/g, '');
    setBankAccountNumber(numericText);
  };

  const getSelectedBankLabel = () => {
    if (selectedBank) {
      return selectedBank.name;
    }
    if (bankName) {
      return bankName;
    }
    return 'Chọn ngân hàng';
  };

  const handleSaveBankAccount = async () => {
    try {
      // Validation
      if (!bankName.trim()) {
        setErrorMessage('Vui lòng chọn ngân hàng');
        setShowErrorModal(true);
        return;
      }

      if (!bankAccountNumber.trim()) {
        setErrorMessage('Vui lòng nhập số tài khoản');
        setShowErrorModal(true);
        return;
      }

      if (bankAccountNumber.length < 6) {
        setErrorMessage('Số tài khoản phải có ít nhất 6 chữ số');
        setShowErrorModal(true);
        return;
      }

      if (!bankAccountHolderName.trim()) {
        setErrorMessage('Vui lòng nhập tên chủ tài khoản');
        setShowErrorModal(true);
        return;
      }

      setSaving(true);

      const token = await AsyncStorage.getItem('ecare_token');
      if (!token) {
        setErrorMessage('Phiên đăng nhập hết hạn');
        setShowErrorModal(true);
        return;
      }

      const response = await userService.updateBankAccount(token, {
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountHolderName: bankAccountHolderName.trim(),
      });

      if (response?.success) {
        setShowSuccessModal(true);
        // Reload user info
        await loadUserInfo();
      } else {
        setErrorMessage(response?.message || 'Có lỗi xảy ra khi cập nhật');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Error saving bank account:', error);
      setErrorMessage('Lỗi khi lưu thông tin ngân hàng');
      setShowErrorModal(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#2196F3" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={wp('6%')} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tài khoản ngân hàng</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Đang tải thông tin...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2196F3" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack()}
        >
          <Icon name="arrow-back" size={wp('6%')} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tài khoản ngân hàng</Text>
      </View>

      <ScrollView style={styles.content}>
        {currentUser?.bankName && currentUser?.bankAccountNumber && (
          <View style={styles.currentBankSection}>
            <Text style={styles.currentBankTitle}>
              Thông tin ngân hàng hiện tại
            </Text>
            <View style={styles.currentBankContainer}>
              <Icon name="card-outline" size={wp('4%')} color="#6B7280" />
              <View style={styles.currentBankInfo}>
                <Text style={styles.currentBankName}>{currentUser.bankName}</Text>
                {currentUser.bankAccountHolderName && (
                  <Text style={styles.currentBankHolder}>
                    Chủ TK: {currentUser.bankAccountHolderName}
                  </Text>
                )}
                <Text style={styles.currentBankAccount}>
                  STK: {currentUser.bankAccountNumber}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.bankSection}>
          <Text style={styles.sectionTitle}>
            {currentUser?.bankName
              ? 'Cập nhật thông tin ngân hàng'
              : 'Thêm tài khoản ngân hàng'}
          </Text>
          {currentUser?.bankName && (
            <Text style={styles.updateHint}>
              Nhập thông tin mới để cập nhật tài khoản ngân hàng của bạn
            </Text>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Ngân hàng <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowBankModal(true)}
            >
              <Text
                style={[
                  styles.dropdownText,
                  !selectedBank && !bankName && styles.placeholderText,
                ]}
              >
                {getSelectedBankLabel()}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Tên chủ tài khoản <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={bankAccountHolderName}
              onChangeText={setBankAccountHolderName}
              placeholder="Nhập tên chủ tài khoản (viết hoa không dấu)"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Số tài khoản <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={bankAccountNumber}
              onChangeText={handleAccountNumberChange}
              placeholder="Nhập số tài khoản ngân hàng"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              maxLength={20}
            />
            {bankAccountNumber.length > 0 && (
              <Text style={styles.inputHint}>
                Số tài khoản sẽ được mã hóa bảo mật
              </Text>
            )}
          </View>

          <View style={styles.securityNotice}>
            <Icon name="shield-checkmark" size={wp('5%')} color="#10B981" />
            <Text style={styles.securityText}>
              Thông tin tài khoản của bạn được mã hóa và bảo mật tuyệt đối
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveBankAccount}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Icon name="save-outline" size={wp('5%')} color="white" />
              <Text style={styles.saveButtonText}>Lưu thông tin</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal chọn ngân hàng */}
      <Modal
        visible={showBankModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBankModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn ngân hàng</Text>
              <TouchableOpacity onPress={() => setShowBankModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={VIETNAM_BANKS}
              keyExtractor={item => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedBank?.code === item.code && styles.modalItemSelected,
                  ]}
                  onPress={() => selectBank(item)}
                >
                  <View style={styles.modalItemContent}>
                    <Text style={styles.modalItemCode}>{item.code}</Text>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                  </View>
                  {selectedBank?.code === item.code && (
                    <Icon name="checkmark-circle" size={wp('5%')} color="#2196F3" />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Không có dữ liệu ngân hàng
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          navigation?.goBack();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <View style={styles.successIconContainer}>
              <Icon name="checkmark-circle" size={wp('16%')} color="#10B981" />
            </View>
            <Text style={styles.alertTitle}>Thành công!</Text>
            <Text style={styles.alertMessage}>
              Đã cập nhật thông tin ngân hàng thành công
            </Text>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => {
                setShowSuccessModal(false);
                navigation?.goBack();
              }}
            >
              <Text style={styles.alertButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <View style={styles.errorIconContainer}>
              <Icon name="close-circle" size={wp('16%')} color="#EF4444" />
            </View>
            <Text style={styles.alertTitle}>Lỗi!</Text>
            <Text style={styles.alertMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={[styles.alertButton, styles.errorButton]}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.alertButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

BankAccountScreen.propTypes = {
  navigation: PropTypes.shape({
    goBack: PropTypes.func.isRequired,
  }).isRequired,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('3.5%'),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: hp('0.2%') },
    shadowOpacity: 0.1,
    shadowRadius: wp('1%'),
  },
  backButton: {
    marginRight: wp('4%'),
  },
  headerTitle: {
    color: 'white',
    fontSize: wp('4.5%'),
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B7280',
  },
  currentBankSection: {
    backgroundColor: '#F0F9FF',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  currentBankTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 8,
  },
  currentBankContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  currentBankInfo: {
    flex: 1,
  },
  currentBankName: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 4,
  },
  currentBankHolder: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 2,
  },
  currentBankAccount: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  bankSection: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  updateHint: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontFamily: 'monospace',
  },
  inputHint: {
    fontSize: 11,
    color: '#8B5CF6',
    fontStyle: 'italic',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  dropdownButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6B7280',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 8,
    gap: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: '#15803D',
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: '#2196F3',
    marginHorizontal: wp('4%'),
    marginVertical: hp('3%'),
    paddingVertical: hp('2%'),
    borderRadius: wp('2%'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: hp('0.2%') },
    shadowOpacity: 0.1,
    shadowRadius: wp('1%'),
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: 'white',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  modalItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 2,
  },
  modalItemText: {
    fontSize: 14,
    color: '#111827',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  alertModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  errorIconContainer: {
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  alertButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  errorButton: {
    backgroundColor: '#EF4444',
  },
  alertButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BankAccountScreen;
