import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import api from '../services/api/axiosConfig'; // 👈 dùng chung baseURL với toàn app

const { FloatingCheckin } = NativeModules || {};

/**
 * Chuẩn hoá baseUrl để native dùng:
 * - Lấy từ api.defaults.baseURL
 * - Bỏ đuôi / nếu có
 * - Nếu kết thúc bằng /api thì cắt /api đi (vì native tự thêm /api/deadman/...)
 */
function resolveBaseUrl() {
  let baseUrl = api?.defaults?.baseURL;

  if (!baseUrl || typeof baseUrl !== 'string') {
    console.log('[Floating] ⚠️ api.defaults.baseURL is not set or not a string:', baseUrl);
    return null;
  }

  // Trim & bỏ dấu / cuối cùng
  baseUrl = baseUrl.trim().replace(/\/+$/, '');

  // Nếu baseURL đang là http://host:3000/api → cắt /api
  baseUrl = baseUrl.replace(/\/api$/i, '');

  console.log('[Floating] ℹ️ resolved baseUrl for overlay =', baseUrl);
  return baseUrl;
}

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

    // 🔗 Lấy baseUrl từ axiosConfig (không hard-code IP nữa)
    const baseUrl = resolveBaseUrl();
    if (!baseUrl) {
      console.log('[Floating] ⚠️ Cannot resolve baseUrl for overlay');
      return;
    }

    // Gọi start(), module sẽ tự xử lý popup + quyền + auto-start
    await FloatingCheckin.start(token, baseUrl);
    console.log('[Floating] ✅ started (elderly only) with baseUrl =', baseUrl);
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
