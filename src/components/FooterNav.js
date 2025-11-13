// components/FooterNav.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const FooterNav = ({ activeKey, onTabPress, items }) => {
  return (
    <View style={styles.container}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.item}
            onPress={() => onTabPress(item.key)}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Icon name={item.icon} size={22} color={active ? '#fff' : '#8E95A3'} />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default FooterNav;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  item: {
    alignItems: 'center',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F2F4F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: { backgroundColor: '#335CFF' },
  label: { fontSize: 12, color: '#8E95A3' },
  labelActive: { color: '#335CFF', fontWeight: '600' },
});
