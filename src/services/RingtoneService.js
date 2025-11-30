import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';
import { Platform } from 'react-native';

/**
 * Service quản lý âm thanh cho cuộc gọi đến
 * Sử dụng Notifee để play ringtone (vì có sẵn và stable)
 */
class RingtoneService {
  constructor() {
    this.currentNotificationId = null;
    this.isPlaying = false;
  }

  /**
   * Phát nhạc chuông cuộc gọi đến
   * @param {boolean} loop - Lặp lại nhạc chuông (default: true)
   */
  async playIncomingCallRingtone(loop = true) {
    try {
      // Dừng nhạc cũ nếu đang phát
      await this.stopRingtone();

      console.log('🔊 Loading incoming call ringtone...');

      // Create channel for ringtone
      const channelId = await notifee.createChannel({
        id: 'ringtone-channel',
        name: 'Ringtone Channel',
        importance: AndroidImportance.HIGH,
        sound: 'incoming_call', // File trong res/raw/incoming_call.mp3
        vibration: true,
        vibrationPattern: [500, 500],
      });

      // Display notification with sound
      const notificationId = await notifee.displayNotification({
        title: 'Cuộc gọi đến',
        body: '',
        android: {
          channelId,
          category: AndroidCategory.CALL,
          sound: 'incoming_call',
          loopSound: loop,
          autoCancel: false,
          ongoing: true,
          smallIcon: 'ic_launcher',
        },
      });

      this.currentNotificationId = notificationId;
      this.isPlaying = true;
      
      console.log('✅ Ringtone playing');
      return true;
    } catch (error) {
      console.error('❌ Error playing ringtone:', error);
      return false;
    }
  }

  /**
   * Phát âm thanh SOS (khẩn cấp)
   */
  async playSOSRingtone(loop = true) {
    try {
      // Dừng nhạc cũ nếu đang phát
      await this.stopRingtone();

      console.log('🆘 Loading SOS ringtone...');

      // Create channel for SOS ringtone
      const channelId = await notifee.createChannel({
        id: 'sos-ringtone-channel',
        name: 'SOS Ringtone Channel',
        importance: AndroidImportance.HIGH,
        sound: 'sos_alarm', // File trong res/raw/sos_alarm.mp3
        vibration: true,
        vibrationPattern: [300, 300, 300, 300],
      });

      // Display notification with sound
      const notificationId = await notifee.displayNotification({
        title: 'Cuộc gọi khẩn cấp',
        body: '',
        android: {
          channelId,
          category: AndroidCategory.ALARM,
          sound: 'sos_alarm',
          loopSound: loop,
          autoCancel: false,
          ongoing: true,
          smallIcon: 'ic_launcher',
        },
      });

      this.currentNotificationId = notificationId;
      this.isPlaying = true;
      
      console.log('✅ SOS ringtone playing');
      return true;
    } catch (error) {
      console.error('❌ Error playing SOS ringtone:', error);
      // Fallback to regular ringtone
      return this.playIncomingCallRingtone(loop);
    }
  }

  /**
   * Dừng nhạc chuông
   */
  async stopRingtone() {
    try {
      if (this.isPlaying && this.currentNotificationId) {
        console.log('🔇 Stopping ringtone...');
        await notifee.cancelNotification(this.currentNotificationId);
        this.currentNotificationId = null;
        this.isPlaying = false;
        console.log('✅ Ringtone stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping ringtone:', error);
      this.isPlaying = false;
    }
  }

  /**
   * Kiểm tra xem có đang phát nhạc không
   */
  isRingtonePlaying() {
    return this.isPlaying;
  }

  /**
   * Cleanup toàn bộ
   */
  async cleanup() {
    await this.stopRingtone();
    console.log('🧹 RingtoneService cleaned up');
  }

  // Singleton pattern
  static getInstance() {
    if (!RingtoneService.instance) {
      RingtoneService.instance = new RingtoneService();
    }
    return RingtoneService.instance;
  }
}

export default RingtoneService.getInstance();

