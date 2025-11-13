import { api } from './api';

export const healthRecordService = {
  createRecord: async (payload) => {
    try {
      const res = await api.post('/health-records', payload);
      return { success: true, data: res.data?.data, message: res.data?.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  getToday: async () => {
    try {
      const res = await api.get('/health-records/today');
      return { success: true, data: res.data?.data, message: res.data?.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },

  listRecords: async (params = {}) => {
    try {
      const res = await api.get('/health-records', { params });
      return { success: true, data: res.data?.data, message: res.data?.message };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message };
    }
  },
  getElderlyHealthData: async (elderlyId, params = {}) => {
    try {
      const res = await api.get(`/health-records/health-monitoring/${elderlyId}`, { params })
      return { success: true, data: res.data?.data, message: res.data?.message }
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message }
    }
  },

  // Get family health monitoring data
  getFamilyHealthMonitoring: async (elderlyId, period = 'day') => {
    try {
      console.log('=== API CALL getFamilyHealthMonitoring ===');
      console.log('elderlyId:', elderlyId);
      console.log('period:', period);
      console.log('URL:', `/health-records/health-monitoring/${elderlyId}`);
      
      const res = await api.get(`/health-records/health-monitoring/${elderlyId}`, { 
        params: { period } 
      })
      
      console.log('API Response:', res.data);
      return { success: true, data: res.data?.data, message: res.data?.message }
    } catch (error) {
      console.error('API Error:', error.response?.data || error.message);
      return { success: false, message: error.response?.data?.message || error.message }
    }
  },

  // Get today's activities for elderly
  getTodayActivities: async (elderlyId) => {
    try {
      const res = await api.get(`/health-records/health-monitoring/${elderlyId}`, { 
        params: { period: 'day' } 
      })
      return { success: true, data: res.data?.data, message: res.data?.message }
    } catch (error) {
      return { success: false, message: error.response?.data?.message || error.message }
    }
  }
};
export default healthRecordService;



