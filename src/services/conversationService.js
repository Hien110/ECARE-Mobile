import { api } from './api';

export const conversationService = {
    // Lấy tất cả cuộc trò chuyện theo userId
    getAllConversationsByUserId: async (userId) => {
    try {
      const response = await api.get(`/conversations/${userId}`);
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
  getMessagesByConversationId: async (conversationId) => {
    try {
      const response = await api.get(`/conversations/messages/${conversationId}`);
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
  sendMessage: async (conversationId, senderId, messageType, content) => {
    try {
      const response = await api.post('/conversations/message', {
        conversationId,
        senderId,
        messageType,
        content
      });
      
      return {
        success: true,
        data: response.data.data, // Tin nhắn thực tế
        message: response.data.message, // Thông báo từ backend
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  },

  // Lấy cuộc trò chuyện giữa hai người tham gia
  getConversationByParticipants: async (userAId, userBId) => {
    try {
      const response = await api.post('/conversations/conversationByParticipants', {
        userAId,
        userBId
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
  // Xóa cuộc trò chuyện và tin nhắn
  deleteConversationAndMessages: async (conversationId) => {
    console.log(conversationId);
    
    try {
      const response = await api.delete(`/conversations/delete/${conversationId}`);
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
  
};
export default conversationService;
