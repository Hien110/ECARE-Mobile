import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

const HealthNavigation = ({ activeTab, onTabChange }) => {
  const tabs = [
    { key: 'input', label: 'Nhập liệu', icon: '➕' },
    { key: 'chart', label: 'Biểu đồ', icon: '📊' },
    { key: 'history', label: 'Lịch sử', icon: '🕒' }
  ];

  return (
    <View style={{ 
      flexDirection: 'row', 
      backgroundColor: 'white', 
      marginHorizontal: 16, 
      marginTop: 16, 
      borderRadius: 12, 
      padding: 4,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2
    }}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          onPress={() => onTabChange(tab.key)}
          style={{
            flex: 1,
            paddingVertical: 12,
            alignItems: 'center',
            borderRadius: 8,
            backgroundColor: activeTab === tab.key ? '#2563eb' : 'transparent',
            flexDirection: 'row',
            justifyContent: 'center'
          }}
        >
          <Text style={{ 
            fontSize: 16, 
            marginRight: 6,
            opacity: activeTab === tab.key ? 1 : 0.6
          }}>
            {tab.icon}
          </Text>
          <Text style={{
            fontSize: 14,
            fontWeight: activeTab === tab.key ? '600' : '500',
            color: activeTab === tab.key ? 'white' : '#6b7280'
          }}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default HealthNavigation;

