import { api } from './api';

export const ratingService = {
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
};
export default ratingService;
