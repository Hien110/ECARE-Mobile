/**
 * Generate a simple UUID v4
 * @returns {string} UUID string
 */
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Service quản lý trạng thái cuộc gọi video/audio
 */
class CallService {
  constructor() {
    this.currentCall = null;
    this.callState = 'idle'; // idle, calling, ringing, in-call, ended
    this.listeners = new Map();
    this.processedCalls = new Set(); // Track calls đã xử lý để tránh duplicate
  }

  /**
   * Kiểm tra xem call đã được xử lý chưa
   * @param {string} callId - ID của cuộc gọi
   * @returns {boolean} true nếu đã xử lý, false nếu chưa
   */
  hasProcessedCall(callId) {
    return this.processedCalls.has(callId);
  }

  /**
   * Đánh dấu call đã được xử lý
   * @param {string} callId - ID của cuộc gọi
   */
  markCallAsProcessed(callId) {
    this.processedCalls.add(callId);
    console.log(`✅ Call marked as processed: ${callId}`);
    
    // 🔧 IMPROVED: Tăng thời gian auto cleanup từ 5 phút lên 10 phút
    // để tránh re-process calls quá sớm
    setTimeout(() => {
      this.processedCalls.delete(callId);
      console.log(`🗑️  Call removed from processed set: ${callId}`);
    }, 10 * 60 * 1000); // 10 phút
  }

  /**
   * Tạo cuộc gọi mới (caller side)
   * @param {Object} params - { conversationId, otherParticipant, callType }
   * @returns {Object} Call object
   */
  createCall(params) {
    const { conversationId, otherParticipant, callType = 'video' } = params;

    const call = {
      callId: generateUUID(),
      conversationId,
      callType,
      caller: null, // Sẽ được set bởi user hiện tại
      callee: otherParticipant,
      status: 'calling', // calling, ringing, connected, ended
      startTime: new Date().toISOString(),
      endTime: null,
    };

    this.currentCall = call;
    this.callState = 'calling';
    
    this.emit('callCreated', call);

    return call;
  }

  /**
   * Nhận cuộc gọi (callee side)
   * @param {Object} callData - Dữ liệu cuộc gọi từ socket/notification
   */
  receiveCall(callData) {
    const { callId, caller, conversationId, callType } = callData;

    const call = {
      callId,
      conversationId,
      callType,
      caller,
      callee: null, // Sẽ được set bởi user hiện tại
      status: 'ringing',
      startTime: new Date().toISOString(),
      endTime: null,
    };

    this.currentCall = call;
    this.callState = 'ringing';

    this.emit('callReceived', call);

    return call;
  }

  /**
   * Chấp nhận cuộc gọi
   */
  acceptCall() {
    if (!this.currentCall) {
      return null;
    }

    this.currentCall.status = 'connected';
    this.callState = 'in-call';

    this.emit('callAccepted', this.currentCall);

    return this.currentCall;
  }

  /**
   * Từ chối cuộc gọi
   */
  rejectCall() {
    if (!this.currentCall) {
      return null;
    }

    const rejectedCall = { ...this.currentCall };
    this.currentCall.status = 'rejected';
    this.currentCall.endTime = new Date().toISOString();

    this.emit('callRejected', rejectedCall);

    this.clearCall();
    return rejectedCall;
  }

  /**
   * Hủy cuộc gọi (caller cancels before callee answers)
   */
  cancelCall() {
    if (!this.currentCall) {
      return null;
    }

    const cancelledCall = { ...this.currentCall };
    this.currentCall.status = 'cancelled';
    this.currentCall.endTime = new Date().toISOString();

    this.emit('callCancelled', cancelledCall);

    this.clearCall();
    return cancelledCall;
  }

  /**
   * Kết thúc cuộc gọi
   */
  endCall() {
    if (!this.currentCall) {
      return null;
    }

    const endedCall = { ...this.currentCall };
    this.currentCall.status = 'ended';
    this.currentCall.endTime = new Date().toISOString();

    this.emit('callEnded', endedCall);

    this.clearCall();
    return endedCall;
  }

  /**
   * Xóa thông tin cuộc gọi hiện tại
   */
  clearCall() {
    this.currentCall = null;
    this.callState = 'idle';
  }

  /**
   * Lấy thông tin cuộc gọi hiện tại
   */
  getCurrentCall() {
    return this.currentCall;
  }

  /**
   * Lấy trạng thái cuộc gọi
   */
  getCallState() {
    return this.callState;
  }

  /**
   * Kiểm tra có cuộc gọi đang hoạt động không
   */
  hasActiveCall() {
    return this.currentCall !== null && this.callState !== 'idle';
  }

  /**
   * Đăng ký lắng nghe sự kiện
   * @param {string} event - Tên sự kiện
   * @param {function} callback - Hàm callback
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Hủy đăng ký lắng nghe sự kiện
   * @param {string} event - Tên sự kiện
   * @param {function} callback - Hàm callback
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Phát sự kiện
   * @param {string} event - Tên sự kiện
   * @param {any} data - Dữ liệu
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in callback for event ${event}:`, error);
        }
      });
    }
  }

  /**
   * Reset toàn bộ service
   */
  reset() {
    this.clearCall();
    this.listeners.clear();
    console.log('🔄 CallService reset');
  }

  // Singleton pattern
  static getInstance() {
    if (!CallService.instance) {
      CallService.instance = new CallService();
    }
    return CallService.instance;
  }
}

export default CallService.getInstance();
