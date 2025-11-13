import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import HealthRecordScreen from './HealthRecordScreen';
import HealthChartScreen from './HealthChartScreen';
import HealthHistoryScreen from './HealthHistoryScreen';
import HealthNavigation from '../../components/HealthNavigation';

export default function HealthScreen() {
  const [activeTab, setActiveTab] = useState('input');

  const renderScreen = () => {
    switch (activeTab) {
      case 'input':
        return <HealthRecordScreen />;
      case 'chart':
        return <HealthChartScreen />;
      case 'history':
        return <HealthHistoryScreen />;
      default:
        return <HealthRecordScreen />;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{ 
        backgroundColor: '#2563eb', 
        paddingTop: 14, 
        paddingBottom: 16, 
        paddingHorizontal: 16, 
        borderBottomLeftRadius: 16, 
        borderBottomRightRadius: 16 
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>Nhật ký sức khỏe</Text>
          <TouchableOpacity style={{ 
            backgroundColor: '#10b981', 
            width: 40, 
            height: 40, 
            borderRadius: 20, 
            justifyContent: 'center', 
            alignItems: 'center' 
          }}>
            <Text style={{ color: 'white', fontSize: 20 }}>❤️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation */}
      <HealthNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      {renderScreen()}
    </View>
  );
}

