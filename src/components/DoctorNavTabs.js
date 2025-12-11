import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TABS = [
  { key: 'profile', label: 'Hồ sơ' },
  { key: 'schedule', label: 'Lịch làm việc' },
  { key: 'statistics', label: 'Thống kê' },
];

const getDeepActiveRouteName = (nav) => {
  try {
    let state = nav?.getState?.();
    while (state && state.routes && state.routes.length) {
      const idx = state.index ?? (state.routes.length - 1);
      const r = state.routes[idx];
      if (r?.state) state = r.state;
      else return r?.name || null;
    }
  } catch {}
  return nav?.getCurrentRoute?.()?.name || null;
};


const normalizeToArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const DoctorNavTabs = ({ active, onChange, navigation, routes = {}, style }) => {
  const [routeActiveKey, setRouteActiveKey] = useState(null);


  const reverseMap = useMemo(() => {
    const map = {};
    Object.entries(routes).forEach(([tabKey, val]) => {
      normalizeToArray(val).forEach((routeName) => {
        if (routeName) map[routeName] = tabKey;
      });
    });
    return map;
  }, [routes]);


  const heuristicPick = (routeName) => {
    if (!routeName) return null;
    const n = routeName.toLowerCase();
    if (n.includes('profile')) return 'profile';
    if (n.includes('schedule') || n.includes('work')) return 'schedule';
    if (n.includes('stat')) return 'statistics';
    return null;
  };


  useEffect(() => {
    if (!navigation) return;
    const sync = () => {
      const name = getDeepActiveRouteName(navigation);
      const key = reverseMap[name] || heuristicPick(name) || null;
      setRouteActiveKey(key);
    };
    sync();
    const off1 = navigation.addListener?.('state', sync);
    const off2 = navigation.addListener?.('focus', sync);
    const parent = navigation.getParent?.();
    const off3 = parent?.addListener?.('state', sync);
    const off4 = parent?.addListener?.('focus', sync);
    return () => { off1 && off1(); off2 && off2(); off3 && off3(); off4 && off4(); };
  }, [navigation, reverseMap]);

  const finalActive = routeActiveKey || active || 'profile';

  return (
    <View style={[styles.tabContainer, style]}>
      {TABS.map((tab) => {
        const isActive = finalActive === tab.key;
        const onPress = () => {
          onChange?.(tab.key);
          const firstRoute = normalizeToArray(routes[tab.key])[0];
          if (navigation && firstRoute) {
            setRouteActiveKey(tab.key); 
            navigation.navigate(firstRoute);
          }
        };
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={onPress}
          >
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16 },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#4A90E2' },
  tabText: { fontSize: 14, color: '#666', fontWeight: '500' },
  activeTabText: { color: '#4A90E2', fontWeight: '600' },
});

export default DoctorNavTabs;
