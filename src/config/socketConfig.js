// Mobile App Configuration
export const CONFIG = {
  // Development

  SOCKET_SERVER_URL: 'http://192.168.0.101:3000',
  API_BASE_URL: 'http://192.168.0.101:3000/api',

  // Production (uncomment when deploying)
  // SOCKET_SERVER_URL: 'https://your-api-domain.com',
  // API_BASE_URL: 'https://your-api-domain.com/api',
  
  // Socket.IO Options
  SOCKET_OPTIONS: {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  },
  
  // Real-time Features
  FEATURES: {
    TYPING_INDICATORS: true,
    MESSAGE_STATUS: true,
    AUTO_RECONNECT: true,
    OFFLINE_QUEUE: true,
    READ_RECEIPTS: true,
  }
};

export default CONFIG;
