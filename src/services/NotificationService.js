import notifee, { AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import api from './api/axiosConfig';
import CallNotificationService from './CallNotificationService';
import CallService from './CallService';

class NotificationService {
  navigationRef = null;

  /**
   * Khởi tạo Firebase Messaging
   */
  async initialize(navigation) {
    this.navigationRef = navigation;

    console.log('🔔 Initializing Notification Service...');

    // Request permission
    const hasPermission = await this.requestPermission();

    if (!hasPermission) {
      console.log('⚠️  Notification permission denied');
      return;
    }

    // Tạo notification channels cho Android
    await this.createNotificationChannels();
    
    // Khởi tạo Call Notification Service
    await CallNotificationService.initialize();
    
    // Khởi tạo SOS Notification Service
    const SOSNotificationService = require('./SOSNotificationService').default;
    await SOSNotificationService.initialize();

    // 🔔 Tạo Android channel để có heads-up banner khi foreground (cắm USB)
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'ecare_alerts',
        name: 'E-Care Alerts',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        lights: true,
        badge: true,
      });
      console.log('✅ Notifee channel created: ecare_alerts');
    }

    // Lấy FCM token
    await this.getFCMToken();

    // Lắng nghe khi nhận notification (app ở foreground)
    this.onMessageListener();

    // Xử lý khi click vào notification (app ở background)
    this.onNotificationOpenedApp();

    // Kiểm tra notification khởi động app (app đã tắt hoàn toàn)
    this.getInitialNotification();

    // Lắng nghe khi token bị refresh
    this.onTokenRefresh();

    console.log('✅ Notification Service initialized');
  }

  /**
   * Tạo notification channels cho Android
   */
  async createNotificationChannels() {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      console.log('📱 Creating Android notification channels...');
      
      // Sử dụng Firebase Messaging để tạo channels (không cần thư viện thêm)
      // Channels sẽ được tạo tự động khi nhận notification với channelId
      
      console.log('✅ Notification channels ready');
    } catch (error) {
      console.error('❌ Error creating notification channels:', error);
    }
  }

  /**
   * Xin quyền hiển thị notification
   */
  async requestPermission() {
    try {
      // Android 13+ cần permission runtime
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Thông báo khẩn cấp',
            message: 'E-Care cần quyền gửi thông báo để thông báo các cuộc gọi SOS khẩn cấp',
            buttonNeutral: 'Hỏi lại sau',
            buttonNegative: 'Từ chối',
            buttonPositive: 'Đồng ý',
          }
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('❌ Notification permission denied by user');
          return false;
        }
      }

      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('✅ Notification permission granted:', authStatus);
      }

      return enabled;
    } catch (error) {
      console.error('❌ Error requesting permission:', error);
      return false;
    }
  }

  /**
   * Lấy FCM token và gửi lên server
   */
  async getFCMToken() {
    try {
      const token = await messaging().getToken();
      console.log('📱 FCM Token:', token.substring(0, 50) + '...');

      // Lưu token lên server
      await this.saveFCMTokenToServer(token);

      // Lưu local để kiểm tra
      await AsyncStorage.setItem('fcm_token', token);

      return token;
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Gửi FCM token lên server
   */
  async saveFCMTokenToServer(token) {
    try {
      // Kiểm tra xem user đã đăng nhập chưa (có JWT token chưa)
      const jwtToken = await AsyncStorage.getItem('ecare_token');
      
      if (!jwtToken) {
        console.log('⚠️ No JWT token found, skipping FCM token save');
        return;
      }

      console.log('📤 Saving FCM token to server...');
      console.log('📱 FCM Token length:', token?.length);
      console.log('🔑 JWT Token exists:', !!jwtToken);

      const deviceInfo = `${Platform.OS} ${Platform.Version}`;

      const response = await api.post('/sos/fcm/token', {
        token,
        deviceInfo,
      });

      console.log('✅ FCM token saved to server:', response.data);
    } catch (error) {
      // console.error('❌ Error saving FCM token to server:', error.message);
      // console.error('❌ Error details:', error.response?.data);
      // console.error('❌ Error status:', error.response?.status);
      // Không throw error để không block app
    }
  }

  async isLoggedIn() {
    try {
      const jwtToken = await AsyncStorage.getItem('ecare_token');
      return !!jwtToken;
    } catch {
      return false;
    }
  }

  async getCurrentUser() {
    try {
      const cachedUser = await AsyncStorage.getItem('ecare_user');
      if (cachedUser) {
        return JSON.parse(cachedUser);
      }
    } catch {}
    return null;
  }

  async shouldDisplayNotification(data) {
    // 1) Bắt buộc đã đăng nhập
    const loggedIn = await this.isLoggedIn();
    if (!loggedIn) {
      console.log('🚫 Skip notification: user not logged in');
      return false;
    }

     if (data?.type === 'deadman_reminder') {
     const currentUser = await this.getCurrentUser();
     const role = currentUser?.role?.toLowerCase?.() || '';
     return role === 'elderly';
   }

    // 2) Kiểm tra vai trò
    const currentUser = await this.getCurrentUser();
    const role = currentUser?.role?.toLowerCase?.() || '';
    const allowedRoles = new Set(['family', 'supporter']);

    if (!allowedRoles.has(role)) {
      console.log('🚫 Skip notification: role not allowed ->', role);
      return false;
    }

    // 3) (Optional) Có thể kiểm tra thêm theo loại thông báo
    //    - 'sos' : đã có kiểm tra "người gửi" ở bên dưới
    //    - 'elder_distress' : server chỉ gửi tới người thân có quan hệ (đã lọc ở backend)
    return true;
  }

  // 🔔 Helper: hiển thị banner khi app đang foreground (kể cả cắm USB)
  async showForegroundBanner(notification, data) {
    try {
      const title = notification?.title || 'Thông báo';
      const body  = notification?.body  || '';

      if (Platform.OS === 'android') {
        await notifee.displayNotification({
          title,
          body,
          android: {
            channelId: 'ecare_alerts',
            pressAction: { id: 'default' },
            smallIcon: 'ic_launcher', // dùng icon mặc định của app; có thể đổi nếu đã khai báo
            importance: AndroidImportance.HIGH,
          },
          data,
        });
      } else {
        await notifee.displayNotification({
          title,
          body,
          ios: {
            foregroundPresentationOptions: { banner: true, sound: true, badge: true },
          },
          data,
        });
      }
    } catch (e) {
      console.error('❌ showForegroundBanner error:', e);
    }
  }

  /**
   * Nhận notification khi app đang mở (foreground)
   */
  onMessageListener() {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const { notification, data } = remoteMessage;

      // 🆕 Xử lý SOS call notification (foreground - KHÔNG hiển thị)
      if (data?.type === 'sos_call') {
        console.log('📥 [Foreground] SOS call notification received via FCM, NOT showing (Socket handles it)');
        // Socket.IO đã xử lý và hiển thị UI
        // KHÔNG cần hiển thị notification
        return;
      }

      // Xử lý video call notification
      if (data?.type === 'video_call') {
        // Kiểm tra duplicate
        if (CallService.hasProcessedCall(data.callId)) {
          return;
        }
        
        // Kiểm tra xem người hiện tại có phải là người GỌI không
        const currentUserId = await this.getCurrentUserId();
        const callerId = data?.callerId;

        // Nếu người hiện tại là người GỌI thì KHÔNG hiển thị notification
        if (currentUserId && callerId && currentUserId === callerId) {
          return;
        }
        
        // Đánh dấu call đã được xử lý
        CallService.markCallAsProcessed(data.callId);
        
        // KHI APP ĐANG MỞ (FOREGROUND): Socket đã xử lý và navigate đến IncomingCallScreen
        // KHÔNG cần xử lý gì thêm ở đây - return luôn
        return;
      }

      const allowed = await this.shouldDisplayNotification(data);
      if (!allowed) return;

      if (data?.type === 'sos') {
        // Kiểm tra xem người hiện tại có phải là người gửi SOS không
        const currentUserId = await this.getCurrentUserId();
        const requesterId = data?.requesterId;

        // Nếu người hiện tại là người gửi SOS thì không hiển thị thông báo
        if (currentUserId && requesterId && currentUserId === requesterId) {
          return;
        }

        // KHI APP ĐANG MỞ (FOREGROUND): Socket đã xử lý rồi
        // KHÔNG cần hiển thị notification nữa - return luôn
        return;
      } 
      else if (data?.type === 'deadman_reminder') {
        await this.showForegroundBanner(notification, data);
        Alert.alert(
          notification?.title || 'Nhắc kiểm tra an toàn',
          notification?.body || 'Bác có muốn xác nhận “Tôi ổn hôm nay” không ạ?',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Tôi ổn hôm nay', onPress: () => this.postDeadmanCheckin() },
          ],
          { cancelable: true }
        );
      } else if (data?.type === 'deadman_alert') {
        await this.showForegroundBanner(notification, data);
        Alert.alert(
          notification?.title || '⚠️ Cảnh báo',
          notification?.body || 'Chưa nhận được xác nhận an toàn hôm nay.',
          [
            { text: 'Bỏ qua', style: 'cancel' },
            { text: 'Xem cảnh báo', onPress: () => this.navigateToAlertsCenter(data) },
          ],
          { cancelable: true }
        );
      } else {
        // Notification thông thường
        await this.showForegroundBanner(notification, data);
        Alert.alert(
          notification?.title || 'Thông báo',
          notification?.body || '',
          [{ text: 'OK' }]
        );
      }
    });

    return unsubscribe;
  }

  /**
   * Xử lý khi click vào notification (app ở background)
   */
  onNotificationOpenedApp() {
    messaging().onNotificationOpenedApp(async remoteMessage => {
      const { data } = remoteMessage;

      // Xử lý video call notification
      if (data?.type === 'video_call') {
        // KHÔNG xử lý gì cả - vì video call đã được xử lý bởi Notifee actions
        // hoặc background handler
        console.log('⚠️ Video call notification opened - skipping (handled by Notifee)');
        return;
      }

      const allowed = await this.shouldDisplayNotification(data);
      if (!allowed) return;

      if (data?.type === 'sos') {
        const currentUserId = await this.getCurrentUserId();
        const requesterId = data?.requesterId;

        // Nếu người hiện tại là người gửi SOS thì không navigate
        if (currentUserId && requesterId && currentUserId === requesterId) {
          return;
        }

        setTimeout(() => {
          this.navigateToSOSDetail(data);
        }, 1000);
      }
      else if (data?.type === 'deadman_reminder') {
        setTimeout(() => {
          Alert.alert(
            'Nhắc kiểm tra an toàn',
            'Bác muốn xác nhận “Tôi ổn hôm nay” không ạ?',
            [
              { text: 'Để sau', style: 'cancel' },
              { text: 'Tôi ổn hôm nay', onPress: () => this.postDeadmanCheckin() },
            ],
            { cancelable: true }
          );
        }, 800);
      } else if (data?.type === 'deadman_alert') {
        setTimeout(() => this.navigateToAlertsCenter(data), 800);
      }
    });
  }

  /**
   * Kiểm tra notification khởi động app (app đã tắt)
   */
  getInitialNotification() {
    messaging()
      .getInitialNotification()
      .then(async remoteMessage => {
        if (remoteMessage) {
          const { data } = remoteMessage;

          // Xử lý video call notification
          if (data?.type === 'video_call') {
            // KHÔNG xử lý gì cả - vì video call đã được xử lý bởi Notifee actions
            // hoặc pending actions trong App.tsx
            console.log('⚠️ Video call notification from killed state - skipping (handled by Notifee)');
            return;
          }

          const allowed = await this.shouldDisplayNotification(data);
          if (!allowed) return;

          if (data?.type === 'sos') {
            const currentUserId = await this.getCurrentUserId();
            const requesterId = data?.requesterId;

            // Nếu người hiện tại là người gửi SOS thì không navigate
            if (currentUserId && requesterId && currentUserId === requesterId) {
              return;
            }

            setTimeout(() => {
              this.navigateToSOSDetail(data);
            }, 2000);
          }
          else if (data?.type === 'deadman_reminder') {
            setTimeout(() => {
              Alert.alert(
                'Nhắc kiểm tra an toàn',
                'Bác muốn xác nhận “Tôi ổn hôm nay” không ạ?',
                [
                  { text: 'Để sau', style: 'cancel' },
                  { text: 'Tôi ổn hôm nay', onPress: () => this.postDeadmanCheckin() },
                ],
                { cancelable: true }
              );
            }, 2000);
          } else if (data?.type === 'deadman_alert') {
            setTimeout(() => this.navigateToAlertsCenter(data), 2000);
          }
        }
      });
  }

  /**
   * Lắng nghe khi FCM token bị refresh
   */
  onTokenRefresh() {
    messaging().onTokenRefresh(async token => {
      await this.saveFCMTokenToServer(token);
      await AsyncStorage.setItem('fcm_token', token);
    });
  }

  /**
   * Navigate đến màn hình SOS Detail
   */
  navigateToSOSDetail(data) {
    if (!this.navigationRef) {
      return;
    }

    // Kiểm tra sosId có hợp lệ không
    if (!data?.sosId || data.sosId === 'undefined') {
      console.error('❌ Invalid sosId in notification data:', data);
      Alert.alert('Lỗi', 'Thông tin SOS không hợp lệ');
      return;
    }

    try {
      this.navigationRef.navigate('SOSDetail', {
        sosId: data.sosId,
        requesterName: data.requesterName || 'Không rõ',
        requesterAvatar: data.requesterAvatar || '',
        address: data.address || 'Không rõ vị trí',
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        message: data.message || '',
      });
    } catch (error) {
      console.error('❌ Error navigating to SOS detail:', error);
      Alert.alert('Lỗi', 'Không thể mở thông tin SOS');
    }
  }

  async postDeadmanCheckin() {
    try {
      const resp = await api.post('/deadman/checkin', {});
      const ok = resp?.data?.success !== false;
      if (ok) {
        Alert.alert('✅ Đã xác nhận', 'Cảm ơn Bác! Hôm nay đã ghi nhận “Tôi ổn”.');
      } else {
        Alert.alert('Ôi...', resp?.data?.message || 'Không thể check-in lúc này, thử lại giúp cháu nhé.');
      }
    } catch (e) {
      Alert.alert('Ôi...', 'Mạng yếu hoặc máy bận, thử lại sau một lát ạ.');
    }
  }

  navigateToAlertsCenter(data) {
    try {
      if (!this.navigationRef) return;
      if (this.navigationRef?.navigate) {
        this.navigationRef.navigate('AlertsCenter', {
          fromNotification: true,
          groupKey: data?.groupKey || data?.type || 'deadman_alert',
        });
      }
    } catch (e) {
      console.warn('[NotificationService] navigateToAlertsCenter error:', e?.message || e);
    }
  }

  /**
   * Xóa FCM token (khi logout)
   */
  async removeFCMToken() {
    try {
      const token = await AsyncStorage.getItem('fcm_token');

      if (token) {
        // Xóa token trên server
        await api.delete('/sos/fcm/token', {
          data: { token },
        });

        // Xóa token trên device
        await messaging().deleteToken();
        await AsyncStorage.removeItem('fcm_token');

        console.log('✅ FCM token removed');
      }
    } catch (error) {
      console.error('❌ Error removing FCM token:', error);
    }
  }

  /**
   * Lấy số lượng badge (optional - cho iOS)
   */
  async getBadgeCount() {
    try {
      if (Platform.OS === 'ios') {
        const badge = await messaging().getInitialNotification();
        return badge?.notification?.ios?.badge || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Set số lượng badge (optional - cho iOS)
   */
  async setBadgeCount(count) {
    try {
      if (Platform.OS === 'ios') {
        await messaging().setApplicationBadge(count);
      }
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  /**
   * Lấy ID của user hiện tại từ AsyncStorage hoặc token
   */
  async getCurrentUserId() {
    try {
      // Thử lấy từ cached user trước
      const cachedUser = await AsyncStorage.getItem('ecare_user');
      if (cachedUser) {
        const user = JSON.parse(cachedUser);
        if (user?._id) {
          return user._id;
        }
      }

      // Thử decode từ JWT token
      const token = await AsyncStorage.getItem('ecare_token');
      if (token) {
        try {
          const base64Payload = token.split('.')[1];
          const payload = JSON.parse(atob(base64Payload));
          return payload.userId || payload._id || payload.id;
        } catch (decodeError) {
          console.warn('Could not decode token:', decodeError);
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  }
}

export default new NotificationService();
