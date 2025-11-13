import { api } from './api';

export const supporterService = {
  // Tạo hồ sơ mô tả công việc của chính mình (mỗi supporter chỉ có 1 hồ sơ)
  createMyProfile: async (payload) => {
    try {
      const response = await api.post('/supporters/create', payload);
      return {
        success: true,
        data: response.data?.data,
        message: response.data?.message || 'Tạo hồ sơ thành công',
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Lấy hồ sơ của chính mình
  getMyProfile: async () => {
    try {
      const response = await api.get('/supporters/me');
      return {
        success: true,
        data: response.data?.data,
        message: response.data?.message || 'Lấy hồ sơ thành công',
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Cập nhật hồ sơ của chính mình (cập nhật từng phần)
  updateMyProfile: async (payload) => {
    try {
      const response = await api.put('/supporters/me', payload);
      return {
        success: true,
        data: response.data?.data,
        message: response.data?.message || 'Cập nhật hồ sơ thành công',
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Lấy danh sách supporter có sẵn trong khoảng thời gian
  getAvailableSupporters: async (bookingDraft) => {
    try {
      const response = await api.post('/supporters/availability', {
        bookingDraft,
      });
      return {
        success: true,
        data: response.data.data,
        message: response.data?.message || 'Lấy danh sách supporter thành công',
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },
};

export default supporterService;
