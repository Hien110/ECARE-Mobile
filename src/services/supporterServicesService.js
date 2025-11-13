import { api } from './api';

export const supporterServicesService = {

    // Lấy danh sách dịch vụ hỗ trợ
  getAllServices: async () => {
    try {
        const response = await api.get('/supporter-services');
        return {
            success: true,
            data: response.data?.data,
            message: response.data?.message || 'Lấy danh sách dịch vụ hỗ trợ thành công',
        };
    } catch (error) {
        return {
            success: false,
            message: error.response?.data?.message || 'Lấy danh sách dịch vụ hỗ trợ thất bại',
        };
    }
  },

  // Lấy dịch vụ hỗ trợ theo id
  getServiceById: async (serviceId) => {
    try {
        const response = await api.get(`/supporter-services/${serviceId}`);
        return {
            success: true,
            data: response.data?.data,
            message: response.data?.message || 'Lấy dịch vụ hỗ trợ thành công',
        };
    } catch (error) {
        return {
            success: false,
            message: error.response?.data?.message || 'Lấy dịch vụ hỗ trợ thất bại',
        };
    }

    },

}

export default supporterServicesService;

