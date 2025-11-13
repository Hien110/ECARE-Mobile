// src/navigation/config.js

export const roleTabs = {
  elderly: [
    { key: 'doctor',     label: 'Bác Sĩ',  icon: 'medkit' },
    { key: 'plan',     label: 'Hỗ trợ',     icon: 'people' },
    { key: 'ElderHome',     label: 'Trang chủ', icon: 'home', center: true },
    { key: 'messages', label: 'Tin nhắn', icon: 'chatbubble' },
    { key: 'me',       label: 'Cá nhân',  icon: 'person' },
  ],
  family: [
    { key: 'planFamily',      label: 'Lịch',      icon: 'calendar' },
    { key: 'alerts',    label: 'Cảnh báo',  icon: 'warning' },
    { key: 'FamilyMemberHome',      label: 'Trang chủ', icon: 'home', center: true },
    { key: 'messages',  label: 'Tin nhắn',  icon: 'chatbubble' },
    { key: 'me',       label: 'Cá nhân',   icon: 'person' },
  ],
  supporter: [
    { key: 'tasks',    label: 'Công việc', icon: 'briefcase' },
    { key: 'planSupporter',     label: 'Lịch hẹn',      icon: 'calendar' },
    { key: 'SupporterHome',     label: 'Trang chủ', icon: 'home', center: true },
    { key: 'messages', label: 'Tin nhắn',  icon: 'chatbubble' },
    { key: 'me',       label: 'Cá nhân',   icon: 'person' },
  ],
  doctor: [
    { key: 'patients', label: 'Bệnh nhân', icon: 'people' },
    { key: 'calendar',     label: 'Lịch',      icon: 'calendar' },
    { key: 'DoctorHome',     label: 'Trang chủ', icon: 'home', center: true },
    { key: 'insights', label: 'Báo cáo',   icon: 'analytics' },
    { key: 'messages', label: 'Tin nhắn',  icon: 'chatbubble' },
  ],
};

// Thêm bất kỳ routes nào cần thiết cho điều hướng giữa các màn hình trong ứng dụng
export const routeMap = {
  ElderHome: 'ElderHome',
  FamilyMemberHome: 'FamilyMemberHome',
  SupporterHome: 'SupporterHome',
  DoctorHome: 'DoctorHome',
  DefaultScreen: 'DefaultScreen', // Mặc định nếu không tìm thấy key
  mood: 'MOOD',
  plan: 'SupporterBookingListScreen',
  planFamily: 'SupporterBookingListFamilyScreen',
  planSupporter: 'SupporterBookingListSupporterScreen',
  messages: 'MessagesList',
  me: 'PersonalInfo',
  dashboard: 'FamilyDashboard',
  alerts: 'ALERTS',
  tasks: 'SupporterIntro',
  patients: 'DOCTOR_PATIENTS',
  insights: 'DOCTOR_INSIGHTS',
  calendar: 'ProfileGate'
};
