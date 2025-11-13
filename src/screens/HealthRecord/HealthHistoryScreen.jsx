import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import healthRecordService from '../../services/healthRecordService';
import userService from '../../services/userService';

export default function HealthHistoryScreen() {
  const [healthRecords, setHealthRecords] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const filters = [
    { key: 'all', label: 'Tất cả' },
    { key: 'today', label: 'Hôm nay' },
    { key: 'week', label: 'Tuần này' },
    { key: 'abnormal', label: 'Bất thường' }
  ];

  useEffect(() => {
    checkUserRole();
  }, []);

  useEffect(() => {
    if (userRole === 'elderly') {
      loadHealthRecords();
    }
  }, [selectedFilter, userRole]);

  const checkUserRole = async () => {
    try {
      const { success, data } = await userService.getUserInfo();
      if (success && data) {
        setUserRole(data.role);
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    } finally {
      setRoleLoading(false);
    }
  };

  const loadHealthRecords = async () => {
    try {
      setLoading(true);
      let params = {};
      
      const now = new Date();
      switch (selectedFilter) {
        case 'today':
          const startOfDay = new Date(now);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(now);
          endOfDay.setHours(23, 59, 59, 999);
          params = { from: startOfDay.toISOString(), to: endOfDay.toISOString() };
          break;
        case 'week':
          const startOfWeek = new Date(now);
          startOfWeek.setDate(startOfWeek.getDate() - 7);
          params = { from: startOfWeek.toISOString(), to: now.toISOString() };
          break;
        case 'abnormal':
          // Load all records and filter for abnormal ones
          params = { limit: 50 };
          break;
        default:
          params = { limit: 30 };
      }

      const { success, data } = await healthRecordService.listRecords(params);
      
      if (success) {
        let records = data || [];
        
        // Filter for abnormal records if needed
        if (selectedFilter === 'abnormal') {
          records = records.filter(record => isAbnormalRecord(record));
        }
        
        setHealthRecords(records);
      }
    } catch (error) {
      console.error('Error loading health records:', error);
      Alert.alert('Lỗi', 'Không thể tải dữ liệu sức khỏe');
    } finally {
      setLoading(false);
    }
  };

  const isAbnormalRecord = (record) => {
    const vitals = record.vitals || {};
    
    // Check blood pressure
    const bp = vitals.bloodPressure;
    if (bp && (bp.systolic >= 140 || bp.diastolic >= 90)) return true;
    
    // Check heart rate
    const hr = vitals.heartRate?.value;
    if (hr && (hr < 60 || hr > 100)) return true;
    
    // Check blood sugar
    const bs = vitals.bloodSugar?.value;
    if (bs && bs >= 126) return true;
    
    // Check BMI
    const bmi = vitals.bmi?.value;
    if (bmi && (bmi < 18.5 || bmi >= 25)) return true;
    
    return false;
  };

  const getRecordStatus = (record) => {
    if (isAbnormalRecord(record)) {
      return { text: 'Cần chú ý', color: '#ef4444', icon: '⚠️' };
    }
    
    const vitals = record.vitals || {};
    const hasAnyVital = vitals.bloodPressure || vitals.heartRate || vitals.bloodSugar || vitals.bmi;
    
    if (hasAnyVital) {
      return { text: 'Tốt', color: '#10b981', icon: '✅' };
    }
    
    return { text: 'Chưa có dữ liệu', color: '#6b7280', icon: '❓' };
  };

  const getStatusSummary = () => {
    const normal = healthRecords.filter(record => {
      const status = getRecordStatus(record);
      return status.text === 'Tốt';
    }).length;
    
    const monitoring = healthRecords.filter(record => {
      const status = getRecordStatus(record);
      return status.text === 'Cần theo dõi';
    }).length;
    
    const attention = healthRecords.filter(record => {
      const status = getRecordStatus(record);
      return status.text === 'Cần chú ý';
    }).length;
    
    return { normal, monitoring, attention };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}-${month}`;
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const renderVitals = (record) => {
    const vitals = record.vitals || {};
    const items = [];
    
    if (vitals.bloodPressure) {
      items.push({
        label: 'Huyết áp',
        value: `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}`,
        unit: 'mmHg'
      });
    }
    
    if (vitals.heartRate?.value) {
      items.push({
        label: 'Nhịp tim',
        value: vitals.heartRate.value,
        unit: 'bpm'
      });
    }
    
    if (vitals.bloodSugar?.value) {
      items.push({
        label: 'Đường huyết',
        value: vitals.bloodSugar.value,
        unit: 'mg/dL'
      });
    }
    
    if (vitals.bmi?.value) {
      items.push({
        label: 'BMI',
        value: vitals.bmi.value,
        unit: ''
      });
    }
    
    return items;
  };

  const summary = getStatusSummary();

  // Show loading state
  if (roleLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#6b7280', fontSize: 16 }}>Đang tải...</Text>
      </View>
    );
  }

  // Show access denied for non-elderly users
  if (userRole && userRole !== 'elderly') {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '600', marginBottom: 12, textAlign: 'center' }}>
          Không có quyền truy cập
        </Text>
        <Text style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Chỉ người dùng cao tuổi mới có thể sử dụng tính năng lịch sử sức khỏe.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Filter Buttons */}
        <View style={{ flexDirection: 'row', marginBottom: 20, gap: 8 }}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setSelectedFilter(filter.key)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: selectedFilter === filter.key ? '#2563eb' : '#f1f5f9',
                borderWidth: 1,
                borderColor: selectedFilter === filter.key ? '#2563eb' : '#e2e8f0'
              }}
            >
              <Text style={{
                fontSize: 14,
                fontWeight: '500',
                color: selectedFilter === filter.key ? 'white' : '#64748b'
              }}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overview Section */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 }}>Tổng quan</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ width: 60, height: 60, backgroundColor: '#10b981', borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: 'white', fontSize: 24 }}>✅</Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#10b981', marginBottom: 4 }}>{summary.normal}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>Bình thường</Text>
            </View>
            
            <View style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ width: 60, height: 60, backgroundColor: '#f59e0b', borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: 'white', fontSize: 24 }}>🎯</Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#f59e0b', marginBottom: 4 }}>{summary.monitoring}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>Cần theo dõi</Text>
            </View>
            
            <View style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ width: 60, height: 60, backgroundColor: '#ef4444', borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: 'white', fontSize: 24 }}>⚠️</Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#ef4444', marginBottom: 4 }}>{summary.attention}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>Cần chú ý</Text>
            </View>
          </View>
        </View>

        {/* Health Records List */}
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 }}>Lịch sử đo</Text>
          
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: '#6b7280' }}>Đang tải dữ liệu...</Text>
            </View>
          ) : healthRecords.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: '#6b7280', fontSize: 16, marginBottom: 8 }}>Chưa có dữ liệu</Text>
              <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center' }}>
                Hãy nhập dữ liệu sức khỏe để xem lịch sử
              </Text>
            </View>
          ) : (
            healthRecords.map((record, index) => {
              const status = getRecordStatus(record);
              const vitals = renderVitals(record);
              
              return (
                <View key={index} style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 8, height: 8, backgroundColor: status.color, borderRadius: 4, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937' }}>
                        {formatDate(record.recordDate)}
                      </Text>
                      <Text style={{ fontSize: 14, color: '#6b7280' }}>
                        {formatTime(record.recordDate)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: status.color, fontSize: 14, fontWeight: '600', marginRight: 4 }}>
                        {status.text}
                      </Text>
                      <Text style={{ fontSize: 12 }}>▼</Text>
                    </View>
                  </View>
                  
                  {vitals.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                      {vitals.map((vital, vitalIndex) => (
                        <View key={vitalIndex} style={{ flex: 1, minWidth: '45%' }}>
                          <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{vital.label}</Text>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937' }}>
                            {vital.value} {vital.unit}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {record.notes && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                      <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Ghi chú</Text>
                      <Text style={{ fontSize: 14, color: '#374151' }}>{record.notes}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
