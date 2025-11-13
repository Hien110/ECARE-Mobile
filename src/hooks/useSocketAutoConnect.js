import { useEffect, useRef } from 'react';
import socketService from '../services/socketService';
import userService from '../services/userService';

/**
 * Hook để tự động kết nối socket khi app khởi động nếu user đã đăng nhập
 */
const useSocketAutoConnect = () => {
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Chỉ chạy một lần khi app khởi động
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const autoConnectSocket = async () => {
      try {
        // Kiểm tra xem user đã đăng nhập chưa
        const token = await userService.getToken();
        const user = await userService.getUser();

        if (token && user?.success && user?.data) {
          console.log('🔌 App started - Auto connecting socket...');
          await socketService.connect();
          console.log('✅ Socket auto-connected on app start');
        } else {
          console.log('ℹ️ No valid user session found - Socket not connected');
        }
      } catch (error) {
        console.error('❌ Socket auto-connect on app start failed:', error);
        // Không throw error để không crash app
      }
    };

    // Delay một chút để đảm bảo các service khác đã sẵn sàng
    const timer = setTimeout(autoConnectSocket, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return null; // Hook này không return gì, chỉ thực hiện side effect
};

export default useSocketAutoConnect;