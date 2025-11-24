// App.js
import React, { useEffect, useRef } from 'react';
import { StatusBar, View, AppState, Text } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast, { BaseToast, ErrorToast, InfoToast } from 'react-native-toast-message';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import socketService from './src/services/socketService';

// Xử lý FCM khi app bị kill
messaging().setBackgroundMessageHandler(async remoteMessage => {
});

export default function App() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Check initial notification (khi app mở từ notification ở trạng thái killed)
    notifee.getInitialNotification().then(initialNotification => {
      if (initialNotification) {
        const { notification, pressAction } = initialNotification;
        
        // Xử lý SOS notification khi app mở từ killed state
        if (notification?.data?.type === 'sos') {
          const { sosId, requesterId, requesterName, requesterAvatar, latitude, longitude, address, message } = notification.data;
          
          // Lưu pending action
          AsyncStorage.setItem('pending_sos_action', JSON.stringify({
            action: pressAction?.id === 'view_location' ? 'view_location' : 'view_sos_detail',
            sosData: {
              sosId,
              requesterId,
              requesterName,
              requesterAvatar,
              latitude,
              longitude,
              address,
              message,
            },
          }));
          
          // Dismiss notification
          notifee.cancelNotification(String(sosId));
        }
      }
    });
    
    // Xử lý foreground notification events
    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      const { notification, pressAction } = detail;
      
      // 🆕 Xử lý SOS call notification
      if (type === EventType.ACTION_PRESS && notification?.data?.type === 'sos_call') {
        const { sosId, callId, requesterId, requesterName, requesterAvatar, requesterPhone, recipientIndex, totalRecipients } = notification.data;
        
        if (pressAction?.id === 'ignore') {
          return;
        }
        
        if (pressAction?.id === 'accept_sos_call') {
          // Gửi accept signal
          socketService.socket.emit('sos_call_accepted', {
            sosId: String(sosId),
            callId: String(callId),
          });
          
          // Navigate đến VideoCallScreen với SOS context
          if (navigationRef.current) {
            navigationRef.current.navigate('VideoCall', {
              callId: String(callId),
              conversationId: null,
              otherParticipant: {
                _id: String(requesterId),
                fullName: String(requesterName),
                avatar: String(requesterAvatar),
                phoneNumber: String(requesterPhone),
              },
              isIncoming: true,
              isSOSCall: true,
              sosId: String(sosId),
            });
          }
        } else if (pressAction?.id === 'reject_sos_call') {
          // Gửi reject signal
          socketService.socket.emit('sos_call_rejected', {
            sosId: String(sosId),
            callId: String(callId),
          });
        }
        
        // Dismiss notification
        await notifee.cancelNotification(String(callId));
        return;
      }
      
      // Xử lý khi user nhấn vào notification actions
      if (type === EventType.ACTION_PRESS && notification?.data?.type === 'video_call') {
        const { callId, conversationId, callerId, callerName, callerAvatar } = notification.data;
        
        // Bỏ qua nếu tap vào body notification (không phải button)
        if (pressAction?.id === 'ignore') {
          return;
        }
        
        if (pressAction?.id === 'accept_call') {
          // Gửi accept signal
          await handleAcceptCall({ callId: String(callId), conversationId: String(conversationId), callerId: String(callerId) });
          
          // Navigate đến VideoCallScreen TRỰC TIẾP (không qua IncomingCall)
          if (navigationRef.current) {
            navigationRef.current.navigate('VideoCall', {
              callId: String(callId),
              conversationId: String(conversationId),
              otherParticipant: {
                _id: String(callerId),
                fullName: String(callerName),
                avatar: String(callerAvatar),
              },
              isIncoming: true,
            });
          }
        } else if (pressAction?.id === 'reject_call') {
          // Chỉ gửi reject signal, KHÔNG navigate
          await handleRejectCall({ callId: String(callId), conversationId: String(conversationId), callerId: String(callerId) });
        }
        
        // Dismiss notification
        await notifee.cancelNotification(String(callId));
      }
    });
    
    // Kiểm tra pending call actions khi app mở
    checkPendingCallActions();
    checkPendingSOSActions();
    
    // Theo dõi AppState để check pending actions khi app quay lại foreground
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      // Khi app chuyển từ background/inactive → active (foreground)
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        checkPendingCallActions();
        checkPendingSOSActions();
      }
      
      appState.current = nextAppState;
    });
    
    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, []);
  
  const checkPendingCallActions = async () => {
    try {
      const pendingAction = await AsyncStorage.getItem('pending_call_action');
      
      if (pendingAction) {
        const actionData = JSON.parse(pendingAction);
        
        // Xóa pending action NGAY để tránh xử lý lại
        await AsyncStorage.removeItem('pending_call_action');
        
        // Xử lý action
        if (actionData.action === 'accept') {
          await handleAcceptCall(actionData);
          
          // Đợi một chút để socket kết nối
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Đợi navigation ref sẵn sàng (tối đa 3 giây)
          let retries = 0;
          const maxRetries = 30; // 30 * 100ms = 3s
          
          while (!navigationRef.current && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }
          
          // Navigate đến VideoCallScreen
          if (navigationRef.current) {
            navigationRef.current.navigate('VideoCall', {
              callId: actionData.callId,
              conversationId: actionData.conversationId,
              otherParticipant: {
                _id: actionData.callerId,
                fullName: actionData.callerName || 'Người dùng',
                avatar: actionData.callerAvatar || '',
              },
              isIncoming: true,
            });
          } else {
            // Lưu lại pending action để thử lại sau
            await AsyncStorage.setItem('pending_call_action', pendingAction);
          }
        } else if (actionData.action === 'reject') {
          await handleRejectCall(actionData);
        }
      }
    } catch (error) {
      console.error('Error checking pending call actions:', error);
    }
  };
  
  const handleAcceptCall = ({ callId, conversationId, callerId }: { callId: string; conversationId: string; callerId: string }) => {
    // Emit socket event accept call
    socketService.acceptVideoCall({
      callId,
      conversationId,
      callerId,
    });
  };
  
  const handleRejectCall = ({ callId, conversationId, callerId }: { callId: string; conversationId: string; callerId: string }) => {
    // Emit socket event reject call
    socketService.rejectVideoCall({
      callId,
      conversationId,
      callerId,
    });
  };
  
  const checkPendingSOSActions = async () => {
    try {
      const pendingAction = await AsyncStorage.getItem('pending_sos_action');
      
      if (pendingAction) {
        const actionData = JSON.parse(pendingAction);
        
        // Xóa pending action NGAY để tránh xử lý lại
        await AsyncStorage.removeItem('pending_sos_action');
        
        // Đợi navigation ref sẵn sàng (tối đa 5 giây thay vì 3 giây)
        let retries = 0;
        const maxRetries = 50; // 50 * 100ms = 5s
        
        while (!navigationRef.current && retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }
        
        if (!navigationRef.current) {
          console.error('❌ Navigation not ready after 5s, saving pending action');
          // Lưu lại pending action để thử lại sau
          await AsyncStorage.setItem('pending_sos_action', pendingAction);
          return;
        }
        
        // Navigate đến SOSDetail screen
        if (actionData.action === 'view_sos_detail' || actionData.action === 'view_location') {
          const { sosData } = actionData;
          
          console.log('✅ Navigating to SOSDetail with data:', {
            sosId: sosData.sosId,
            requesterName: sosData.requesterName,
            address: sosData.address
          });
          
          navigationRef.current.navigate('SOSDetail', {
            sosId: sosData.sosId,
            requesterName: sosData.requesterName || 'Không rõ',
            requesterAvatar: sosData.requesterAvatar || '',
            address: sosData.address || 'Không rõ vị trí',
            latitude: sosData.latitude ? parseFloat(sosData.latitude) : null,
            longitude: sosData.longitude ? parseFloat(sosData.longitude) : null,
            message: sosData.message || '',
          });
        }
      }
    } catch (error) {
      console.error('❌ Error checking pending SOS actions:', error);
    }
  };
  
  // Custom Toast Config
  const toastConfig = {
    success: (props) => (
      <BaseToast
        {...props}
        style={{
          borderLeftColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.95)',
          height: 70,
        }}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        text1Style={{
          fontSize: 16,
          fontWeight: '600',
          color: '#fff',
        }}
        text2Style={{
          fontSize: 14,
          color: '#fff',
        }}
      />
    ),
    error: (props) => (
      <ErrorToast
        {...props}
        style={{
          borderLeftColor: '#f44336',
          backgroundColor: 'rgba(244, 67, 54, 0.95)',
          height: 70,
        }}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        text1Style={{
          fontSize: 16,
          fontWeight: '600',
          color: '#fff',
        }}
        text2Style={{
          fontSize: 14,
          color: '#fff',
        }}
      />
    ),
    info: (props) => (
      <InfoToast
        {...props}
        style={{
          borderLeftColor: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.95)',
          height: 70,
        }}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        text1Style={{
          fontSize: 16,
          fontWeight: '600',
          color: '#fff',
        }}
        text2Style={{
          fontSize: 14,
          color: '#fff',
        }}
      />
    ),
  };
  
  return (
    // Đặt backgroundColor giống màu status bar để không bị nhấp nháy khi chuyển màn
    <View style={{ flex: 1}}>
      <StatusBar
        translucent       // vẽ nội dung nằm dưới status bar
        backgroundColor="transparent" // trong suốt (Android)
        barStyle="dark-content"       // icon/chữ tối; đổi "light-content" nếu nền phía sau tối
      />
      <AppNavigator />
      <Toast config={toastConfig} />
    </View>
  );
}
