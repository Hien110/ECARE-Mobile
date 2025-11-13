import { api } from './api';

export const doctorService = {
  // Tạo hồ sơ của chính mình
  createMyProfile: async (payload) => {
    try {
      const response = await api.post('/doctors/create', payload);
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
      const response = await api.get('/doctors/me');
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

  // Cập nhật hồ sơ của chính mình
  updateMyProfile: async (payload) => {
    try {
      const response = await api.put('/doctors/update', payload);
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

  // Lấy hồ sơ public theo profileId
  getProfileById: async (profileId) => {
    try {
      const response = await api.get(`/doctors/by-id/${profileId}`);
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


  // Tạo lịch cho 1 ngày (chỉ thêm mới, báo lỗi nếu đã tồn tại)
  createScheduleForDay: async (payload) => {
    try {
      const response = await api.post('/doctors/schedule/create', payload);
      return {
        success: true,
        data: response.data?.data,
        message: response.data?.message || 'Tạo lịch thành công',
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Cập nhật lịch cho 1 ngày (chỉ update, báo lỗi nếu chưa tồn tại)
  updateScheduleForDay: async (payload) => {
    try {
      const response = await api.put('/doctors/schedule/update', payload);
      return {
        success: true,
        data: response.data?.data,
        message: response.data?.message || 'Cập nhật lịch thành công',
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Sao chép lịch từ 1 ngày sang nhiều ngày (ghi đè ngày đích)
  copySchedule: async (payload) => {
    try {
      const response = await api.post('/doctors/schedule/copy', payload);
      return {
        success: true,
        data: response.data?.data,
        message: response.data?.message || 'Sao chép lịch thành công',
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Thống kê đánh giá 
  getMyRatingStats: async () => {
    try {
      const response = await api.get('/doctors/ratings/stats');
      return {
        success: true,
        data: response.data?.data,
        message: response.data?.message || 'Lấy thống kê thành công',
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },
  getProfileByUserId: async (userId) => {
  try {
    if (!userId) {
      return { success: false, message: "Thiếu userId" };
    }
    const response = await api.get(`/doctors/by-user/${userId}`);
    return {
      success: true,
      data: response.data?.data,
      message: response.data?.message || "Lấy hồ sơ thành công",
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message,
    };
  }
},
deleteSchedule: async (payload) => {
  try {
    console.log('[API] DELETE /doctors/schedule/delete', {
      baseURL: api.defaults.baseURL,
      payload
    });
    const response = await api.delete('/doctors/schedule/delete', { data: payload });
    console.log('[API] OK', response.status, response.data);
    return {
      success: true,
      data: response.data?.data,
      message: response.data?.message || 'Xoá lịch thành công',
    };
  } catch (error) {
    console.log('[API] FAIL', {
      url: '/doctors/schedule/delete',
      baseURL: api.defaults.baseURL,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      payload
    });
    return {
      success: false,
      message: error.response?.data?.message || error.message,
    };
  }
},
};

export default doctorService;
