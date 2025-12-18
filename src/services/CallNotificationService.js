import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';
import { Platform } from 'react-native';

class CallNotificationService {
  constructor() {
    this.activeCallNotificationId = null;
    // \ud83c\udd95 CRITICAL: Deduplication - Track displayed notifications to prevent duplicates
    this.displayedNotifications = new Set();
    // Auto-cleanup after 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.displayedNotifications.clear();
    }, 30000);
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

      // 🆕 Tạo channel cho SOS calls (ưu tiên cao hơn)
      await notifee.createChannel({
        id: 'sos_calls',
        name: 'Cuộc gọi khẩn cấp SOS',
        importance: AndroidImportance.HIGH,
        sound: 'sos_alarm', // Sử dụng sound khác biệt cho SOS
        vibration: true,
        vibrationPattern: [100, 500, 200, 500, 200, 500, 200, 500], // 🔧 Fixed: Không dùng 0, dùng 100ms delay
        lights: true,
        lightColor: '#FF0000', // Đỏ cho SOS
      });

      console.log('✅ Call notification channels created');
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

      // 🚫 DEDUPLICATION: Kiểm tra xem notification này đã được hiển thị chưa
      if (this.displayedNotifications.has(callId)) {
        console.log('⚠️  Duplicate video call notification prevented:', callId);
        return null;
      }

      // Đánh dấu notification này đã được hiển thị
      this.displayedNotifications.add(callId);

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
   * Hiển thị SOS call notification với UI khẩn cấp
   * @param {Object} callData - Dữ liệu cuộc gọi SOS
   */
  async showSOSCallNotification(callData) {
    try {
      const { sosId, callId, requester, recipientIndex, totalRecipients } = callData;

      // 🚫 DEDUPLICATION: Kiểm tra xem notification này đã được hiển thị chưa
      if (this.displayedNotifications.has(callId)) {
        console.log('⚠️  Duplicate SOS call notification prevented:', callId);
        return null;
      }

      // Đánh dấu notification này đã được hiển thị
      this.displayedNotifications.add(callId);

      console.log('🆘📞 Showing SOS call notification:', {
        sosId,
        callId,
        requesterName: requester?.fullName,
        recipientIndex,
        totalRecipients,
      });

      // Tạo actions cho SOS notification
      const notificationActions = [
        {
          title: '❌ Từ chối',
          pressAction: {
            id: 'reject_sos_call',
          },
        },
        {
          title: '🚨 CHẤP NHẬN NGAY',
          pressAction: {
            id: 'accept_sos_call',
            launchActivity: 'default',
          },
        },
      ];

      // Hiển thị notification với full-screen intent
      const notificationId = await notifee.displayNotification({
        id: callId, // Sử dụng callId làm notification ID
        title: '🆘 CUỘC GỌI KHẨN CẤP SOS',
        body: `${requester?.fullName || 'Người thân'} cần trợ giúp khẩn cấp! (${recipientIndex}/${totalRecipients})`,
        data: {
          type: 'sos_call',
          sosId,
          callId,
          requesterId: requester?._id,
          requesterName: requester?.fullName,
          requesterAvatar: requester?.avatar,
          requesterPhone: requester?.phoneNumber,
          recipientIndex: String(recipientIndex),
          totalRecipients: String(totalRecipients),
        },
        android: {
          channelId: 'sos_calls',
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.CALL,
          
          // QUAN TRỌNG: Full-screen intent
          fullScreenAction: {
            id: 'default',
            launchActivity: 'default',
          },
          
          autoCancel: true,
          ongoing: true,
          showTimestamp: true,
          timestamp: Date.now(),
          
          // Sound & vibration - Mạnh hơn cho SOS
          sound: 'sos_alarm',
          loopSound: true,
          vibrationPattern: [100, 500, 200, 500, 200, 500, 200, 500], // 🔧 Fixed: Không dùng 0
          
          // Color đỏ cho SOS
          color: '#FF0000',
          
          smallIcon: 'ic_launcher',
          largeIcon: requester?.avatar || undefined,
          circularLargeIcon: true,
          
          actions: notificationActions,
          
          pressAction: {
            id: 'ignore',
          },
        },
      });

      this.activeCallNotificationId = notificationId;
      console.log('✅ SOS call notification displayed:', notificationId);

      return notificationId;
    } catch (error) {
      console.error('❌ Error showing SOS call notification:', error);
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
        const notifType = notification.notification?.data?.type;
        if (notifType === 'video_call' || notifType === 'sos_call') {
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
