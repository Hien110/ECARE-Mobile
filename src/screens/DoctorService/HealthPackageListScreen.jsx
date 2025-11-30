import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { doctorBookingService } from '../../services/doctorBookingService';
import { SafeAreaView } from 'react-native-safe-area-context';

const TAG = '[HealthPackageListScreen]';

const HealthPackageListScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // ✅ nhận lại cả elderly + family từ route
  const { elderly, family } = route.params || {};

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // === state cho popup chi tiết ===
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  useEffect(() => {
    console.log(TAG, 'route.params =', route.params);
  }, [route.params]);

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const res = await doctorBookingService.getPackages();

      // Chuẩn hóa data: luôn lấy ra mảng
      let list = [];
      if (res?.success) {
        if (Array.isArray(res.data)) {
          list = res.data;
        } else if (Array.isArray(res.data?.items)) {
          list = res.data.items;
        } else if (Array.isArray(res.data?.packages)) {
          list = res.data.packages;
        }
      }

      if (list.length) {
        setPackages(list);
        setError('');
      } else {
        setPackages([]);
        setError(
          typeof res?.message === 'string'
            ? res.message
            : 'Không lấy được danh sách gói sức khỏe. Vui lòng thử lại.',
        );
      }
    } catch (err) {
      console.log('getPackages error:', err?.response?.data || err.message);
      setError('Không lấy được danh sách gói sức khỏe. Vui lòng thử lại.');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPackages();
    setRefreshing(false);
  };

  const handleBack = () => {
    navigation.goBack();
  };

  // ---------- Helper: luôn trả về STRING ----------
  const getTitle = pkg => {
    if (!pkg) return 'Gói sức khỏe';
    const raw =
      pkg.title ||
      pkg.name ||
      pkg.serviceName || // field từ DB
      'Gói sức khỏe';
    return typeof raw === 'string' ? raw : 'Gói sức khỏe';
  };

  const getShortDescription = pkg => {
    if (!pkg) return '';
    const raw =
      pkg.shortDescription ||
      pkg.description ||
      pkg.serviceDescription || // field từ DB
      '';
    return typeof raw === 'string' ? raw : '';
  };

  // Các mô tả chi tiết / dòng giờ giấc / giá sẽ được lấy từ DB
  const getDetailLines = pkg => {
    if (!pkg) return [];
    let block =
      pkg.detailsText ||
      pkg.longDescription ||
      pkg.detailDescription ||
      pkg.extraInfo ||
      pkg.pricingDescription ||
      '';

    if (typeof block !== 'string') return [];
    return block
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
  };

  const getPricingText = pkg => {
    if (!pkg) return '';
    const fromField =
      pkg.pricingText ||
      pkg.priceText ||
      pkg.priceLabel ||
      '';

    if (typeof fromField === 'string' && fromField.trim()) {
      return fromField;
    }

    if (typeof pkg.price === 'number') {
      return `Giá tham khảo: ${pkg.price.toLocaleString('vi-VN')} VND`;
    }

    if (typeof pkg.basePrice === 'number') {
      return `Giá từ: ${pkg.basePrice.toLocaleString('vi-VN')} VND`;
    }

    return '';
  };
  // ------------------------------------------------

  const handleViewDetail = pkg => {
    if (!pkg) return;
    setSelectedPackage(pkg);
    setDetailVisible(true);
  };

  const handleSelectPackage = pkg => {
    if (!pkg) return;

    // ✅ forward cả elderly + family sang bước chọn thời lượng
    navigation.navigate('HealthPackageScheduleScreen', {
      elderly,
      family,
      healthPackage: pkg,
    });
  };

  const closeDetailModal = () => {
    setDetailVisible(false);
  };

  const renderPackageCard = pkg => {
    const detailLines = getDetailLines(pkg);
    const pricingText = getPricingText(pkg);

    return (
      <View key={pkg._id || pkg.id} style={styles.packageCard}>
        <Text style={styles.packageTitle}>{getTitle(pkg)}</Text>

        {!!getShortDescription(pkg) && (
          <Text style={styles.packageDescription}>
            {getShortDescription(pkg)}
          </Text>
        )}

        {detailLines.map((line, idx) => (
          <Text key={idx.toString()} style={styles.packageLine}>
            {line}
          </Text>
        ))}

        {!!pricingText && (
          <Text style={[styles.packageLine, { marginTop: 4 }]}>
            {pricingText}
          </Text>
        )}

        {/* Nút xem chi tiết */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => handleViewDetail(pkg)}
        >
          <Text style={styles.secondaryButtonText}>Xem chi tiết</Text>
        </TouchableOpacity>

        {/* Nút chọn dịch vụ */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => handleSelectPackage(pkg)}
        >
          <Text style={styles.primaryButtonText}>Chọn dịch vụ</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ============== RENDER ==============
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F7EFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đặt gói sức khỏe</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepContainer}>
        <View style={[styles.stepItem, styles.stepItemActive]}>
          <Text style={styles.stepLabelActive}>1. Chọn gói sức khỏe</Text>
        </View>
        <View style={styles.stepDivider} />
        <View style={styles.stepItem}>
          <Text style={styles.stepLabel}>2. Chọn bác sĩ & thời gian</Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {error ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Text style={{ color: 'red', marginBottom: 8 }}>
                {typeof error === 'string' ? error : ''}
              </Text>
            </View>
          ) : null}

          {!error && !packages.length ? (
            <View style={{ padding: 16 }}>
              <Text style={{ textAlign: 'center', color: '#6B7280' }}>
                Hiện chưa có gói sức khỏe nào khả dụng.
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              {packages.map(renderPackageCard)}
            </View>
          )}
        </ScrollView>
      )}

      {/* ===== POPUP CHI TIẾT GÓI SỨC KHỎE ===== */}
      <Modal
        visible={detailVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDetailModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết dịch vụ</Text>
              <TouchableOpacity onPress={closeDetailModal}>
                <Icon name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Tên gói */}
              <Text style={styles.modalPackageTitle}>
                {getTitle(selectedPackage)}
              </Text>

              {/* Mô tả ngắn */}
              {!!getShortDescription(selectedPackage) && (
                <Text style={styles.modalDescription}>
                  {getShortDescription(selectedPackage)}
                </Text>
              )}

              <View style={styles.modalDivider} />

              {/* Bảng giá */}
              <Text style={styles.modalSectionTitle}>Bảng giá</Text>

              {getDetailLines(selectedPackage).map((line, idx) => (
                <Text key={idx.toString()} style={styles.modalLine}>
                  {line}
                </Text>
              ))}

              {!!getPricingText(selectedPackage) && (
                <Text style={[styles.modalLine, { marginTop: 4 }]}>
                  {getPricingText(selectedPackage)}
                </Text>
              )}
            </ScrollView>

            {/* Buttons trong modal */}
            <View style={styles.modalButtonsWrapper}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={closeDetailModal}
              >
                <Text style={styles.modalSecondaryText}>Đóng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={() => {
                  const pkg = selectedPackage;
                  closeDetailModal();
                  handleSelectPackage(pkg);
                }}
              >
                <Text style={styles.modalPrimaryText}>Chọn dịch vụ này</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default HealthPackageListScreen;

// styles giữ nguyên như bạn
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#4F7EFF',
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
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F7EFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  stepItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  stepItemActive: {
    backgroundColor: '#ffffff',
  },
  stepLabel: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  stepLabelActive: {
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  stepDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5F5',
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  packageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  packageDescription: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 8,
  },
  packageLine: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  secondaryButton: {
    marginTop: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#4F7EFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // ===== Modal styles =====
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  modalPackageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modalDescription: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 10,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  modalLine: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  modalButtonsWrapper: {
    marginTop: 16,
  },
  modalSecondaryButton: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  modalPrimaryButton: {
    backgroundColor: '#4F7EFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
