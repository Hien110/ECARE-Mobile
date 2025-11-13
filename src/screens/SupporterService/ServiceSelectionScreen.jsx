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

const SESSION_SLOTS = ['morning', 'afternoon', 'evening'];
const VN_LABEL = { morning: 'Sáng', afternoon: 'Chiều', evening: 'Tối' };
const FOOTER_HEIGHT = 72; // chiều cao footer HOC ước lượng

// ---- Helpers (không dùng Intl/timeZone để tránh NaN) ----
const toDateYMD = date => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
// Tạo mốc UTC cho "giờ VN" (UTC+7)
const utcFromVN = (Y, M /*1-based*/, D, h = 0, min = 0, s = 0) =>
  Date.UTC(Y, M - 1, D, h - 7, min, s);

// Cutoff theo yêu cầu:
const violatesCutoffSession = (dateStr, slot) => {
  const [Y, M, D] = dateStr.split('-').map(x => parseInt(x, 10));
  let cutoffUTC;
  if (slot === 'morning') {
    // trước 19:00 ngày hôm trước (VN) => UTC 12:00 hôm trước
    cutoffUTC = utcFromVN(Y, M, D - 1, 19, 0, 0);
  } else if (slot === 'afternoon') {
    // trước 10:00 cùng ngày (VN) => UTC 03:00
    cutoffUTC = utcFromVN(Y, M, D, 10, 0, 0);
  } else {
    // evening: trước 16:00 cùng ngày (VN) => UTC 09:00
    cutoffUTC = utcFromVN(Y, M, D, 16, 0, 0);
  }
  return Date.now() > cutoffUTC;
};

const violatesCutoffDay = dateStr => {
  const [Y, M, D] = dateStr.split('-').map(x => parseInt(x, 10));
  const cutoffUTC = utcFromVN(Y, M, D - 1, 19, 0, 0); // 19:00 hôm trước (VN)
  return Date.now() > cutoffUTC;
};

// Tháng: phải đặt trước 1 ngày => start >= ngày mai (theo VN)
const isBeforeTomorrowVN = dateStr => {
  const now = new Date();
  // tính "hôm nay" theo local, nhưng so sánh dạng Y-M-D là đủ (chấp nhận sai lệch nhỏ TZ trên thiết bị)
  const todayYMD = toDateYMD(now);
  const today = new Date(todayYMD + 'T00:00:00');
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const cand = new Date(dateStr + 'T00:00:00');
  return cand < tomorrow;
};

// Cộng ngày (ms)
const addDaysYMD = (ymd, n) => {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toDateYMD(d);
};

