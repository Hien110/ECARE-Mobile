import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  StatusBar,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Feather from 'react-native-vector-icons/Feather';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supporterServicesService } from '../../services/supporterServicesService';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const FOOTER_HEIGHT = 72; // chiều cao footer HOC ước lượng

// ---- Helpers ----
const toDateYMD = date => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Cộng ngày (ms)
const addDaysYMD = (ymd, n) => {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toDateYMD(d);
};

const ServiceSelectionScreen = ({ route }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const elderlyId = route.params?.elderlyId || null;

  // STEP
  const [step, setStep] = useState(1);

  // SERVICES
  const [services, setServices] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [fetchErr, setFetchErr] = useState(null);

  // DETAIL MODAL
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailService, setDetailService] = useState(null);

  // SELECTION
  const [selectedService, setSelectedService] = useState(null);

  // TIME
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD

  // Date picker visibility
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [error, setError] = useState(null);

  // Fetch services
  useEffect(() => {
    const run = async () => {
      setFetching(true);
      setFetchErr(null);
      const rs = await supporterServicesService.getAllServices();
      if (rs?.success) {
        setServices(rs.data || []);
      } else {
        setFetchErr(rs?.message || 'Không thể tải danh sách dịch vụ');
      }
      setFetching(false);
    };
    run();
  }, []);

  // Handlers
  const openDetail = svc => {
    setDetailService(svc);
    setDetailOpen(true);
  };
  const closeDetail = () => {
    setDetailOpen(false);
    setDetailService(null);
  };
  const chooseService = svc => {
    setSelectedService(svc);
    setError(null);
    setStep(2);
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else navigation.goBack();
  };

  const validateAndContinue = () => {
    setError(null);
    if (!selectedService) {
      setError('Vui lòng chọn dịch vụ.');
      return;
    }

    if (!startDate) {
      setError('Vui lòng chọn ngày bắt đầu.');
      return;
    }

    // Kiểm tra không chọn ngày trong quá khứ hoặc hôm nay
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const selectedDate = new Date(startDate + 'T00:00:00');
    if (selectedDate < tomorrow) {
      setError('Vui lòng chọn ngày bắt đầu từ ngày mai.');
      return;
    }

    // Tính ngày kết thúc dựa trên numberOfDays
    const numberOfDays = selectedService.numberOfDays || 7;
    const calculatedEndDate = addDaysYMD(startDate, numberOfDays - 1);

    const bookingDraft = {
      serviceId: selectedService._id || selectedService.id,
      serviceName: selectedService.name,
      startDate,
      endDate: calculatedEndDate,
      numberOfDays,
      elderlyId,
      priceAtBooking: selectedService?.price || 0,
    };

    navigation.navigate('SupportFinder', {
      elderlyId,
      bookingDraft,
    });
  };

  // Tính ngày kết thúc dựa trên startDate và numberOfDays (để hiển thị UI)
  const displayEndDate = useMemo(() => {
    if (!startDate || !selectedService?.numberOfDays) return '';
    return addDaysYMD(startDate, selectedService.numberOfDays - 1);
  }, [startDate, selectedService]);

  // UI
  return (
    <SafeAreaView
      style={[styles.container, { paddingBottom: insets.bottom }]}
      edges={['top', 'bottom']}
    >
      <StatusBar backgroundColor="#4F7EFF" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Đặt dịch vụ hỗ trợ</Text>
        </View>
      </View>

      {/* Step indicator */}
      <View style={styles.stepper}>
        <View style={[styles.step, step === 1 && styles.stepActive]}>
          <Text style={[styles.stepText, step === 1 && styles.stepTextActive]}>
            1. Chọn dịch vụ
          </Text>
        </View>
        <View style={styles.stepSeparator} />
        <View style={[styles.step, step === 2 && styles.stepActive]}>
          <Text style={[styles.stepText, step === 2 && styles.stepTextActive]}>
            2. Chọn thời gian
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + FOOTER_HEIGHT + 16,
        }}
      >
        {fetching ? (
          <View style={styles.centerBox}>
            <Text>Đang tải dịch vụ...</Text>
          </View>
        ) : fetchErr ? (
          <View style={styles.centerBox}>
            <Text style={{ color: '#e11d48' }}>{fetchErr}</Text>
          </View>
        ) : (
          <>
            {step === 1 && (
              <>
                {services.length === 0 ? (
                  <View style={styles.centerBox}>
                    <Text>Hiện chưa có dịch vụ nào.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    {services.map(svc => {
                      const id = svc._id || svc.id;
                      return (
                        <View key={id} style={styles.card}>
                          <Text style={styles.cardTitle}>{svc.name}</Text>
                          {!!svc.description && (
                            <Text style={styles.cardDesc}>{svc.description}</Text>
                          )}
                          <Text style={styles.timeLine}>
                            Thời hạn: {svc.numberOfDays} ngày
                          </Text>
                          <Text style={styles.priceLine}>
                            Giá: {(svc.price || 0).toLocaleString('vi-VN')}₫
                          </Text>
                          <View style={styles.actionsBottom}>
                            <TouchableOpacity
                              style={styles.secondaryBtn}
                              onPress={() => openDetail(svc)}
                            >
                              <Text style={styles.secondaryBtnText}>Chi tiết</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.primaryBtn}
                              onPress={() => chooseService(svc)}
                            >
                              <Text style={styles.primaryBtnText}>Chọn</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {step === 2 && (
              <View style={{ gap: 16 }}>
                <View style={styles.selectedBox}>
                  <Text style={{ fontWeight: '600' }}>Dịch vụ đã chọn:</Text>
                  <Text style={styles.cardTitle}>{selectedService?.name}</Text>
                  <Text style={styles.timeLine}>
                    Thời hạn: {selectedService?.numberOfDays} ngày
                  </Text>
                  <Text style={styles.priceLine}>
                    Giá: {(selectedService?.price || 0).toLocaleString('vi-VN')}₫
                  </Text>
                </View>

                <View style={styles.box}>
                  <Text style={styles.sectionTitle}>Chọn ngày bắt đầu</Text>

                  <TouchableOpacity
                    style={styles.inputLike}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Feather name="calendar" size={16} color="#6b7280" />
                    <Text style={styles.inputLikeText}>
                      {startDate || 'Chọn ngày bắt đầu (YYYY-MM-DD)'}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <DateTimePicker
                      value={
                        startDate
                          ? new Date(startDate + 'T00:00:00')
                          : (() => {
                              const tomorrow = new Date();
                              tomorrow.setDate(tomorrow.getDate() + 1);
                              return tomorrow;
                            })()
                      }
                      mode="date"
                      display="default"
                      minimumDate={(() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        return tomorrow;
                      })()}
                      onChange={(e, d) => {
                        setShowDatePicker(false);
                        if (e.type === 'set' && d) setStartDate(toDateYMD(d));
                      }}
                    />
                  )}

                  {displayEndDate && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.hint}>
                        Ngày kết thúc (tự động): {displayEndDate}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.pricePreview}>
                    Tổng giá:{' '}
                    {(selectedService?.price || 0).toLocaleString('vi-VN')}₫
                  </Text>

                  <RulesBlock
                    title="Quy tắc đặt dịch vụ"
                    items={[
                      'Không chọn ngày trong quá khứ.',
                      `Thời hạn dịch vụ: ${selectedService?.numberOfDays || 0} ngày kể từ ngày bắt đầu.`,
                      'Ngày kết thúc được tự động tính toán.',
                    ]}
                  />
                </View>

                {error && <Text style={{ color: '#e11d48' }}>{error}</Text>}

                <TouchableOpacity
                  style={styles.cta}
                  onPress={validateAndContinue}
                >
                  <Text style={styles.ctaText}>Tiếp tục</Text>
                  <Feather name="chevron-right" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* DETAIL MODAL */}
      <Modal
        visible={detailOpen}
        transparent
        animationType="fade"
        onRequestClose={closeDetail}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết dịch vụ</Text>
              <TouchableOpacity onPress={closeDetail}>
                <Icon name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.detailName}>{detailService?.name}</Text>
              {!!detailService?.description && (
                <Text style={styles.detailDesc}>
                  {detailService.description}
                </Text>
              )}

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Thông tin dịch vụ</Text>
              <Text style={styles.detailLine}>
                • Thời hạn: {detailService?.numberOfDays} ngày
              </Text>
              <Text style={styles.detailLine}>
                • Giá: {(detailService?.price || 0).toLocaleString('vi-VN')}₫
              </Text>
            </ScrollView>

            <View style={{ gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={closeDetail}
              >
                <Text style={styles.secondaryBtnText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  chooseService(detailService);
                  closeDetail();
                }}
              >
                <Text style={styles.primaryBtnText}>Chọn dịch vụ này</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ===== Rules UI =====
const Bullet = ({ children }) => (
  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
    <Text style={{ color: '#64748b' }}>•</Text>
    <Text style={{ flex: 1, color: '#334155' }}>{children}</Text>
  </View>
);

const RulesBlock = ({ title, items }) => (
  <View
    style={{
      backgroundColor: '#f8fafc',
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: '#e2e8f0',
    }}
  >
    <Text style={{ fontWeight: '700', color: '#0f172a', marginBottom: 6 }}>
      {title}
    </Text>
    {items.map((line, idx) => (
      <Bullet key={idx}>{line}</Bullet>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#4F7EFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 4,
  },
  backButton: { padding: 6 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  step: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  stepActive: { backgroundColor: '#dbeafe' },
  stepText: { color: '#374151', fontSize: 12, fontWeight: '500' },
  stepTextActive: { color: '#1d4ed8' },
  stepSeparator: { flex: 1, height: 2, backgroundColor: '#e5e7eb' },

  content: { padding: 14 },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardDesc: { marginTop: 4, fontSize: 13, color: '#4b5563' },
  timeLine: { marginTop: 6, fontSize: 12, color: '#334155' },
  timeLineSmall: { marginTop: 6, fontSize: 12, color: '#475569' },
  priceLine: { fontSize: 12, color: '#374151' },

  actionsBottom: { gap: 8, marginTop: 10 }, // ⬅️ hai nút xuống dưới
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#eef2ff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#4338ca', fontWeight: '700' },

  selectedBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    borderColor: '#e5e7eb',
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },

  box: { backgroundColor: '#fff', padding: 12, borderRadius: 10, gap: 10 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  pillActive: { backgroundColor: '#2563eb' },
  pillDisabled: { backgroundColor: '#e5e7eb' },
  pillText: { color: '#374151', fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  pillTextDisabled: { color: '#9ca3af' },

  inputLike: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputLikeText: { color: '#111827' },

  hint: { fontSize: 12, color: '#6b7280' },
  pricePreview: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  detailName: { marginTop: 10, fontWeight: '700', fontSize: 16 },
  detailDesc: { marginTop: 6, color: '#4b5563' },
  detailLine: { marginTop: 6, color: '#374151', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 10 },

  cta: {
    marginTop: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,

    // đổ bóng
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // (tuỳ chọn) trạng thái disabled
  ctaDisabled: {
    backgroundColor: '#A7C0FF',
    shadowOpacity: 0.15,
    elevation: 0,
  },

  // (tuỳ chọn) viền khi cần nổi bật hơn
  ctaOutlined: {
    backgroundColor: '#1e40af',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});

export default ServiceSelectionScreen;
