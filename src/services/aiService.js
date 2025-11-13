// services/aiService.js
import { api } from './api';

export const aiService = {
  chat: async (payload) => {
    try {
      const response = await api.post('/ai/chat', payload, { timeout: 12000 });

      const ok = response?.data?.success !== false;
      if (ok && response?.data?.data) {
        return { success: true, data: response.data.data };
      }

      return {
        success: true,
        data: {
          reply:
            'Mình hơi chậm một chút, nhưng bạn yên tâm nhé 💬. Hãy mô tả rõ hơn để mình hỗ trợ tốt hơn!',
          emotion: {
            mood: 'neutral',
            valence: 0.5,
            arousal: 0.3,
            loneliness: 0.2,
            riskLevel: 'none',
            supportMessage: '',
            followUps: ['Bạn muốn mình gợi ý bác sĩ không?', 'Hay bạn cần supporter gần đây?'],
          },
        },
      };
    } catch (error) {
      return {
        success: true,
        data: {
          reply:
            'Kết nối hơi chập chờn 🌿. Mình gửi gợi ý nhanh trước nhé: nghỉ ngơi, hít thở sâu, và cho mình biết thêm tình trạng của bạn.',
          emotion: {
            mood: 'neutral',
            valence: 0.5,
            arousal: 0.3,
            loneliness: 0.2,
            riskLevel: 'none',
            supportMessage: '',
            followUps: ['Bạn có muốn mình tóm tắt lại không?', 'Mình gợi ý bác sĩ giúp nhé?'],
          },
        },
      };
    }
  },

  history: async (params = {}) => {
    const { sessionId, limit = 100, before } = params || {};
    if (!sessionId) {
      return { success: true, data: [] };
    }

    try {
      const response = await api.get('/ai/history', {
        params: { sessionId, limit, ...(before ? { before } : {}) },
        timeout: 10000,
      });

      const ok = response?.data?.success !== false;
      const data = Array.isArray(response?.data?.data) ? response.data.data : [];
      return { success: !!ok, data };
    } catch (error) {
      return { success: true, data: [] };
    }
  },

  listSessions: async () => {
    const TAG = '[aiService][listSessions]';
    try {
      const res = await api.get('/ai/sessions', { timeout: 10000 });

      const payload = res?.data || {};
      // chấp nhận nhiều shape trả về khác nhau
      // Ưu tiên: {success, data: [...]}
      let arr =
        (Array.isArray(payload?.data) && payload.data) ||
        // {success, data: { sessions: [...] }}
        (Array.isArray(payload?.data?.sessions) && payload.data.sessions) ||
        // {success, sessions: [...]}
        (Array.isArray(payload?.sessions) && payload.sessions) ||
        // {items: [...]}
        (Array.isArray(payload?.items) && payload.items) ||
        // {data: { items: [...] }}
        (Array.isArray(payload?.data?.items) && payload.data.items) ||
        // fallback: rỗng
        [];

      return { success: payload?.success !== false, data: arr };
    } catch (err) {
      console.error('[aiService][listSessions][ERROR]', err?.message || err);
      return { success: false, data: [] };
    }
  },

  createSession: async ({ sessionId, title = 'Cuộc trò chuyện mới' } = {}) => {
    if (!sessionId) return { success: false, message: 'Thiếu sessionId' };
    try {
      const resp = await api.post('/ai/sessions', { sessionId, title }, { timeout: 12000 });
      // eslint-disable-next-line no-console
      console.log('[aiService][createSession] status=', resp?.status, 'data=', resp?.data);

      const httpOk = [200, 201, 409].includes(resp?.status);
      const ok = resp?.data?.success !== false || httpOk;
      return { success: !!ok, data: resp?.data?.data || { sessionId } };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[aiService][createSession] ERROR', e?.message, e?.response?.status, e?.response?.data);
      return { success: false, message: e?.message || 'Không tạo được phiên' };
    }
  },

  deleteSession: async (params = {}) => {
    const { sessionId } = params || {};
    if (!sessionId) {
      return { success: false, message: 'Thiếu sessionId' };
    }
    try {
      const response = await api.delete('/ai/sessions', {
        params: { sessionId },
        timeout: 10000,
      });
      const ok = response?.data?.success !== false;
      return { success: !!ok };
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Không thể xoá cuộc trò chuyện';
      return { success: false, message };
    }
  },
};

export default aiService;
