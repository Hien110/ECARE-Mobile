// screens/ViewIntroductionProfile.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { supporterService } from '../../services/supporterService';

import { SafeAreaView } from 'react-native-safe-area-context';
const AVATAR_FALLBACK =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-mAf0Q5orw3lJzIC2j6NFU6Ik2VNcgB.png';

// const DAY_NUM_TO_LABEL = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7', 8: 'Chủ nhật' };
const DAY_ORDER = [2, 3, 4, 5, 6, 7, 8];

// const SLOT_LABEL = {
//   morning: 'Ca sáng (06:00 - 12:00)',
//   afternoon: 'Ca chiều (12:00 - 18:00)',
//   evening: 'Ca tối (18:00 - 22:00)',
// };
// const SLOT_SHORT = { morning: 'Sáng', afternoon: 'Chiều', evening: 'Tối' };


const ViewIntroductionProfile = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState(null);

  // --- Bank card local form state ---
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [savingCard, setSavingCard] = useState(false);

  // Helpers
  const maskCard = (num = '') => {
    const clean = String(num).replace(/\D/g, '');
    if (!clean) return 'Chưa có thông tin';
    const tail = clean.slice(-4).padStart(4, '*');
    return `**** **** **** ${tail}`;
  };

  const hydrateBankForm = (p) => {
    const bc = p?.bankCard || {};
    setCardNumber(bc.cardNumber ? String(bc.cardNumber) : '');
    setCardHolderName(bc.cardHolderName || '');
    setExpiryMonth(bc.expiryMonth ? String(bc.expiryMonth) : '');
    setExpiryYear(bc.expiryYear ? String(bc.expiryYear) : '');
  };

  // ----- Fetch profile -----
  const fetchProfile = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const res = await supporterService.getMyProfile();
   
      if (res.success) {
        setProfile(res.data);
        hydrateBankForm(res.data);
      } else {
        Alert.alert('Lỗi', res.message || 'Không tải được hồ sơ.');
      }
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không tải được hồ sơ.');
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile(true);
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile(true);
  };

 
  // --- Schedule transforms ---
  // const scheduleByDay = useMemo(() => {
  //   const map = {};
  //   (profile?.schedule || []).forEach((s) => {
  //     const d = s.dayOfWeek; // 2..8
  //     if (!map[d]) map[d] = new Set();
  //     map[d].add(s.timeSlots);
  //   });
  //   return DAY_ORDER.map((d) => ({ dayNumber: d, slots: Array.from(map[d] || []) }));
  // }, [profile]);

  /**
   * todaySlots = các ca đã được ĐẶT trong hôm nay
   */
  // const todaySlots = useMemo(() => {
  //   const today = new Date();
  //   const isSameYMD = (d) => {
  //     if (!d) return false;
  //     const x = new Date(d);
  //     if (isNaN(x)) return false;
  //     return (
  //       x.getFullYear() === today.getFullYear() &&
  //       x.getMonth() === today.getMonth() &&
  //       x.getDate() === today.getDate()
  //     );
  //   };

  //   // profile.bookings | profile.appointments | profile.todayBookings
  //   const list =
  //     (Array.isArray(profile?.todayBookings) && profile.todayBookings) ||
  //     (Array.isArray(profile?.bookings) && profile.bookings) ||
  //     (Array.isArray(profile?.appointments) && profile.appointments) ||
  //     [];

  //   const BOOKED_STATUS = ['confirmed', 'accepted', 'booked', 'approved', 'pending'];

  //   const bookedToday = list.filter((b) => {
  //     const status = String(b?.status || '').toLowerCase();
  //     const dateField = b?.date || b?.bookingDate || b?.start || b?.startTime || b?.startAt;
  //     return BOOKED_STATUS.includes(status) && isSameYMD(dateField);
  //   });

  //   const slots = bookedToday
  //     .map((b) => b?.timeSlot || b?.slot || b?.timeSlots)
  //     .filter((s) => s === 'morning' || s === 'afternoon' || s === 'evening');

  //   return new Set(slots);
  // }, [profile]);

  const renderStars = (rating) =>
    Array.from({ length: 5 }, (_, i) => (
      <Icon key={i} name={i < rating ? 'star' : 'star-outline'} size={14} color="#FFD700" />
    ));

  // ======= BỔ SUNG: Hiển thị giá dịch vụ theo ca =======
  const formatCurrency = (n) => {
    const x = Math.round(Number(n) || 0);
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const getSessionFee = useCallback(
    (slotKey) => {
      const feeVal = profile?.sessionFee?.[slotKey];
      if (typeof feeVal !== 'number' || feeVal <= 0) return 'Chưa có';
      return `${formatCurrency(feeVal)}đ/ca`;
    },
    [profile],
  );
  // ======================================================

  // --- Bank card validations ---
  const validateBankCard = () => {
    const now = new Date();
    const y = Number(String(expiryYear).replace(/\D/g, ''));
    const m = Number(String(expiryMonth).replace(/\D/g, ''));
    const numberClean = String(cardNumber).replace(/\s+/g, '').replace(/-/g, '');

    if (!/^\d{12,19}$/.test(numberClean)) {
      Alert.alert('Thẻ không hợp lệ', 'Số thẻ phải gồm 12–19 chữ số.');
      return false;
    }
    if (!cardHolderName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên chủ thẻ.');
      return false;
    }
    if (!(m >= 1 && m <= 12)) {
      Alert.alert('Tháng hết hạn không hợp lệ', 'Tháng phải từ 1 đến 12.');
      return false;
    }
    if (!(y >= now.getFullYear())) {
      Alert.alert('Năm hết hạn không hợp lệ', `Năm phải từ ${now.getFullYear()} trở đi.`);
      return false;
    }
    if (y === now.getFullYear() && m < now.getMonth() + 1) {
      Alert.alert('Thời hạn không hợp lệ', 'Thẻ đã hết hạn.');
      return false;
    }
    return { cardNumber: numberClean, cardHolderName: cardHolderName.trim(), expiryMonth: m, expiryYear: y };
  };

  const onSaveBankCard = async () => {
    const payload = validateBankCard();
    if (!payload) return;

    try {
      setSavingCard(true);
      const res = await supporterService.updateMyProfile({ bankCard: payload });
      setSavingCard(false);
      if (res?.success) {
        setProfile(res.data);
        hydrateBankForm(res.data);
        Alert.alert('Thành công', 'Đã lưu thẻ ngân hàng.');
      } else {
        Alert.alert('Không thành công', res?.message || 'Không thể lưu thẻ.');
      }
    } catch (e) {
      setSavingCard(false);
      Alert.alert('Lỗi', e?.message || 'Không thể lưu thẻ.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={{ marginTop: 12, color: '#666' }}>Đang tải hồ sơ...</Text>
      </SafeAreaView>
    );
  }

  const fullName = profile?.user?.fullName || 'Supporter';
  const avatar = profile?.user?.avatar || AVATAR_FALLBACK;
  const years = profile?.experience?.totalYears ?? 0;
  const description =
    profile?.experience?.description || 'Chưa có mô tả. Hãy cập nhật để khách hàng hiểu rõ hơn về bạn.';
  const serviceAreaKm = profile?.serviceArea ?? 0;

  // 🔹 ĐỊA CHỈ SUPPORTER: bắt nhiều dạng field, kèm log
  const userObj = profile?.user || {};
  const addressText =
    userObj.currentAddress ||
    userObj.current_address ||
    userObj.address ||
    userObj.currentLocation?.address ||
    userObj.currentLocation?.formatted ||
    'Chưa cập nhật địa chỉ.';


  const reviews = Array.isArray(profile?.reviews) ? profile.reviews : [];
  const ratingAvg =
    typeof profile?.ratings?.average === 'number'
      ? profile.ratings.average
      : (reviews.reduce((s, r) => s + (r.rating || 0), 0) / (reviews.length || 1)) || 0;

  const bankCardPreview = {
    bankName: profile?.bankCard?.bankName || '',
    holder: cardHolderName || profile?.bankCard?.cardHolderName || '',
    masked: maskCard(cardNumber || profile?.bankCard?.cardNumber),
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hồ sơ cá nhân</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <Image source={{ uri: avatar }} style={styles.profileImage} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{fullName}</Text>
              <Text style={styles.profileRole}>Supporter • {years || 0} năm kinh nghiệm</Text>
              <View style={styles.verifiedBadge}>
                <Icon name="checkmark-circle" size={16} color="#0046FF" />
                <Text style={styles.verifiedText}>Đã xác minh</Text>
              </View>

              {/* 🔹 ĐỊA CHỈ HỖ TRỢ VIÊN */}
              <View style={styles.addressRow}>
                <Icon
                  name="location-outline"
                  size={16}
                  color="#4A90E2"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.addressText} numberOfLines={2}>
                  {addressText}
                  {serviceAreaKm > 0 ? ` • Bán kính phục vụ ~${serviceAreaKm} km` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile?.stats?.completedJobs ?? 0}</Text>
              <Text style={styles.statLabel}>Công việc hoàn thành</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{(profile?.stats?.successRate ?? 0)}%</Text>
              <Text style={styles.statLabel}>Tỷ lệ thành công</Text>
            </View>
          </View>
        </View>

        {/* Job Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mô tả công việc</Text>
          <Text style={styles.description}>{description}</Text>
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Đánh giá từ khách hàng</Text>

          {reviews.length === 0 ? (
            <Text style={{ color: '#666' }}>Chưa có đánh giá nào.</Text>
          ) : (
            <>
              <View style={styles.ratingOverview}>
                <View style={styles.ratingLeft}>
                  <Text style={styles.ratingScore}>{ratingAvg.toFixed(1)}</Text>
                  <View style={styles.starsContainer}>{renderStars(Math.round(ratingAvg))}</View>
                  <Text style={styles.ratingCount}>{reviews.length} đánh giá</Text>
                </View>

                <View style={styles.ratingBars}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter((r) => Math.round(r.rating) === star).length;
                    const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                    return (
                      <View key={star} style={styles.ratingBar}>
                        <Text style={styles.starNumber}>{star}</Text>
                        <View style={styles.barContainer}>
                          <View style={[styles.bar, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.barCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <Text style={styles.reviewsTitle}>Đánh giá gần đây</Text>
              {reviews.slice(0, 5).map((review, index) => (
                <View key={index} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.avatarText}>
                        {(review.name || 'U')[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.reviewInfo}>
                      <Text style={styles.reviewerName}>{review.name || 'Ẩn danh'}</Text>
                      <View style={styles.reviewStars}>{renderStars(review.rating || 0)}</View>
                    </View>
                  </View>
                  <Text style={styles.reviewComment}>{review.comment || ''}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Edit button */}
        {/* <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() =>
              navigation?.navigate?.('EditIntroduction', {
                initialProfile: profile,
                onUpdated: (updatedProfile) => {
                  if (updatedProfile) setProfile(updatedProfile);
                },
              })
            }
          >
            <Text style={styles.editButtonText}>Chỉnh sửa hồ sơ</Text>
          </TouchableOpacity>
        </View> */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2F66FF',
    height: 60,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', flex: 1, textAlign: 'center', marginRight: 10 },
  placeholder: { width: 40 },
  content: { flex: 1 },

  profileSection: { backgroundColor: '#ffffff', padding: 16 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  profileImage: { width: 60, height: 60, borderRadius: 30, marginRight: 12 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '600', color: '#000000', marginBottom: 4 },
  profileRole: { fontSize: 14, color: '#666666', marginBottom: 4 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center' },
  verifiedText: { fontSize: 12, color: '#0046FF', marginLeft: 4 },

  // 🔹 ĐỊA CHỈ
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },

  statsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#4A90E2' },
  statLabel: { fontSize: 12, color: '#666666', textAlign: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: '#E0E0E0', marginHorizontal: 16 },

  section: { backgroundColor: '#ffffff', padding: 16, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#000000', marginBottom: 12 },
  subTitle: { fontSize: 14, color: '#666666', marginBottom: 12 },
  description: { fontSize: 14, color: '#333333', lineHeight: 20, marginBottom: 12 },

  tagContainer: { flexDirection: 'row' },
  tag: { backgroundColor: '#FF6B35', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  tagText: { fontSize: 12, color: '#ffffff', fontWeight: '500' },

  // Weekly schedule item with border
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E3E8EF',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  dayText: { fontSize: 14, color: '#0B1220', fontWeight: '700' },
  timeContainer: { flexDirection: 'row', alignItems: 'center' },
  availableDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0046FF', marginRight: 8 },
  unavailableDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9AA6B2', marginRight: 8 },
  timeText: { fontSize: 14, color: '#0B1220' },
  unavailableText: { fontSize: 14, color: '#9AA6B2' },
  nextAvailable: { fontSize: 12, color: '#666666', marginTop: 8, marginBottom: 16 },

  // Shift cards (today)
  shiftContainer: { gap: 8 },
  shiftButton: { borderWidth: 3, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, backgroundColor: '#ffffff' },
  shiftText: { fontSize: 14, color: '#000000', fontWeight: '500' },
  shiftStatus: { fontSize: 12, marginTop: 4 },
  shiftPriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  shiftPrice: { fontSize: 13, color: '#0B1220', fontWeight: '500' },

  serviceTitle: { fontSize: 14, fontWeight: '600', color: '#000000', marginTop: 16, marginBottom: 12 },
  serviceItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  serviceIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: 14, color: '#000000', fontWeight: '500' },
  servicePrice: { fontSize: 14, color: '#4A90E2', fontWeight: '600' },
  noteContainer: { flexDirection: 'row', backgroundColor: '#F5F5F5', padding: 12, borderRadius: 8, marginTop: 16 },
  noteText: { fontSize: 12, color: '#666666', marginLeft: 8, flex: 1, lineHeight: 16 },

  ratingOverview: { flexDirection: 'row', marginBottom: 16 },
  ratingLeft: { alignItems: 'center', marginRight: 24 },
  ratingScore: { fontSize: 32, fontWeight: '700', color: '#000000' },
  starsContainer: { flexDirection: 'row', marginVertical: 4 },
  ratingCount: { fontSize: 12, color: '#666666' },

  ratingBars: { flex: 1 },
  ratingBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  starNumber: { fontSize: 12, color: '#666666', width: 12 },
  barContainer: { flex: 1, height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, marginHorizontal: 8 },
  bar: { height: 8, backgroundColor: '#FFD700', borderRadius: 4, width: '0%' },
  barCount: { fontSize: 12, color: '#666666', width: 24, textAlign: 'right' },

  reviewsTitle: { fontSize: 14, fontWeight: '600', color: '#000000', marginBottom: 8 },
  reviewItem: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
  reviewInfo: { flex: 1 },
  reviewerName: { fontSize: 14, fontWeight: '600', color: '#000000', marginBottom: 2 },
  reviewStars: { flexDirection: 'row' },
  reviewComment: { fontSize: 14, color: '#333333', lineHeight: 18 },

  actionButtons: { padding: 16, gap: 12 },
  editButton: { backgroundColor: '#2F66FF', paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
  editButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },

  // --- Bank card styles ---
  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  bankInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  bankDetails: { marginLeft: 12 },
  bankName: { fontSize: 16, fontWeight: '600', color: '#000000', marginBottom: 2 },
  cardNumber: { fontSize: 14, color: '#666666', marginBottom: 2 },
  cardHolder: { fontSize: 12, color: '#999999' },
  inputLabel: { fontSize: 13, color: '#0B1220', marginBottom: 6, fontWeight: '500' },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E6EF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  saveBankBtn: {
    backgroundColor: '#FF8040',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBankText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default ViewIntroductionProfile;
