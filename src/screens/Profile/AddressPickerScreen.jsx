import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import PropTypes from 'prop-types';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import userService from '../../services/userService';
import { SafeAreaView } from 'react-native-safe-area-context';

// eslint-disable-next-line react/prop-types
const AddressPickerScreen = ({ navigation }) => {
  const [address, setAddress] = useState('');
  const [selectedCommune, setSelectedCommune] = useState('');
  const [communes, setCommunes] = useState([]);
  const [showCommuneModal, setShowCommuneModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [addressCoordinates, setAddressCoordinates] = useState(null);
  const [loadingCoordinates, setLoadingCoordinates] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load user info and initialize address
  const loadUserInfo = async () => {
    try {
      // Always fetch fresh data from API to ensure decrypted address
      const apiResult = await userService.getUserInfo();
      if (apiResult.success && apiResult.data) {
        // Update local storage with fresh decrypted data
        await userService.setUser(apiResult.data);
        setCurrentUser(apiResult.data);

        // Set current address if exists (should be decrypted from API)
        if (apiResult.data.currentAddress) {
          const addressParts = apiResult.data.currentAddress.split(',');
          if (addressParts.length > 0) {
            setAddress(addressParts[0].trim());
          }

          if (addressParts.length > 1) {
            const communePart = addressParts[1].trim();
            // Find matching commune from the list when it's loaded
            // This will be handled after communes are fetched
          }
        }
      } else {
        // Fallback to local data if API fails
        const localResult = await userService.getUser();
        if (localResult.success && localResult.data) {
          setCurrentUser(localResult.data);
          if (localResult.data.currentAddress) {
            const addressParts = localResult.data.currentAddress.split(',');
            if (addressParts.length > 0) {
              setAddress(addressParts[0].trim());
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading user info:', error);
      // Fallback to local data if API call fails
      try {
        const localResult = await userService.getUser();
        if (localResult.success && localResult.data) {
          setCurrentUser(localResult.data);
          if (localResult.data.currentAddress) {
            const addressParts = localResult.data.currentAddress.split(',');
            if (addressParts.length > 0) {
              setAddress(addressParts[0].trim());
            }
          }
        }
      } catch (localError) {
        console.error('Error loading local user info:', localError);
      }
    }
  };

  // Đăng ký tại: https://locationiq.com (miễn phí)
  const LOCATIONIQ_API_KEY = 'pk.458e61bf9d66b7fdf75f10be3ea11410'; // pk.xxx

  const getCoordinatesFromAddress = async fullAddress => {
    try {
      setLoadingCoordinates(true);
      const DA_NANG_CENTER = { latitude: 16.0544, longitude: 108.2022 };
      let coordinates = null;
      let isApproximate = false;

      try {
        const encodedAddress = encodeURIComponent(fullAddress);
        console.log('🔍 Geocoding with LocationIQ:', fullAddress);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_API_KEY}&q=${encodedAddress}&format=json&limit=1&countrycodes=vn`,
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          console.log('📦 LocationIQ response:', data);

          if (data && Array.isArray(data) && data.length > 0) {
            const { lat, lon } = data[0];
            coordinates = {
              latitude: parseFloat(lat),
              longitude: parseFloat(lon),
            };
            console.log('✓ Got exact coordinates:', coordinates);
          }
        } else {
          console.log('❌ LocationIQ status:', response.status);
        }
      } catch (geoError) {
        console.log('❌ Geocoding error:', geoError.message);
      }

      // Fallback logic
      if (!coordinates) {
        isApproximate = true;
        const selectedCommuneObj = communes.find(c => c.code === selectedCommune);

        if (selectedCommuneObj) {
          const offset = parseInt(selectedCommuneObj.code) % 100;
          coordinates = {
            latitude: DA_NANG_CENTER.latitude + (offset * 0.002 - 0.05),
            longitude: DA_NANG_CENTER.longitude + (offset * 0.003 - 0.075),
          };
          console.log('⚠ Using approximate coordinates');
        } else {
          coordinates = DA_NANG_CENTER;
        }
      }

      setAddressCoordinates(coordinates);

      if (isApproximate) {
        Alert.alert(
          'Thông báo',
          'Không thể lấy tọa độ chính xác. Sử dụng tọa độ ước tính dựa trên khu vực Đà Nẵng.',
          [{ text: 'Đã hiểu' }]
        );
      } else {
        Alert.alert('Thành công', 'Đã lấy được tọa độ chính xác!');
      }

      return coordinates;
    } catch (error) {
      console.error('❌ Error:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi lấy tọa độ.');
      return null;
    } finally {
      setLoadingCoordinates(false);
    }
  };

  // Function to get coordinates for current address input
  const handleGetCoordinates = async () => {
    if (!address.trim() || !selectedCommune) {
      Alert.alert(
        'Thông báo',
        'Vui lòng điền đầy đủ thông tin địa chỉ trước khi lấy tọa độ',
      );
      return;
    }

    const selectedCommuneObj = communes.find(c => c.code === selectedCommune);
    const fullAddress = `${address.trim()}, ${selectedCommuneObj?.name || ''
      }, Đà Nẵng, Việt Nam`;

    await getCoordinatesFromAddress(fullAddress);
  };

  // Extract and set commune from existing address
  const extractCommuneFromAddress = (fullAddress, communesList) => {
    if (!fullAddress || !communesList || communesList.length === 0) return;

    const addressParts = fullAddress.split(',');
    if (addressParts.length > 1) {
      const communePart = addressParts[1].trim();
      const matchingCommune = communesList.find(
        commune =>
          commune.name.toLowerCase().includes(communePart.toLowerCase()) ||
          communePart.toLowerCase().includes(commune.name.toLowerCase()),
      );

      if (matchingCommune) {
        setSelectedCommune(matchingCommune.code);
        console.log('Auto-selected commune:', matchingCommune.name);
      }
    }
  };

  // Fetch communes from API
  const fetchCommunes = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        'https://production.cas.so/address-kit/2025-07-01/provinces/48/communes',
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const communesList = data.communes || [];
      setCommunes(communesList);

      if (currentUser?.currentAddress && communesList.length > 0) {
        extractCommuneFromAddress(currentUser.currentAddress, communesList);
      }
    } catch (error) {
      console.error('Error fetching communes:', error);
      setCommunes([]);
      Alert.alert('Lỗi', 'Không thể tải danh sách xã. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      await loadUserInfo();
      await fetchCommunes();
    };
    initializeData();
  }, []);

  useEffect(() => {
    if (
      currentUser?.currentAddress &&
      communes.length > 0 &&
      !selectedCommune
    ) {
      extractCommuneFromAddress(currentUser.currentAddress, communes);
    }
  }, [currentUser, communes, selectedCommune]);

  const selectCommune = commune => {
    setSelectedCommune(commune.code);
    setShowCommuneModal(false);
    setAddressCoordinates(null);
  };

  const handleAddressChange = text => {
    setAddress(text);
    setAddressCoordinates(null);
  };

  const getSelectedCommuneLabel = () => {
    if (!Array.isArray(communes) || communes.length === 0) {
      return 'Chọn xã/phường';
    }
    const commune = communes.find(c => c.code === selectedCommune);
    return commune ? commune.name : 'Chọn xã/phường';
  };

  const handleSaveAddress = async () => {
    if (!address.trim() || !selectedCommune) {
      Alert.alert('Thông báo', 'Vui lòng điền đầy đủ thông tin địa chỉ');
      return;
    }

    setSaving(true);
    try {
      const selectedCommuneObj = communes.find(c => c.code === selectedCommune);
      const fullAddress = `${address.trim()}, ${selectedCommuneObj?.name || ''
        }, Đà Nẵng`;

      const updateData = {
        currentAddress: fullAddress,
      };

      let coordinates = addressCoordinates;

      // If no coordinates yet, try to get them automatically
      if (!coordinates) {
        const fullAddressForGeocoding = `${fullAddress}, Việt Nam`;
        coordinates = await getCoordinatesFromAddress(fullAddressForGeocoding);

        // If still no coordinates after geocoding, ask user
        if (!coordinates) {
          Alert.alert(
            'Không thể lấy tọa độ',
            'Không thể xác định tọa độ của địa chỉ này. Bạn có muốn lưu địa chỉ mà không có thông tin vị trí không?',
            [
              {
                text: 'Hủy',
                style: 'cancel',
                onPress: () => setSaving(false),
              },
              {
                text: 'Lưu không có tọa độ',
                onPress: async () => {
                  try {
                    const result = await userService.updateCurrentAddress(updateData);
                    if (result.success) {
                      Alert.alert('Thành công', 'Địa chỉ đã được lưu (không có tọa độ)!', [
                        { text: 'OK', onPress: () => navigation?.goBack() },
                      ]);
                    } else {
                      Alert.alert('Lỗi', result.message || 'Có lỗi xảy ra khi lưu địa chỉ');
                    }
                  } catch (error) {
                    console.error('Save address error:', error);
                    Alert.alert('Lỗi', 'Có lỗi xảy ra. Vui lòng thử lại.');
                  } finally {
                    setSaving(false);
                  }
                },
              },
            ],
          );
          return; // Exit early, waiting for user choice
        }
      }

      // Add coordinates to update data if available
      if (coordinates) {
        updateData.currentLocation = coordinates;
      }

      const result = await userService.updateCurrentAddress(updateData);

      if (result.success) {
        const message = coordinates
          ? 'Địa chỉ và vị trí đã được lưu thành công!'
          : 'Địa chỉ đã được lưu thành công!';

        Alert.alert('Thành công', message, [
          {
            text: 'OK',
            onPress: () => navigation?.goBack(),
          },
        ]);
      } else {
        Alert.alert('Lỗi', result.message || 'Có lỗi xảy ra khi lưu địa chỉ');
      }
    } catch (error) {
      console.error('Save address error:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

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
        <Text style={styles.headerTitle}>Địa chỉ hiện tại</Text>
      </View>

      <ScrollView style={styles.content}>
        {currentUser?.currentAddress && (
          <View style={styles.currentAddressSection}>
            <Text style={styles.currentAddressTitle}>Địa chỉ hiện tại</Text>
            <View style={styles.currentAddressContainer}>
              <Icon name="location-outline" size={wp('4%')} color="#6B7280" />
              <Text style={styles.currentAddressText}>
                {currentUser.currentAddress}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.addressSection}>
          <Text style={styles.sectionTitle}>Cập nhật địa chỉ</Text>
          {currentUser?.currentAddress && (
            <Text style={styles.updateHint}>
              Nhập thông tin mới để cập nhật địa chỉ hiện tại của bạn
            </Text>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Số nhà, tên đường <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={address}
              onChangeText={handleAddressChange}
              placeholder="Vd: 123 Nguyễn Văn Linh"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Tỉnh/Thành phố <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.fixedInput}>
              <Text style={styles.fixedInputText}>Đà Nẵng</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Xã/Phường <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowCommuneModal(true)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#2196F3" />
              ) : (
                <>
                  <Text
                    style={[
                      styles.dropdownText,
                      !selectedCommune && styles.placeholderText,
                    ]}
                  >
                    {getSelectedCommuneLabel()}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tọa độ địa chỉ</Text>
            <View style={styles.coordinatesSection}>
              <TouchableOpacity
                style={[
                  styles.coordinatesButton,
                  (!address.trim() || !selectedCommune) &&
                  styles.coordinatesButtonDisabled,
                ]}
                onPress={handleGetCoordinates}
                disabled={
                  loadingCoordinates || !address.trim() || !selectedCommune
                }
              >
                {loadingCoordinates ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Icon name="location" size={wp('4%')} color="white" />
                )}
                <Text style={styles.coordinatesButtonText}>
                  {loadingCoordinates
                    ? 'Đang lấy tọa độ...'
                    : 'Lấy tọa độ địa chỉ'}
                </Text>
              </TouchableOpacity>
              {addressCoordinates && (
                <View style={styles.coordinatesInfo}>
                  <Text style={styles.coordinatesText}>
                    📍 Lat: {addressCoordinates.latitude.toFixed(6)}, Lng:{' '}
                    {addressCoordinates.longitude.toFixed(6)}
                  </Text>
                </View>
              )}
              <Text style={styles.coordinatesHint}>
                Tọa độ sẽ được tự động lấy khi lưu địa chỉ nếu chưa có
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveAddress}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButtonText}>Lưu địa chỉ</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showCommuneModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCommuneModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn Xã/Phường</Text>
              <TouchableOpacity onPress={() => setShowCommuneModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.loadingText}>Đang tải danh sách xã...</Text>
              </View>
            ) : (
              <FlatList
                data={communes}
                keyExtractor={item => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => selectCommune(item)}
                  >
                    <Text style={styles.modalItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      Không có dữ liệu xã/phường
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

AddressPickerScreen.propTypes = {
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
  addressSection: {
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
    fontSize: 16,
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
  fixedInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    opacity: 0.8,
  },
  fixedInputText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B7280',
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
    maxHeight: '70%',
    width: '80%',
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
  },
  modalItemText: {
    fontSize: 16,
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    marginHorizontal: wp('4%'),
    marginVertical: hp('3%'),
    paddingVertical: hp('2%'),
    borderRadius: wp('2%'),
    alignItems: 'center',
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
  coordinatesSection: {
    marginTop: 8,
  },
  coordinatesButton: {
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  coordinatesButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  coordinatesButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  coordinatesInfo: {
    backgroundColor: '#F3E8FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginBottom: 8,
  },
  coordinatesText: {
    fontSize: 12,
    color: '#7C3AED',
    fontFamily: 'monospace',
  },
  coordinatesHint: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  currentAddressSection: {
    backgroundColor: '#F0F9FF',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  currentAddressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 8,
  },
  currentAddressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  currentAddressText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  updateHint: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
});

export default AddressPickerScreen;
