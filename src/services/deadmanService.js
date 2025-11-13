import { api } from './api';

export const deadmanService = {
  // ===== Exists =====
  status: async () => {
    try {
      const res = await api.get('/deadman/status', { timeout: 10000 });
      const ok = res?.data?.success !== false;
      const data =
        res?.data?.data && typeof res.data.data === 'object'
          ? res.data.data
          : {};
      return { success: !!ok, data };
    } catch (e) {
      return { success: false, data: {} };
    }
  },

  config: async (patch = {}) => {
    try {
      const res = await api.post('/deadman/config', patch, { timeout: 12000 });
      const ok = res?.data?.success !== false;
      const data =
        res?.data?.data && typeof res.data.data === 'object'
          ? res.data.data
          : {};
      return { success: !!ok, data };
    } catch (e) {
      return {
        success: false,
        message:
          e?.response?.data?.message ||
          e?.message ||
          'Không thể cập nhật cấu hình Deadman',
      };
    }
  },

  checkin: async () => {
    try {
      const res = await api.post('/deadman/checkin', {}, { timeout: 10000 });
      const ok = res?.data?.success !== false;
      const data =
        res?.data?.data && typeof res.data.data === 'object'
          ? res.data.data
          : {};
      return { success: !!ok, data };
    } catch (e) {
      return {
        success: false,
        message:
          e?.response?.data?.message ||
          e?.message ||
          'Không thể check-in hôm nay',
      };
    }
  },

  snooze: async (params = {}) => {
    const minutes = Number(params?.minutes ?? 60);
    try {
      const res = await api.post(
        '/deadman/snooze',
        { minutes },
        { timeout: 10000 }
      );
      const ok = res?.data?.success !== false;
      const data =
        res?.data?.data && typeof res.data.data === 'object'
          ? res.data.data
          : {};
      return { success: !!ok, data };
    } catch (e) {
      return {
        success: false,
        message:
          e?.response?.data?.message ||
          e?.message ||
          'Không thể snooze Deadman',
      };
    }
  },

};

export default deadmanService;
