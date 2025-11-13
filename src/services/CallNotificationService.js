import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';
import { Platform } from 'react-native';

class CallNotificationService {
  constructor() {
    this.activeCallNotificationId = null;
  }

  /**
   * Khởi tạo notification channel cho incoming calls
   */
  async initialize() {
    if (Platform.OS !== 'android') return;

    try {
      // Tạo channel với importance HIGH để hiển thị full-screen
      await notifee.createChannel({
        id: 'incoming_calls',
        name: 'Cuộc gọi đến',
        importance: AndroidImportance.HIGH,
        sound: 'incoming_call', // Sử dụng custom sound
        vibration: true,
        vibrationPattern: [300, 500, 300, 500, 300, 500],
        lights: true,
        lightColor: '#2196F3',
      });

      console.log('✅ Call notification channel created');
    } catch (error) {
      console.error('❌ Error creating call notification channel:', error);
    }
  }

  /**
   * Hiển thị full-screen incoming call notification
   * @param {Object} callData - Dữ liệu cuộc gọi
   */
  async showIncomingCallNotification(callData) {
    try {
      const { callId, caller, conversationId, callType = 'video' } = callData;

      console.log('📞 Showing full-screen incoming call notification:', {
        callId,
        callerName: caller?.fullName,
        callType,
      });

      // Tạo actions cho notification
      const notificationActions = [
        {
          title: '❌ Từ chối',
          pressAction: {
            id: 'reject_call',
            // KHÔNG launch activity - xử lý trong background
          },
        },
        {
          title: '✅ Chấp nhận',
          pressAction: {
            id: 'accept_call',
            // Launch activity để vào VideoCallScreen
            launchActivity: 'default',
          },
        },
      ];

      // Hiển thị notification với full-screen intent
      const notificationId = await notifee.displayNotification({
        id: callId, // Sử dụng callId làm notification ID để tránh duplicate
        title: '📞 Cuộc gọi video đến',
        body: `${caller?.fullName || 'Người dùng'} đang gọi video cho bạn...`,
        data: {
          type: 'video_call',
          callId,
          conversationId,
          callerId: caller?._id,
          callerName: caller?.fullName,
          callerAvatar: caller?.avatar,
          callType,
        },
        android: {
          channelId: 'incoming_calls',
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.CALL,
          
          // QUAN TRỌNG: Full-screen intent
          fullScreenAction: {
            id: 'default',
            launchActivity: 'default',
          },
          
          // Auto cancel khi user tap
          autoCancel: true,
          
          // Ongoing notification (không thể swipe away)
          ongoing: true,
          
          // Show when locked
          showTimestamp: true,
          timestamp: Date.now(),
          
          // Sound & vibration - Sử dụng nhạc chuông tùy chỉnh
          sound: 'incoming_call', // Tên file trong android/app/src/main/res/raw/ (không cần .mp3)
          loopSound: true, // Lặp lại nhạc chuông cho đến khi người dùng tương tác
          vibrationPattern: [300, 500, 300, 500, 300, 500],
          
          // Color
          color: '#2196F3',
          
          // Small icon
          smallIcon: 'ic_launcher',
          
          // Large icon (avatar)
          largeIcon: caller?.avatar || undefined,
          circularLargeIcon: true,
          
          // Actions
          actions: notificationActions,
          
          // QUAN TRỌNG: Khi tap vào body notification, KHÔNG mở app
          // Chỉ xử lý khi tap vào button actions
          pressAction: {
            id: 'ignore', // ID đặc biệt - sẽ bị ignore
          },
        },
      });

      this.activeCallNotificationId = notificationId;
      console.log('✅ Full-screen notification displayed:', notificationId);

      return notificationId;
    } catch (error) {
      console.error('❌ Error showing incoming call notification:', error);
      throw error;
    }
  }

  /**
   * Dismiss incoming call notification
   */
  async dismissIncomingCallNotification(callId) {
    try {
      if (callId) {
        await notifee.cancelNotification(callId);
        console.log('✅ Call notification dismissed:', callId);
      }
      
      if (this.activeCallNotificationId) {
        await notifee.cancelNotification(this.activeCallNotificationId);
        this.activeCallNotificationId = null;
      }
    } catch (error) {
      console.error('❌ Error dismissing call notification:', error);
    }
  }

  /**
   * Dismiss tất cả call notifications
   */
  async dismissAllCallNotifications() {
    try {
      const notifications = await notifee.getDisplayedNotifications();
      
      for (const notification of notifications) {
        if (notification.notification?.data?.type === 'video_call') {
          await notifee.cancelNotification(notification.id);
        }
      }
      
      this.activeCallNotificationId = null;
      console.log('✅ All call notifications dismissed');
    } catch (error) {
      console.error('❌ Error dismissing all call notifications:', error);
    }
  }
}

export default new CallNotificationService();
