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

  // Thống kê đánh giá cho bác sĩ hiện tại (authenticated)
  getMyRatingStats: async () => {
    try {
      // get own profile to obtain userId
      const meRes = await api.get('/doctors/me');
      const profile = meRes?.data?.data;
      const userId = profile?.user?._id || profile?.userId || null;
      if (!userId) {
        return { success: false, message: 'Không lấy được userId từ hồ sơ' };
      }
      const response = await api.get(`/doctors/${userId}/ratings/summary`);
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

  // Lấy số lượng đánh giá public cho doctor (by reviewee)
  getDoctorRatingCount: async (userId) => {
    try {
      if (!userId) return { success: false, message: 'Thiếu userId' };
      const response = await api.get(`/doctors/${userId}/ratings/count`);
      return {
        success: true,
        data: response.data?.data,
        message: response.data?.message || 'Lấy số lượng đánh giá thành công',
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

  // Lấy danh sách đánh giá hồ sơ bác sĩ (doctor_profile)
  getDoctorReviews: async (userId, params = {}) => {
    try {
      if (!userId) {
        return { success: false, message: 'Thiếu userId' };
      }
      const response = await api.get(`/doctors/${userId}/reviews`, { params });
      const payload = response.data?.data;

      // Normalize response to { items: [], nextCursor: null }
      let items = [];
      let nextCursor = null;

      if (Array.isArray(payload)) {
        items = payload;
      } else if (payload && typeof payload === 'object') {
        items = payload.items || payload.data || [];
        nextCursor = payload.nextCursor || payload.next_cursor || null;
      }

      return {
        success: true,
        data: { items, nextCursor },
        message: response.data?.message || 'Lấy đánh giá bác sĩ thành công',
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Tạo đánh giá hồ sơ bác sĩ (doctor_profile)
  createDoctorReview: async (userId, payload) => {
    try {
      if (!userId) {
        return { success: false, message: 'Thiếu userId' };
      }
      const response = await api.post(`/doctors/${userId}/reviews`, payload);
      return {
        success: true,
        data: response.data?.data,
        message: response.data?.message || 'Tạo đánh giá bác sĩ thành công',
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Thống kê rating bác sĩ public
  getDoctorRatingSummary: async (userId) => {
    try {
      if (!userId) {
        return { success: false, message: 'Thiếu userId' };
      }
      // Prefer public profile endpoint (includes ratingSummary) to avoid 401 when unauthenticated
      try {
        const profileRes = await api.get(`/doctors/by-user/${userId}`);
        if (profileRes?.data?.data?.ratingSummary) {
          return { success: true, data: profileRes.data.data.ratingSummary, message: profileRes.data?.message || 'Lấy thống kê đánh giá bác sĩ thành công' };
        }
      } catch (err) {
        // ignore and fall back to direct summary endpoint
      }

      const response = await api.get(`/doctors/${userId}/ratings/summary`);
      return {
        success: true,
        data: response.data?.data,
        message: response.data?.message || 'Lấy thống kê đánh giá bác sĩ thành công',
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },
};

export default doctorService;
