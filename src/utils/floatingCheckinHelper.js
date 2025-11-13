import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';

const { FloatingCheckin } = NativeModules || {};

// 👉 Cập nhật IP server backend của bạn tại đây
const getBaseUrl = () => 'http://192.168.1.51:3000';

/**
 * Bật Floating Checkin overlay cho người cao tuổi
 */
export async function enableFloating() {
  try {
    if (!FloatingCheckin) {
      console.log('[Floating] ⚠️ Native module not found');
      return;
    }

    // 🔐 Chỉ bật nếu role = elderly
    const rawUser = await AsyncStorage.getItem('ecare_user');
    const user = rawUser ? JSON.parse(rawUser) : null;
    const role = (user?.role || '').toLowerCase();
    if (role !== 'elderly') {
      console.log('[Floating] ⛔ Skip: role is not elderly');
      await disableFloating();
      return;
    }

    const token = await AsyncStorage.getItem('ecare_token');
    if (!token) {
      console.log('[Floating] ⚠️ No JWT token found');
      return;
    }

    // Gọi start(), module sẽ tự xử lý popup + quyền + auto-start
    await FloatingCheckin.start(token, getBaseUrl());
    console.log('[Floating] ✅ started (elderly only)');
  } catch (err) {
    console.log('[Floating] start error', err);
  }
}

/**
 * Tắt Floating Checkin overlay
 */
export async function disableFloating() {
  try {
    if (!FloatingCheckin) {
      console.log('[Floating] ⚠️ Native module not found');
      return;
    }
    await FloatingCheckin.stop();
    console.log('[Floating] 🛑 stopped');
  } catch (err) {
    console.log('[Floating] stop error', err);
  }
}
