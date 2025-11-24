import React, { useState, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType, RtcSurfaceView } from 'react-native-agora';
import Config from 'react-native-config';
import Toast from 'react-native-toast-message';
import agoraService from '../../services/agoraService';
import socketService from '../../services/socketService';
import CallService from '../../services/CallService';
import CallNotificationService from '../../services/CallNotificationService';

const VideoCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { conversationId, otherParticipant, callId, isIncoming = false, isSOSCall = false, sosId } = route.params || {};

  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [remoteUid, setRemoteUid] = useState(null);
  const [localUid, setLocalUid] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [networkQuality, setNetworkQuality] = useState({ tx: 0, rx: 0 }); // Monitor network
  const [showNetworkWarning, setShowNetworkWarning] = useState(false); // Hiển thị cảnh báo mạng
  const [waitingForResponse, setWaitingForResponse] = useState(!isIncoming); // Chỉ waiting nếu là caller

  const engineRef = useRef(null);
  const timerRef = useRef(null);
  const networkWarningTimeoutRef = useRef(null);
  const endingCallRef = useRef(false); // Track if we're already ending the call
    const waitingTimeoutRef = useRef(null); // Timer for auto end call
    // Timer tự động end call sau 30s nếu không trả lời
    useEffect(() => {
      if (waitingForResponse) {
        waitingTimeoutRef.current = setTimeout(() => {
          if (waitingForResponse && !endingCallRef.current) {
            Toast.show({
              type: 'error',
              text1: 'Người dùng không trả lời',
              text2: 'Cuộc gọi đã bị hủy do không có phản hồi',
              position: 'top',
              visibilityTime: 3000,
              topOffset: 50,
            });
            setTimeout(() => safeGoBack(), 1500);
            endCall();
          }
        }, 30000);
      } else {
        if (waitingTimeoutRef.current) {
          clearTimeout(waitingTimeoutRef.current);
          waitingTimeoutRef.current = null;
        }
      }
      return () => {
        if (waitingTimeoutRef.current) {
          clearTimeout(waitingTimeoutRef.current);
          waitingTimeoutRef.current = null;
        }
      };
    }, [waitingForResponse]);

  // App ID từ file .env
  const AGORA_APP_ID = Config.AGORA_APP_ID || 'YOUR_AGORA_APP_ID';
  
  // Dismiss notification khi vào màn hình call
  useEffect(() => {
    if (callId) {
      CallNotificationService.dismissIncomingCallNotification(callId);
    }
  }, [callId]);

  // Helper function to navigate back safely
  const safeGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // If can't go back, navigate to main screen
      navigation.replace('MessagesList'); // Navigate to messages list screen
    }
  };

  // Lắng nghe socket events cho call
  useEffect(() => {
    // 🆕 Handler cho SOS call answered (để clear waiting timer cho elderly)
    const handleSOSCallAnswered = (data) => {
      if (data.callId === callId && isSOSCall) {
        console.log('✅ SOS call answered, clearing waiting timer');
        setWaitingForResponse(false);
        setIsConnecting(true);
      }
    };

    if (!isIncoming) {
      // Nếu là caller, lắng nghe response từ callee
      const handleCallAccepted = (data) => {
        if (data.callId === callId) {
          setWaitingForResponse(false);
          setIsConnecting(true);
        }
      };

      const handleCallRejected = async (data) => {
        if (data.callId === callId) {
          await cleanupAgora();
          
          Toast.show({
            type: 'error',
            text1: 'Cuộc gọi bị từ chối',
            text2: 'Người dùng đã từ chối cuộc gọi',
            position: 'top',
            visibilityTime: 3000,
            topOffset: 50,
          });
          
          setTimeout(() => {
            safeGoBack();
          }, 2000);
        }
      };

      const handleCallBusy = async (data) => {
        if (data.callId === callId) {
          await cleanupAgora();
          
          Toast.show({
            type: 'error',
            text1: 'Người dùng đang bận',
            text2: data.message || 'Người dùng đang có cuộc gọi khác',
            position: 'top',
            visibilityTime: 3000,
            topOffset: 50,
          });
          
          setTimeout(() => {
            safeGoBack();
          }, 2000);
        }
      };

      socketService.on('video_call_accepted', handleCallAccepted);
      socketService.on('video_call_rejected', handleCallRejected);
      socketService.on('video_call_busy', handleCallBusy);

      // 🆕 Register listener cho SOS call (chỉ khi là SOS caller - elderly)
      if (isSOSCall) {
        socketService.on('sos_call_answered', handleSOSCallAnswered);
      }

      return () => {
        socketService.off('video_call_accepted', handleCallAccepted);
        socketService.off('video_call_rejected', handleCallRejected);
        socketService.off('video_call_busy', handleCallBusy);
        if (isSOSCall) {
          socketService.off('sos_call_answered', handleSOSCallAnswered);
        }
      };
    }
  }, [callId, isIncoming, isSOSCall]);

  // Lắng nghe events kết thúc cuộc gọi (cho cả caller và callee)
  useEffect(() => {
    const handleCallEnded = async (data) => {
      if (data.callId === callId) {
        await cleanupAgora();
        
        Toast.show({
          type: 'info',
          text1: 'Cuộc gọi đã kết thúc',
          text2: 'Người dùng đã kết thúc cuộc gọi',
          position: 'top',
          visibilityTime: 2500,
          topOffset: 50,
        });
        
        setTimeout(() => {
          safeGoBack();
        }, 1500);
      }
    };

    const handleCallCancelled = async (data) => {
      if (data.callId === callId) {
        await cleanupAgora();
        
        Toast.show({
          type: 'error',
          text1: 'Cuộc gọi đã bị hủy',
          text2: 'Người gọi đã hủy cuộc gọi',
          position: 'top',
          visibilityTime: 2500,
          topOffset: 50,
        });
        
        setTimeout(() => {
          safeGoBack();
        }, 1500);
      }
    };

    socketService.on('video_call_ended', handleCallEnded);
    socketService.on('video_call_cancelled', handleCallCancelled);

    return () => {
      socketService.off('video_call_ended', handleCallEnded);
      socketService.off('video_call_cancelled', handleCallCancelled);
    };
  }, [callId]);

  useEffect(() => {
    initializeAgora();
    return () => {
      cleanupAgora();
    };
  }, []);

  // Timer cho call duration
  useEffect(() => {
    if (isJoined && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isJoined]);

  const initializeAgora = async () => {
    try {
      // Request permissions
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) return;

      // Initialize Agora service
      agoraService.initialize(AGORA_APP_ID);

      // Create RTC engine
      engineRef.current = createAgoraRtcEngine();
      await engineRef.current.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      // ⚡ Tối ưu hóa ULTRA LOW LATENCY
      
      // 1. Enable video với cấu hình tối ưu
      await engineRef.current.enableVideo();
      
      // 2. Cấu hình video encoder - ULTRA LOW LATENCY mode
      await engineRef.current.setVideoEncoderConfiguration({
        dimensions: { width: 640, height: 480 }, // 480p - Cân bằng tối ưu
        frameRate: 30, // 30fps 
        bitrate: 600, // Giảm bitrate xuống 600 kbps để giảm độ trễ
        minBitrate: 400, // Min bitrate khi mạng yếu
        orientationMode: 0, // Adaptive
        degradationPreference: 2, // MAINTAIN_FRAMERATE - Quan trọng cho low latency
        mirrorMode: 0,
      });
      
      // 3. Enable dual stream mode với low stream cực thấp
      await engineRef.current.enableDualStreamMode(true);
      await engineRef.current.setDualStreamMode({
        streamConfig: {
          dimensions: { width: 320, height: 240 }, // Low stream 240p
          framerate: 15,
          bitrate: 200,
        },
      });
      
      // 4. Set audio profile - ULTRA LOW LATENCY
      await engineRef.current.setAudioProfile(0, 5); 
      // Profile: 0 = Speech Standard (16kHz, 18 kbps) - Thấp nhất
      // Scenario: 5 = Game Streaming (Ultra low latency < 100ms)
      
      // 5. Enable audio
      await engineRef.current.enableAudio();
      
      // 6. Disable echo cancellation và noise suppression (nếu không cần - giảm processing time)
      // await engineRef.current.setAudioEffectPreset(0); // OFF
      
      // 7. Set parameters để giảm độ trễ thêm
      await engineRef.current.setParameters(JSON.stringify({
        "che.video.lowBitRateStreamParameter": JSON.stringify({
          width: 320,
          height: 240,
          frameRate: 15,
          bitrate: 200
        })
      }));
      
      // 8. Enable hardware acceleration
      await engineRef.current.enableVideoImageSource(false); // Disable image source
      
      // 9. Start preview
      await engineRef.current.startPreview();

      // Register event handlers
      engineRef.current.registerEventHandler({
        onJoinChannelSuccess: (connection, elapsed) => {
          setLocalUid(connection.localUid);
          setIsJoined(true);
        },
        onUserJoined: (connection, remoteUid, elapsed) => {
          console.log('👤 Remote user joined:', remoteUid);
          setRemoteUid(remoteUid);
          setIsConnecting(false);
          setWaitingForResponse(false); // 🆕 Clear waiting timer khi remote user join
          engineRef.current?.setRemoteVideoStreamType(remoteUid, 0);
        },
        onUserOffline: (connection, remoteUid, reason) => {
          setRemoteUid(null);
        },
        onError: (err, msg) => {
          console.error('❌ Agora error:', err, msg);
        },
        onNetworkQuality: (connection, remoteUid, txQuality, rxQuality) => {
          setNetworkQuality({ tx: txQuality, rx: rxQuality });
          
          if (txQuality > 3 || rxQuality > 3) {
            setShowNetworkWarning(true);
            
            if (rxQuality > 3 && remoteUid) {
              engineRef.current?.setRemoteVideoStreamType(remoteUid, 1);
            }
            
            if (networkWarningTimeoutRef.current) {
              clearTimeout(networkWarningTimeoutRef.current);
            }
            networkWarningTimeoutRef.current = setTimeout(() => {
              if (txQuality <= 3 && rxQuality <= 3) {
                setShowNetworkWarning(false);
              }
            }, 5000);
          } else {
            setShowNetworkWarning(false);
            if (rxQuality <= 2 && remoteUid) {
              engineRef.current?.setRemoteVideoStreamType(remoteUid, 0);
            }
          }
        },
        onRemoteVideoStats: (connection, stats) => {
          if (stats.delay > 400) {
            console.warn('⚠️ High video latency:', stats.delay, 'ms');
          }
        },
        onRtcStats: (connection, stats) => {
          // Stats tracking for debugging if needed
        },
      });

      // Get channel info
      const channelInfo = await agoraService.joinChannel(conversationId);
      const tokenData = await agoraService.requestToken(channelInfo.channelName, 0);
      
      // Join channel with token
      await engineRef.current.joinChannel(tokenData.token, channelInfo.channelName, 0, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      });

    } catch (error) {
      console.error('❌ Error initializing Agora:', error);
      Toast.show({
        type: 'error',
        text1: 'Lỗi khởi tạo',
        text2: error.message || 'Không thể khởi tạo video call. Vui lòng thử lại.',
        position: 'top',
        visibilityTime: 3000,
        topOffset: 50,
      });
      setTimeout(() => safeGoBack(), 2000);
    }
  };

  const requestPermissions = async () => {
    try {
      if (Platform.OS !== 'android') {
        return true;
      }

      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);

      const cameraGranted = granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED;
      const audioGranted = granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED;

      if (!cameraGranted || !audioGranted) {
        Toast.show({
          type: 'error',
          text1: 'Cần quyền truy cập',
          text2: 'Ứng dụng cần quyền truy cập camera và microphone',
          position: 'top',
          visibilityTime: 3000,
          topOffset: 50,
        });
        setTimeout(() => safeGoBack(), 2000);
        return false;
      }

      return true;
    } catch (err) {
      console.warn('❌ Permission error:', err);
      return false;
    }
  };

  const cleanupAgora = async () => {
    try {
      if (engineRef.current) {
        await engineRef.current.leaveChannel();
        engineRef.current.release();
        engineRef.current = null;
      }
      await agoraService.leaveChannel();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (networkWarningTimeoutRef.current) {
        clearTimeout(networkWarningTimeoutRef.current);
      }
    } catch (error) {
      console.error('❌ Error cleaning up Agora:', error);
    }
  };

  const toggleLocalVideo = () => {
    engineRef.current?.enableLocalVideo(!localVideoEnabled);
    setLocalVideoEnabled(!localVideoEnabled);
  };

  const toggleAudio = () => {
    // audioEnabled = true => đang bật mic => muteLocalAudioStream(true) để tắt
    // audioEnabled = false => đang tắt mic => muteLocalAudioStream(false) để bật
    const shouldMute = audioEnabled; // Nếu đang bật thì mute, nếu đang tắt thì unmute
    engineRef.current?.muteLocalAudioStream(shouldMute);
    setAudioEnabled(!audioEnabled);
  };

  const switchCamera = () => {
    engineRef.current?.switchCamera();
  };

  const endCall = async () => {
    // Prevent duplicate calls
    if (endingCallRef.current) {
      return;
    }
    
    endingCallRef.current = true;
    
    if (callId) {
      const otherUserId = otherParticipant?._id || otherParticipant?.id || otherParticipant?.user?._id;
      
      if (waitingForResponse) {
        socketService.cancelVideoCall({
          callId,
          conversationId,
          calleeId: otherUserId
        });
        CallService.cancelCall();
      } else {
        socketService.endVideoCall({
          callId,
          conversationId,
          otherUserId,
          sosId: isSOSCall ? sosId : undefined // 🆕 Thêm sosId nếu là SOS call
        });
        CallService.endCall();
      }
    }

    await cleanupAgora();
    safeGoBack();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Remote Video - Full Screen */}
      <View style={styles.remoteVideoContainer}>
        {remoteUid ? (
          <RtcSurfaceView
            style={styles.remoteVideo}
            canvas={{ 
              uid: remoteUid,
              renderMode: 1, // HIDDEN mode - tối ưu cho performance
              mirrorMode: 0, // Disabled - giảm processing
            }}
            zOrderMediaOverlay={false}
          />
        ) : (
          <View style={styles.waitingContainer}>
            {waitingForResponse ? (
              <>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.waitingText}>
                  Đang gọi {otherParticipant?.fullName || 'người dùng'}...
                </Text>
              </>
            ) : isConnecting ? (
              <>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.waitingText}>Đang kết nối...</Text>
              </>
            ) : (
              <>
                <Icon name="person" size={80} color="#fff" />
                <Text style={styles.waitingText}>
                  Đang chờ {otherParticipant?.user?.fullName || otherParticipant?.fullName || 'người dùng'} tham gia
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* Local Video - Small Preview */}
      {localVideoEnabled && localUid !== 0 && (
        <View style={[styles.localVideoContainer, { top: (typeof insets.top === 'number' ? insets.top : 0) + 70 }]}> 
          {/* Local video preview */}
          <RtcSurfaceView
            style={styles.localVideo}
            canvas={{ 
              uid: 0,
              renderMode: 1, // HIDDEN mode
              mirrorMode: 2, // AUTO mirror cho front camera
            }}
            zOrderMediaOverlay={true}
          />
        </View>
      )}

      {/* Top Bar - Info */}
      <View style={[styles.topBar, { top: typeof insets.top === 'number' ? insets.top : 0 }]}> 
        <View style={styles.callInfo}>
          <Text style={styles.participantName}>
            {otherParticipant?.user?.fullName || otherParticipant?.fullName || 'Cuộc gọi video'}
          </Text>
          {isJoined ? (
            <Text style={styles.callDuration}>{formatDuration(callDuration)}</Text>
          ) : null}
        </View>
      </View>

      {/* Network Quality Warning Banner */}
      {showNetworkWarning ? (
        <View style={[styles.networkWarning, { top: (typeof insets.top === 'number' ? insets.top : 0) + 44 }]}> 
          <Icon name="signal-cellular-connected-no-internet-4-bar" size={20} color="#FFA726" />
          <Text style={styles.networkWarningText}>
            Kết nối mạng kém - Chất lượng video đã giảm
          </Text>
        </View>
      ) : null}

      {/* Bottom Controls */}
      <View style={[styles.bottomControls, { bottom: (typeof insets.bottom === 'number' ? insets.bottom : 0) + 18 }]}> 
        <TouchableOpacity
          style={[styles.controlButton, !audioEnabled && styles.controlButtonDisabled]}
          onPress={toggleAudio}
        >
          <Icon name={audioEnabled ? 'mic' : 'mic-off'} size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={endCall}
        >
          <Icon name="call-end" size={32} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !localVideoEnabled && styles.controlButtonDisabled]}
          onPress={toggleLocalVideo}
        >
          <Icon name={localVideoEnabled ? 'videocam' : 'videocam-off'} size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
          <Icon name="flip-camera-android" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideoContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
    zIndex: 1,
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    color: '#fff',
    fontSize: wp('4%'),
    marginTop: hp('2%'),
    textAlign: 'center',
    paddingHorizontal: wp('10%'),
  },
  localVideoContainer: {
    position: 'absolute',
    top: hp('7%'),
    right: wp('4%'),
    width: wp('28%'),
    height: hp('18%'),
    borderRadius: wp('2%'),
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 5,
    backgroundColor: '#222',
    zIndex: 3,
  },
  localVideo: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: hp('2.5%'),
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('1.2%'),
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },
  callInfo: {
    alignItems: 'center',
  },
  participantName: {
    color: '#fff',
    fontSize: wp('4.5%'),
    fontWeight: '600',
  },
  callDuration: {
    color: '#fff',
    fontSize: wp('3.5%'),
    marginTop: hp('0.5%'),
    opacity: 0.8,
  },
  networkWarning: {
    position: 'absolute',
    top: hp('10%'),
    left: wp('4%'),
    right: wp('4%'),
    backgroundColor: 'rgba(255, 152, 0, 0.95)',
    paddingVertical: hp('1.2%'),
    paddingHorizontal: wp('4%'),
    borderRadius: wp('2%'),
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 5,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  networkWarningText: {
    color: '#fff',
    fontSize: wp('3.5%'),
    fontWeight: '500',
    marginLeft: wp('2%'),
    flex: 1,
  },
  bottomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: hp('3%'),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  controlButton: {
    width: wp('14%'),
    height: wp('14%'),
    borderRadius: wp('7%'),
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: wp('2%'),
    zIndex: 11,
  },
  controlButtonDisabled: {
    backgroundColor: 'rgba(255, 0, 0, 0.5)',
  },
  endCallButton: {
    backgroundColor: '#f44336',
    width: wp('16%'),
    height: wp('16%'),
    borderRadius: wp('8%'),
  },
});

export default VideoCallScreen;
