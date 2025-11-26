import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity, View,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';

import relationshipService from '../../services/relationshipService';
import socketService from '../../services/socketService';
import sosService from '../../services/sosService';
import userService from '../../services/userService';

import { SafeAreaView } from 'react-native-safe-area-context';
import { enableFloating, disableFloating } from '../../utils/floatingCheckinHelper';

/* ===================== HOME ===================== */
export default function HomeScreen() {
  const nav = useNavigation();

  // boot/auth
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);

  // ===== Family connections =====
  const [reqLoading, setReqLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [familyList, setFamilyList] = useState([]);
  const [relationships, setRelationships] = useState([]);

  // helper: notify
  const notify = useCallback((msg, type = 'info') => {
    if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    else Alert.alert(type === 'success' ? 'Thành công' : 'Thông báo', msg);
  }, []);

  // helper: lấy người “còn lại” trong quan hệ
  const getOtherMember = useCallback((rel, myId) => {
    const isMeElderly = String(rel?.elderly?._id) === String(myId);
    return isMeElderly ? rel?.family : rel?.elderly;
  }, []);

  // tải yêu cầu kết nối (pending)
  const loadPendingRequests = useCallback(async () => {
    try {
      setReqLoading(true);
      const res = await relationshipService.getRequestRelationshipsById();
      if (res?.success) {
        setPendingRequests(res.data || []);
      } else {
        console.log('getRequestRelationshipsById error:', res?.message);
      }
    } catch (e) {
      console.log('loadPendingRequests error:', e);
    } finally {
      setReqLoading(false);
    }
  }, []);

  // tải danh sách đã kết nối (accepted)
  const loadFamilyRelationships = useCallback(async () => {
  if (!user?._id) return;
  try {
    setFamilyLoading(true);
    const res = await relationshipService.getAllRelationships();
    if (res?.success) {
      const all = res.data || [];
      setRelationships(all);
      const list = all
        .filter(r => r?.status === 'accepted')
        .map(r => {
          const other = getOtherMember(r, user._id);
          if (!other?._id) return null;
          return {
            _id: other._id,
            fullName: other.fullName || 'Thành viên',
            role: other.role, // doctor/family/supporter/...
            avatar: other.avatar,
            relationship: r?.relationship, // “con trai”, “con gái”,...
          };
        })
        .filter(Boolean);
      setFamilyList(list);
    } else {
      console.log('getAllRelationships error:', res?.message);
    }
  } catch (e) {
    console.log('loadFamilyRelationships error:', e);
  } finally {
    setFamilyLoading(false);
  }
}, [user, getOtherMember]);

  // chấp nhận / từ chối yêu cầu
  const respondToRequest = useCallback(
    async (relationshipId, action /* 'accept' | 'reject' */) => {
      try {
        setReqLoading(true);
        if (action === 'accept') {
          if (relationshipService.approveRelationship) {
            await relationshipService.approveRelationship(relationshipId);
          } else if (relationshipService.updateRelationshipStatus) {
            await relationshipService.updateRelationshipStatus(
              relationshipId,
              'accepted',
            );
          } else if (relationshipService.respondRequest) {
            await relationshipService.respondRequest({
              id: relationshipId,
              status: 'accepted',
            });
          } else {
            await relationshipService.patch?.(relationshipId, {
              status: 'accepted',
            });
          }
          notify('Đã chấp nhận yêu cầu kết nối!', 'success');
        } else {
          if (relationshipService.rejectRelationship) {
            await relationshipService.rejectRelationship(relationshipId);
          } else if (relationshipService.updateRelationshipStatus) {
            await relationshipService.updateRelationshipStatus(
              relationshipId,
              'rejected',
            );
          } else if (relationshipService.respondRequest) {
            await relationshipService.respondRequest({
              id: relationshipId,
              status: 'rejected',
            });
          } else {
            await relationshipService.patch?.(relationshipId, {
              status: 'rejected',
            });
          }
          notify('Đã từ chối yêu cầu.');
        }
        await loadPendingRequests();
        await loadFamilyRelationships();
      } catch (e) {
        console.log('respondToRequest error:', e);
        notify('Xử lý yêu cầu thất bại. Vui lòng thử lại.');
      } finally {
        setReqLoading(false);
      }
    },
    [loadPendingRequests, loadFamilyRelationships, notify],
  );

  // boot user
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('ecare_token');
        if (!token) {
          nav.reset({ index: 0, routes: [{ name: 'Login' }] });
          return;
        }
        const cached = await AsyncStorage.getItem('ecare_user');
        if (cached) {
          try {
            setUser(JSON.parse(cached));
          } catch {}
        }
        const res = await userService.getUser();
        if (res?.success && res?.data) {
          setUser(res.data);
          await AsyncStorage.setItem('ecare_user', JSON.stringify(res.data));
        }
      } catch {
        nav.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      } finally {
        setBooting(false);
      }
    })();
  }, [nav]);

  // khi có user, tải dữ liệu gia đình
  useEffect(() => {
    if (user?._id) {
      loadPendingRequests();
      loadFamilyRelationships();
    }
  }, [user, loadPendingRequests, loadFamilyRelationships]);

  useEffect(() => {
  if (!user?._id) return;
  const role = (user?.role || '').toLowerCase();

  if (role !== 'elderly') {
    disableFloating();
    return;
  }

  const hasAcceptedRelationship = (relationships || []).some(rel => {
    const isElderInRel =
      String(rel?.elderly?._id) === String(user._id) ||
      String(rel?.family?._id) === String(user._id);
      return isElderInRel && rel?.status === 'accepted';
  });

  if (!hasAcceptedRelationship) {
    disableFloating();
    return;
  }

  enableFloating();
}, [user, relationships]);

  // time
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const timeStr = useMemo(
    () =>
      now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    [now],
  );
  const dateStr = useMemo(() => {
    const weekday = now.toLocaleDateString('vi-VN', { weekday: 'long' });
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return `${cap(weekday)}, ${day} tháng ${month}, ${year}`;
  }, [now]);

  // Hàm lấy vị trí hiện tại
  const getCurrentLocation = useCallback(() => {
    return new Promise(async (resolve, reject) => {
      try {
        // Yêu cầu quyền truy cập vị trí trên Android
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Quyền truy cập vị trí',
              message:
                'E-Care cần quyền truy cập vị trí để gửi cảnh báo khẩn cấp.',
              buttonPositive: 'Đồng ý',
              buttonNegative: 'Từ chối',
            },
          );

          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            reject(new Error('Không có quyền truy cập vị trí'));
            return;
          }
        }

        // Lấy vị trí hiện tại
        Geolocation.getCurrentPosition(
          position => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          error => {
            console.error('Geolocation error:', error);
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 10000,
          },
        );
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  // Hàm chuyển đổi tọa độ thành địa chỉ bằng Nominatim
  const reverseGeocode = useCallback(async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=vi`,
        {
          headers: {
            'User-Agent': 'E-Care Mobile App',
          },
        },
      );

      const data = await response.json();

      if (data && data.display_name) {
        return data.display_name;
      }

      // Fallback nếu không có display_name
      if (data && data.address) {
        const addr = data.address;
        const parts = [
          addr.road || addr.street,
          addr.suburb || addr.neighbourhood,
          addr.city || addr.town || addr.village,
          addr.state,
          addr.country,
        ].filter(Boolean);

        return parts.join(', ');
      }

      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  }, []);

  // emergency
  const handleEmergency = useCallback(async () => {
    // Kiểm tra user đã login chưa
    if (!user?._id) {
      Alert.alert('Lỗi', 'Bạn cần đăng nhập để sử dụng tính năng này!');
      return;
    }

    try {
      // Kiểm tra token CHI TIẾT
      const token = await AsyncStorage.getItem('ecare_token');

      if (!token) {
        Alert.alert(
          'Lỗi',
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!',
        );
        nav.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      notify('Đang gửi cảnh báo khẩn cấp...', 'info');

      // Lấy vị trí hiện tại
      let location;
      try {
        const coords = await getCurrentLocation();
        const address = await reverseGeocode(
          coords.latitude,
          coords.longitude,
        );

        location = {
          coordinates: {
            latitude: coords.latitude,
            longitude: coords.longitude,
          },
          address: address,
        };
      } catch (locationError) {
        console.warn(
          '⚠️ Could not get location, using fallback:',
          locationError,
        );

        // Fallback: Sử dụng vị trí mẫu nếu không lấy được vị trí thực
        location = {
          coordinates: {
            latitude: 10.762622,
            longitude: 106.660172,
          },
          address: 'Không xác định được vị trí (Vui lòng bật GPS)',
        };
      }

      // Lấy danh sách family members
      const familyRes = await userService.getFamilyMembersByElderlyId({
        elderlyId: user._id,
      });
      if (!familyRes.success) {
        Alert.alert('Lỗi', 'Không thể lấy danh sách thành viên gia đình');
        return;
      }

      // Loại bỏ chính người gửi khỏi danh sách recipients
      const recipients = familyRes.data
        .map(member => member._id)
        .filter(memberId => memberId !== user._id);

      if (recipients.length === 0) {
        Alert.alert(
          'Lỗi',
          'Không có thành viên gia đình nào để gửi cảnh báo',
        );
        return;
      }

      // Tạo SOS notification
      const message = `${
        user?.fullName || 'Người dùng'
      } cần trợ giúp ngay lập tức!`;

      const result = await sosService.createSOS(
        recipients,
        message,
        location,
      );

      notify('Đã gửi cảnh báo đến tất cả thành viên!', 'success');
    } catch (error) {
      console.error('❌ Error sending emergency notification:', error);
      console.error('❌ Error details:', error?.response?.data);
      const errorMsg =
        error?.response?.data?.message ||
        'Gửi cảnh báo thất bại. Vui lòng thử lại.';
      Alert.alert('Lỗi', errorMsg);
    }
  }, [notify, user, nav, getCurrentLocation, reverseGeocode]);

  // demo actions
  const bookAppointment = () =>
    Alert.alert('Đặt lịch tư vấn', '📅 Chọn ngày giờ • 👩‍⚕️ Chọn bác sĩ • 💬 Trực tiếp/Video');
  const healthDiary = () =>
    Alert.alert('Nhật ký sức khỏe', '📝 Triệu chứng • 📊 Chỉ số • 💭 Tâm trạng');

  const findSupport = () => {
    const flag = 'BookingFromElderly';
    const userPayload = {
      elderlyId: user?._id,
      fullName: user?.fullName || '',
      phoneNumber: user?.phoneNumber || '',
      avatar: user?.avatar || '',
      address: user?.addressEnc || '',
      currentLocation: user?.currentLocation || null,
    };
    nav.navigate('ServiceSelectionScreen', {
      user: member,
      source: 'FamilyListFunction', // để màn sau biết đi từ đâu
    });
  };
  const chatSupport = () => nav.navigate('ChatWithAI');

  const callFamily = who => {
    const contacts = {
      son: 'Con trai Minh Tuấn',
      daughter: 'Con gái Thu Hằng',
    };
    notify(`Đang gọi cho ${contacts[who]}...\n📞 Kết nối cuộc gọi`, 'success');
  };
  const callDoctor = () =>
    notify('Đang gọi Bác sĩ Lan...\n📞 Kết nối phòng khám', 'success');

  // logout
  const onLogout = useCallback(async () => {
    try {
      await disableFloating();
      socketService.disconnect();
      await userService.logout?.();
      await AsyncStorage.multiRemove(['ecare_token', 'ecare_user']);
    } finally {
      nav.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  }, [nav]);

  if (booting) {
    return (
      <SafeAreaView
        style={[
          styles.safe,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12, color: '#6b7280', fontSize: 18 }}>
          Đang tải dữ liệu...
        </Text>
      </SafeAreaView>
    );
  }

  const displayName =
    (user?.fullName && `bác ${user.fullName.split(' ').slice(-1)[0]}`) ||
    (user?.phoneNumber && `người dùng ${user.phoneNumber}`) ||
    'bác Minh';

  // rút gọn để ít phải lướt: chỉ lấy 2 yêu cầu và 4 thành viên
  const pendingPreview = pendingRequests.slice(0, 2);
  const familyPreview = familyList.slice(0, 4);

  /* ===================== RENDER ===================== */
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header} accessibilityRole="header">
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hi} maxFontSizeMultiplier={1.4}>
                Chào {displayName}! 👋
              </Text>
              <Text style={styles.date} maxFontSizeMultiplier={1.3}>
                {dateStr}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {/* <View
                style={styles.timePill}
                accessible
                accessibilityLabel={`Bây giờ là ${timeStr}`}
              >
                <Text style={styles.timeText} maxFontSizeMultiplier={1.6}>
                  {timeStr}
                </Text>
              </View> */}
              {/* <TouchableOpacity
                style={styles.logoutBtn}
                onPress={onLogout}
                accessibilityRole="button"
                accessibilityLabel="Đăng xuất"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutText}>Đăng xuất</Text>
              </TouchableOpacity> */}
            </View>
          </View>
        </View>

        {/* Emergency – nút lớn, ít chữ, tương phản cao */}
        <TouchableOpacity
          style={styles.emgBigBtn}
          onPress={handleEmergency}
          accessibilityRole="button"
          accessibilityLabel="Gọi khẩn cấp. Nhấn để báo động cho gia đình"
          activeOpacity={0.9}
        >
          <Text style={styles.emgBigIcon} accessible>🚨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.emgBigTitle}>GỌI KHẨN CẤP</Text>
            <Text style={styles.emgBigDesc}>Liên hệ ngay toàn bộ gia đình</Text>
          </View>
          <Text style={styles.emgChevron}>›</Text>
        </TouchableOpacity>

        {/* Quick actions – 2 cột, nút lớn */}
        <Section title="Tác vụ nhanh" icon="" color="#2563eb">
          <View style={styles.quickGrid}>
            {/* <BigAction
              tint="#F59E0B"
              icon="🧑🏻‍⚕️"
              title="Hẹn bác sĩ"
              desc="Khám trực tiếp/Video"
              onPress={bookAppointment}
            /> */}
            <BigAction
              tint="#4F46E5"
              icon="💬"
              title="Trò chuyện E-Care"
              desc="AI hỗ trợ tinh thần"
              onPress={chatSupport}
            />
            <BigAction
              tint="#16A34A"
              icon="💁‍♀️"
              title="Thuê người hỗ trợ"
              desc="Giúp việc • Chăm sóc"
              onPress={findSupport}
            />
            {/* <BigAction
              tint="#22A2F2"
              icon="❤️"
              title="Nhật ký sức khỏe"
              desc="Triệu chứng • Chỉ số"
              onPress={healthDiary}
            /> */}
            
          </View>
        </Section>

        {/* Family Connections – rút gọn để ít phải lướt */}
        <Section title="Kết nối gia đình" icon="👨‍👩‍👧" color="#f43f5e">
          
          {/* ĐÃ KẾT NỐI (tối đa 4) */}
          <View style={[styles.card, { paddingTop: 12 }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Đã kết nối</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.countPill}>
                  {familyLoading ? '…' : familyList.length}
                </Text>
                <TouchableOpacity
                  onPress={() => nav.navigate('FamilyConnectionList')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.viewAll}>Xem tất cả ›</Text>
                </TouchableOpacity>
              </View>
            </View>

            {familyLoading ? (
              <ActivityIndicator />
            ) : familyPreview.length === 0 ? (
              <View
                style={[
                  styles.msgCard,
                  { backgroundColor: '#FFF7ED', borderLeftColor: '#FB923C' },
                ]}
              >
                <View style={[styles.msgIcon, { backgroundColor: '#FFEDD5' }]}>
                  <Text>👋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.msgTitle}>Chưa có thành viên gia đình</Text>
                  <Text style={styles.msgText}>
                    Hãy mời người thân kết nối để tiện liên lạc và theo dõi.
                  </Text>
                  <TouchableOpacity onPress={() => nav.navigate('FamilyConnectionList')}>
                    <Text style={[styles.secRight, { marginTop: 6 }]}>
                      Mời/Quản lý gia đình ›
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.familyRow}>
                {familyPreview.map(m => (
                  <ConnectedCard
                    key={m._id}
                    icon={m.role === 'doctor' ? '👩‍⚕️' : '👤'}
                    sub={
                      m.relationship ||
                      (m.role === 'doctor' ? 'Bác sĩ' : 'Thành viên')
                    }
                    title={m.fullName}
                    onPress={() => notify(`Đang gọi cho ${m.fullName}...`, 'success')}
                    online={false}
                  />
                ))}
                <Text
                  style={{
                    marginTop: 6,
                    color: '#6b7280',
                    fontSize: 14,
                    textAlign: 'center',
                    width: '100%',
                  }}
                >
                  Nhấn vào tên của thành viên để gọi
                </Text>
              </View>
            )}
          </View>

          {/* YÊU CẦU KẾT NỐI (0–2 item) */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Yêu cầu kết nối</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.countPill}>
                  {reqLoading ? '…' : pendingRequests.length}
                </Text>
                <TouchableOpacity
                  onPress={() => nav.navigate('FamilyConnection')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.viewAll}>Xem tất cả ›</Text>
                </TouchableOpacity>
              </View>
            </View>

            {reqLoading ? (
              <ActivityIndicator />
            ) : pendingPreview.length === 0 ? (
              <Text style={styles.muted}>Không có yêu cầu mới.</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {pendingPreview.map(r => {
                  const other = getOtherMember(r, user?._id);
                  const name = other?.fullName || 'Người dùng';
                  const relation = r?.relationship || 'Thành viên gia đình';
                  const requestedAt = r?.createdAt
                    ? new Date(r.createdAt).toLocaleString('vi-VN')
                    : 'Gần đây';
                  return (
                    <RequestItem
                      key={r?._id}
                      rq={{
                        name,
                        relation,
                        note: r?.note || 'Yêu cầu kết nối',
                        requestedAt,
                      }}
                      onAccept={() => respondToRequest(r?._id, 'accept')}
                      onDecline={() => respondToRequest(r?._id, 'reject')}
                    />
                  );
                })}
              </View>
            )}
          </View>
        </Section>

        {/* Schedule – chỉ việc sắp tới + 1 việc kế */}
        <Section title="Lịch hôm nay" icon="📅" color="#7c3aed">
          <View style={styles.scheduleList}>
            <ScheduleItem
              icon="🚶"
              title="Đi bộ trong công viên"
              sub="16:00 • Sắp đến giờ"
              status="soon"
              rightBadge="30 phút"
            />
            <ScheduleItem
              icon="💊"
              title="Uống thuốc tối"
              sub="20:00 • Chưa đến giờ"
              status="default"
            />
          </View>
        </Section>

        {/* Health overview – icon và chữ to, dễ đọc */}
        <Section title="Tổng quan sức khỏe" icon="📊" color="#16A34A">
          <View style={styles.statRow}>
            <StatChip color="#22C55E" icon="❤️" label="Huyết áp" value="120/80" />
            <StatChip color="#3B82F6" icon="🌡️" label="Nhiệt độ" value="36.5°C" />
            <StatChip color="#F59E0B" icon="💓" label="Nhịp tim" value="72" />
          </View>

          <View style={styles.scoreCard}>
            <View style={styles.scoreHeader}>
              <Text style={styles.scoreTitle}>Chỉ số sức khỏe tổng thể</Text>
              <Text style={styles.scoreBadge}>Tốt • 85%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '85%' }]} />
            </View>
            <Text style={styles.scoreHint}>Dựa trên các chỉ số gần đây</Text>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ===================== SUBCOMPONENTS ===================== */
function Section({
  title,
  icon,
  color,
  rightText,
  onRightPress,
  onTitlePress,
  children,
}) {
  const TitleComponent = onTitlePress ? TouchableOpacity : View;
  return (
    <View style={styles.section}>
      <View style={styles.secHeader}>
        <TitleComponent
          style={[styles.secChip, { backgroundColor: hexWithAlpha(color, 0.12) }]}
          onPress={onTitlePress}
          activeOpacity={0.8}
        >
          <Text style={[styles.secChipText, { color }]}>{icon}</Text>
          <Text style={[styles.secChipText, { color, marginLeft: 8 }]}>{title}</Text>
        </TitleComponent>
        {rightText ? (
          <TouchableOpacity
            onPress={onRightPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.secRight}>{rightText}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function BigAction({ tint, icon, title, desc, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.bigAction,
        { borderColor: hexWithAlpha(tint, 0.3), backgroundColor: '#fff' },
      ]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${desc}`}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View
        style={[styles.bigIconWrap, { backgroundColor: hexWithAlpha(tint, 0.15) }]}
      >
        <Text style={[styles.bigIcon, { color: tint }]}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bigTitle} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {title}
        </Text>
        <Text style={styles.bigDesc} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {desc}
        </Text>
      </View>
      <Text style={[styles.actionChevron, { color: tint }]}>›</Text>
    </TouchableOpacity>
  );
}

