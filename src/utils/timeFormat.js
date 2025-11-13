export const formatTime = (dateString) => {
  if (!dateString) return '';
  
  const messageDate = new Date(dateString);
  const now = new Date();
  const diffInMs = now - messageDate;
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  // Nếu trong vòng 1 phút
  if (diffInMinutes < 1) {
    return 'Vừa xong';
  }
  
  // Nếu trong vòng 1 giờ
  if (diffInMinutes < 60) {
    return `${diffInMinutes} phút`;
  }
  
  // Nếu trong vòng 24 giờ
  if (diffInHours < 24) {
    return `${diffInHours} giờ`;
  }
  
  // Nếu trong vòng 7 ngày
  if (diffInDays < 7) {
    return `${diffInDays} ngày`;
  }
  
  // Nếu cùng năm, hiển thị ngày/tháng
  const currentYear = now.getFullYear();
  const messageYear = messageDate.getFullYear();
  
  if (currentYear === messageYear) {
    return messageDate.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit'
    });
  }
  
  // Nếu khác năm, hiển thị ngày/tháng/năm
  return messageDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatMessageTime = (dateString) => {
  if (!dateString) return '';
  
  const messageDate = new Date(dateString);
  const now = new Date();
  const isToday = messageDate.toDateString() === now.toDateString();
  
  if (isToday) {
    return messageDate.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } else {
    const diffInDays = Math.floor((now - messageDate) / (1000 * 60 * 60 * 24));
    if (diffInDays === 1) {
      return `Hôm qua ${messageDate.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })}`;
    } else if (diffInDays < 7) {
      const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      return `${dayNames[messageDate.getDay()]} ${messageDate.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })}`;
    } else {
      return messageDate.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  }
};

export const formatMessagePreview = (message, currentUserId) => {
  if (!message) return 'Chưa có tin nhắn';
  
  const isOwnMessage = message.sender?._id === currentUserId || message.sender === currentUserId;
  const senderName = isOwnMessage ? 'Bạn' : (message.sender?.fullName || 'Người khác');
  
  // Lấy nội dung tin nhắn từ content object
  let content = '';
  if (message.content) {
    if (typeof message.content === 'string') {
      content = message.content;
    } else if (message.content.text) {
      content = message.content.text;
    } else if (message.content.systemMessage) {
      return message.content.systemMessage; // System message không cần hiển thị người gửi
    } else if (message.content.fileUrl) {
      content = message.messageType === 'image' ? '📷 Hình ảnh' : '📎 Tệp đính kèm';
    } else {
      content = 'Tin nhắn';
    }
  } else {
    content = 'Tin nhắn';
  }
  
  // Cắt ngắn nội dung nếu quá dài
  if (content.length > 50) {
    content = content.substring(0, 47) + '...';
  }
  
  // Với system message, không hiển thị người gửi
  if (message.messageType === 'system') {
    return content;
  }
  
  return `${senderName}: ${content}`;
};
