import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import userService from '../../services/userService';
import { conversationService } from '../../services/conversationService';
import socketService from '../../services/socketService';
import CallService from '../../services/CallService';

const C = {
  bg: '#ffffff',
  fg: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
};

export default function FamilyDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { elderlyId, name, relationship, avatar } = route.params || {};

  const handleVideoCall = async () => {
    try {
      if (!socketService.isConnected) {
        Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi. Vui lòng kiểm tra kết nối.');
        return;
      }
      const meRes = await userService.getUser();
      const me = meRes?.data || null;
      if (!me?._id && !me?.id) {
        Alert.alert('Lỗi', 'Không xác định được người gọi');
        return;
      }
      // Tìm cuộc trò chuyện giữa family (me) và elderly
      const callerId = me._id || me.id;
      const convRes = await conversationService.getConversationByParticipants(callerId, elderlyId);
      const conversation = convRes?.data || null;
      const conversationId = conversation?._id || conversation?.id;
      if (!conversationId) {
        Alert.alert('Lỗi', 'Chưa có cuộc trò chuyện với người nhà');
        return;
      }

      const otherParticipant = { _id: elderlyId, fullName: name, avatar };
      const call = CallService.createCall({ conversationId, otherParticipant, callType: 'video' });

      socketService.requestVideoCall({
        callId: call.callId,
        conversationId,
        callerId,
        callerName: me.fullName,
        callerAvatar: me.avatar,
        calleeId: elderlyId,
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
            {relationship || 'Mối quan hệ'}
          </Text>
        </View>
        <TouchableOpacity style={styles.callButton} onPress={handleVideoCall} activeOpacity={0.8}>
          <Text style={styles.callText}>Gọi video</Text>
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
  callButton: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  callText: { color: '#fff', fontWeight: '700' },
});
