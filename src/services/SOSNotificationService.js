import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';
import { Platform } from 'react-native';

class SOSNotificationService {
  constructor() {
    this.activeSOSNotificationId = null;
  }

  /**
   * Khởi tạo notification channel cho SOS alerts
   */
  async initialize() {
    if (Platform.OS !== 'android') return;

    try {
      // Tạo channel với importance HIGH để hiển thị full-screen
      await notifee.createChannel({
        id: 'sos_emergency',
        name: '🆘 Cảnh báo khẩn cấp',
        importance: AndroidImportance.HIGH,
        sound: 'sos_alarm', // Custom sound cho SOS (file: sos_alarm.mp3 trong android/app/src/main/res/raw/)
        vibration: true,
        vibrationPattern: [500, 500, 500, 500, 500, 500], // Rung mạnh hơn
        lights: true,
        lightColor: '#FF0000', // Đỏ cho SOS
      });
    } catch (error) {
      console.error('❌ Error creating SOS notification channel:', error);
    }
  }

  /**
   * Hiển thị full-screen SOS notification
   * @param {Object} sosData - Dữ liệu SOS
   */
  async showSOSNotification(sosData) {
    try {
      const { 
        sosId, 
        requesterId, 
        requesterName, 
        requesterAvatar,
        latitude,
        longitude,
        address,
        message,
        timestamp 
      } = sosData;

      // Tạo actions cho notification
      const notificationActions = [
        {
          title: '📍 Xem vị trí',
          pressAction: {
            id: 'view_location',
            launchActivity: 'default',
          },
        },
      ];

      // Hiển thị notification với full-screen intent
      const notificationId = await notifee.displayNotification({
        id: sosId, // Sử dụng sosId làm notification ID để tránh duplicate
        title: '🆘 CẢNH BÁO KHẨN CẤP!',
        body: message || `${requesterName} cần trợ giúp ngay lập tức!\n📍 ${address || 'Không xác định vị trí'}`,
        data: {
          type: 'sos',
          sosId,
          requesterId,
          requesterName,
          requesterAvatar,
          latitude,
          longitude,
          address,
          message,
          timestamp: timestamp || new Date().toISOString(),
          clickAction: 'SOS_DETAIL',
        },
        android: {
          channelId: 'sos_emergency',
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.ALARM, // ALARM category cho emergency
          
          // QUAN TRỌNG: Full-screen intent
          fullScreenAction: {
            id: 'default',
            launchActivity: 'default',
          },
          
          // Auto cancel khi user tap
          autoCancel: true,
          
          // Ongoing notification (không thể swipe away cho đến khi xử lý)
          ongoing: true,
          
          // Show when locked
          showTimestamp: true,
          timestamp: timestamp ? new Date(timestamp).getTime() : Date.now(),
          
          // Sound & vibration - Rung và kêu mạnh
          sound: 'sos_alarm', // Custom sound - phải match với channel sound
          loopSound: true, // Lặp lại âm thanh
          vibrationPattern: [500, 500, 500, 500, 500, 500],
          
          // Color - Đỏ cho SOS
          color: '#FF0000',
          
          // Small icon
          smallIcon: 'ic_launcher',
          
          // Large icon (avatar người gửi SOS)
          largeIcon: requesterAvatar || undefined,
          circularLargeIcon: true,
          
          // Actions
          actions: notificationActions,
          
          // Press action - Mở app và navigate đến SOS detail
          pressAction: {
            id: 'view_sos_detail',
            launchActivity: 'default',
          },
        },
      });

      this.activeSOSNotificationId = notificationId;

      return notificationId;
    } catch (error) {
      console.error('❌ Error showing SOS notification:', error);
      throw error;
    }
  }

  /**
   * Dismiss SOS notification
   */
  async dismissSOSNotification(sosId) {
    try {
      if (sosId) {
        await notifee.cancelNotification(sosId);
      }
      
      if (this.activeSOSNotificationId) {
        await notifee.cancelNotification(this.activeSOSNotificationId);
        this.activeSOSNotificationId = null;
      }
    } catch (error) {
      console.error('❌ Error dismissing SOS notification:', error);
    }
  }

  /**
   * Cancel all SOS notifications
   */
  async cancelAllSOSNotifications() {
    try {
      const notifications = await notifee.getDisplayedNotifications();
      
      for (const notification of notifications) {
        if (notification.notification?.data?.type === 'sos') {
          await notifee.cancelNotification(notification.id);
        }
      }
      
      this.activeSOSNotificationId = null;
    } catch (error) {
      console.error('❌ Error cancelling SOS notifications:', error);
    }
  }
}

export default new SOSNotificationService();
