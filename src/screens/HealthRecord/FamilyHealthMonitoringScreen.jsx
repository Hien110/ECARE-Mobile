import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import healthRecordService from '../../services/healthRecordService';
import relationshipService from '../../services/relationshipService';

const { width } = Dimensions.get('window');

const FamilyHealthMonitoringScreen = ({ route, navigation }) => {
  const { elderlyId: routeElderlyId } = route.params || {};
  const [elderlyId, setElderlyId] = useState(routeElderlyId);
  const [selectedPeriod, setSelectedPeriod] = useState('day');
  const [healthData, setHealthData] = useState(null);
  const [elderlyInfo, setElderlyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relationships, setRelationships] = useState([]);

  const periods = [
    { key: 'day', label: 'Hôm nay' },
    { key: 'week', label: 'Tuần' },
    { key: 'month', label: 'Tháng' },
  ];

  const navigationTabs = [
    { key: 'overview', label: 'Tổng quan', icon: '📊' },
    { key: 'trends', label: 'Xu hướng', icon: '📈' },
    { key: 'mood', label: 'Tâm trạng', icon: '😊' },
    { key: 'alerts', label: 'Cảnh báo', icon: '🔔' },
  ];

  useEffect(() => {
    loadRelationships();
  }, []);

  useEffect(() => {
    console.log('useEffect triggered - elderlyId:', elderlyId, 'selectedPeriod:', selectedPeriod);
    if (elderlyId) {
      loadHealthData();
    } else {
      console.log('No elderlyId, setting loading to false');
      setLoading(false);
    }
  }, [elderlyId, selectedPeriod]);

  // Fallback timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('Loading timeout - forcing loading to false');
      setLoading(false);
    }, 10000); // 10 seconds timeout

    return () => clearTimeout(timeout);
  }, []);

  const loadRelationships = async () => {
    try {
      console.log('=== LOADING RELATIONSHIPS ===');
      const { success, data, message } = await relationshipService.getAcceptedRelationshipsByFamilyId();
      console.log('Relationships response:', { success, data, message });
      
      if (success && data) {
        setRelationships(data);
        console.log('Relationships data length:', data.length);
        console.log('Relationships data:', JSON.stringify(data, null, 2));
        console.log('Current elderlyId:', elderlyId);
        
        if (data.length > 0 && !elderlyId) {
          // If no specific elderly selected, use the first one
          const firstElderlyId = data[0].elderly._id;
          console.log('Setting elderlyId to:', firstElderlyId);
          setElderlyId(firstElderlyId);
        } else if (data.length === 0) {
          console.log('No relationships found - setting loading to false');
          setLoading(false);
        }
      } else {
        console.log('Failed to load relationships:', message);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading relationships:', error);
      setLoading(false);
    }
  };

  const loadHealthData = async () => {
    if (!elderlyId) {
      console.log('No elderlyId, skipping loadHealthData');
      setLoading(false);
      return;
    }
    
    console.log('=== LOADING HEALTH DATA ===');
    console.log('elderlyId:', elderlyId);
    console.log('selectedPeriod:', selectedPeriod);
    
    setLoading(true);
    try {
      const { success, data, message } = await healthRecordService.getFamilyHealthMonitoring(elderlyId, selectedPeriod);
      console.log('Health data response:', { success, data, message });
      
      if (success && data) {
        setHealthData(data);
        setElderlyInfo(data.elderly);
        console.log('Health data set successfully');
        console.log('Elderly info:', data.elderly);
      } else {
        console.log('Failed to get health data:', message);
        // Set empty data to stop loading
        setHealthData({ records: [], summary: null });
        setElderlyInfo(null);
      }
    } catch (error) {
      console.error('Error loading health data:', error);
      Alert.alert('Lỗi', 'Không thể tải dữ liệu sức khỏe');
      // Set empty data to stop loading
      setHealthData({ records: [], summary: null });
      setElderlyInfo(null);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const getHealthStatus = (value, type) => {
    if (!value) return { status: 'Chưa có dữ liệu', color: '#6b7280' };
    
    switch (type) {
      case 'bloodPressure':
        const [systolic, diastolic] = value.split('/').map(Number);
        if (systolic < 120 && diastolic < 80) return { status: 'Bình thường', color: '#10b981' };
        if (systolic < 140 && diastolic < 90) return { status: 'Cần theo dõi', color: '#f59e0b' };
        return { status: 'Cần chú ý', color: '#ef4444' };
      case 'heartRate':
        if (value >= 60 && value <= 100) return { status: 'Bình thường', color: '#10b981' };
        if (value >= 50 && value <= 110) return { status: 'Cần theo dõi', color: '#f59e0b' };
        return { status: 'Cần chú ý', color: '#ef4444' };
      case 'bloodSugar':
        if (value < 100) return { status: 'Bình thường', color: '#10b981' };
        if (value < 126) return { status: 'Cần theo dõi', color: '#f59e0b' };
        return { status: 'Cần chú ý', color: '#ef4444' };
      case 'temperature':
        if (value >= 36.1 && value <= 37.2) return { status: 'Bình thường', color: '#10b981' };
        return { status: 'Cần chú ý', color: '#ef4444' };
      default:
        return { status: 'Bình thường', color: '#10b981' };
    }
  };

  const getOverallHealthScore = () => {
    if (!healthData?.summary) return { score: 0, status: 'Chưa có dữ liệu' };
    
    const { summary } = healthData;
    let score = 0;
    let count = 0;

    // Calculate score based on available data
    if (summary.ranges?.bloodPressure) {
      const bp = summary.ranges.bloodPressure;
      if (bp.systolic && bp.diastolic) {
        if (bp.systolic < 120 && bp.diastolic < 80) score += 25;
        else if (bp.systolic < 140 && bp.diastolic < 90) score += 15;
        else score += 5;
        count++;
      }
    }

    if (summary.ranges?.heartRate) {
      const hr = summary.ranges.heartRate.avg;
      if (hr >= 60 && hr <= 100) score += 25;
      else if (hr >= 50 && hr <= 110) score += 15;
      else score += 5;
      count++;
    }

    if (summary.ranges?.bloodSugar) {
      const bs = summary.ranges.bloodSugar.avg;
      if (bs < 100) score += 25;
      else if (bs < 126) score += 15;
      else score += 5;
      count++;
    }

    if (summary.ranges?.temperature) {
      const temp = summary.ranges.temperature.avg;
      if (temp >= 36.1 && temp <= 37.2) score += 25;
      else score += 5;
      count++;
    }

    const finalScore = count > 0 ? Math.round(score / count) : 0;
    
    if (finalScore >= 80) return { score: finalScore, status: 'Trạng thái tốt' };
    if (finalScore >= 60) return { status: 'Cần theo dõi' };
    return { score: finalScore, status: 'Cần chú ý' };
  };

  const renderSummaryCards = () => {
    const cards = [
      { icon: '❤️', label: 'Sức khỏe', status: 'Tốt', color: '#10b981' },
      { icon: '😊', label: 'Tâm trạng', status: 'Vui vẻ', color: '#3b82f6' },
      { icon: '💊', label: 'Thuốc', status: 'Đúng giờ', color: '#f97316' },
      { icon: '🛡️', label: 'An toàn', status: 'Bình thường', color: '#8b5cf6' },
    ];

    return (
      <View style={styles.summaryCardsContainer}>
        {cards.map((card, index) => (
          <View key={index} style={styles.summaryCard}>
            <Text style={styles.summaryCardIcon}>{card.icon}</Text>
            <Text style={styles.summaryCardLabel}>{card.label}</Text>
            <Text style={[styles.summaryCardStatus, { color: card.color }]}>{card.status}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderHealthMetrics = () => {
    if (!healthData?.records || healthData.records.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>Chưa có dữ liệu sức khỏe</Text>
        </View>
      );
    }

    const latestRecord = healthData.records[0];
    const vitals = latestRecord.vitals || {};

    const metrics = [
      {
        icon: '❤️',
        label: 'Huyết áp',
        value: vitals.bloodPressure ? `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}` : '--',
        unit: 'mmHg',
        status: getHealthStatus(vitals.bloodPressure ? `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}` : null, 'bloodPressure'),
        color: '#3b82f6',
      },
      {
        icon: '💓',
        label: 'Nhịp tim',
        value: vitals.heartRate?.value || '--',
        unit: 'bpm',
        status: getHealthStatus(vitals.heartRate?.value, 'heartRate'),
        color: '#f97316',
      },
      {
        icon: '🩸',
        label: 'Đường huyết',
        value: vitals.bloodSugar?.value || '--',
        unit: 'mg/dL',
        status: getHealthStatus(vitals.bloodSugar?.value, 'bloodSugar'),
        color: '#3b82f6',
      },
      {
        icon: '🌡️',
        label: 'Nhiệt độ',
        value: vitals.temperature?.value || '--',
        unit: '°C',
        status: getHealthStatus(vitals.temperature?.value, 'temperature'),
        color: '#6b7280',
      },
    ];

    return (
      <View style={styles.metricsContainer}>
        {metrics.map((metric, index) => (
          <View key={index} style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricIcon}>{metric.icon}</Text>
              <View style={styles.metricInfo}>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricUnit}>{metric.unit}</Text>
              </View>
            </View>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={[styles.metricStatus, { color: metric.status.color }]}>
              {metric.status.status}
            </Text>
            <View style={styles.metricChart}>
              {/* Simple chart representation */}
              <View style={[styles.chartBar, { backgroundColor: metric.color, height: 20 }]} />
              <View style={[styles.chartBar, { backgroundColor: metric.color, height: 15 }]} />
              <View style={[styles.chartBar, { backgroundColor: metric.color, height: 25 }]} />
              <View style={[styles.chartBar, { backgroundColor: metric.color, height: 18 }]} />
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderTodayActivities = () => {
    // Mock activities data - in real app, this would come from the API
    const activities = [
      { time: '07:30', activity: 'Đo huyết áp buổi sáng', status: 'completed', value: '122/76 mmHg' },
      { time: '08:00', activity: 'Uống thuốc huyết áp', status: 'completed', value: 'Đã hoàn thành' },
      { time: '12:00', activity: 'Kiểm tra đường huyết', status: 'completed', value: '95 mg/dL' },
      { time: '14:30', activity: 'Ghi nhận tâm trạng', status: 'completed', value: 'Vui vẻ 🙂' },
      { time: '18:00', activity: 'Đo huyết áp buổi tối', status: 'pending', value: 'Chưa thực hiện' },
      { time: '20:00', activity: 'Uống thuốc buổi tối', status: 'scheduled', value: 'Chưa đến giờ' },
    ];

    return (
      <View style={styles.activitiesContainer}>
        <View style={styles.activitiesHeader}>
          <Text style={styles.activitiesTitle}>Hoạt động hôm nay</Text>
          <View style={styles.periodSelector}>
            {periods.map((period) => (
              <TouchableOpacity
                key={period.key}
                style={[
                  styles.periodButton,
                  selectedPeriod === period.key && styles.periodButtonActive,
                ]}
                onPress={() => setSelectedPeriod(period.key)}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    selectedPeriod === period.key && styles.periodButtonTextActive,
                  ]}
                >
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.activitiesList}>
          {activities.map((activity, index) => (
            <View key={index} style={styles.activityItem}>
              <Text style={styles.activityTime}>{activity.time}</Text>
              <View style={styles.activityContent}>
                <Text style={styles.activityName}>{activity.activity}</Text>
                <Text style={styles.activityValue}>{activity.value}</Text>
              </View>
              <View
                style={[
                  styles.activityStatus,
                  {
                    backgroundColor:
                      activity.status === 'completed'
                        ? '#10b981'
                        : activity.status === 'pending'
                        ? '#f59e0b'
                        : '#d1d5db',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressTitle}>Tiến độ hôm nay</Text>
          <Text style={styles.progressText}>4/6 hoạt động đã hoàn thành (67%)</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '67%' }]} />
          </View>
        </View>
      </View>
    );
  };

  const renderHealthSummary = () => {
    const summaries = [
      {
        icon: '✅',
        title: 'Tuân thủ uống thuốc tốt',
        description: '95% đúng giờ trong tuần qua',
        time: 'Hôm nay',
        color: '#10b981',
      },
      {
        icon: '💎',
        title: 'Chỉ số sinh hiệu ổn định',
        description: 'Huyết áp và nhịp tim trong giới hạn bình thường',
        time: '2 giờ trước',
        color: '#3b82f6',
      },
      {
        icon: '😊',
        title: 'Tâm trạng tích cực',
        description: 'Ghi nhận cảm xúc vui vẻ hôm nay',
        time: '4 giờ trước',
        color: '#f97316',
      },
    ];

    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Tóm tắt sức khỏe gần đây</Text>
        {summaries.map((summary, index) => (
          <View key={index} style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: summary.color }]}>
              <Text style={styles.summaryIconText}>{summary.icon}</Text>
            </View>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryItemTitle}>{summary.title}</Text>
              <Text style={styles.summaryItemDescription}>{summary.description}</Text>
              <Text style={styles.summaryItemTime}>{summary.time}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  if (!elderlyInfo && !loading) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Không tìm thấy thông tin người cao tuổi</Text>
        <Text style={styles.errorText}>ElderlyId: {elderlyId || 'null'}</Text>
        <Text style={styles.errorText}>Relationships: {relationships.length}</Text>
        <TouchableOpacity 
          style={{ marginTop: 20, padding: 10, backgroundColor: '#2563eb', borderRadius: 8 }}
          onPress={() => {
            console.log('Retry button pressed');
            setLoading(true);
            loadRelationships();
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center' }}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const healthScore = getOverallHealthScore();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.appTitle}>E-CARE</Text>
            <Text style={styles.appSubtitle}>Chăm sóc người cao tuổi</Text>
          </View>
        </View>

        {/* Family Health Monitoring Banner */}
        <View style={styles.monitoringBanner}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>Theo dõi sức khỏe gia đình</Text>
            <Text style={styles.elderlyInfo}>
              {elderlyInfo.fullName} • {elderlyInfo.dateOfBirth ? 
                `${new Date().getFullYear() - new Date(elderlyInfo.dateOfBirth).getFullYear()} tuổi` : 
                'Chưa có thông tin tuổi'
              }
            </Text>
            <Text style={styles.updateInfo}>
              Cập nhật: Hôm nay, {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <View style={styles.connectionStatus}>
              <View style={styles.connectionDot} />
              <Text style={styles.connectionText}>Kết nối</Text>
            </View>
          </View>
        </View>

        {/* Summary Cards */}
        {renderSummaryCards()}

        {/* Navigation Tabs */}
        <View style={styles.navigationTabs}>
          {navigationTabs.map((tab) => (
            <TouchableOpacity key={tab.key} style={styles.navTab}>
              <Text style={styles.navTabIcon}>{tab.icon}</Text>
              <Text style={styles.navTabLabel}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Elderly Profile and Health Score */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileIcon}>
              <Text style={styles.profileIconText}>👤</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{elderlyInfo.fullName}</Text>
              <Text style={styles.profileDetails}>
                {elderlyInfo.dateOfBirth ? 
                  `${new Date().getFullYear() - new Date(elderlyInfo.dateOfBirth).getFullYear()} tuổi` : 
                  'Chưa có thông tin tuổi'
                } • Nhà riêng - Hà Nội
              </Text>
              <View style={styles.profileStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Đang hoạt động</Text>
                <Text style={styles.statusTime}>
                  Hôm nay, {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.healthScoreContainer}>
            <Text style={styles.healthScoreTitle}>Chỉ số sức khỏe tổng thể</Text>
            <View style={styles.healthScoreContent}>
              <View style={styles.healthScoreCircle}>
                <Text style={styles.healthScoreNumber}>{healthScore.score || '--'}</Text>
              </View>
              <View style={styles.healthScoreInfo}>
                <Text style={styles.healthScorePercent}>{healthScore.score || '--'}%</Text>
                <Text style={[styles.healthScoreStatus, { color: healthScore.status === 'Trạng thái tốt' ? '#10b981' : '#f59e0b' }]}>
                  {healthScore.status}
                </Text>
              </View>
              <TouchableOpacity style={styles.callButton}>
                <Text style={styles.callButtonIcon}>📞</Text>
                <Text style={styles.callButtonText}>Gọi điện</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Health Metrics */}
        {renderHealthMetrics()}

        {/* Today's Activities */}
        {renderTodayActivities()}

        {/* Health Summary */}
        {renderHealthSummary()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
  noDataContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  appSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  monitoringBanner: {
    backgroundColor: '#2563eb',
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  elderlyInfo: {
    fontSize: 14,
    color: 'white',
    marginBottom: 4,
  },
  updateInfo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 4,
  },
  connectionText: {
    fontSize: 12,
    color: 'white',
  },
  summaryCardsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  summaryCardIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  summaryCardLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryCardStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  navigationTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  navTabIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  navTabLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  profileCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileIconText: {
    fontSize: 20,
    color: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  profileDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  profileStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#10b981',
    marginRight: 8,
  },
  statusTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  healthScoreContainer: {
    marginTop: 16,
  },
  healthScoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  healthScoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthScoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  healthScoreNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  healthScoreInfo: {
    flex: 1,
  },
  healthScorePercent: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  healthScoreStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  callButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callButtonIcon: {
    fontSize: 16,
    color: 'white',
    marginRight: 4,
  },
  callButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  metricCard: {
    width: (width - 48) / 2,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 8,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  metricInfo: {
    flex: 1,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  metricUnit: {
    fontSize: 12,
    color: '#6b7280',
  },
  metricLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  metricStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  metricChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 20,
  },
  chartBar: {
    width: 4,
    marginRight: 2,
    borderRadius: 2,
  },
  activitiesContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  activitiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activitiesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  periodSelector: {
    flexDirection: 'row',
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 4,
  },
  periodButtonActive: {
    backgroundColor: '#2563eb',
  },
  periodButtonText: {
    fontSize: 12,
    color: '#6b7280',
  },
  periodButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  activitiesList: {
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activityTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    width: 60,
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityName: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 2,
  },
  activityValue: {
    fontSize: 12,
    color: '#6b7280',
  },
  activityStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  summaryContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryIconText: {
    fontSize: 20,
    color: 'white',
  },
  summaryContent: {
    flex: 1,
  },
  summaryItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  summaryItemDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryItemTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
});

export default FamilyHealthMonitoringScreen;

