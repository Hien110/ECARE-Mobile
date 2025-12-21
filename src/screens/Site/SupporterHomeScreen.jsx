import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { userService } from '../../services/userService';
import supporterSchedulingService from '../../services/supporterSchedulingService';
import { routeMap } from '../../navigation/config';

export default function FinancialApp() {
  const nav = useNavigation();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const [upcomingSchedule, setUpcomingSchedule] = useState([]);
  const [inProgressSchedule, setInProgressSchedule] = useState([]);
  const [canceledSchedule, setCanceledSchedule] = useState([]);

  const totalActive = upcomingSchedule.length + inProgressSchedule.length;

  const formatPrice = price => {
    if (!price) return '0đ';
    return `${Number(price).toLocaleString('vi-VN')}đ`;
  };

  const formatTime = dateString => {
    try {
      const d = new Date(dateString);
      return `${d.getHours().toString().padStart(2, '0')}:${d
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
    } catch {
      return '--:--';
    }
  };

  const formatDateShort = (startDate, endDate) => {
    try {
      const fmt = d => {
        if (!d) return '--/--';
        const dt = new Date(d);
        return `${dt.getDate().toString().padStart(2, '0')}/${(
          dt.getMonth() + 1
        )
          .toString()
          .padStart(2, '0')}/${dt.getFullYear()}`;
      };

      if (!startDate && !endDate) return '--/--';
      if (!endDate) return fmt(startDate);

      const s = new Date(startDate);
      const e = new Date(endDate);
      let yearsText = '';
      if (!isNaN(s) && !isNaN(e) && e > s) {
        const years = Math.floor((e - s) / (365 * 24 * 60 * 60 * 1000));
        if (years >= 1) yearsText = ` • ${years} năm`;
      }

      return `${fmt(startDate)} - ${fmt(endDate)}${yearsText}`;
    } catch {
      return '--/--';
    }
  };

  const mountedRef = useRef(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);

      const userRes = await userService.getUserInfo();
      if (!mountedRef.current) return;
      if (userRes?.success) {
        const userData = userRes.data?.user || userRes.data;
        setMe(userData);

        if (userData?._id) {
          const [confirmedRes, inProgressRes, canceledRes] =
            await Promise.all([
              supporterSchedulingService.getSchedulingsByStatus(
                userData._id,
                'confirmed',
                3,
              ),
              supporterSchedulingService.getSchedulingsByStatus(
                userData._id,
                'in_progress',
                3,
              ),
              supporterSchedulingService.getSchedulingsByStatus(
                userData._id,
                'canceled',
                3,
              ),
            ]);

          if (!mountedRef.current) return;

          if (confirmedRes?.success && Array.isArray(confirmedRes.data)) {
            setUpcomingSchedule(confirmedRes.data);
          }
          if (inProgressRes?.success && Array.isArray(inProgressRes.data)) {
            setInProgressSchedule(inProgressRes.data);
          }
          if (canceledRes?.success && Array.isArray(canceledRes.data)) {
            setCanceledSchedule(canceledRes.data);
          }
        }
      }
    } catch (err) {
      console.error('Error loading user/schedulings:', err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const roleText = useMemo(() => {
    const role = me?.role ? capitalize(me.role) : 'Supporter';
    const exp = me?.yearsExp ? ` • ${me.yearsExp} năm` : '';
    return role + exp;
  }, [me]);

  const goList = status => {
    const target = routeMap?.planSupporter || 'SupporterBookingListSupporterScreen';
    nav.navigate(target, { filterStatus: status });
  };

  /**
   * ✅ MiniStat: bỏ ellipsis (không numberOfLines=1)
   * - cho phép xuống dòng 2 dòng
   * - textAlign center
   */
  const MiniStat = ({ label, value }) => (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2} ellipsizeMode="tail">
        {label}
      </Text>
    </View>
  );

  const renderScheduleItem = (item, status) => {
    const key = item._id || item.id;

    const statusLabel =
      status === 'confirmed'
        ? 'Sắp tới'
        : status === 'in_progress'
        ? 'Đang diễn ra'
        : 'Đã hủy';

    const customerName = item?.elderly?.fullName || 'N/A';
    const address = item?.elderly?.currentAddress || '—';

    return (
      <TouchableOpacity
        key={key}
        style={styles.item}
        onPress={() =>
          nav.navigate('BookingDetailScreen', { bookingId: item._id })
        }
        activeOpacity={0.75}
      >
        <View style={styles.avatarWrap}>
          {item?.elderly?.avatar ? (
            <Image
              source={{ uri: item.elderly.avatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {customerName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.itemBody}>
          {/* Row 1: Tên + Status + Giá (cùng 1 hàng, không tách cột) */}
          <View style={styles.row1}>
            <View style={styles.nameStatus}>
              <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
                {customerName}
              </Text>
            </View>
          </View>

          {/* Row 2: time */}
          <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
            {formatDateShort(item.startDate, item.endDate)}
          </Text>

          {/* Row 3: address */}
          <Text style={styles.addr} numberOfLines={2} ellipsizeMode="tail">
            {address}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const Section = ({ title, count, onPressAll, children }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text
          style={styles.sectionTitle}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {title} <Text style={styles.count}>({count})</Text>
        </Text>

        <TouchableOpacity onPress={onPressAll} activeOpacity={0.7}>
          <Text style={styles.viewAll} numberOfLines={1}>
            Xem tất cả
          </Text>
        </TouchableOpacity>
      </View>

      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.meRow}>
              <Image
                source={{
                  uri:
                    me?.avatar ||
                    'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=faces',
                }}
                style={styles.meAvatar}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={styles.hello}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {me?.fullName || me?.name || 'Xin chào'}
                </Text>
                <Text
                  style={styles.role}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {roleText}
                </Text>
              </View>
            </View>
          </View>

          {/* ✅ Dashboard ngắn: không bị ... */}
          <View style={styles.summary}>
            <MiniStat label="Sắp tới" value={upcomingSchedule.length} />
            <MiniStat label="Đang diễn ra" value={inProgressSchedule.length} />
            <MiniStat label="Tổng hoạt động" value={totalActive} />
          </View>
        </View>

        <View style={styles.content}>
          <Section
            title="Lịch hẹn sắp tới"
            count={upcomingSchedule.length}
            onPressAll={() => goList('confirmed')}
          >
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>Đang tải…</Text>
              </View>
            ) : upcomingSchedule.length > 0 ? (
              <View style={{ gap: 10 }}>
                {upcomingSchedule.map(it =>
                  renderScheduleItem(it, 'confirmed'),
                )}
              </View>
            ) : (
              <Text style={styles.empty}>Không có lịch hẹn</Text>
            )}
          </Section>

          {inProgressSchedule.length > 0 && (
            <Section
              title="Lịch hẹn hiện tại"
              count={inProgressSchedule.length}
              onPressAll={() => goList('in_progress')}
            >
              <View style={{ gap: 10 }}>
                {inProgressSchedule.map(it =>
                  renderScheduleItem(it, 'in_progress'),
                )}
              </View>
            </Section>
          )}

          {canceledSchedule.length > 0 && (
            <Section
              title="Lịch hẹn đã hủy"
              count={canceledSchedule.length}
              onPressAll={() => goList('canceled')}
            >
              <View style={{ gap: 10 }}>
                {canceledSchedule.map(it => renderScheduleItem(it, 'canceled'))}
              </View>
            </Section>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function capitalize(str) {
  try {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  } catch {
    return str;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F7F9' },
  scroll: { paddingBottom: 28 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9EDF3',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  meAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
  },
  hello: { fontSize: 18, fontWeight: '900', color: '#111827' },
  role: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  headerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  headerBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },

  /* ✅ Dashboard ngắn: label không bị "..." */
  summary: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F7',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '900', color: '#111827' },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },

  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 20,
  },
  count: { fontWeight: '800', color: '#6B7280' },
  viewAll: { fontSize: 13, fontWeight: '900', color: '#111827' },

  /* Item */
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 12,
  },
  avatar: { width: 56, height: 56 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#fff', fontWeight: '900', fontSize: 18 },

  /* ✅ Body chiếm toàn bộ phần còn lại */
  itemBody: {
    flex: 1,
    minWidth: 0,
  },

  /* ✅ Row 1: trái (name+status) | phải (price) */
  row1: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },

  /* ✅ Khối name+status: cho phép co giãn đúng */
  nameStatus: {
    flex: 1,
    minWidth: 0,
  },

  /* ✅ Tên lớn, ưu tiên hiển thị */
  name: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 20,
  },

  /* ✅ Status nằm dưới tên (hoặc có thể để cùng hàng nếu bạn muốn) */
  status: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '800',
  },
  statusUpcoming: { color: '#2563EB' },
  statusProgress: { color: '#059669' },
  statusCanceled: { color: '#DC2626' },

  /* ✅ Giá KHÔNG tách cột, chỉ là text canh phải */
  price: {
    flexShrink: 0,
    maxWidth: 130,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 20,
  },

  meta: {
    marginTop: 6,
    fontSize: 13,
    color: '#374151',
  },

  addr: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },

  loadingBox: { paddingVertical: 14, alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 13, color: '#6B7280' },
  empty: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 13,
    paddingVertical: 14,
  },
});
