import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import userService from '../../services/userService';
import { doctorBookingService } from '../../services/doctorBookingService';
import supporterSchedulingService from '../../services/supporterSchedulingService';
import { conversationService } from '../../services/conversationService';
import socketService from '../../services/socketService';
import CallService from '../../services/CallService';

const C = {
  bg: '#ffffff',
  fg: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  primary: '#2563eb',
};

export default function SupportStaffDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { staffId, name, type, avatar } = route.params || {};

  const [me, setMe] = useState(null);
  const [relatedElders, setRelatedElders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const meRes = await userService.getUser();
        const meData = meRes?.data || null;
        if (mounted) setMe(meData);

        // Lấy danh sách elderly thuộc family hiện tại (dựa vào màn hình khác đang dùng)
        const eldersRes = await doctorBookingService.getElderlies();
        const elders = Array.isArray(eldersRes?.data) ? eldersRes.data : [];

        // Với từng elderly, kiểm tra có quan hệ với staff không
        const matched = [];
        for (const e of elders) {
          const eId = e?.elderlyId || e?.userId || e?.elderly?._id || e?._id;
          const eName = e?.elderly?.fullName || e?.fullName || e?.name;
          if (!eId) continue;

          if (type === 'doctor') {
            try {
              const bRes = await doctorBookingService.getBookingsByElderlyId(eId);
              const bookings = Array.isArray(bRes?.data) ? bRes.data : [];
              const has = bookings.some(bk => {
                const d = bk?.doctor || bk?.doctorProfile || {};
                const dUser = d?.user || d?.userInfo || {};
                const dId = dUser?._id || d?.userId || d?._id;
                return dId && dId === staffId;
              });
              if (has) matched.push({ _id: eId, fullName: eName });
            } catch {}
          } else if (type === 'supporter') {
            try {
              const sRes = await supporterSchedulingService.getSchedulingsByUserId(eId);
              const scheds = Array.isArray(sRes?.data) ? sRes.data : [];
              const has = scheds.some(s => {
                const sup = s?.supporter || s?.supporterProfile || {};
                const sUser = sup?.user || sup?.userInfo || {};
                const sid = sUser?._id || sup?.userId || sup?._id || s?.supporterId;
                return sid && sid === staffId;
              });
              if (has) matched.push({ _id: eId, fullName: eName });
            } catch {}
          }
        }
        if (mounted) setRelatedElders(matched);
      } finally {
        mounted && setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [staffId, type]);

  const handleVideoCall = async () => {
    try {
      if (!socketService.isConnected) {
        Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi. Vui lòng kiểm tra kết nối.');
        return;
      }
      setCalling(true);

      const caller = me || (await userService.getUser()).data;
      if (!caller?._id && !caller?.id) {
        Alert.alert('Lỗi', 'Không xác định được người gọi');
        return;
      }

      // Tìm cuộc trò chuyện 1-1 giữa family (me) và staff
      const callerId = caller._id || caller.id;
      const convRes = await conversationService.getConversationByParticipants(callerId, staffId);
      const conversation = convRes?.data || null;
      const conversationId = conversation?._id || conversation?.id;
      if (!conversationId) {
        Alert.alert('Lỗi', 'Chưa có cuộc trò chuyện với nhân viên hỗ trợ');
        return;
      }

      const otherParticipant = { _id: staffId, fullName: name, avatar };
      const call = CallService.createCall({ conversationId, otherParticipant, callType: 'video' });

      socketService.requestVideoCall({
        callId: call.callId,
        conversationId,
        callerId: callerId,
        callerName: caller.fullName,
        callerAvatar: caller.avatar,
        calleeId: staffId,
        callType: 'video',
      });

      navigation.navigate('VideoCall', {
        callId: call.callId,
        conversationId,
        otherParticipant,
        isIncoming: false,
      });
    } catch (e) {
      console.error('video call error', e);
      Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi. Vui lòng thử lại.');
    } finally {
      setCalling(false);
    }
  };

  return (
    <View style={styles.safe}>
      <View style={styles.card}>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <Image
            source={{
              uri:
                avatar ||
                'https://cdn.sforum.vn/sforum/wp-content/uploads/2023/10/avatar-trang-4.jpg',
            }}
            style={styles.avatar}
          />
          <Text style={styles.name} numberOfLines={1}>
            {name || 'Ẩn danh'}
          </Text>
          <Text style={styles.rel} numberOfLines={1}>
            {type === 'doctor' ? 'Bác sĩ' : 'Supporter'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Liên kết với người già</Text>
        {loading ? (
          <ActivityIndicator />
        ) : relatedElders.length ? (
          <View style={{ gap: 8 }}>
            {relatedElders.map((e) => (
              <View key={e._id} style={styles.rowItem}>
                <Text style={styles.value}>{e.fullName || 'Ẩn danh'}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>Chưa có liên kết với người già trong gia đình</Text>
        )}

        <TouchableOpacity
          style={styles.callButton}
          onPress={handleVideoCall}
          disabled={calling}
          activeOpacity={0.8}
        >
          <Text style={styles.callText}>{calling ? 'Đang gọi...' : 'Gọi video'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 8 },
  name: { fontSize: 18, fontWeight: '800', color: C.fg },
  rel: { fontSize: 12, color: C.muted, marginTop: 4 },
  sectionTitle: { marginTop: 6, fontSize: 14, fontWeight: '700', color: C.fg },
  rowItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  value: { fontSize: 13, color: C.fg },
  muted: { fontSize: 12, color: C.muted, marginTop: 6 },
  callButton: {
    marginTop: 16,
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  callText: { color: '#fff', fontWeight: '700' },
});
