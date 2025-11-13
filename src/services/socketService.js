import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config/socketConfig';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.messageQueue = [];
  }

  async connect() {
    try {
      // Luôn disconnect trước để đảm bảo kết nối mới hoàn toàn
      if (this.socket) {
        this.disconnect();
      }

      // Kiểm tra user đã đăng nhập chưa bằng userService
      const userService = require('./userService').userService;
      const userResponse = await userService.getUser();
      
      if (!userResponse || !userResponse.success || !userResponse.data) {
        console.error('❌ User not logged in');
        throw new Error('User must be logged in to use real-time features');
      }

      // Lấy token từ userService
      const token = await userService.getToken();
      console.log('🔑 Retrieved token:', token ? 'Token found' : 'No token');
      
      if (!token) {
        console.error('❌ No auth token found');
        throw new Error('Authentication token required. Please login again.');
      }

      // Debug: Decode token để kiểm tra (chỉ để debug, không dùng trong production)
      try {
        const base64Payload = token.split('.')[1];
        const payload = JSON.parse(atob(base64Payload));
        console.log('🔍 Token payload (debug):', {
          userId: payload.userId,
          phoneNumber: payload.phoneNumber,
          role: payload.role,
          exp: new Date(payload.exp * 1000)
        });
        
        // Kiểm tra token đã expired chưa
        if (payload.exp * 1000 < Date.now()) {
          console.error('❌ Token has expired');
          throw new Error('Token has expired. Please login again.');
        }
      } catch (decodeError) {
        console.error('⚠️ Could not decode token for debugging:', decodeError.message);
      }

      // Kết nối đến server - Lấy URL từ config
      const serverUrl = CONFIG.SOCKET_SERVER_URL;
      
      console.log('🔌 Connecting to:', serverUrl);
      console.log('👤 User:', userResponse.data.fullName || userResponse.data.phoneNumber);
      console.log('🔑 Using token for auth');
      
      this.socket = io(serverUrl, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      });

      this.setupEventHandlers();
      this.reconnectAttempts = 0;

      console.log('🔌 Attempting to connect to Socket.IO server...');

    } catch (error) {
      console.error('❌ Socket connection error:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected successfully');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Gửi các tin nhắn đang chờ
      this.flushMessageQueue();
      
      // Emit custom event
      this.emit('socket_connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.isConnected = false;
      this.emit('socket_disconnected', reason);
      
      // Auto reconnect if not intentional
      if (reason === 'io server disconnect') {
        this.reconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      this.isConnected = false;
      this.emit('socket_connect_error', error);
      this.reconnect();
    });

    // Message events
    this.socket.on('new_message', (data) => {
      console.log('📨 New message received:', data);
      this.emit('new_message', data);
    });

    this.socket.on('message_error', (data) => {
      console.error('❌ Message error:', data);
      this.emit('message_error', data);
    });

    this.socket.on('messages_read', (data) => {
      console.log('📖 Messages marked as read:', data);
      this.emit('messages_read', data);
    });

    // Typing events
    this.socket.on('user_typing', (data) => {
      console.log('⌨️ User typing:', data);
      this.emit('user_typing', data);
    });

    this.socket.on('user_stop_typing', (data) => {
      console.log('⏹️ User stopped typing:', data);
      this.emit('user_stop_typing', data);
    });

    // Conversation events
    this.socket.on('conversation_updated', (data) => {
      console.log('💬 Conversation updated:', data);
      this.emit('conversation_updated', data);
    });

    // SOS events
    this.socket.on('sos:new', (data) => {
      console.log('🆘 New SOS received:', data);
      this.emit('sos:new', data);
    });

    // Video call events
    this.socket.on('video_call_request', (data) => {
      console.log('📞 Incoming video call:', data);
      this.emit('video_call_request', data);
    });

    this.socket.on('video_call_accepted', (data) => {
      console.log('✅ Video call accepted:', data);
      this.emit('video_call_accepted', data);
    });

    this.socket.on('video_call_rejected', (data) => {
      console.log('Video call rejected:', data);
      this.emit('video_call_rejected', data);
    });

    this.socket.on('video_call_cancelled', (data) => {
      console.log('🚫 Video call cancelled:', data);
      this.emit('video_call_cancelled', data);
    });

    this.socket.on('video_call_ended', (data) => {
      console.log('👋 Video call ended:', data);
      this.emit('video_call_ended', data);
    });
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached');
      this.emit('socket_reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('❌ Reconnection failed:', error);
      });
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      console.log('👋 Disconnecting socket...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
      this.messageQueue = [];
      
      // Reset memory để đảm bảo kết nối mới hoàn toàn
      this.reconnectAttempts = 0;
    }
  }

  // Message methods
  sendMessage(conversationId, messageType, content) {
    const data = {
      conversationId,
      messageType,
      content
    };

    if (this.isConnected && this.socket) {
      console.log('📤 Sending message via socket:', data);
      this.socket.emit('send_message', data);
    } else {
      console.log('📦 Queueing message (socket not connected):', data);
      this.messageQueue.push({ event: 'send_message', data });
    }
  }

  markMessagesRead(conversationId, messageIds) {
    const data = {
      conversationId,
      messageIds
    };

    if (this.isConnected && this.socket) {
      this.socket.emit('mark_messages_read', data);
    }
  }

  // Conversation methods
  joinConversation(conversationId) {
    if (this.isConnected && this.socket) {
      console.log(`📱 Joining conversation: ${conversationId}`);
      this.socket.emit('join_conversation', conversationId);
    }
  }

  leaveConversation(conversationId) {
    if (this.isConnected && this.socket) {
      console.log(`📱 Leaving conversation: ${conversationId}`);
      this.socket.emit('leave_conversation', conversationId);
    }
  }

  // Typing methods
  startTyping(conversationId) {
    if (this.isConnected && this.socket) {
      this.socket.emit('typing_start', { conversationId });
    }
  }

  stopTyping(conversationId) {
    if (this.isConnected && this.socket) {
      this.socket.emit('typing_stop', { conversationId });
    }
  }

  // Video call methods
  requestVideoCall(data) {
    // data: { callId, conversationId, callerId, callerName, callerAvatar, calleeId }
    if (this.isConnected && this.socket) {
      console.log('📞 Requesting video call:', data);
      this.socket.emit('video_call_request', data);
    } else {
      console.error('❌ Socket not connected, cannot request video call');
    }
  }

  acceptVideoCall(data) {
    // data: { callId, conversationId, callerId }
    if (this.isConnected && this.socket) {
      console.log('✅ Accepting video call:', data);
      this.socket.emit('video_call_accepted', data);
    }
  }

  rejectVideoCall(data) {
    // data: { callId, conversationId, callerId }
    if (this.isConnected && this.socket) {
      console.log('❌ Rejecting video call:', data);
      this.socket.emit('video_call_rejected', data);
    }
  }

  cancelVideoCall(data) {
    // data: { callId, conversationId, calleeId }
    if (this.isConnected && this.socket) {
      console.log('🚫 Cancelling video call:', data);
      this.socket.emit('video_call_cancelled', data);
    } else {
      console.error('❌ Cannot cancel video call - socket not connected');
    }
  }

  endVideoCall(data) {
    // data: { callId, conversationId, otherUserId }
    if (this.isConnected && this.socket) {
      console.log('👋 Ending video call:', data);
      this.socket.emit('video_call_ended', data);
    } else {
      console.error('❌ Cannot end video call - socket not connected');
    }
  }

  // Event listener methods
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Utility methods
  flushMessageQueue() {
    if (this.messageQueue.length > 0) {
      console.log(`📤 Sending ${this.messageQueue.length} queued messages`);
      this.messageQueue.forEach(({ event, data }) => {
        this.socket.emit(event, data);
      });
      this.messageQueue = [];
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length
    };
  }

  // Singleton pattern
  static getInstance() {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }
}

export default SocketService.getInstance();
