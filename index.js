/**
 * @format
 */
import './src/utils/deadmanBackground';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Register background handler for Firebase
// This must be registered outside of the React component lifecycle
messaging().setBackgroundMessageHandler(async remoteMessage => {
  // 🆕 Xử lý SOS call notification khi app ở background
  if (remoteMessage.data?.type === 'sos_call') {
    console.log('🆘📞 Background: SOS call notification received');
    
    const CallNotificationService = require('./src/services/CallNotificationService').default;
    
    try {
      await CallNotificationService.showSOSCallNotification({
        sosId: remoteMessage.data.sosId,
        callId: remoteMessage.data.callId,
        requester: {
          _id: remoteMessage.data.requesterId,
          fullName: remoteMessage.data.requesterName,
          avatar: remoteMessage.data.requesterAvatar,
          phoneNumber: remoteMessage.data.requesterPhone,
        },
        recipientIndex: parseInt(remoteMessage.data.recipientIndex) || 1,
        totalRecipients: parseInt(remoteMessage.data.totalRecipients) || 1,
      });
      console.log('✅ Background: SOS call notification displayed');
    } catch (error) {
      console.error('❌ Error showing background SOS call notification:', error);
    }
    return;
  }
  
  // Xử lý video call notification khi app ở background
  if (remoteMessage.data?.type === 'video_call') {
    
    const CallNotificationService = require('./src/services/CallNotificationService').default;
    
    try {
      await CallNotificationService.showIncomingCallNotification({
        callId: remoteMessage.data.callId,
        caller: {
          _id: remoteMessage.data.callerId,
          fullName: remoteMessage.data.callerName,
          avatar: remoteMessage.data.callerAvatar,
        },
        conversationId: remoteMessage.data.conversationId,
        callType: remoteMessage.data.callType || 'video',
      });
    } catch (error) {
      console.error('❌ Error showing background call notification:', error);
    }
  }
  
  // Xử lý SOS notification khi app ở background/killed
  if (remoteMessage.data?.type === 'sos') {
    
    const SOSNotificationService = require('./src/services/SOSNotificationService').default;
    
    try {
      await SOSNotificationService.showSOSNotification({
        sosId: remoteMessage.data.sosId,
        requesterId: remoteMessage.data.requesterId,
        requesterName: remoteMessage.data.requesterName,
        requesterAvatar: remoteMessage.data.requesterAvatar,
        latitude: remoteMessage.data.latitude,
        longitude: remoteMessage.data.longitude,
        address: remoteMessage.data.address,
        message: remoteMessage.data.message,
        timestamp: remoteMessage.data.timestamp,
      });
    } catch (error) {
      console.error('❌ Error showing background SOS notification:', error);
    }
  }
  
  // Notification sẽ được Android system tự động hiển thị
  // Khi user click vào notification, onNotificationOpenedApp sẽ handle
});

// Register Notifee background event handler
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;
  
  // Xử lý khi user nhấn vào notification actions - VIDEO CALL
  if (type === EventType.ACTION_PRESS && notification?.data?.type === 'video_call') {
    const { callId, conversationId, callerId, callerName, callerAvatar } = notification.data;
    
    // Bỏ qua nếu tap vào body notification (không phải button)
    if (pressAction.id === 'ignore') {
      return;
    }
    
    if (pressAction.id === 'accept_call') {
      // Lưu action để xử lý sau khi app mở (cần socket connection)
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('pending_call_action', JSON.stringify({
        action: 'accept',
        callId,
        conversationId,
        callerId,
        callerName,
        callerAvatar,
      }));
      
      // Dismiss notification
      await notifee.cancelNotification(callId);
      
    } else if (pressAction.id === 'reject_call') {
      // Dismiss notification NGAY LẬP TỨC
      await notifee.cancelNotification(callId);
      
      // GỬI REJECT qua HTTP API (không cần mở app)
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const token = await AsyncStorage.getItem('ecare_token');
        
        if (token) {
          const axios = require('axios').default;
          const { CONFIG } = require('./src/config/socketConfig');
          const API_URL = CONFIG.SOCKET_SERVER_URL;
          
          await axios.post(
            `${API_URL}/api/conversations/video-call/reject`,
            {
              callId,
              conversationId,
              callerId,
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              timeout: 5000,
            }
          );
        } else {
          await AsyncStorage.setItem('pending_call_action', JSON.stringify({
            action: 'reject',
            callId,
            conversationId,
            callerId,
          }));
        }
      } catch (error) {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('pending_call_action', JSON.stringify({
          action: 'reject',
          callId,
          conversationId,
          callerId,
        }));
      }
      
      // RETURN để KHÔNG mở app
      return;
    }
  }
  
  // 🆕 Xử lý khi user nhấn vào notification actions - SOS CALL
  if (type === EventType.ACTION_PRESS && notification?.data?.type === 'sos_call') {
    const { sosId, callId, requesterId, requesterName, requesterAvatar, requesterPhone, recipientIndex, totalRecipients } = notification.data;
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    
    if (pressAction.id === 'ignore') {
      return;
    }
    
    if (pressAction.id === 'accept_sos_call') {
      // Lưu action để xử lý sau khi app mở (cần socket connection)
      await AsyncStorage.setItem('pending_sos_call_action', JSON.stringify({
        action: 'accept',
        sosId,
        callId,
        requesterId,
        requesterName,
        requesterAvatar,
        requesterPhone,
        recipientIndex,
        totalRecipients,
      }));
      
      // Dismiss notification
      await notifee.cancelNotification(callId);
      
    } else if (pressAction.id === 'reject_sos_call') {
      // Dismiss notification NGAY LẬP TỨC
      await notifee.cancelNotification(callId);
      
      // GỬI REJECT qua socket (sẽ xử lý khi app mở)
      await AsyncStorage.setItem('pending_sos_call_action', JSON.stringify({
        action: 'reject',
        sosId,
        callId,
      }));
      
      // RETURN để KHÔNG mở app
      return;
    }
  }
  
  // Xử lý khi user nhấn vào notification actions - SOS
  if (type === EventType.ACTION_PRESS && notification?.data?.type === 'sos') {
    const { sosId, requesterId, requesterName, requesterAvatar, latitude, longitude, address, message } = notification.data;
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    
    if (pressAction.id === 'view_location') {
      // Lưu action để xử lý sau khi app mở
      await AsyncStorage.setItem('pending_sos_action', JSON.stringify({
        action: 'view_location',
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
    }
    
    // Dismiss notification
    await notifee.cancelNotification(sosId);
  }
  
  // Xử lý khi user tap vào body notification - SOS
  if (type === EventType.PRESS && notification?.data?.type === 'sos') {
    const { sosId, requesterId, requesterName, requesterAvatar, latitude, longitude, address, message } = notification.data;
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    
    // Lưu data để navigate đến SOS detail screen
    await AsyncStorage.setItem('pending_sos_action', JSON.stringify({
      action: 'view_sos_detail',
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
    await notifee.cancelNotification(sosId);
  }
  
  // Dismissed notification
  if (type === EventType.DISMISSED) {
    // Notification dismissed
  }
});

AppRegistry.registerComponent(appName, () => App);
