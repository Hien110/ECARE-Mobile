import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import DoctorNavTabs from '../../components/DoctorNavTabs';
import { doctorService } from '../../services/doctorService';

/* ---------------- helpers: bóc tách linh hoạt ---------------- */
const pickProfileFromResponse = (res) => {
  const data = res?.data ?? res;
  if (Array.isArray(data) && data.length) return data[0];
  return (
    data?.doctorProfile ??
    data?.profile ??
    res?.doctorProfile ??
    res?.profile ??
    data ??
    null
  );
};

const pickUserNode = (p) => p?.user ?? p?.account ?? p?.owner ?? p?.createdBy ?? null;

const first = (...arr) => arr.find(Boolean);

const getUrlLike = (v) => {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.url || v.href || v.src || undefined;
  return undefined;
};

const pickAvatarUrl = (p, u) =>
  first(
    getUrlLike(p?.avatar),
    getUrlLike(p?.avatarUrl),
    getUrlLike(p?.photo),
    getUrlLike(p?.photoURL),
    getUrlLike(p?.profileImage),
    getUrlLike(p?.image),
    getUrlLike(p?.imageUrl),
    getUrlLike(u?.avatar),
    getUrlLike(u?.avatarUrl),
    getUrlLike(u?.avatarURL),
    getUrlLike(u?.photo),
    getUrlLike(u?.photoURL),
    getUrlLike(u?.profileImage),
    getUrlLike(u?.image),
    getUrlLike(u?.imageUrl)
  );

const pickDisplayName = (p, u) =>
  first(
    p?.fullName,
    p?.name,
    u?.fullName,
    u?.name,
    u?.displayName,
    u?.username,
    (u?.email && String(u.email).split('@')[0])
  );

/* -------------------------------------------------------------- */

const DEFAULT_AVATAR =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-h7we5cEhjWKmxlMrlmcjabsOKhK8JA.png';

