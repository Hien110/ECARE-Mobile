import api from './api/axiosConfig';

const sosService = {
  /**
   * Tạo SOS notification mới
   */
  createSOS: async (recipients, message, location) => {
    try {
      console.log('📤 Creating SOS with:', { recipients, message, location });
      const response = await api.post('/sos', {
        recipients,
        message,
        location,
      });
      console.log('✅ SOS created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error creating SOS:', error);
      console.error('❌ Error response:', error?.response?.data);
      console.error('❌ Error status:', error?.response?.status);
      throw error;
    }
  },

  /**
   * Lấy danh sách SOS của user
   */
  getSOSList: async (params = {}) => {
    try {
      const { status, limit = 50, page = 1 } = params;
      const queryParams = new URLSearchParams({
        ...(status && { status }),
        limit: limit.toString(),
        page: page.toString(),
      });

      const response = await api.get(`/sos?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('Error getting SOS list:', error);
      throw error;
    }
  },

  /**
   * Lấy chi tiết một SOS
   */
  getSOSById: async (sosId) => {
    try {
      const response = await api.get(`/sos/${sosId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting SOS detail:', error);
      throw error;
    }
  },

  /**
   * Cập nhật trạng thái SOS
   */
  updateSOSStatus: async (sosId, status) => {
    try {
      const response = await api.patch(`/sos/${sosId}/status`, {
        status,
      });
      return response.data;
    } catch (error) {
      console.error('Error updating SOS status:', error);
      throw error;
    }
  },

  /**
   * Xóa SOS notification
   */
  deleteSOS: async (sosId) => {
    try {
      const response = await api.delete(`/sos/${sosId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting SOS:', error);
      throw error;
    }
  },

  /**
   * Test gửi notification
   */
  testNotification: async (title, body, data = {}) => {
    try {
      const response = await api.post('/sos/fcm/test', {
        title,
        body,
        data,
      });
      return response.data;
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw error;
    }
  },
};

export default sosService;
