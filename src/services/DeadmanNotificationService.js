// DeadmanNotificationService.js
import notifee, { AndroidCategory, AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';

class DeadmanNotificationService {
  constructor() {
    this.activeDeadmanNotificationId = null;
  }

  async initialize() {
    if (Platform.OS !== 'android') return;

    try {
      await notifee.createChannel({
        id: 'deadman_phys_unwell_v2', // 🔥 ID MỚI
        name: '⚕️ Cảnh báo sức khỏe người cao tuổi',
        importance: AndroidImportance.HIGH,
        sound: 'sos_alarm', // file: android/app/src/main/res/raw/sos_alarm.mp3
        vibration: true,
        vibrationPattern: [500, 500, 500, 500, 500, 500],
        lights: true,
        lightColor: '#FF0000',
      });
    } catch (error) {
      console.error('❌ Error creating Deadman notification channel:', error);
    }
  }

  async showPhysUnwellNotification(deadmanData = {}) {
    try {
      const {
        elderId,
        elderName,
        elderAvatar,
        message,
        timestamp,
        notificationId,
      } = deadmanData;

      const id = notificationId || `deadman_phys_${Date.now()}`;

      const bodyText =
        message ||
        `${elderName || 'Người cao tuổi'} vừa báo KHÔNG ỔN về SỨC KHỎE.\nVui lòng kiểm tra ngay.`;

      const displayId = await notifee.displayNotification({
        id,
        title: '⚕️ Người cao tuổi không ổn về sức khỏe',
        body: bodyText,
        data: {
          type: 'deadman_choice',
          choice: 'phys_unwell',
          elderId: elderId || '',
          elderName: elderName || '',
          clickAction: 'DEADMAN_DETAIL',
        },
        android: {
          channelId: 'deadman_phys_unwell_v2', // 🔥 dùng ID mới ở đây
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.ALARM,

          fullScreenAction: {
            id: 'default',
            launchActivity: 'default',
          },

          autoCancel: true,
          ongoing: true,

          showTimestamp: true,
          timestamp: timestamp ? new Date(timestamp).getTime() : Date.now(),

          sound: 'sos_alarm',
          loopSound: true,
          vibrationPattern: [500, 500, 500, 500, 500, 500],

          color: '#DC2626',
          smallIcon: 'ic_launcher',

          ...(elderAvatar && typeof elderAvatar === 'string' && elderAvatar.startsWith('http')
            ? { largeIcon: elderAvatar, circularLargeIcon: true }
            : {}),

          pressAction: {
            id: 'view_deadman_detail',
            launchActivity: 'default',
          },
        },
      });

      this.activeDeadmanNotificationId = displayId;
      return displayId;
    } catch (error) {
      console.error('❌ Error showing Deadman phys_unwell notification:', error);
      throw error;
    }
  }

  async dismissPhysUnwellNotification(notificationId) {
    try {
      if (notificationId) {
        await notifee.cancelNotification(notificationId);
      }

      if (this.activeDeadmanNotificationId) {
        await notifee.cancelNotification(this.activeDeadmanNotificationId);
        this.activeDeadmanNotificationId = null;
      }
    } catch (error) {
      console.error('❌ Error dismissing Deadman notification:', error);
    }
  }

  async cancelAllDeadmanNotifications() {
    try {
      const notifications = await notifee.getDisplayedNotifications();
      for (const n of notifications) {
        if (
          n.notification?.android?.channelId === 'deadman_phys_unwell_v2' ||
          n.notification?.data?.type === 'deadman_choice'
        ) {
          await notifee.cancelNotification(n.id);
        }
      }
      this.activeDeadmanNotificationId = null;
    } catch (error) {
      console.error('❌ Error cancelling Deadman notifications:', error);
    }
  }
}

export default new DeadmanNotificationService();
