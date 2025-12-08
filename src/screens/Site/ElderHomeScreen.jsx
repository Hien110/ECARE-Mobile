import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
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
  TouchableOpacity,
  View,
  NativeEventEmitter,
  NativeModules,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';

import relationshipService from '../../services/relationshipService';
import socketService from '../../services/socketService';
import sosService from '../../services/sosService';
import userService from '../../services/userService';
import conversationService from '../../services/conversationService';
import CallService from '../../services/CallService';

import { SafeAreaView } from 'react-native-safe-area-context';
import { enableFloating, disableFloating } from '../../utils/floatingCheckinHelper';

/* ===================== HOME ===================== */
export default function HomeScreen() {
  const nav = useNavigation();
  const route = useRoute();

  // boot/auth
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);

  // ===== Family connections =====
  const [reqLoading, setReqLoading] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [familyList, setFamilyList] = useState([]);
  const [relationships, setRelationships] = useState([]);

  // Track SOS sending state
  const [isSendingSOS, setIsSendingSOS] = useState(false);

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

  // helper: notify
  const notify = useCallback((msg, type = 'info') => {
    if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    else {
      Alert.alert(
        type === 'success' ? 'Thành công' : type === 'error' ? 'Lỗi' : 'Thông báo',
        msg,
      );
    }
  }, []);

  // helper: lấy người “còn lại” trong quan hệ
  const getOtherMember = useCallback((rel, myId) => {
    const isMeElderly = String(rel?.elderly?._id) === String(myId);
    return isMeElderly ? rel?.family : rel?.elderly;
  }, []);

  // Hàm lấy vị trí hiện tại
  const getCurrentLocation = useCallback(() => {
    return new Promise(async (resolve, reject) => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Quyền truy cập vị trí',
              message: 'E-Care cần quyền truy cập vị trí để gửi cảnh báo khẩn cấp.',
              buttonPositive: 'Đồng ý',
              buttonNegative: 'Từ chối',
            },
          );

          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            reject(new Error('Không có quyền truy cập vị trí'));
            return;
          }
        }

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

  // Hàm chuyển tọa độ thành địa chỉ
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
    if (!user?._id) {
      Alert.alert('Lỗi', 'Bạn cần đăng nhập để sử dụng tính năng này!');
      return;
    }

    if (isSendingSOS) {
      Alert.alert(
        '⚠️ Đang xử lý',
        'Đang có cuộc gọi SOS đang được xử lý. Vui lòng đợi hoàn tất.',
        [{ text: 'OK' }],
      );
      return;
    }

    try {
      setIsSendingSOS(true);

      const token = await AsyncStorage.getItem('ecare_token');

      if (!token) {
        Alert.alert('Lỗi', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!');
        nav.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      notify('Đang gửi cảnh báo khẩn cấp...', 'info');

      // Lấy vị trí
      let location;
      try {
        const coords = await getCurrentLocation();
        const address = await reverseGeocode(coords.latitude, coords.longitude);

        location = {
          coordinates: {
            latitude: coords.latitude,
            longitude: coords.longitude,
          },
          address: address,
        };
      } catch (locationError) {
        console.warn('⚠️ Could not get location, using fallback:', locationError);

        location = {
          coordinates: {
            latitude: 10.762622,
            longitude: 106.660172,
          },
          address: 'Không xác định được vị trí (Vui lòng bật GPS)',
        };
      }

      // Lấy family
      const familyRes = await userService.getFamilyMembersByElderlyId({
        elderlyId: user._id,
      });
      if (!familyRes.success) {
        setIsSendingSOS(false);
        Alert.alert('Lỗi', 'Không thể lấy danh sách thành viên gia đình');
        return;
      }

      const recipients = familyRes.data
        .map(member => member._id)
        .filter(memberId => memberId !== user._id);

      if (recipients.length === 0) {
        setIsSendingSOS(false);
        Alert.alert('Lỗi', 'Không có thành viên gia đình nào để gửi cảnh báo');
        return;
      }

      const message = `${user?.fullName || 'Người dùng'} cần trợ giúp ngay lập tức!`;

      await sosService.createSOS(recipients, message, location);

      notify('Đã gửi cảnh báo đến tất cả thành viên!', 'success');
      // isSendingSOS sẽ được clear bởi listener sos_call_no_answer hoặc khi cuộc gọi kết thúc
    } catch (error) {
      console.error('❌ Error sending emergency notification:', error);
      console.error('❌ Error details:', error?.response?.data);

      setIsSendingSOS(false);

      const errorCode = error?.response?.data?.code;
      const errorMsg = error?.response?.data?.message;

      if (errorCode === 'ACTIVE_SOS_EXISTS') {
        Alert.alert(
          '⚠️ SOS đang xử lý',
          errorMsg ||
            'Bạn đang có cuộc gọi SOS đang xử lý. Vui lòng đợi hoàn tất trước khi gửi SOS mới.',
          [{ text: 'OK' }],
        );
      } else {
        const defaultMsg =
          errorMsg || 'Gửi cảnh báo thất bại. Vui lòng thử lại.';
        Alert.alert('Lỗi', defaultMsg);
      }
    }
  }, [notify, user, nav, getCurrentLocation, reverseGeocode, isSendingSOS]);

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
              role: other.role,
              avatar: other.avatar,
              relationship: r?.relationship,
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
    async (relationshipId, action) => {
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
          } else if (relationshipService.patch) {
            await relationshipService.patch(relationshipId, {
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
          } else if (relationshipService.patch) {
            await relationshipService.patch(relationshipId, {
              status: 'rejected',
            });
          }
          notify('Đã từ chối yêu cầu.');
        }
        await loadPendingRequests();
        await loadFamilyRelationships();
      } catch (e) {
        console.log('respondToRequest error:', e);
        notify('Xử lý yêu cầu thất bại. Vui lòng thử lại.', 'error');
      } finally {
        setReqLoading(false);
      }
    },
    [loadPendingRequests, loadFamilyRelationships, notify],
  );

  // gọi video tới thành viên gia đình
  const handleVideoCallToMember = useCallback(
    async member => {
      try {
        if (!socketService.isConnected) {
          notify('Không thể thực hiện cuộc gọi. Vui lòng kiểm tra kết nối.', 'error');
          return;
        }

        if (!user) {
          notify('Không thể lấy thông tin người dùng', 'error');
          return;
        }

        const convResult =
          await conversationService.getConversationByParticipants(
            user._id,
            member._id,
          );

        if (!convResult.success) {
          notify('Không tìm thấy cuộc trò chuyện với thành viên này', 'error');
          return;
        }

        const conversationId = convResult.data._id;

        const call = CallService.createCall({
          conversationId,
          otherParticipant: member,
          callType: 'video',
        });

        console.log('📞 Initiating video call to member:', call);

        socketService.requestVideoCall({
          callId: call.callId,
          conversationId,
          callerId: user._id,
          callerName: user.fullName,
          callerAvatar: user.avatar,
          calleeId: member._id,
          callType: 'video',
        });

        nav.navigate('VideoCall', {
          callId: call.callId,
          conversationId,
          otherParticipant: member,
          isIncoming: false,
        });
      } catch (error) {
        console.error('❌ Error initiating video call:', error);
        notify('Không thể thực hiện cuộc gọi. Vui lòng thử lại.', 'error');
      }
    },
    [user, nav, notify],
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

  // Bật/tắt FloatingDeadman theo role & relationship
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

  // Listener SOS answered / no answer
  useEffect(() => {
    if (!user?._id) return;

    const handleSOSCallAnswered = data => {
      const { sosId, callId, recipient } = data;

      console.log('✅ SOS call answered by:', recipient?.fullName);

      setIsSendingSOS(false);

      try {
        console.log(
          '🧹 Disabling Deadman floating overlay because SOS call was answered',
        );
        disableFloating();
      } catch (err) {
        console.log('⚠️ Error disabling Deadman floating overlay:', err);
      }

      nav.navigate('VideoCall', {
        callId,
        conversationId: null,
        otherParticipant: recipient,
        isIncoming: false,
        isSOSCall: true,
        sosId,
      });

      if (Platform.OS === 'android') {
        ToastAndroid.show(
          `✅ ${
            recipient?.fullName || 'Thành viên gia đình'
          } đã chấp nhận cuộc gọi`,
          ToastAndroid.SHORT,
        );
      }
    };

    const handleSOSCallNoAnswer = data => {
      console.log('❌ SOS call - no one answered');

      setIsSendingSOS(false);

      Alert.alert(
        '⚠️ Không có phản hồi',
        data.message ||
          'Không có thành viên nào trả lời cuộc gọi khẩn cấp. Vui lòng thử gọi trực tiếp hoặc liên hệ số khẩn cấp 115.',
        [{ text: 'OK' }],
      );
    };

    socketService.on('sos_call_answered', handleSOSCallAnswered);
    socketService.on('sos_call_no_answer', handleSOSCallNoAnswer);

    return () => {
      socketService.off('sos_call_answered', handleSOSCallAnswered);
      socketService.off('sos_call_no_answer', handleSOSCallNoAnswer);
    };
  }, [user, nav]);

  // Listener Deadman vuốt xuống
  useEffect(() => {
    if (!user?._id) return;

    const nativeModule = NativeModules.FloatingCheckin;
    if (!nativeModule) {
      console.warn('[FloatingCheckin] Native module not found, skip listener');
      return;
    }
    const eventEmitter = new NativeEventEmitter(NativeModules.FloatingCheckin);

    const subscription = eventEmitter.addListener('onDeadmanSwipe', event => {
      const { choice } = event;
      console.log('🚨 Deadman swipe event received:', choice);

      if (choice === 'phys_unwell') {
        console.log('📞 Triggering handleEmergency from swipe down...');
        handleEmergency();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user, handleEmergency]);

  // Auto SOS khi quay lại từ Deadman
  useEffect(() => {
    if (!user?._id) {
      return;
    }

    const role = (user?.role || '').toLowerCase();
    const autoSOS = route?.params?.autoSOSFromDeadman;

    if (role !== 'elderly') {
      return;
    }

    if (!autoSOS) {
      return;
    }

    handleEmergency();

    if (nav.setParams) {
      nav.setParams({
        ...(route?.params || {}),
        autoSOSFromDeadman: false,
      });
    }
  }, [user, route, nav, handleEmergency]);

  const bookAppointment = () => {
    nav.navigate('IntroductionBookingDoctor', {
      elderlyId: user?._id || null,
    });
  };

  const findSupport = () => {
    nav.navigate('ServiceSelectionScreen', {
      elderlyId: user?._id || null,
      source: 'FamilyListFunction_Supporter',
    });
  };

  const chatSupport = () => nav.navigate('ChatWithAI');

  if (booting) {
    return (
      <SafeAreaView
        style={[
          styles.safe,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </SafeAreaView>
    );
  }

  const displayName =
    (user?.fullName && `bác ${user.fullName.split(' ').slice(-1)[0]}`) ||
    (user?.phoneNumber && `người dùng ${user.phoneNumber}`) ||
    'bác';

  const pendingPreview = pendingRequests.slice(0, 2);
  const familyPreview = familyList.slice(0, 3);

  /* ===================== RENDER ===================== */
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Không cần lời chào to, chỉ hiển thị thông tin ngày giờ gọn */}
        {/* <View style={styles.infoPillRow}>
          <Text style={styles.infoPillText}>{dateStr}</Text>
          <Text style={styles.infoPillText}>Bây giờ: {timeStr}</Text>
        </View> */}

        {/* Khối 1 – GỌI KHẨN CẤP */}
        <TouchableOpacity
          style={[styles.emgBigBtn, isSendingSOS && { opacity: 0.7 }]}
          onPress={handleEmergency}
          disabled={isSendingSOS}
          accessibilityRole="button"
          accessibilityLabel="Gọi khẩn cấp. Nhấn để báo động cho gia đình"
          activeOpacity={0.9}
        >
          <View style={styles.emgIconWrap}>
            <Text style={styles.emgBigIcon} accessible>
              🚨
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emgBigTitle}>
              {isSendingSOS ? 'ĐANG GỬI TÍN HIỆU...' : 'GỌI KHẨN CẤP'}
            </Text>
            <Text style={styles.emgBigDesc}>
              {isSendingSOS
                ? 'Đang liên hệ với các thành viên gia đình...'
                : 'Nhấn một lần để báo động cho gia đình'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Khối 2 – TÁC VỤ CHÍNH */}
        <Section title="Tác vụ chính" icon="⭐" color="#2563eb">
          <View style={styles.mainActionList}>
            <BigAction
              tint="#4F46E5"
              icon="💬"
              title="Trò chuyện với E-Care"
              desc="AI lắng nghe và hỗ trợ"
              onPress={chatSupport}
            />
            <BigAction
              tint="#16A34A"
              icon="🧑🏻‍⚕️"
              title="Hẹn gặp bác sĩ"
              desc="Khám trực tiếp hoặc video"
              onPress={bookAppointment}
            />
            <BigAction
              tint="#059669"
              icon="🤝"
              title="Thuê người hỗ trợ"
              desc="Giúp việc • chăm sóc tại nhà"
              onPress={findSupport}
            />
          </View>
        </Section>

        {/* Khối 3 – GIA ĐÌNH & BÁC SĨ */}
        <Section
          title="Kết nối"
          icon="👨‍👩‍👧"
          color="#f43f5e"
          rightText="Xem tất cả"
          onRightPress={() => nav.navigate('FamilyConnectionList')}
        >
          <View style={styles.card}>
            {familyLoading ? (
              <ActivityIndicator />
            ) : familyPreview.length === 0 ? (
              <View style={styles.msgCard}>
                <View style={styles.msgIcon}>
                  <Text>👋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.msgTitle}>Chưa có thành viên gia đình</Text>
                  <Text style={styles.msgText}>
                    Mời con cháu hoặc bác sĩ kết nối để tiện liên lạc.
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      nav.navigate('FamilyConnectionList')
                    }
                  >
                    <Text style={styles.msgLink}>Mời/Quản lý gia đình ›</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.familyList}>
                  {familyPreview.map(m => {
                    const rel = (m.relationship || '').toLowerCase();
                    const role = (m.role || '').toLowerCase();

                    const isDoctor =
                      role === 'doctor' ||
                      rel === 'doctor' ||
                      rel === 'bác sĩ';

                    const subText = isDoctor
                      ? `Bác sĩ của ${user?.fullName || 'người cao tuổi'}`
                      : (m.relationship || 'Thành viên gia đình');

                    return (
                      <ConnectedCard
                        key={m._id}
                        icon={isDoctor ? '👩‍⚕️' : '👤'}
                        sub={subText}
                        title={m.fullName}
                        onPress={() => handleVideoCallToMember(m)}
                        online={false}
                      />
                    );
                  })}
                </View>
                <Text style={styles.familyHint}>
                  Nhấn vào tên để gọi video.
                </Text>
              </>
            )}
          </View>
        </Section>

        {/* Khối 4 – YÊU CẦU KẾT NỐI */}
        <Section
          title="Yêu cầu kết nối"
          icon="📩"
          color="#0f766e"
          rightText="Xem tất cả"
          onRightPress={() => nav.navigate('FamilyConnection')}
        >
          <View style={styles.card}>
            {reqLoading ? (
              <ActivityIndicator />
            ) : pendingPreview.length === 0 ? (
              <Text style={styles.muted}>Hiện không có yêu cầu mới.</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {pendingPreview.map(r => {
                  const other = getOtherMember(r, user?._id);
                  const name = other?.fullName || 'Người dùng';
                  const relation =
                    r?.relationship || 'Thành viên gia đình';
                  const requestedAt = r?.createdAt
                    ? new Date(r.createdAt).toLocaleString('vi-VN')
                    : 'Gần đây';
                  return (
                    <RequestItem
                      key={r?._id}
                      rq={{
                        name,
                        relation,
                        note:
                          r?.note ||
                          'Yêu cầu kết nối với bạn trên E-Care',
                        requestedAt,
                      }}
                      onAccept={() =>
                        respondToRequest(r?._id, 'accept')
                      }
                      onDecline={() =>
                        respondToRequest(r?._id, 'reject')
                      }
                    />
                  );
                })}
              </View>
            )}
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
          {!!icon && (
            <Text style={[styles.secChipText, { color }]}>
              {icon}
            </Text>
          )}
          <Text
            style={[
              styles.secChipText,
              { color, marginLeft: icon ? 8 : 0 },
            ]}
          >
            {title}
          </Text>
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
        { borderColor: hexWithAlpha(tint, 0.35), backgroundColor: '#fff' },
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
        <Text style={styles.bigTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.bigDesc} numberOfLines={2}>
          {desc}
        </Text>
      </View>
      <Text style={[styles.actionChevron, { color: tint }]}>›</Text>
    </TouchableOpacity>
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
      <View style={{ flex: 1 }}>
        <Text style={styles.contactTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.contactSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function RequestItem({ rq, onAccept, onDecline }) {
  return (
    <View style={styles.reqItem} accessible>
      <View style={{ flex: 1 }}>
        <Text style={styles.reqName}>
          {rq.name}{' '}
          <Text style={styles.reqRelation}>• {rq.relation}</Text>
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
  safe: {
    flex: 1,
    backgroundColor: '#EEF2FF',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 18,
  },

  /* Loading */
  loadingText: {
    marginTop: 12,
    color: '#4b5563',
    fontSize: 18,
    fontWeight: '600',
  },

  /* Info row (ngày/giờ nhỏ gọn) */
  infoPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  infoPillText: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    color: '#1e293b',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Section */
  section: {
    gap: 10,
  },
  secHeader: {
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  secChipText: {
    fontWeight: '800',
    fontSize: 20,
  },
  secRight: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 20,
    textDecorationLine: 'underline',
  },

  /* Emergency BIG */
  emgBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 26,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: '#B91C1C',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  emgIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: 'rgba(248, 250, 252, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  emgBigIcon: {
    fontSize: 34,
  },
  emgBigTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  emgBigDesc: {
    color: 'rgba(255,255,255,0.95)',
    marginTop: 4,
    fontSize: 15,
  },

  /* Main actions (vertical list) */
  mainActionList: {
    flexDirection: 'column',
    gap: 10,
  },
  bigAction: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  bigIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigIcon: {
    fontSize: 26,
  },
  bigTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  bigDesc: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 2,
  },
  actionChevron: {
    fontSize: 28,
  },

  /* Card chung */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    gap: 10,
  },
  muted: {
    color: '#9ca3af',
    fontSize: 14,
  },

  /* Family list */
  familyList: {
    flexDirection: 'column',
    gap: 10,
  },
  familyHint: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 14,
  },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  contactIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactIcon: {
    fontSize: 28,
  },
  contactTitle: {
    fontWeight: '800',
    color: '#111827',
    fontSize: 17,
  },
  contactSub: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 2,
  },
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
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  reqName: {
    fontWeight: '800',
    color: '#0f172a',
    fontSize: 16,
  },
  reqRelation: {
    color: '#2563eb',
    fontWeight: '700',
  },
  reqNote: {
    color: '#475569',
    marginTop: 4,
    fontSize: 14,
  },
  reqTime: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 6,
  },
  reqBtnRow: {
    justifyContent: 'center',
    gap: 8,
  },
  reqBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    minWidth: 120,
    alignItems: 'center',
  },
  reqBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },

  /* Message */
  msgCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    borderLeftWidth: 6,
    borderLeftColor: '#FBBF24',
    padding: 14,
  },
  msgIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgTitle: {
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
    fontSize: 16,
  },
  msgText: {
    color: '#4b5563',
    fontSize: 14,
  },
  msgLink: {
    color: '#1D4ED8',
    fontWeight: '700',
    marginTop: 6,
  },
});