const VN_SLOT_TEXT = 'Sáng 07:00–11:00 • Chiều 13:00–17:00 • Tối 18:00–21:00';

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

  // PACKAGE & TIME
  const [packageType, setPackageType] = useState('session'); // 'session' | 'day' | 'month'
  const [sessionDate, setSessionDate] = useState(''); // YYYY-MM-DD
  const [sessionSlot, setSessionSlot] = useState('morning');

  const [dayDate, setDayDate] = useState(''); // YYYY-MM-DD

  const [monthStart, setMonthStart] = useState(''); // YYYY-MM-DD

  // Date pickers visibility
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showMonthStartPicker, setShowMonthStartPicker] = useState(false);

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
    const canSession = svc?.bySession?.enabled;
    const canDay = svc?.byDay?.enabled;
    const canMonth = svc?.byMonth?.enabled;
    setPackageType(
      canSession ? 'session' : canDay ? 'day' : canMonth ? 'month' : 'session',
    );
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
      setStep(1);
      return;
    }

    if (packageType === 'session') {
      if (!sessionDate)
        return setError('Vui lòng chọn ngày cho gói theo buổi.');
      if (!sessionSlot) return setError('Vui lòng chọn buổi (sáng/chiều/tối).');
      if (violatesCutoffSession(sessionDate, sessionSlot)) {
        const msg =
          sessionSlot === 'morning'
            ? 'Buổi sáng: cần đặt trước 19:00 của ngày hôm trước (giờ Việt Nam).'
            : sessionSlot === 'afternoon'
            ? 'Buổi chiều: cần đặt trước 10:00 cùng ngày (giờ Việt Nam).'
            : 'Buổi tối: cần đặt trước 16:00 cùng ngày (giờ Việt Nam).';
        return setError(msg);
      }
    }

    if (packageType === 'day') {
      if (!dayDate) return setError('Vui lòng chọn ngày.');
      if (violatesCutoffDay(dayDate)) {
        return setError(
          'Theo ngày: cần đặt trước 19:00 của ngày hôm trước (giờ Việt Nam).',
        );
      }
    }

    if (packageType === 'month') {
      if (!monthStart) return setError('Vui lòng chọn ngày bắt đầu.');
      if (isBeforeTomorrowVN(monthStart)) {
        return setError('Theo tháng: ngày bắt đầu phải từ ngày mai trở đi.');
      }
    }

    const monthEnd =
      packageType === 'month' ? addDaysYMD(monthStart, 29) : undefined; // 30 ngày

    const bookingDraft = {
      serviceId: selectedService._id || selectedService.id,
      serviceName: selectedService.name,
      packageType,
      session:
        packageType === 'session'
          ? { date: sessionDate, slot: sessionSlot }
          : undefined,
      day: packageType === 'day' ? { date: dayDate } : undefined,
      month:
        packageType === 'month'
          ? { start: monthStart, end: monthEnd }
          : undefined,
      elderlyId, // ✅ chỉ cần id
      priceAtBooking:
        packageType === 'session'
          ? selectedService?.bySession?.[sessionSlot] || 0
          : packageType === 'day'
          ? selectedService?.byDay?.dailyFee || 0
          : selectedService?.byMonth?.monthlyFee || 0,
    };

    navigation.navigate('SupportFinder', {
      elderlyId,
      bookingDraft,
    });
  };

  // Giá hiển thị preview
  const pricePreview = useMemo(() => {
    if (!selectedService) return 0;
    if (packageType === 'session')
      return selectedService?.bySession?.[sessionSlot] || 0;
    if (packageType === 'day') return selectedService?.byDay?.dailyFee || 0;
    return selectedService?.byMonth?.monthlyFee || 0;
  }, [selectedService, packageType, sessionSlot]);

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
            2. Chọn gói & thời gian
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
                      const hasAny =
                        svc.bySession?.enabled ||
                        svc.byDay?.enabled ||
                        svc.byMonth?.enabled;
                      return (
                        <View key={id} style={styles.card}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{svc.name}</Text>
                            {!!svc.description && (
                              <Text style={styles.cardDesc}>
                                {svc.description}
                              </Text>
                            )}

                            {/* Thời gian từng buổi (rõ ràng) */}
                            <Text style={styles.timeLine}>{VN_SLOT_TEXT}</Text>

                            {/* Giá gọn */}
                            {hasAny && (
                              <View style={{ marginTop: 6 }}>
                                {svc.bySession?.enabled && (
                                  <Text style={styles.priceLine}>
                                    Theo buổi: S{' '}
                                    {svc.bySession.morning?.toLocaleString?.(
                                      'vi-VN',
                                    )}
                                    ₫ • C{' '}
                                    {svc.bySession.afternoon?.toLocaleString?.(
                                      'vi-VN',
                                    )}
                                    ₫ • T{' '}
                                    {svc.bySession.evening?.toLocaleString?.(
                                      'vi-VN',
                                    )}
                                    ₫
                                  </Text>
                                )}
                                {svc.byDay?.enabled && (
                                  <Text style={styles.priceLine}>
                                    Theo ngày:{' '}
                                    {svc.byDay.dailyFee?.toLocaleString?.(
                                      'vi-VN',
                                    )}
                                    ₫
                                  </Text>
                                )}
                                {svc.byMonth?.enabled && (
                                  <Text style={styles.priceLine}>
                                    Theo tháng:{' '}
                                    {svc.byMonth.monthlyFee?.toLocaleString?.(
                                      'vi-VN',
                                    )}
                                    ₫ — Buổi:{' '}
                                    {Array.isArray(
                                      svc.byMonth.sessionsPerDay,
                                    ) &&
                                      svc.byMonth.sessionsPerDay
                                        .map(x => VN_LABEL[x])
                                        .join(', ')}
                                  </Text>
                                )}
                              </View>
                            )}
                          </View>

                          {/* HAI NÚT Ở DƯỚI — KHÔNG cùng hàng thông tin */}
                          <View style={styles.actionsBottom}>
                            <TouchableOpacity
                              style={styles.secondaryBtn}
                              onPress={() => openDetail(svc)}
                            >
                              <Text style={styles.secondaryBtnText}>
                                Xem chi tiết
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.primaryBtn}
                              onPress={() => chooseService(svc)}
                            >
                              <Text style={styles.primaryBtnText}>
                                Chọn dịch vụ
                              </Text>
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
                {/* Tóm tắt */}
                <View style={styles.selectedBox}>
                  <Text style={{ fontWeight: '600' }}>Dịch vụ đã chọn:</Text>
                  <Text>{selectedService?.name}</Text>
                </View>

                {/* Chọn gói */}
                <View>
                  <Text style={styles.sectionTitle}>Chọn gói dịch vụ</Text>
                  <View style={styles.rowWrap}>
                    <PackagePill
                      label="Theo buổi"
                      active={packageType === 'session'}
                      disabled={!selectedService?.bySession?.enabled}
                      onPress={() => setPackageType('session')}
                    />
                    <PackagePill
                      label="Theo ngày"
                      active={packageType === 'day'}
                      disabled={!selectedService?.byDay?.enabled}
                      onPress={() => setPackageType('day')}
                    />
                    <PackagePill
                      label="Theo tháng"
                      active={packageType === 'month'}
                      disabled={!selectedService?.byMonth?.enabled}
                      onPress={() => setPackageType('month')}
                    />
                  </View>
                </View>

                {/* Theo buổi */}
                {packageType === 'session' && (
                  <View style={styles.box}>
                    <Text style={styles.sectionTitle}>Chọn ngày & buổi</Text>

                    <TouchableOpacity
                      style={styles.inputLike}
                      onPress={() => setShowSessionPicker(true)}
                    >
                      <Feather name="calendar" size={16} color="#6b7280" />
                      <Text style={styles.inputLikeText}>
                        {sessionDate || 'Chọn ngày (YYYY-MM-DD)'}
                      </Text>
                    </TouchableOpacity>

                    {showSessionPicker && (
                      <DateTimePicker
                        value={
                          sessionDate
                            ? new Date(sessionDate + 'T00:00:00')
                            : new Date()
                        }
                        mode="date"
                        display="default"
                        minimumDate={new Date()} // không cho chọn ngày trước đó
                        onChange={(e, d) => {
                          setShowSessionPicker(false);
                          if (d) setSessionDate(toDateYMD(d));
                        }}
                      />
                    )}

                    <Text style={styles.timeLineSmall}>{VN_SLOT_TEXT}</Text>

                    <View style={styles.rowWrap}>
                      {SESSION_SLOTS.map(slot => (
                        <OptionPill
                          key={slot}
                          label={VN_LABEL[slot]}
                          active={sessionSlot === slot}
                          onPress={() => setSessionSlot(slot)}
                        />
                      ))}
                    </View>

                    <Text style={styles.hint}>
                      Sáng: đặt trước 19:00 hôm trước • Chiều: trước 10:00 cùng
                      ngày • Tối: trước 16:00 cùng ngày (giờ VN).
                    </Text>

                    {/* Giá */}
                    <Text style={styles.pricePreview}>
                      Giá tạm tính:{' '}
                      {(
                        selectedService?.bySession?.[sessionSlot] || 0
                      ).toLocaleString('vi-VN')}
                      ₫
                    </Text>
                    <RulesBlock
                      title="Quy tắc đặt theo buổi"
                      items={getSessionRules(
                        sessionSlot === 'morning'
                          ? 'Sáng'
                          : sessionSlot === 'afternoon'
                          ? 'Chiều'
                          : 'Tối',
                      )}
                    />
                  </View>
                )}

                {/* Theo ngày */}
                {packageType === 'day' && (
                  <View style={styles.box}>
                    <Text style={styles.sectionTitle}>Chọn ngày</Text>
                    <TouchableOpacity
                      style={styles.inputLike}
                      onPress={() => setShowDayPicker(true)}
                    >
                      <Feather name="calendar" size={16} color="#6b7280" />
                      <Text style={styles.inputLikeText}>
                        {dayDate || 'Chọn ngày (YYYY-MM-DD)'}
                      </Text>
                    </TouchableOpacity>
                    {showDayPicker && (
                      <DateTimePicker
                        value={
                          dayDate ? new Date(dayDate + 'T00:00:00') : new Date()
                        }
                        mode="date"
                        display="default"
                        minimumDate={new Date()} // không cho chọn ngày trước đó
                        onChange={(e, d) => {
                          setShowDayPicker(false);
                          if (d) setDayDate(toDateYMD(d));
                        }}
                      />
                    )}
                    <Text style={styles.hint}>
                      Theo ngày: đặt trước 19:00 hôm trước (giờ VN).
                    </Text>
                    <Text style={styles.pricePreview}>
                      Giá tạm tính:{' '}
                      {(selectedService?.byDay?.dailyFee || 0).toLocaleString(
                        'vi-VN',
                      )}
                      ₫
                    </Text>
                    <RulesBlock
                      title="Quy tắc đặt theo ngày"
                      items={getDayRules()}
                    />
                  </View>
                )}

                {/* Theo tháng */}
                {packageType === 'month' && (
                  <View style={styles.box}>
                    <Text style={styles.sectionTitle}>
                      Ngày bắt đầu (mặc định 30 ngày)
                    </Text>

                    <TouchableOpacity
                      style={styles.inputLike}
                      onPress={() => setShowMonthStartPicker(true)}
                    >
                      <Feather name="calendar" size={16} color="#6b7280" />
                      <Text style={styles.inputLikeText}>
                        {monthStart || 'Chọn ngày bắt đầu (YYYY-MM-DD)'}
                      </Text>
                    </TouchableOpacity>

                    {showMonthStartPicker && (
                      <DateTimePicker
                        value={
                          monthStart
                            ? new Date(monthStart + 'T00:00:00')
                            : new Date()
                        }
                        mode="date"
                        display="default"
                        minimumDate={
                          new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
                        } // ít nhất ngày mai
                        onChange={(e, d) => {
                          setShowMonthStartPicker(false);
                          if (d) setMonthStart(toDateYMD(d));
                        }}
                      />
                    )}

                    {/* Buổi cố định từ service */}
                    <Text style={[styles.timeLineSmall, { marginTop: 8 }]}>
                      Buổi áp dụng mỗi ngày:{' '}
                      {Array.isArray(selectedService?.byMonth?.sessionsPerDay)
                        ? selectedService.byMonth.sessionsPerDay
                            .map(x => VN_LABEL[x])
                            .join(', ')
                        : '—'}
                    </Text>
                    <Text style={styles.hint}>
                      Không chọn ngày kết thúc. Gói mặc định 30 ngày kể từ ngày
                      bắt đầu.
                    </Text>
                    <Text style={styles.pricePreview}>
                      Giá tạm tính:{' '}
                      {(
                        selectedService?.byMonth?.monthlyFee || 0
                      ).toLocaleString('vi-VN')}
                      ₫
                    </Text>
                    <RulesBlock
                      title="Quy tắc đặt theo tháng"
                      items={getMonthRules(selectedService)}
                    />
                  </View>
                )}

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
              <Text style={styles.sectionTitle}>Bảng giá</Text>
              {detailService?.bySession?.enabled && (
                <>
                  <Text style={styles.detailLine}>{VN_SLOT_TEXT}</Text>
                  <Text style={styles.detailLine}>
                    • Theo buổi: S{' '}
                    {detailService.bySession.morning?.toLocaleString?.('vi-VN')}
                    ₫ • C{' '}
                    {detailService.bySession.afternoon?.toLocaleString?.(
                      'vi-VN',
                    )}
                    ₫ • T{' '}
                    {detailService.bySession.evening?.toLocaleString?.('vi-VN')}
                    ₫
                  </Text>
                </>
              )}
              {detailService?.byDay?.enabled && (
                <Text style={styles.detailLine}>
                  • Theo ngày:{' '}
                  {detailService.byDay.dailyFee?.toLocaleString?.('vi-VN')}₫
                </Text>
              )}
              {detailService?.byMonth?.enabled && (
                <Text style={styles.detailLine}>
                  • Theo tháng:{' '}
                  {detailService.byMonth.monthlyFee?.toLocaleString?.('vi-VN')}₫
                  — Buổi:{' '}
                  {Array.isArray(detailService.byMonth.sessionsPerDay) &&
                    detailService.byMonth.sessionsPerDay
                      .map(x => VN_LABEL[x] || x)
                      .join(', ')}
                </Text>
              )}
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

