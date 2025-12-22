import { api } from './api';

export const ratingService = {

  // tạo đánh giá
  createRating: async (reviewer, reviewee, ratingType, rating, comment, serviceSupportId) => {
    console.log({ reviewer, reviewee, ratingType, rating, comment, serviceSupportId });
    
    try {
      const response = await api.post('/ratings', {
        reviewer,
        reviewee,
        ratingType,
        rating,
        comment,
        serviceSupportId,
      });
      return {
        success: true,
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      return {
        success: false, 
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Lấy đánh giá theo dịch vụ hỗ trợ và userId
  getRatingsByServiceSupportIdAndReviewer: async (serviceSupportId, reviewer) => {
    try {
      const response = await api.get(`/ratings/service-support/${serviceSupportId}/${reviewer}`);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Chỉnh sửa: Lấy đánh giá theo Id người dùng được đánh giá
  updateRatingById: async (ratingId, rating, comment) => {
    try {
      const response = await api.put(`/ratings/${ratingId}`, {
        rating,
        comment,
      });
      return {
        success: true,
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Lấy đánh giá theo Id người dùng được đánh giá
  deleteRatingById: async (ratingId) => {
    try {
      const response = await api.delete(`/ratings/${ratingId}`);
      return {
        success: true,
        data: response.data.data,
        message: response.data.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },

  getRatingsByUserId: async (userId) => {
    try {
      const response = await api.get(`/ratings/${userId}`);
      return {
        success: true,
        data: response.data,
        message: response.data.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },
  // Lấy đánh giá theo Id lịch khám tư vấn
  getRatingByConsultationId: async (consultationId) => {
    try {
      const response = await api.get(`/ratings/consultation/${consultationId}`);
      return {
        success: true,
        data: response.data?.data,
        message: response.data?.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },
};
export default ratingService;
