import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import socketService from '../../services/socketService';
import CallNotificationService from '../../services/CallNotificationService';

const SOSCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Nhận thông tin cuộc gọi SOS từ params
  const { 
    sosId,
    callId,
    requester, // { _id, fullName, avatar, phoneNumber }
    recipientIndex = 1,
    totalRecipients = 1,
  } = route.params || {};

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Dismiss notification khi vào màn hình này
    if (callId) {
      CallNotificationService.dismissIncomingCallNotification(callId);
    }

    // Animation cho avatar (pulse effect)
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    // Rung điện thoại mạnh hơn cho SOS
    if (Platform.OS === 'android') {
      const pattern = [0, 500, 200, 500, 200, 500]; // Pattern mạnh
      Vibration.vibrate(pattern, true); // Rung liên tục
    }

    // Lắng nghe sự kiện timeout từ backend
    socketService.on('sos_call_timeout', handleCallTimeout);
    socketService.on('sos_call_cancelled', handleCallCancelled);

    // Cleanup
    return () => {
      pulseAnimation.stop();
      Vibration.cancel();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      socketService.off('sos_call_timeout', handleCallTimeout);
      socketService.off('sos_call_cancelled', handleCallCancelled);
    };
  }, []);

  const handleCallTimeout = (data) => {
    if (data.sosId === sosId && data.callId === callId) {
      console.log('⏰ SOS call timeout');
      Vibration.cancel();
      navigation.goBack();
    }
  };

  const handleCallCancelled = (data) => {
    if (data.sosId === sosId && data.callId === callId) {
      console.log('🛑 SOS call cancelled');
      Vibration.cancel();
      navigation.goBack();
    }
  };

  const handleAcceptCall = () => {
    console.log('✅ SOS Call accepted');
    Vibration.cancel();
    
    // Emit socket event accept SOS call
    socketService.socket.emit('sos_call_accepted', {
      sosId,
      callId,
    });

    // Navigate đến VideoCallScreen với SOS context
    navigation.replace('VideoCall', {
      callId,
      conversationId: null, // SOS call không cần conversation
      otherParticipant: requester,
      isIncoming: true,
      isSOSCall: true, // Đánh dấu đây là SOS call
      sosId,
    });
  };

  const handleRejectCall = () => {
    console.log('❌ SOS Call rejected');
    Vibration.cancel();
    
    // Emit socket event reject SOS call
    socketService.socket.emit('sos_call_rejected', {
      sosId,
      callId,
    });

    navigation.goBack();
  };

  const handleCallDirect = () => {
    console.log('📞 Calling directly via phone');
    Vibration.cancel();
    
    if (requester?.phoneNumber) {
      Linking.openURL(`tel:${requester.phoneNumber}`);
    }
  };

  if (!requester || !sosId || !callId) {
    console.error('❌ Missing SOS call information');
    navigation.goBack();
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Emergency Banner */}
      <View style={styles.emergencyBanner}>
        <Icon name="alert-circle" size={30} color="#FFF" />
        <Text style={styles.emergencyText}>🆘 CUỘC GỌI KHẨN CẤP</Text>
      </View>

      {/* Call Order Info */}
      {totalRecipients > 1 && (
        <View style={styles.orderInfo}>
          <Text style={styles.orderText}>
            Bạn là người được gọi thứ {recipientIndex}/{totalRecipients}
          </Text>
        </View>
      )}

      {/* Requester Info */}
      <View style={styles.requesterInfoContainer}>
        <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
          {requester.avatar ? (
            <Image source={{ uri: requester.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {requester.fullName?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          {/* SOS Badge */}
          <View style={styles.sosBadge}>
            <Text style={styles.sosBadgeText}>SOS</Text>
          </View>
        </Animated.View>

        <Text style={styles.requesterName}>{requester.fullName || 'Unknown'}</Text>
        <Text style={styles.emergencyMessage}>CẦN TRỢ GIÚP KHẨN CẤP!</Text>
        {requester.phoneNumber && (
          <Text style={styles.phoneNumber}>📱 {requester.phoneNumber}</Text>
        )}
      </View>

      {/* Warning Text */}
      <View style={styles.warningContainer}>
        <Icon name="warning" size={20} color="#FF6B6B" />
        <Text style={styles.warningText}>
          Đây là cuộc gọi khẩn cấp. Vui lòng trả lời nếu có thể.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Direct Call Button (nếu có phone number) */}
        {requester.phoneNumber && (
          <TouchableOpacity
            style={[styles.actionButton, styles.directCallButton]}
            onPress={handleCallDirect}
            activeOpacity={0.8}
          >
            <Icon name="call" size={28} color="#fff" />
            <Text style={styles.actionButtonText}>Gọi điện thoại</Text>
          </TouchableOpacity>
        )}

        {/* Reject Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={handleRejectCall}
          activeOpacity={0.8}
        >
          <Icon name="close-circle" size={28} color="#fff" />
          <Text style={styles.actionButtonText}>Không thể trả lời</Text>
        </TouchableOpacity>

        {/* Accept Video Call Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={handleAcceptCall}
          activeOpacity={0.8}
        >
          <Icon name="videocam" size={28} color="#fff" />
          <Text style={styles.actionButtonText}>Chấp nhận cuộc gọi</Text>
        </TouchableOpacity>
      </View>

      {/* Background Gradient Effect */}
      <View style={styles.backgroundGradient} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0000', // Darker red for emergency
    justifyContent: 'space-between',
    paddingVertical: hp('5%'),
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: hp('50%'),
    backgroundColor: 'rgba(255, 0, 0, 0.15)',
  },
  emergencyBanner: {
    backgroundColor: '#FF0000',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#FFD700',
    zIndex: 1,
  },
  emergencyText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
    letterSpacing: 1,
  },
  orderInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 1,
  },
  orderText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  requesterInfoContainer: {
    alignItems: 'center',
    zIndex: 1,
    marginTop: hp('5%'),
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 5,
    borderColor: '#FF0000',
  },
  avatarPlaceholder: {
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 50,
    fontWeight: 'bold',
    color: '#FFF',
  },
  sosBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#FF0000',
  },
  sosBadgeText: {
    color: '#FF0000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  requesterName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  emergencyMessage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 1,
  },
  phoneNumber: {
    fontSize: 16,
    color: '#CCC',
    marginTop: 5,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    zIndex: 1,
  },
  warningText: {
    color: '#FFD700',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
    fontWeight: '600',
  },
  actionsContainer: {
    paddingHorizontal: wp('8%'),
    zIndex: 1,
    marginBottom: hp('3%'),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 50,
    marginBottom: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  directCallButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#666',
  },
  acceptButton: {
    backgroundColor: '#FF0000',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});

export default SOSCallScreen;
