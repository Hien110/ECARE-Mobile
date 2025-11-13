// components/AppLayout.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import FooterNav from './FooterNav';

const AppLayout = ({ children, activeTab, onChangeTab, centerKey, TABS }) => {
  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      <FooterNav
        items={TABS}          // Sử dụng TABS từ props
        activeKey={activeTab}
        onTabPress={onChangeTab}
        centerKey={centerKey}  // Truyền centerKey từ props
      />
    </View>
  );
};

export default AppLayout;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1 },
});
