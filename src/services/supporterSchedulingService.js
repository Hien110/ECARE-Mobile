import { api } from './api';

const supporterSchedulingService = {
  // Tạo lịch hỗ trợ mới
  createScheduling: async schedulingData => {
    try {
      const response = await api.post('/supporter-schedulings', schedulingData);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      console.error('createScheduling error:', error);
      throw error;
    }
  },

  // Lấy danh sách đặt lịch theo id
  getSchedulingsByUserId: async (userId) => {
    console.log(userId);
    
    try {
      const response = await api.post('/supporter-schedulings/list', {
        userId,
      });
      return {
        success: true,
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      console.error('getSchedulingsByUserId error:', error);
      throw error;
    }
  },

  // Lấy danh sách đặt lịch theo supporter id
  getSchedulingsBySupporterId: async userId => {
    try {
      const response = await api.post('/supporter-schedulings/supporter-list', {
        userId,
      });
      return {
        success: true,
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      console.error('getSchedulingsBySupporterId error:', error);
      throw error;
    }
  },

  // Lấy chi tiết đặt lịch theo id
  getSchedulingById: async schedulingId => {
    try {
      const response = await api.get(`/supporter-schedulings/${schedulingId}`);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      console.error('getSchedulingById error:', error);
      throw error;
    }
  },

  // Cập nhật trạng thái đặt lịch
  updateSchedulingStatus: async (schedulingId, status) => {
    try {
      const response = await api.put(
        `/supporter-schedulings/${schedulingId}/status`,
        { status },
      );
      return {
        success: true,
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      console.error('updateSchedulingStatus error:', error);  
      throw error;
    }
  },

  // Kiểm tra lịch đã hoàn thành hết hay chưa
  checkAllCompletedOrCanceled: async (supporterId, elderlyId) => {
    try {
      const response = await api.post(
        '/supporter-schedulings/check-completion',
        {
          supporterId,
          elderlyId,
        },
      );
      return {
        success: true,
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      console.error('checkAllCompletedOrCanceled error:', error);
      throw error;
    }
  },
  getSupporterDetail: async supporterId => {
      try {
        const response = await api.get(
          `/supporter-schedulings/supporter-detail/${supporterId}`,
        );
        return {
          success: !!response.data?.success,
          data: response.data?.data,
          message:
            response.data?.message || 'Lấy chi tiết người hỗ trợ thành công',
        };
      } catch (error) {
        console.error('getSupporterDetail error:', error);
        return {
          success: false,
          data: null,
          message: error.response?.data?.message || error.message,
        };
      }
  },
};

export default supporterSchedulingService;
