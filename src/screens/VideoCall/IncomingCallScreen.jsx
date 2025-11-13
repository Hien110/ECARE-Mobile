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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import socketService from '../../services/socketService';
import CallNotificationService from '../../services/CallNotificationService';

const IncomingCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Nhận thông tin cuộc gọi từ params
  const { 
    callId,
    caller, // { _id, fullName, avatar }
    conversationId,
    callType = 'video' // 'video' hoặc 'audio'
  } = route.params || {};

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Dismiss notification khi vào màn hình này
    if (callId) {
      CallNotificationService.dismissIncomingCallNotification(callId);
    }

    // Animation cho avatar (pulse effect)
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    // Rung điện thoại
    if (Platform.OS === 'android') {
      const pattern = [0, 1000, 500, 1000, 500, 1000];
      Vibration.vibrate(pattern, true); // Rung liên tục
    }

    // Lắng nghe sự kiện caller hủy cuộc gọi
    socketService.on('video_call_cancelled', handleCallCancelled);

    // Cleanup
    return () => {
      pulseAnimation.stop();
      Vibration.cancel();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      socketService.off('video_call_cancelled', handleCallCancelled);
    };
  }, []);

  const handleCallCancelled = (data) => {
    if (data.callId === callId) {
      console.log('📞 Caller cancelled the call');
      Vibration.cancel();
      navigation.goBack();
    }
  };

  const handleAccept = () => {
    console.log('✅ Call accepted');
    Vibration.cancel();
    
    // Emit socket event accept call - SỬA: Dùng acceptVideoCall() thay vì emit()
    const acceptData = {
      callId,
      conversationId,
      callerId: caller._id,
    };
    console.log('📤 Accepting video call:', acceptData);
    socketService.acceptVideoCall(acceptData);

    // Navigate đến VideoCallScreen
    navigation.replace('VideoCall', {
      callId,
      conversationId,
      otherParticipant: caller,
      isIncoming: true, // Đánh dấu là người nhận cuộc gọi
    });
  };

  const handleReject = () => {
    console.log('❌ Call rejected by callee');
    Vibration.cancel();
    
    // Kiểm tra socket connection trước khi emit
    const socketStatus = socketService.getConnectionStatus();
    console.log('🔌 Socket status before rejecting:', socketStatus);
    
    // Emit socket event reject call - SỬA: Dùng rejectVideoCall() thay vì emit()
    const rejectData = {
      callId,
      conversationId,
      callerId: caller._id,
    };
    console.log('📤 Rejecting video call:', rejectData);
    socketService.rejectVideoCall(rejectData);

    navigation.goBack();
  };

  if (!caller || !callId) {
    console.error('❌ Missing call information');
    navigation.goBack();
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Caller Info */}
      <View style={styles.callerInfoContainer}>
        <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
          {caller.avatar ? (
            <Image source={{ uri: caller.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {caller.fullName?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </Animated.View>

        <Text style={styles.callerName}>{caller.fullName || 'Unknown'}</Text>
        <Text style={styles.callTypeText}>
          {callType === 'video' ? 'Cuộc gọi video đến...' : 'Cuộc gọi thoại đến...'}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Reject Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={handleReject}
          activeOpacity={0.8}
        >
          <Icon name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          <Text style={styles.actionButtonText}>Từ chối</Text>
        </TouchableOpacity>

        {/* Accept Button */}
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={handleAccept}
          activeOpacity={0.8}
        >
          <Icon name={callType === 'video' ? 'videocam' : 'call'} size={30} color="#fff" />
          <Text style={styles.actionButtonText}>Chấp nhận</Text>
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
    backgroundColor: '#1a1a2e',
    justifyContent: 'space-between',
    paddingVertical: hp('10%'),
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: hp('50%'),
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  callerInfoContainer: {
    alignItems: 'center',
    zIndex: 1,
  },
  avatarContainer: {
    marginBottom: hp('3%'),
  },
  avatar: {
    width: wp('35%'),
    height: wp('35%'),
    borderRadius: wp('17.5%'),
    borderWidth: 4,
    borderColor: '#2196F3',
  },
  avatarPlaceholder: {
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: wp('15%'),
    fontWeight: 'bold',
  },
  callerName: {
    color: '#fff',
    fontSize: wp('6%'),
    fontWeight: '600',
    marginBottom: hp('1%'),
    textAlign: 'center',
    paddingHorizontal: wp('10%'),
  },
  callTypeText: {
    color: '#aaa',
    fontSize: wp('4%'),
    marginBottom: hp('2%'),
  },
  timeoutText: {
    color: '#ff6b6b',
    fontSize: wp('3.5%'),
    marginTop: hp('1%'),
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: wp('10%'),
    zIndex: 1,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: wp('20%'),
    height: wp('20%'),
    borderRadius: wp('10%'),
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: wp('3%'),
    marginTop: hp('0.5%'),
    fontWeight: '500',
  },
});

export default IncomingCallScreen;