function StatChip({ color, icon, label, value }) {
  return (
    <View
      style={[
        styles.statChip,
        {
          borderColor: hexWithAlpha(color, 0.35),
          backgroundColor: hexWithAlpha(color, 0.08),
        },
      ]}
      accessibilityRole="summary"
      accessible
      importantForAccessibility="yes"
    >
      <Text style={[styles.statChipIcon, { color }]}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.statChipValue, { color }]}>{value}</Text>
        <Text style={styles.statChipLabel}>{label}</Text>
      </View>
    </View>
  );
}

function ScheduleItem({ icon, title, sub, status = 'default', rightBadge }) {
  const map = {
    done: { border: '#22C55E', bg: '#F0FFF7' },
    soon: { border: '#F59E0B', bg: '#FFF8ED' },
    default: { border: '#CBD5E1', bg: '#F8FAFC' },
  };
  const { border, bg } = map[status] ?? map.default;
  return (
    <View
      style={[styles.schItem, { borderLeftColor: border, backgroundColor: bg }]}
      accessibilityRole="summary"
      accessible
    >
      <Text style={styles.schIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.schTitle}>{title}</Text>
        <Text style={styles.schSub}>{sub}</Text>
      </View>
      {!!rightBadge && (
        <View style={[styles.badge, { backgroundColor: border }]}>
          <Text style={styles.badgeText}>{rightBadge}</Text>
        </View>
      )}
    </View>
  );
}