const ViewDoctorProfileScreen = ({ navigation, route }) => {
  const profileId = route?.params?.profileId || null;

  const [selectedTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [profile, setProfile] = useState(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    setAvatarFailed(false);
    try {
      const res = profileId
        ? await doctorService.getProfileById(profileId)
        : await doctorService.getMyProfile();

      const picked = pickProfileFromResponse(res);
      if (picked) setProfile(picked);
      else {
        setProfile(null);
        setErrorMsg('Không thể tải hồ sơ.');
      }
    } catch {
      setProfile(null);
      setErrorMsg('Có lỗi xảy ra khi tải hồ sơ.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  // ----- derive fields -----
  const rating = Number(profile?.ratingStats?.averageRating) || 0;
  const totalRatings = Number(profile?.ratingStats?.totalRatings) || 0;

  const userNode = pickUserNode(profile);
  const doctorName = pickDisplayName(profile, userNode) || 'Bác sĩ';
  const username = userNode?.username || '';
  const avatarUrlRaw = pickAvatarUrl(profile, userNode) || DEFAULT_AVATAR;
  const avatarUri = avatarFailed ? DEFAULT_AVATAR : avatarUrlRaw;

  // Lĩnh vực chuyên môn: ưu tiên trường specialization (string) mới
  const specialty = (() => {
    const directSpec = (profile?.specialization || profile?.doctorProfile?.specialization || '')
      .toString()
      .trim();
    if (directSpec) return directSpec;

    if (Array.isArray(profile?.specializations) && profile.specializations.length) {
      return profile.specializations.join(', ');
    }
    if (
      profile?.doctorProfile?.specializations &&
      Array.isArray(profile.doctorProfile.specializations) &&
      profile.doctorProfile.specializations.length
    ) {
      return profile.doctorProfile.specializations.join(', ');
    }
    return '—';
  })();
  const experienceYears = Number.isFinite(profile?.experience) ? `${profile.experience} năm` : '—';
  const hospitalName = profile?.hospitalName || '—';

  const renderStars = (val = 0) => {
    const full = Math.floor(val);
    const half = val % 1 !== 0;
    const empties = 5 - Math.ceil(val);
    return (
      <View style={styles.starsContainer}>
        {Array.from({ length: full }, (_, i) => (
          <Icon key={`full-${i}`} name="star" size={14} color="#FFD700" />
        ))}
        {half && <Icon name="star-half" size={14} color="#FFD700" />}
        {Array.from({ length: empties }, (_, i) => (
          <Icon key={`empty-${i}`} name="star-outline" size={14} color="#FFD700" />
        ))}
      </View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>Chưa có hồ sơ bác sĩ</Text>
      <Text style={styles.emptyDesc}>
        Bạn chưa tạo hồ sơ. Hãy thiết lập thông tin để bệnh nhân có thể tìm và đặt lịch với bạn.
      </Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={() => navigation?.navigate?.('CreateDoctorProfile')}
      >
        <Icon name="add-circle-outline" size={18} color="#ffffff" />
        <Text style={styles.emptyBtnText}>Tạo hồ sơ ngay</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2F6FED" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Xem hồ sơ bác sĩ</Text>
          <Text style={styles.headerSubtitle}>Thông tin hồ sơ hiển thị cho bệnh nhân</Text>
        </View>
      </View>

      {/* Tabs */}
      <DoctorNavTabs
  navigation={navigation}
  active={selectedTab}  
  routes={{
    profile: [
      'ProfileGate',                 
      'ViewDoctorProfile',           
      'IntroductionCreateDoctorProfile', 
      'EditDoctorProfile',           
    ],
    schedule: [
      'CreateWorkSchedule' 
    ],
    statistics: [
      'EvaluationStatistics',
    ],
  }}
/>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#2F6FED" />
            <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorWrap}>
            <Icon name="alert-circle-outline" size={18} color="#D32F2F" />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchProfile}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : !profile ? (
          <EmptyState />
        ) : (
          <>
            {/* Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.profileImage}
                  onError={() => setAvatarFailed(true)}
                />
                <View style={styles.profileInfo}>
                  <Text style={styles.doctorName}>{doctorName}</Text>
                  {!!username && <Text style={styles.doctorUsername}>@{username}</Text>}
                  <View style={styles.ratingContainer}>
                    {renderStars(rating)}
                    <Text style={styles.ratingText}>
                      {rating.toFixed(1)} ({totalRatings} đánh giá)
                    </Text>
                  </View>
                </View>

                {/* Nút nhỏ chỉnh sửa (trong thẻ) */}
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => navigation?.navigate?.('EditDoctorProfile')}
                >
                  <Icon name="pencil" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>

            </View>

            {/* Professional */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: '#E8F5E8' }]}>
                  <MaterialIcons name="school" size={20} color="#4CAF50" />
                </View>
                <View style={styles.sectionTitleContainer}>
                  <Text style={styles.sectionTitle}>Thông tin chuyên môn</Text>
                  <Text style={styles.sectionSubtitle}>Trình độ và kinh nghiệm</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <View style={styles.infoIcon}>
                    <MaterialIcons name="verified" size={16} color="#4CAF50" />
                  </View>
                  <Text style={styles.infoLabel}>Lĩnh vực chuyên môn</Text>
                </View>
              </View>
              <Text style={styles.infoValue}>{specialty}</Text>

              <View style={styles.infoGrid}>
                <View style={styles.gridItem}>
                  <View style={styles.gridIcon}>
                    <MaterialIcons name="access-time" size={16} color="#9C27B0" />
                  </View>
                  <Text style={styles.gridLabel}>Kinh nghiệm</Text>
                  <Text style={styles.gridValue}>{experienceYears}</Text>
                </View>

                <View style={styles.gridItem}>
                  <View style={styles.gridIcon}>
                    <MaterialIcons name="star-rate" size={16} color="#FFD700" />
                  </View>
                  <Text style={styles.gridLabel}>Điểm trung bình</Text>
                  <Text style={styles.gridValue}>{rating.toFixed(1)} / 5</Text>
                </View>
              </View>
            </View>


            {/* Statistics */}
            <View style={styles.statisticsContainer}>
              <View style={styles.statItem}>
                <View style={styles.statIcon}>
                  <MaterialIcons name="star" size={24} color="#2F6FED" />
                </View>
                <Text style={styles.statNumber}>{rating.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Đánh giá TB</Text>
              </View>

              <TouchableOpacity
                style={styles.statItem}
                activeOpacity={0.8}
                onPress={() => {
                  const doctorUserId = userNode?._id;
                  if (!doctorUserId) return;
                  navigation?.navigate?.('DoctorReviews', {
                    userId: String(doctorUserId),
                    avgRating: rating,
                    totalRatings,
                  });
                }}
              >
                <View style={styles.statIcon}>
                  <MaterialIcons name="assignment" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.statNumber}>{totalRatings}</Text>
                <Text style={styles.statLabel}>Lượt đánh giá</Text>
              </TouchableOpacity>

              <View style={styles.statItem}>
                <View style={styles.statIcon}>
                  <MaterialIcons name="access-time" size={24} color="#9C27B0" />
                </View>
                <Text style={styles.statNumber}>
                  {Number.isFinite(profile?.experience) ? profile?.experience : 0}
                </Text>
                <Text style={styles.statLabel}>Năm KN</Text>
              </View>
            </View>

            {/* CTA: Chỉnh sửa hồ sơ (nút to, rõ ràng) */}
            <TouchableOpacity
              style={styles.editProfileCta}
              onPress={() => navigation?.navigate?.('EditDoctorProfile')}
            >
              <Icon name="create-outline" size={18} color="#fff" />
              <Text style={styles.editProfileCtaText}>Chỉnh sửa hồ sơ</Text>
            </TouchableOpacity>
          </>
        )}
        
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Container & Header
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2F6FED',
    minHeight: 80,
  },
  backButton: { padding: 8, marginRight: 12 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#E3F2FD', lineHeight: 18 },

  // Tabs
  content: { flex: 1, padding: 16 },

  // Loading & error
  loadingWrap: { backgroundColor: '#ffffff', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16 },
  loadingText: { marginTop: 8, fontSize: 13, color: '#666666' },
  errorWrap: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: { color: '#D32F2F', fontSize: 13, textAlign: 'center', marginVertical: 6 },
  retryBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#D32F2F', borderRadius: 8 },
  retryText: { color: '#ffffff', fontWeight: '600' },

  // Empty
  emptyWrap: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  emptyDesc: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 6, marginBottom: 12, lineHeight: 18 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2F6FED', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '600', marginLeft: 6 },

  // Profile card
  profileCard: { backgroundColor: '#2F6FED', borderRadius: 16, padding: 20, marginBottom: 16 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  profileImage: { width: 60, height: 60, borderRadius: 30, marginRight: 12, backgroundColor: '#e6eefb' },
  profileInfo: { flex: 1 },
  doctorName: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 2 },
  doctorUsername: { fontSize: 14, color: '#E3F2FD', marginBottom: 4 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center' },
  starsContainer: { flexDirection: 'row' },
  ratingText: { fontSize: 14, color: '#ffffff', marginLeft: 6 },

  // small edit icon on card
  editButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },

  // CTA button below card
  editProfileCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2F6FED',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 40,
    marginTop: 30,
  },
  editProfileCtaText: { color: '#fff', fontWeight: '700' },

  // Fees
  feesContainer: { flexDirection: 'row', gap: 12 },
  feeItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  feeIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  feeLabel: { fontSize: 12, color: '#E3F2FD', marginBottom: 4 },
  feeAmount: { fontSize: 16, fontWeight: '600', color: '#ffffff' },

  // Sections
  section: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sectionTitleContainer: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#000000', marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, color: '#666666' },

  infoRow: { marginBottom: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'center' },
  infoIcon: { marginRight: 8 },
  infoLabel: { fontSize: 14, color: '#666666' },
  infoValue: {
    fontSize: 16, color: '#000000', fontWeight: '500',
    marginBottom: 16, backgroundColor: '#F0F7FF', padding: 12, borderRadius: 8,
  },

  infoGrid: { flexDirection: 'row', gap: 12 },
  gridItem: { flex: 1, backgroundColor: '#F8F9FA', borderRadius: 8, padding: 12, alignItems: 'center' },
  gridIcon: { marginBottom: 8 },
  gridLabel: { fontSize: 12, color: '#666666', marginBottom: 4 },
  gridValue: { fontSize: 14, color: '#000000', fontWeight: '500' },

  workplaceName: { fontSize: 16, fontWeight: '600', color: '#000000', marginBottom: 8 },
  addressContainer: { flexDirection: 'row', alignItems: 'center' },
  workplaceAddress: { fontSize: 14, color: '#666666', marginLeft: 4, flex: 1 },

  // Stats
  statisticsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statIcon: { marginBottom: 8 },
  statNumber: { fontSize: 20, fontWeight: '700', color: '#000000', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#666666', textAlign: 'center' },
});

ViewDoctorProfileScreen.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func,
    goBack: PropTypes.func,
  }).isRequired,
  route: PropTypes.shape({
    params: PropTypes.shape({
      profileId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
  }).isRequired,
};

export default ViewDoctorProfileScreen;