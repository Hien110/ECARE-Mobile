import notifee, { AndroidImportance } from '@notifee/react-native';

/**
 * Tạo notification channels cho Android
 */
export const createNotificationChannels = async () => {
  try {
    // Channel cho SOS alerts
    await notifee.createChannel({
      id: 'sos_alerts',
      name: 'SOS Alerts',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 500],
    });

    // Channel cho Video Calls
    await notifee.createChannel({
      id: 'video_calls',
      name: 'Video Calls',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 500],
    });

    // Channel cho Messages
    await notifee.createChannel({
      id: 'messages',
      name: 'Messages',
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
    });

    console.log('✅ Notification channels created');
  } catch (error) {
    console.error('❌ Error creating notification channels:', error);
  }
};