// Small UI parts
const PackagePill = ({ label, active, disabled, onPress }) => (
  <TouchableOpacity
    disabled={disabled}
    onPress={onPress}
    style={[
      styles.pill,
      active && styles.pillActive,
      disabled && styles.pillDisabled,
    ]}
  >
    <Text
      style={[
        styles.pillText,
        active && styles.pillTextActive,
        disabled && styles.pillTextDisabled,
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const OptionPill = ({ label, active, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.pill, active && styles.pillActive]}
  >
    <Text style={[styles.pillText, active && styles.pillTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ===== Rules UI =====
const Bullet = ({ children }) => (
  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
    <Text style={{ color: '#64748b' }}>•</Text>
    <Text style={{ flex: 1, color: '#334155' }}>{children}</Text>
  </View>
);

// Quy tắc dạng dữ liệu + renderer
const getSessionRules = slotLabel => [
  'Không chọn ngày trong quá khứ.',
  slotLabel === 'Sáng'
    ? 'Đặt trước 19:00 ngày hôm trước (giờ Việt Nam).'
    : slotLabel === 'Chiều'
    ? 'Đặt trước 10:00 cùng ngày (giờ Việt Nam).'
    : 'Đặt trước 16:00 cùng ngày (giờ Việt Nam).',
  'Khung giờ làm: Sáng 07:00–11:00 • Chiều 13:00–17:00 • Tối 18:00–21:00.',
];

const getDayRules = () => [
  'Không chọn ngày trong quá khứ.',
  'Đặt trước 19:00 ngày hôm trước (giờ Việt Nam).',
  'Khung giờ làm trong ngày: 07:00–21:00 (nghỉ 11:00–13:00).',
];

const getMonthRules = svc => {
  const sessions =
    Array.isArray(svc?.byMonth?.sessionsPerDay) &&
    svc.byMonth.sessionsPerDay.length
      ? svc.byMonth.sessionsPerDay
          .map(x =>
            x === 'morning' ? 'Sáng' : x === 'afternoon' ? 'Chiều' : 'Tối',
          )
          .join(', ')
      : '—';
  return [
    'Ngày bắt đầu phải từ ngày mai trở đi (không chọn ngày quá khứ).',
    'Thời hạn mặc định 30 ngày, ngày kết thúc tự động tính sau 30 ngày.',
    `Buổi áp dụng cố định mỗi ngày (không thay đổi): ${sessions}.`,
    'Thanh toán theo gói tháng; dịch vụ triển khai theo các buổi cố định nêu trên.',
  ];
};

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