function ConnectedCard({ icon, title, sub, onPress, online }) {
  return (
    <TouchableOpacity
      style={styles.contact}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}. Nhấn để gọi`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.contactIconWrap}>
        <Text style={styles.contactIcon}>{icon}</Text>
        <View
          style={[
            styles.dot,
            { backgroundColor: online ? '#22c55e' : '#94a3b8' },
          ]}
        />
      </View>
      <Text style={styles.contactTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.contactSub} numberOfLines={1}>
        {sub}
      </Text>
    </TouchableOpacity>
  );
}

function RequestItem({ rq, onAccept, onDecline }) {
  return (
    <View style={styles.reqItem} accessible>
      <View style={{ flex: 1 }}>
        <Text style={styles.reqName}>
          {rq.name} • <Text style={styles.reqRelation}>{rq.relation}</Text>
        </Text>
        <Text style={styles.reqNote}>{rq.note}</Text>
        <Text style={styles.reqTime}>{rq.requestedAt}</Text>
      </View>
      <View style={styles.reqBtnRow}>
        <TouchableOpacity
          style={[styles.reqBtn, { backgroundColor: '#22C55E' }]}
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel={`Chấp nhận kết nối với ${rq.name}`}
        >
          <Text style={styles.reqBtnText}>Chấp nhận</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.reqBtn, { backgroundColor: '#EF4444' }]}
          onPress={onDecline}
          accessibilityRole="button"
          accessibilityLabel={`Từ chối kết nối với ${rq.name}`}
        >
          <Text style={styles.reqBtnText}>Từ chối</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ===================== UTILS & STYLES ===================== */
function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function hexWithAlpha(hex, alpha = 0.1) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F8FC' },
  container: { padding: 16, paddingBottom: 28, gap: 16 },

  /* Header */
  header: {
    backgroundColor: '#4F79FF',
    borderRadius: 22,
    padding: 18,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hi: { color: '#fff', fontSize: 24, fontWeight: '800' },
  date: { color: 'rgba(255,255,255,0.95)', marginTop: 8, fontSize: 16 },
  timePill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  timeText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  logoutBtn: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
  },
  logoutText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  /* Section */
  section: { gap: 12 },
  secHeader: {
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  secChipText: { fontWeight: '800', fontSize: 18 },
  secRight: { color: '#475569', fontWeight: '800', fontSize: 14 },
  viewAll: { color: '#475569', fontWeight: '800', fontSize: 14 },

  /* Emergency BIG */
  emgBigBtn: {
    backgroundColor: '#EA3D3D',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: hexWithAlpha('#000', 0.08),
    flexDirection: 'row',
    alignItems: 'center',
  },
  emgBigIcon: { fontSize: 28, marginRight: 14 },
  emgBigTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  emgBigDesc: { color: 'rgba(255,255,255,0.92)', marginTop: 2, fontSize: 14 },
  emgChevron: { color: 'rgba(255,255,255,0.95)', fontSize: 30, marginLeft: 8 },

  /* Quick actions */
  quickGrid: {
    flexDirection: 'column',
    flexWrap: 'wrap',
    gap: 12,
  },
  bigAction: {
    flexBasis: '48%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  bigIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigIcon: { fontSize: 26 },
  bigTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  bigDesc: { color: '#6b7280', fontSize: 14, marginTop: 2 },
  actionChevron: { fontSize: 28 },

  /* Cards */
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E9F1',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontWeight: '900', fontSize: 18, color: '#0f172a' },
  countPill: {
    backgroundColor: '#EEF2FF',
    color: '#3730a3',
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 14,
  },
  muted: { color: '#94a3b8', fontSize: 14 },

  /* Health */
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  statChip: {
    flexGrow: 1,
    flexBasis: '30%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  statChipIcon: { fontSize: 22 },
  statChipValue: { fontSize: 18, fontWeight: '900' },
  statChipLabel: { color: '#475569', fontSize: 13 },

  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scoreTitle: { fontWeight: '900', fontSize: 18, color: '#111827' },
  scoreBadge: {
    backgroundColor: hexWithAlpha('#22C55E', 0.15),
    color: '#16A34A',
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  progressTrack: {
    height: 12,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#22C55E' },
  scoreHint: { color: '#6b7280', fontSize: 13, marginTop: 8 },

  /* Schedule */
  scheduleList: { gap: 12 },
  schItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 6,
  },
  schIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  schTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  schSub: { color: '#475569', fontSize: 13, marginTop: 3 },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  badgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },

  /* Family */
  familyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 6,
  },
  contact: {
    flexBasis: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  contactIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  contactIcon: { fontSize: 28 },
  contactTitle: {
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
    fontSize: 16,
  },
  contactSub: { color: '#6b7280', fontSize: 13 },
  dot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#EEF2FF',
  },

  /* Requests */
  reqItem: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E6E9F1',
    gap: 12,
  },
  reqName: { fontWeight: '900', color: '#0f172a', fontSize: 16 },
  reqRelation: { color: '#2563eb', fontWeight: '800' },
  reqNote: { color: '#475569', marginTop: 4, fontSize: 14 },
  reqTime: { color: '#94a3b8', fontSize: 12, marginTop: 6 },
  reqBtnRow: { justifyContent: 'center', gap: 10 },
  reqBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 110,
    alignItems: 'center',
  },
  reqBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  /* Message */
  msgCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F0FFF7',
    borderRadius: 16,
    borderLeftWidth: 6,
    borderLeftColor: '#22C55E',
    padding: 16,
    marginTop: 6,
  },
  msgIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgTitle: {
    fontWeight: '900',
    color: '#111827',
    marginBottom: 6,
    fontSize: 16,
  },
  msgText: { color: '#475569', marginBottom: 6, lineHeight: 20, fontSize: 14 },
  msgTime: { color: '#94a3b8', fontSize: 12 },
});
