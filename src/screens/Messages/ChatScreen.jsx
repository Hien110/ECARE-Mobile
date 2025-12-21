import React, { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Alert, StatusBar } from "react-native"
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { conversationService } from '../../services/conversationService';
import { userService } from '../../services/userService';
import socketService from '../../services/socketService';
import CallService from '../../services/CallService';
import { formatMessageTime } from '../../utils/timeFormat';
import { SafeAreaView } from 'react-native-safe-area-context';

const ChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef()
  const textInputRef = useRef()

  // Lấy params từ navigation
  const { conversationId, otherParticipant } = route.params || {};

  const [currentUser, setCurrentUser] = useState(null)

  console.log('ChatScreen params:', { conversationId, otherParticipant });

  const renderMessage = (msg, index) => {
    // Tạo key duy nhất bằng cách kết hợp id và index
    const uniqueKey = `${msg.id || index}-${index}`;
    
    if (msg.type === "system") {
      return (
        <View key={uniqueKey} style={styles.systemMessage}>
          <Text style={styles.systemMessageText}>{msg.text}</Text>
        </View>
      )
    }

    // Lấy thông tin người gửi cho tin nhắn received
    const senderInfo = msg.raw?.sender || {};
    const senderName = senderInfo.fullName || otherParticipant?.user?.fullName || otherParticipant?.fullName || 'Unknown';
    const senderAvatar = senderInfo.avatar || otherParticipant?.user?.avatar || '';
    const avatarLetter = senderName.charAt(0).toUpperCase();

    return (
      <View
        key={uniqueKey}
        style={[styles.messageContainer, msg.type === "sent" ? styles.sentContainer : styles.receivedContainer]}
      >
        {msg.type === "received" && (
          <View style={styles.avatar}>
            {senderAvatar ? (
              <Image 
                source={{ uri: senderAvatar }} 
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            )}
          </View>
        )}
        
        <View style={styles.messageContent}>
          {msg.type === "received" && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          
          <View style={[styles.messageBubble, msg.type === "sent" ? styles.sentBubble : styles.receivedBubble]}>
            <Text style={[styles.messageText, msg.type === "sent" ? styles.sentText : styles.receivedText]}>
              {msg.text}
            </Text>
            {msg.status === 'failed' && msg.type === 'sent' && (
              <TouchableOpacity 
                style={styles.retryButton} 
                onPress={() => retryMessage(msg.id)}
              >
                <Text style={styles.retryText}>Thử lại</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={[styles.timeContainer, msg.type === "sent" ? styles.sentTimeContainer : styles.receivedTimeContainer]}>
            <Text style={styles.timeText}>{msg.time}</Text>
            {msg.type === "sent" && (
              <View style={styles.messageStatus}>
                {msg.status === 'sending' && <ActivityIndicator size="small" color="#999" />}
                {msg.status === 'sent' && <Text style={styles.readReceipt}>✓</Text>}
                {msg.status === 'delivered' && <Text style={styles.readReceipt}>✓✓</Text>}
                {msg.status === 'failed' && <Text style={styles.failedReceipt}>⚠</Text>}
              </View>
            )}
          </View>
        </View>
      </View>
    )
  }
  // Fetch messages on mount
  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const userResponse = await userService.getUser()
        if (!userResponse.success) {
          setError('Không thể lấy thông tin người dùng')
          return
        }
        setCurrentUser(userResponse.data)

        if (!conversationId) return
        const resp = await conversationService.getMessagesByConversationId(conversationId)
        if (resp.success) {
          // resp.data is the raw API response; messages likely in resp.data.data
          const msgs = (resp.data && resp.data.data) ? resp.data.data : (resp.data || [])
          // map to UI shape
          const mapped = msgs.map((m, index) => {
            const senderId = m.sender?._id || m.sender || m.senderId
            const isSent = senderId && userResponse.data && (senderId === userResponse.data._id || senderId === userResponse.data.id)
            return {
              id: m._id || m.id || `loaded-${index}-${Date.now()}`,
              type: m.messageType === 'system' ? 'system' : (isSent ? 'sent' : 'received'),
              text: m.contentText || m.content?.text || m.content?.systemMessage || m.content || '',
              time: formatMessageTime(m.createdAt),
              status: isSent ? 'delivered' : undefined,
              raw: m,
            }
          })
          if (mounted) setMessages([{ id: `system-info-${Date.now()}`, type: 'system', text: 'Cuộc trò chuyện đã được mã hóa đầu cuối để bảo vệ quyền riêng tư' }, ...mapped])
        } else {
          setError(resp.message || 'Không thể tải tin nhắn')
        }
      } catch (err) {
        setError(err.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [conversationId])

  // Join/leave conversation khi vào/thoát chat, không connect lại socket
  useEffect(() => {
    if (currentUser && conversationId) {
      socketService.joinConversation(conversationId);
    }
  }, [conversationId, currentUser]);

  // Listen for new messages via Socket.IO
  useEffect(() => {
    const handleNewMessage = (data) => {
      console.log('📨 Received new message via socket:', data);
      
      const message = data.message;
      const senderId = message.sender?._id || message.sender;
      const currentUserId = currentUser?._id || currentUser?.id;
      
      // Debug log để kiểm tra ID matching
      console.log('🔍 ID comparison:', {
        senderId,
        currentUserId,
        messageId: message._id,
        isFromCurrentUser: senderId && currentUserId && (senderId.toString() === currentUserId.toString())
      });
      
      const isFromCurrentUser = senderId && currentUserId && (senderId.toString() === currentUserId.toString());
      
      // Chỉ thêm tin nhắn từ người khác, tin nhắn của mình đã được thêm optimistically
      if (!isFromCurrentUser) {
        const newMsg = {
          id: message._id || `received-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'received',
          text: message.content?.text || message.contentText || '',
          time: formatMessageTime(message.createdAt),
          raw: message,
        };

        setMessages(prev => [...prev, newMsg]);
      } else {
        // Nếu là tin nhắn của current user, có thể cập nhật message ID từ temp sang real ID
        console.log('📤 Message from current user, checking for optimistic update replacement');
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          // Kiểm tra xem tin nhắn cuối có phải là optimistic message cần thay thế không
          if (lastMessage && 
              lastMessage.type === 'sent' && 
              lastMessage.text === (message.content?.text || message.contentText) &&
              lastMessage.id.startsWith('tmp-')) {
            
            console.log('🔄 Replacing optimistic message with real message');
            return prev.map((msg, index) => 
              index === prev.length - 1 ? {
                ...msg,
                id: message._id || msg.id,
                status: 'delivered',
                raw: message
              } : msg
            );
          }
          return prev;
        });
      }
    };

    const handleMessageError = (data) => {
      console.error('❌ Message error from socket:', data);
      setError(data.error || 'Có lỗi xảy ra khi gửi tin nhắn');
    };

    const handleSocketConnected = () => {
      console.log('✅ Socket connected');
      setError(null); // Clear any connection errors
    };

    const handleSocketDisconnected = () => {
      console.log('❌ Socket disconnected');
      setError('Mất kết nối real-time. Đang cố gắng kết nối lại...');
    };

    // Register event listeners
    socketService.on('new_message', handleNewMessage);
    socketService.on('message_error', handleMessageError);
    socketService.on('socket_connected', handleSocketConnected);
    socketService.on('socket_disconnected', handleSocketDisconnected);

    // Cleanup
    return () => {
      socketService.off('new_message', handleNewMessage);
      socketService.off('message_error', handleMessageError);
      socketService.off('socket_connected', handleSocketConnected);
      socketService.off('socket_disconnected', handleSocketDisconnected);
    };
  }, [currentUser]);

  // Scroll to bottom when messages loaded or changed
  useEffect(() => {
    if (!loading && messages.length > 0 && scrollRef.current) {
      setTimeout(() => {
        try {
          scrollRef.current.scrollToEnd({ animated: true });
        } catch (e) {}
      }, 100); // delay nhỏ để đảm bảo render xong
    }
  }, [loading, messages]);

  const handleSend = async () => {
    if (!message.trim() || sending) return
    
    // Kiểm tra thông tin người dùng
    if (!currentUser) {
      const u = await userService.getUser()
      if (!u.success) { 
        setError('Không có thông tin người gửi')
        return 
      }
      setCurrentUser(u.data)
    }

    // Validation
    if (!conversationId) {
      setError('Không có thông tin cuộc trò chuyện')
      return
    }

    const senderId = currentUser._id || currentUser.id
    if (!senderId) {
      setError('Không có thông tin người gửi')
      return
    }

    const messageText = message.trim()
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const newMsg = {
      id: tempId,
      type: 'sent',
      text: messageText,
      time: formatMessageTime(new Date()),
      status: 'sending'
    }

    // Optimistic update - thêm tin nhắn ngay lập tức
    setMessages(prev => [...prev, newMsg])
    setMessage('')
    setSending(true)

    try {
      console.log('Sending message via socket:', { conversationId, messageText });
      
      // Gửi qua Socket.IO trước
      socketService.sendMessage(conversationId, 'text', messageText);
      
      // Cập nhật trạng thái tin nhắn
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, status: 'sent' } : m
      ));

      // Tạo mock message cho optimistic update của conversation list
      const mockMessage = {
        _id: tempId,
        content: { text: messageText },
        contentText: messageText,
        messageType: 'text',
        sender: {
          _id: senderId,
          fullName: currentUser.fullName,
          avatar: currentUser.avatar
        },
        createdAt: new Date().toISOString(),
        conversation: conversationId
      };

      // Emit local event cho MessagesListScreen (optimistic update)
      socketService.emit('conversation_updated', {
        conversationId,
        latestMessage: mockMessage,
        updatedAt: new Date().toISOString()
      });

      // Fallback: gửi qua HTTP API nếu socket không khả dụng
      if (!socketService.getConnectionStatus().isConnected) {
        console.log('Socket not connected, using HTTP fallback');
        const resp = await conversationService.sendMessage(conversationId, senderId, 'text', messageText)
        
        if (resp.success) {
          const savedMessage = resp.data
          setMessages(prev => prev.map(m => 
            m.id === tempId ? {
              ...m,
              id: savedMessage._id || savedMessage.id || tempId,
              status: 'delivered',
              raw: savedMessage
            } : m
          ))
        } else {
          throw new Error(resp.message || 'Gửi tin nhắn thất bại')
        }
      }
        
      // Clear error nếu có
      if (error) setError(null)

    } catch (err) {
      // Đánh dấu tin nhắn thất bại
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, status: 'failed' } : m
      ))
      setError(err.message || 'Có lỗi xảy ra khi gửi tin nhắn')
    } finally {
      setSending(false)
    }
  }

  // Hàm retry gửi tin nhắn thất bại
  const retryMessage = async (messageId) => {
    const messageToRetry = messages.find(m => m.id === messageId)
    if (!messageToRetry || messageToRetry.status !== 'failed') return

    // Cập nhật trạng thái thành đang gửi
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, status: 'sending' } : m
    ))

    try {
      const senderId = currentUser._id || currentUser.id
      const resp = await conversationService.sendMessage(conversationId, senderId, 'text', messageToRetry.text)
      
      if (resp.success) {
        const savedMessage = resp.data // resp.data đã là tin nhắn từ backend
        setMessages(prev => prev.map(m => 
          m.id === messageId ? {
            ...m,
            id: savedMessage._id || savedMessage.id || messageId,
            status: 'delivered',
            raw: savedMessage
          } : m
        ))
        setError(null)
      } else {
        setMessages(prev => prev.map(m => 
          m.id === messageId ? { ...m, status: 'failed' } : m
        ))
        setError(resp.message || 'Gửi lại tin nhắn thất bại')
      }
    } catch (err) {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, status: 'failed' } : m
      ))
      setError(err.message || 'Có lỗi xảy ra khi gửi lại tin nhắn')
    }
  }

  // Xử lý gọi video call
  const handleVideoCall = async () => {
    try {
      // Kiểm tra socket đã kết nối chưa
      if (!socketService.isConnected) {
        Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi. Vui lòng kiểm tra kết nối.');
        return;
      }

      // Lấy thông tin người gọi
      if (!currentUser) {
        const u = await userService.getUser();
        if (!u.success) {
          Alert.alert('Lỗi', 'Không thể lấy thông tin người dùng');
          return;
        }
        setCurrentUser(u.data);
      }

      const caller = currentUser || (await userService.getUser()).data;
      const callee = otherParticipant?.user || otherParticipant;

      // Tạo cuộc gọi mới
      const call = CallService.createCall({
        conversationId,
        otherParticipant: callee,
        callType: 'video'
      });

      console.log('📞 Initiating video call:', call);

      // Emit socket event để gọi
      socketService.requestVideoCall({
        callId: call.callId,
        conversationId,
        callerId: caller._id || caller.id,
        callerName: caller.fullName,
        callerAvatar: caller.avatar,
        calleeId: callee._id || callee.id,
        callType: 'video'
      });

      // Navigate đến VideoCallScreen (waiting screen)
      navigation.navigate('VideoCall', {
        callId: call.callId,
        conversationId,
        otherParticipant: callee,
        isIncoming: false, // Người gọi
      });

    } catch (error) {
      console.error('❌ Error initiating video call:', error);
      Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi. Vui lòng thử lại.');
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#2196F3" barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            navigation.goBack();
          }}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Text style={styles.headerTitle}>
            {otherParticipant?.user?.fullName || otherParticipant?.fullName || 'Cuộc trò chuyện'}
          </Text>
          <TouchableOpacity
            style={{ marginLeft: 8 }}
            onPress={handleVideoCall}
            activeOpacity={0.7}
          >
            <Icon name="videocam" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.dismissButton} 
            onPress={() => setError(null)}
          >
            <Icon name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={{ paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="message" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Chưa có tin nhắn nào</Text>
              <Text style={styles.emptySubText}>Hãy bắt đầu cuộc trò chuyện!</Text>
            </View>
          ) : (
            messages.map((msg, index) => renderMessage(msg, index))
          )}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.attachButton}>
              <Text style={styles.attachIcon}>📎</Text>
            </TouchableOpacity>

            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor="#999"
              value={message}
              onChangeText={setMessage}
              multiline
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />

              <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending} activeOpacity={0.8}>
                {sending ? <ActivityIndicator color="white" /> : <Text style={styles.sendIcon}>➤</Text>}
              </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: hp('0.2%') },
    shadowOpacity: 0.1,
    shadowRadius: wp('1%'),
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: wp('4%'),
    padding: wp('2%'),
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    color: 'white',
    fontSize: wp('5%'),
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: wp('12%'), // Để tránh overlap với back button
    flex: 1,
  },
  errorContainer: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    margin: wp('2%'),
    borderRadius: wp('2%'),
  },
  errorText: {
    color: 'white',
    fontSize: wp('3.5%'),
    flex: 1,
  },
  dismissButton: {
    padding: wp('1%'),
    marginLeft: wp('2%'),
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp('10%'),
  },
  loadingText: {
    marginTop: hp('1%'),
    fontSize: wp('4%'),
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp('10%'),
  },
  emptyText: {
    fontSize: wp('4.5%'),
    color: '#666',
    marginTop: hp('2%'),
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: wp('3.5%'),
    color: '#999',
    marginTop: hp('1%'),
    textAlign: 'center',
  },
  systemMessage: {
    alignItems: "center",
    marginVertical: hp('2%'),
  },
  systemMessageText: {
    backgroundColor: "#E0E0E0",
    color: "#666",
    fontSize: wp('3%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    borderRadius: wp('4%'),
    textAlign: "center",
    maxWidth: "80%",
  },
  messageContainer: {
    flexDirection: "row",
    marginVertical: hp('0.5%'),
    alignItems: "flex-end",
  },
  sentContainer: {
    justifyContent: "flex-end",
  },
  receivedContainer: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: wp('8%'),
    height: wp('8%'),
    borderRadius: wp('4%'),
    backgroundColor: "#FFCDD2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: wp('2%'),
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: wp('4%'),
  },
  avatarText: {
    color: "#E57373",
    fontSize: wp('3.5%'),
    fontWeight: "bold",
  },
  messageContent: {
    maxWidth: "70%",
  },
  senderName: {
    fontSize: wp('3%'),
    color: "#666",
    marginBottom: hp('0.2%'),
    marginLeft: wp('1%'),
  },
  messageBubble: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    borderRadius: wp('4.5%'),
  },
  sentBubble: {
    backgroundColor: "#2196F3",
    borderBottomRightRadius: wp('1%'),
  },
  receivedBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: wp('1%'),
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messageText: {
    fontSize: wp('4%'),
    lineHeight: hp('2.5%'),
  },
  sentText: {
    color: "white",
  },
  receivedText: {
    color: "#333",
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: hp('0.5%'),
  },
  sentTimeContainer: {
    justifyContent: "flex-end",
  },
  receivedTimeContainer: {
    justifyContent: "flex-start",
    marginLeft: wp('1%'),
  },
  timeText: {
    fontSize: wp('2.5%'),
    color: "#999",
  },
  messageStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: wp('1%'),
  },
  readReceipt: {
    fontSize: wp('2.5%'),
    color: "#4CAF50",
    marginLeft: wp('1%'),
  },
  failedReceipt: {
    fontSize: wp('2.5%'),
    color: "#f44336",
    marginLeft: wp('1%'),
  },
  retryButton: {
    marginTop: hp('0.5%'),
    paddingVertical: hp('0.3%'),
    paddingHorizontal: wp('2%'),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: wp('1%'),
    alignSelf: 'flex-end',
  },
  retryText: {
    fontSize: wp('3%'),
    color: 'white',
    fontWeight: '500',
  },
  inputContainer: {
    backgroundColor: "white",
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -hp('0.3%') },
    shadowOpacity: 0.1,
    shadowRadius: wp('1%'),
    zIndex: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: hp('1.5%'),
  },
  attachButton: {
    padding: wp('2%'),
    marginRight: wp('2%'),
  },
  attachIcon: {
    fontSize: wp('5%'),
    color: "#666",
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: wp('5%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    fontSize: wp('4%'),
    maxHeight: hp('13%'),
    marginRight: wp('2%'),
  },
  emojiButton: {
    padding: wp('2%'),
    marginRight: wp('2%'),
  },
  emojiIcon: {
    fontSize: wp('5%'),
  },
  sendButton: {
    backgroundColor: "#2196F3",
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
    justifyContent: "center",
    alignItems: "center",
  },
  sendIcon: {
    color: "white",
    fontSize: wp('4.5%'),
    fontWeight: "bold",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  quickAction: {
    alignItems: "center",
  },
  quickActionIcon: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: hp('0.5%'),
  },
  quickActionEmoji: {
    fontSize: wp('5%'),
  },
  quickActionText: {
    fontSize: wp('3%'),
    color: "#666",
  },
})

export default ChatScreen
