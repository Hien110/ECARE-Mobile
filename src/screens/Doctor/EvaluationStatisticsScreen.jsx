import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import DoctorNavTabs from '../../components/DoctorNavTabs';
import { doctorService } from '../../services/doctorService';
import { userService } from '../../services/userService';
import { SafeAreaView } from 'react-native-safe-area-context';
const { width } = Dimensions.get('window');

const EvaluationStatisticsScreen = ({ navigation }) => {
  const [selectedTab, setSelectedTab] = useState('statistics');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [stats, setStats] = useState(null);
  const [doctorUserId, setDoctorUserId] = useState(null);

  // --- Fetch rating stats from API ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        // Try authoritative summary for current doctor
        const res = await doctorService.getMyRatingStats();
        if (!mounted) return;
        if (res?.success) {
          const payload = res.data || {};
          const avg = Number(payload.avg ?? payload.averageRating ?? payload.avgRating ?? payload.ratingAvg ?? 0) || 0;
          const total = Number(payload.total ?? payload.totalRatings ?? payload.count ?? 0) || 0;
          const breakdown = payload.breakdown ?? payload.starCounts ?? payload.stars ?? {};
          const weekly = payload.weeklyRatings ?? payload.weeklyReviewCounts ?? null;
          const recent = payload.reviews ?? payload.recentReviews ?? null;
          setStats({ averageRating: avg, totalReviews: total, starCounts: breakdown, weeklyRatings: weekly, recentReviews: recent });
        } else {
          // Fallback: try to resolve doctor userId and fetch summary + count
          const me = await userService.getUser();
          const id = me?.data?._id || null;
          if (!id) {
            setErrorMsg(res?.message || 'Không thể tải thống kê.');
          } else {
            const sum = await doctorService.getDoctorRatingSummary(String(id));
            const cnt = await doctorService.getDoctorRatingCount(String(id));
            const avg = Number(sum?.success ? (sum.data?.avg ?? 0) : 0) || 0;
            const breakdown = sum?.success ? (sum.data?.breakdown ?? {}) : {};
            const total = Number(cnt?.success ? (cnt.data?.total ?? (sum?.success ? sum.data?.total ?? 0 : 0)) : (sum?.success ? sum.data?.total ?? 0 : 0)) || 0;
            setStats({ averageRating: avg, totalReviews: total, starCounts: breakdown, weeklyRatings: null, recentReviews: null });
          }
        }
      } catch (e) {
        if (!mounted) return;
        setErrorMsg('Có lỗi khi tải thống kê.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Lấy userId của bác sĩ hiện tại để dùng cho điều hướng sang màn tất cả đánh giá
  useEffect(() => {
    (async () => {
      const res = await userService.getUser();
      const id = res?.data?._id || null;
      setDoctorUserId(id);
    })();
  }, []);

  // --- Normalize data from backend to UI shape ---
  // Chấp nhận các key phổ biến: averageRating|avgRating, totalReviews|totalRatings, starCounts|stars
  const averageRating = useMemo(() => {
    if (!stats) return 0;
    return Number(
      stats.averageRating ??
      stats.avgRating ??
      stats.ratingAvg ??
      0
    ) || 0;
  }, [stats]);

  const totalReviews = useMemo(() => {
    if (!stats) return 0;
    return Number(
      stats.totalReviews ??
      stats.totalRatings ??
      stats.count ??
      0
    ) || 0;
  }, [stats]);

  const starCounts = useMemo(() => {
    // Chuẩn hóa về object {1: n, 2: n, 3: n, 4: n, 5: n}
    const raw =
      (stats?.starCounts) ||
      (stats?.stars) ||
      (stats?.breakdown) ||
      {};
    const get = (k) => Number(raw[k] ?? raw[String(k)] ?? 0) || 0;
    return {
      1: get(1),
      2: get(2),
      3: get(3),
      4: get(4),
      5: get(5),
    };
  }, [stats]);

  const ratingBreakdown = useMemo(() => {
    const total = Math.max(totalReviews, 1); // để tránh chia 0
    return [5, 4, 3, 2, 1].map(stars => {
      const count = starCounts[stars] || 0;
      return {
        stars,
        count,
        percentage: Math.round((count / total) * 100),
      };
    });
  }, [starCounts, totalReviews]);

  // Nếu backend có trả dữ liệu theo tuần: [{day:'T2', value: 10}, ...]
  const weeklyData = useMemo(() => {
    const raw = stats?.weeklyRatings || stats?.weeklyReviewCounts || null;
    // Cho phép nhiều format: {labels:[...], counts:[...] } hoặc array obj
    if (Array.isArray(raw)) {
      return raw.map((it) => ({
        day: it.day || it.label || '',
        value: Number(it.value || it.count || 0) || 0,
      }));
    }
    if (raw && Array.isArray(raw.labels) && Array.isArray(raw.counts)) {
      return raw.labels.map((d, i) => ({
        day: String(d),
        value: Number(raw.counts[i] || 0) || 0,
      }));
    }
    return null;
  }, [stats]);

  // Một vài chỉ số thêm cho lưới "hoạt động" (dựa trên rating)
  const fiveStarPct = useMemo(() => (
    totalReviews ? Math.round((starCounts[5] / totalReviews) * 100) : 0
  ), [starCounts, totalReviews]);

  const belowFourPct = useMemo(() => {
    const belowFour =
      (starCounts[1] || 0) +
      (starCounts[2] || 0) +
      (starCounts[3] || 0);
    return totalReviews ? Math.round((belowFour / totalReviews) * 100) : 0;
  }, [starCounts, totalReviews]);

  // --- UI helpers ---
  const renderStars = (rating) => {
    const full = Math.floor(rating);
    const hasHalf = rating % 1 !== 0;
    const total = 5;
    const views = [];
    for (let i = 0; i < full; i++) {
      views.push(<Icon key={`full-${i}`} name="star" size={16} color="#FFD700" />);
    }
    if (hasHalf) views.push(<Icon key="half" name="star-half" size={16} color="#FFD700" />);
    for (let i = views.length; i < total; i++) {
      views.push(<Icon key={`empty-${i}`} name="star-outline" size={16} color="#FFD700" />);
    }
    return <View style={styles.starsContainer}>{views}</View>;
  };

  const renderBarChart = () => {
    if (!weeklyData || weeklyData.length === 0) {
      return (
        <View style={[styles.chartContainer, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#666' }}>Chưa có dữ liệu biểu đồ</Text>
        </View>
      );
    }
    const maxValue = Math.max(...weeklyData.map(item => item.value), 1);
    return (
      <View style={styles.chartContainer}>
        <View style={styles.barsContainer}>
          {weeklyData.map((item, index) => (
            <View key={index} style={styles.barItem}>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: (item.value / maxValue) * 100,
                      backgroundColor: index % 2 === 0 ? '#4A90E2' : '#FF9800',
                    },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{item.day}</Text>
              <Text style={styles.barValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const activityStats = [
    { value: String(totalReviews), label: 'Lượt đánh giá', icon: 'chatbubbles-outline', color: '#4A90E2' },
    { value: averageRating.toFixed(1), label: 'Điểm trung bình', icon: 'star-outline', color: '#FF9800' },
  ];

  const percentStats = [
    { value: `${fiveStarPct}%`, label: 'Tỉ lệ 5★', icon: 'thumbs-up-outline', color: '#4CAF50' },
    { value: `${belowFourPct}%`, label: 'Dưới 4★', icon: 'trending-down-outline', color: '#9C27B0' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Thống kê đánh giá</Text>
          <Text style={styles.headerSubtitle}>Tổng quan chất lượng dịch vụ & phản hồi bệnh nhân</Text>
        </View>
      </View>

      {/* Tabs */}
      <DoctorNavTabs navigation={navigation} active={selectedTab} routes={{
        profile: ['ProfileGate','ViewDoctorProfile','IntroductionCreateDoctorProfile','EditDoctorProfile'],
        schedule: ['CreateWorkSchedule'],
        statistics: ['EvaluationStatistics']
      }} />

      {/* Loading / Error */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={{ marginTop: 8, color: '#666' }}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Icon name="alert-circle-outline" size={16} color="#D32F2F" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Rating Statistics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thống kê đánh giá</Text>

            <View style={styles.ratingOverview}>
              <View style={styles.ratingLeft}>
                <Text style={styles.ratingScore}>{averageRating.toFixed(1)}</Text>
                {renderStars(averageRating)}
                <Text style={styles.ratingLabel}>Điểm trung bình</Text>
              </View>

              <View style={styles.ratingRight}>
                <Text style={styles.totalReviews}>{totalReviews}</Text>
                <Text style={styles.reviewsLabel}>Lượt đánh giá</Text>
              </View>
            </View>

            <View style={styles.ratingBreakdown}>
              {ratingBreakdown.map((item) => (
                <View key={item.stars} style={styles.ratingRow}>
                  <Text style={styles.starNumber}>{item.stars}</Text>
                  <Icon name="star" size={12} color="#FFD700" />
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${item.percentage}%` }]} />
                  </View>
                  <Text style={styles.ratingCount}>{item.count}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Activity Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chỉ số chất lượng</Text>

            <View style={styles.statsGrid}>
              {activityStats.map((stat, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.statCard}
                  activeOpacity={index === 0 ? 0.8 : 1}
                  onPress={
                    index === 0 && doctorUserId
                      ? () =>
                          navigation?.navigate?.('DoctorReviews', {
                            userId: String(doctorUserId),
                            avgRating: averageRating,
                            totalRatings: totalReviews,
                          })
                      : undefined
                  }
                >
                  <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
                    <Icon name={stat.icon} size={20} color={stat.color} />
                  </View>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.persGrid}>
              {percentStats.map((stat, index) => (
                <View key={index} style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
                    <Icon name={stat.icon} size={20} color={stat.color} />
                  </View>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

     

          {/* Recent Reviews (nếu backend có) */}
          {Array.isArray(stats?.recentReviews) && stats.recentReviews.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Đánh giá gần đây</Text>
              {stats.recentReviews.map((rv, idx) => (
                <View key={idx} style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: '#FFF4E5' }]}>
                    <Icon name="chatbubble-ellipses-outline" size={16} color="#FF9800" />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>
                      {rv?.patientName ? `BN ${rv.patientName}` : 'Người dùng ẩn danh'} — {rv?.stars || 0}★
                    </Text>
                    <Text style={styles.activityTime}>
                      {rv?.createdAt ? new Date(rv.createdAt).toLocaleString() : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#2F6FED', minHeight: 80,
  },
  backButton: { padding: 8, marginRight: 12 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#E3F2FD', lineHeight: 18 },

  tabContainer: { flexDirection: 'row', backgroundColor: '#ffffff', paddingHorizontal: 16 },
  tab: {
    flex: 1, paddingVertical: 16, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#4A90E2' },
  tabText: { fontSize: 14, color: '#666666', fontWeight: '500' },
  activeTabText: { color: '#4A90E2', fontWeight: '600' },

  content: { flex: 1, padding: 16 },

  section: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#000000', marginBottom: 16 },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFEBEE', borderRadius: 8, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FFCDD2',
  },
  errorText: { color: '#D32F2F', fontSize: 13, marginLeft: 6 },

  // Rating overview
  ratingOverview: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  ratingLeft: { alignItems: 'center', marginRight: 32 },
  ratingScore: { fontSize: 32, fontWeight: '700', color: '#000000', marginBottom: 8 },
  starsContainer: { flexDirection: 'row', marginBottom: 8 },
  ratingLabel: { fontSize: 12, color: '#666666' },
  ratingRight: { alignItems: 'center' },
  totalReviews: { fontSize: 24, fontWeight: '700', color: '#000000', marginBottom: 4 },
  reviewsLabel: { fontSize: 12, color: '#666666' },

  // Breakdown
  ratingBreakdown: { marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  starNumber: { fontSize: 12, color: '#666666', width: 12, marginRight: 4 },
  progressBarContainer: {
    flex: 1, height: 8, backgroundColor: '#F0F0F0',
    borderRadius: 4, marginHorizontal: 12, overflow: 'hidden',
  },
  progressBar: { height: '100%', backgroundColor: '#FFD700', borderRadius: 4 },
  ratingCount: { fontSize: 12, color: '#666666', width: 24, textAlign: 'right' },

  // Stats grid
  statsGrid: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  persGrid: { flexDirection: 'row', gap: 6, marginTop: 4 },
  statCard: {
    width: (width - 64) / 2, backgroundColor: '#F8F9FA',
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  statIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#000000', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#666666', textAlign: 'center' },

  // Chart
  chartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  chartIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#E3F2FD',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  chartTitleContainer: { flex: 1 },
  chartSubtitle: { fontSize: 12, color: '#666666' },
  chartSection: { marginBottom: 8 },
  chartLabel: { fontSize: 14, fontWeight: '500', color: '#000000', marginBottom: 8 },
  chartLegend: { flexDirection: 'row', marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 12, color: '#666666' },
  chartContainer: { height: 120, marginBottom: 8 },
  barsContainer: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    height: 100, paddingHorizontal: 8,
  },
  barItem: { alignItems: 'center', flex: 1 },
  barWrapper: { height: 80, justifyContent: 'flex-end', marginBottom: 8 },
  bar: { width: 20, borderRadius: 2 },
  barLabel: { fontSize: 10, color: '#666666', marginBottom: 2 },
  barValue: { fontSize: 10, color: '#333333', fontWeight: '500' },

  // Recent items
  activityItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  activityContent: { flex: 1 },
  activityText: { fontSize: 14, color: '#000000', marginBottom: 2 },
  activityTime: { fontSize: 12, color: '#666666' },
});

export default EvaluationStatisticsScreen;
