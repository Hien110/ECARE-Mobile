import { Platform } from 'react-native';
import { BASE_URL } from './api/axiosConfig';

class AgoraService {
  constructor() {
    this.appId = null; // Sẽ được set từ config hoặc env
    this.currentChannel = null;
    this.currentToken = null;
  }

  /**
   * Khởi tạo Agora service với App ID
   * @param {string} appId - Agora App ID từ console.agora.io
   */
  initialize(appId) {
    this.appId = appId;
    console.log('✅ Agora Service initialized with App ID:', appId);
  }

  /**
   * Tạo channel name từ conversation ID
   * @param {string} conversationId 
   * @returns {string} Channel name
   */
  generateChannelName(conversationId) {
    // Agora channel name chỉ chấp nhận: a-z, A-Z, 0-9, !, #, $, %, &, (, ), +, -, :, ;, <, =, ., >, ?, @, [, ], ^, _, {, }, |, ~, ,
    // Độ dài tối đa 64 ký tự
    return `chat_${conversationId}`.substring(0, 64);
  }

  /**
   * Join video call channel
   * @param {string} conversationId 
   * @param {string} token - Agora token (optional, null cho testing)
   * @returns {Object} Channel info
   */
  async joinChannel(conversationId, token = null) {
    if (!this.appId) {
      throw new Error('Agora App ID chưa được khởi tạo. Gọi initialize() trước.');
    }

    const channelName = this.generateChannelName(conversationId);
    this.currentChannel = channelName;
    this.currentToken = token;

    console.log('📞 Joining Agora channel:', channelName);

    return {
      appId: this.appId,
      channelName,
      token,
    };
  }

  /**
   * Leave current channel
   */
  async leaveChannel() {
    if (this.currentChannel) {
      console.log('👋 Leaving Agora channel:', this.currentChannel);
      this.currentChannel = null;
      this.currentToken = null;
    }
  }

  /**
   * Get current channel info
   */
  getCurrentChannel() {
    return {
      channelName: this.currentChannel,
      token: this.currentToken,
      appId: this.appId,
    };
  }

  /**
   * Request Agora token from backend
   * @param {string} channelName 
   * @param {number} uid - User ID (optional, 0 for auto-assign)
   * @returns {Promise<Object>} Token data from backend
   */
  async requestToken(channelName, uid = 0) {
    try {
      console.log('🔑 Requesting token from backend...', { channelName, uid });

      const response = await fetch(`${BASE_URL}/agora/token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelName, uid })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to get token');
      }

      console.log('✅ Token received from backend:', {
        channelName: data.data.channelName,
        expiresIn: data.data.expiresIn,
        expiresAt: data.data.expiresAt
      });

      return data.data; // { token, appId, channelName, uid, expiresIn, expiresAt }
      
    } catch (error) {
      console.error('❌ Error requesting Agora token:', error);
      throw error;
    }
  }
}

export default new AgoraService();
