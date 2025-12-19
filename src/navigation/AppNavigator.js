import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NotificationService from '../services/NotificationService';
import socketService from '../services/socketService';
import CallService from '../services/CallService';
import userService from '../services/userService';

import ElderHomeScreen from '../screens/Site/ElderHomeScreen';
import RegistersScreen from '../screens/Auth/RegistersScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';
import LoginScreen from '../screens/Auth/LoginScreen';
import ResetPasswordScreen from '../screens/Auth/ResetPasswordScreen';
import VerifySMSScreen from '../screens/Auth/VerifySMSScreen';
import ChangePasswordScreen from '../screens/Profile/ChangePasswordScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen.jsx';
import SuccessScreen from '../screens/Site/SuccessScreen';
import PersonalInfoScreen from '../screens/Profile/PersonalInfoScreen.jsx';
import FamilyMemberHomeScreen from '../screens/Site/FamilyHomeScreen.jsx';
import FamilyDetailScreen from '../screens/Connect-family/FamilyDetailScreen.jsx';
import SupportStaffDetailScreen from '../screens/Staff/SupportStaffDetailScreen.jsx';
import SupporterHomeScreen from '../screens/Site/SupporterHomeScreen';
import DefaultScreen from '../screens/Error/DefaultScreen';
import ChangePhonenumberScreen from '../screens/Auth/ChangePhonenumberScreen.jsx';
import OtPChangePhoneScreen from '../screens/Auth/OTPChangePhoneScreen.jsx';
import ChangeEmailScreen from '../screens/Auth/ChangeEmailScreen.jsx';
import OTPChangeEmailScreen from '../screens/Auth/OTPChangeEmailScreen.jsx';
import FindPeopleScreen from '../screens/Connect-family/FindPeopleScreen';
import FamilyConnectionScreen from '../screens/Connect-family/FamilyConnectionScreen';
import FamilyConnectionListScreen from '../screens/Connect-family/FamilyConnectionListScreen';
import FamilyList_FamilyScreen from '../screens/Connect-family/FamilyList_FamilyScreen';
import MessagesListScreen from '../screens/Messages/MessagesListScreen';
import ChatScreen from '../screens/Messages/ChatScreen.jsx';
import VideoCallScreen from '../screens/VideoCall/VideoCallScreen.jsx';
import IncomingCallScreen from '../screens/VideoCall/IncomingCallScreen.jsx';
import SOSCallScreen from '../screens/SOS/SOSCallScreen.jsx'; // 🆕 SOS Call Screen
import CreateIntroductionScreen from '../screens/Supporter/CreateIntroductionProfileScreen.jsx';
import ViewIntroductionScreen from '../screens/Supporter/ViewIntroductionProfileScreen.jsx';
import SupporterIntroGate from '../screens/Supporter/SupporterIntroGate.jsx';
import EditIntroductionScreen from '../screens/Supporter/EditIntroductionProfileScreen.jsx';
import HealthScreen from '../screens/HealthRecord/HealthScreen.jsx';
import FamilyHealthMonitoringScreen from '../screens/HealthRecord/FamilyHealthMonitoringScreen.jsx';
import SupportFinderScreen from '../screens/Search-Supporter/SupportFinderScreen.jsx';
import SupporterProfileScreen from '../screens/Search-Supporter/SupporterProfileScreen.jsx';
import AddressPickerScreen from '../screens/Profile/AddressPickerScreen.jsx';
import BankAccountScreen from '../screens/Profile/BankAccountScreen.jsx';
import IntroductionCreateDoctorProfileScreen from '../screens/Doctor/IntroductionCreateDoctorProfileScreen.jsx';
import CreateDoctorProfileScreen from '../screens/Doctor/CreateDoctorProfileScreen.jsx';
import ViewDoctorProfileScreen from '../screens/Doctor/ViewDoctorProfileScreen.jsx';
import EditDoctorProfileScreen from '../screens/Doctor/EditDoctorProfileScreen.jsx';
import CreateWorkScheduleScreen from '../screens/Doctor/CreateWorkScheduleScreen.jsx';
import EvaluationStatisticsScreen from '../screens/Doctor/EvaluationStatisticsScreen.jsx';
import ProfileGateScreen from '../screens/Doctor/ProfileGateScreen.jsx';
import DoctorHomeScreen from '../screens/Site/DoctorHomeScreen.jsx';
import ProfileDoctorScreen from '../screens/Doctor/ProfileScreen.jsx';
import ScheduleScreen from '../screens/Doctor/ScheduleScreen.jsx';
import ReviewsScreen from '../screens/Doctor/ReviewsScreen.jsx';
import ConsulationSummaryScreen from '../screens/Doctor/ConsulationSummaryScreen.jsx';
import ListSumaryScreen from '../screens/Doctor/ListSumaryScreen.jsx';


import SupporterBookingListFamilyScreen from '../screens/SupporterService/SupporterBookingListFamilyScreen.jsx';
import BookingDetailWithFooter from './BookingDetailWithFooter.js'
import BookingListWithFooter from './BookingListWithFooter.js'
import SupporterBookingListSupporterScreen from '../screens/SupporterService/SupporterBookingListSupporterScreen.jsx';
import SupporterBookingScreen from '../screens/SupporterService/SuppporterBookingScreen.jsx';
import ServiceSelectionScreen from '../screens/SupporterService/ServiceSelectionScreen.jsx';
import PaymentBookingScreen from '../screens/SupporterService/PaymentBookingScreen.jsx';

import FamilyListFunctionScreen from '../screens/Connect-family/FamilyListFunctionScreen.jsx';
import SOSDetailScreen from '../screens/SOS/SOSDetailScreen.jsx';
import ChatWithAIScreen from '../screens/Chat-AI/ChatWithAI.jsx';
import IntroductionBookingDoctorScreen from '../screens/DoctorService/IntroductionBookingDoctor.jsx';
import DoctorListBookScreen from '../screens/DoctorService/DoctorListBookScreen.jsx';
import DoctorScheduleSelectScreen from '../screens/DoctorService/DoctorScheduleSelectScreen.jsx';
import PaymentServiceScreen from '../screens/DoctorService/PaymentServiceScreen.jsx';
import DoctorBookingHistoryScreen from '../screens/DoctorService/DoctorBookingHistoryScreen.jsx';
import DoctorConsultationDetailScreen from '../screens/DoctorService/DoctorConsultationDetailScreen.jsx';
import DoctorMyBookingListScreen from '../screens/DoctorService/DoctorMyBookingListScreen.jsx';
import ProfileSupporterScreen from '../screens/SupporterService/ProfileSupporterScreen.jsx';
// HOC footer
import withFooter from '../components/withFooter';
 
const Stack = createStackNavigator();

// Component wrapper để sử dụng hooks INSIDE NavigationContainer
const NavigationContent = ({ initialRouteName }) => {
  const navigation = useNavigation();
  const appState = useRef(AppState.currentState);
  const listenersRegistered = useRef(false);
  
  useEffect(() => {
    console.log('🎬 [AppNavigator] useEffect triggered');
    console.log('🔌 [AppNavigator] Socket status:', {
      isConnected: socketService.isConnected,
      socketExists: !!socketService.socket
    });
    
    // 🔧 FIX: Đăng ký listeners và RE-REGISTER mỗi khi navigation hoặc socket state thay đổi
    const setupListeners = () => {
      console.log('📝 [AppNavigator] Setting up socket listeners...');
      console.log('🔌 Socket connected:', socketService.isConnected);
      
      // Đăng ký listener cho incoming video call
      const handleIncomingCall = (data) => {
        // CHỈ xử lý khi app đang ở FOREGROUND (active)
        if (appState.current !== 'active') {
          console.log('⚠️ App not active, skipping call');
          return;
        }
        
        const { callId, conversationId, caller, callType } = data;
        console.log('📞 [AppNavigator] Incoming video call:', { callId, caller: caller?.fullName });

        // Check if this call has been processed
        if (CallService.hasProcessedCall(callId)) {
          console.log('⚠️ Call already processed, ignoring:', callId);
          return;
        }

        // Mark as processed
        CallService.markCallAsProcessed(callId);

        // Lưu thông tin cuộc gọi vào CallService
        CallService.receiveCall({
          callId,
          conversationId,
          caller,
          callType: callType || 'video'
        });

        // Navigate đến IncomingCallScreen
        navigation.navigate('IncomingCall', {
          callId,
          caller,
          conversationId,
          callType: callType || 'video',
        });
      };
      
      // Đăng ký listener cho incoming SOS
      const handleIncomingSOS = (data) => {
        // CHỈ xử lý khi app đang ở FOREGROUND (active)
        if (appState.current !== 'active') {
          return;
        }
        
        const { _id, requester, location, message } = data;
        
        // Navigate đến SOSDetail screen
        navigation.navigate('SOSDetail', {
          sosId: _id,
          requesterName: requester?.fullName || 'Không rõ',
          requesterAvatar: requester?.avatar || '',
          address: location?.address || 'Không rõ vị trí',
          latitude: location?.coordinates?.latitude || null,
          longitude: location?.coordinates?.longitude || null,
          message: message || '',
        });
      };

      // 🆕 Đăng ký listener cho incoming SOS Call
      const handleIncomingSOSCall = (data) => {
        // CHỈ xử lý khi app đang ở FOREGROUND (active)
        if (appState.current !== 'active') {
          return;
        }
        
        const { sosId, callId, requester, recipientIndex, totalRecipients } = data;

        // Check if this call has been processed
        if (CallService.hasProcessedCall(callId)) {
          console.log('⚠️ SOS call already processed, ignoring:', callId);
          return;
        }

        // Mark as processed
        CallService.markCallAsProcessed(callId);

        // Navigate đến SOSCallScreen
        navigation.navigate('SOSCall', {
          sosId,
          callId,
          requester: {
            _id: requester._id,
            fullName: requester.fullName,
            avatar: requester.avatar,
            phoneNumber: requester.phoneNumber,
          },
          recipientIndex: recipientIndex || 1,
          totalRecipients: totalRecipients || 1,
        });
      };

      // 🆕 Đăng ký listener khi SOS call được chấp nhận (cho requester/elderly)
      const handleSOSCallAnswered = (data) => {
        // CHỈ xử lý khi app đang ở FOREGROUND (active)
        if (appState.current !== 'active') {
          return;
        }
        
        const { sosId, callId, recipient } = data;

        console.log('✅ SOS call answered, navigating to VideoCall:', {
          sosId,
          callId,
          recipientName: recipient?.fullName,
        });

        // Navigate elderly đến VideoCallScreen
        navigation.navigate('VideoCall', {
          callId,
          conversationId: null, // SOS call không cần conversation
          otherParticipant: recipient,
          isIncoming: false, // Elderly là người gọi
          isSOSCall: true,
          sosId,
        });
      };
      
      // 🔧 CRITICAL: Cleanup listeners cũ trước khi đăng ký mới để tránh duplicate
      console.log('🧹 [AppNavigator] Removing old listeners...');
      socketService.off('video_call_request', handleIncomingCall);
      socketService.off('sos:new', handleIncomingSOS);
      socketService.off('sos_call_request', handleIncomingSOSCall);
      socketService.off('sos_call_answered', handleSOSCallAnswered);
      
      // Đăng ký listener mới
      console.log('➕ [AppNavigator] Registering new listeners...');
      socketService.on('video_call_request', handleIncomingCall);
      socketService.on('sos:new', handleIncomingSOS);
      socketService.on('sos_call_request', handleIncomingSOSCall);
      socketService.on('sos_call_answered', handleSOSCallAnswered);
      
      listenersRegistered.current = true;
      console.log('✅ [AppNavigator] Socket listeners registered successfully');
      console.log('📊 [AppNavigator] Listener count check after registration...');
      
      // Return cleanup function
      return () => {
        console.log('🗑️  Cleaning up AppNavigator socket listeners...');
        socketService.off('video_call_request', handleIncomingCall);
        socketService.off('sos:new', handleIncomingSOS);
        socketService.off('sos_call_request', handleIncomingSOSCall);
        socketService.off('sos_call_answered', handleSOSCallAnswered);
        listenersRegistered.current = false;
      };
    };
    
    // 🔧 CRITICAL: Lưu setupListeners vào global để có thể gọi từ LoginScreen
    globalSetupListeners = () => {
      console.log('🔥 [Global] Re-setting up listeners via global function...');
      if (cleanup) cleanup();
      cleanup = setupListeners();
    };
    
    // Setup listeners lần đầu
    let cleanup = setupListeners();
    
    // 🔧 CRITICAL FIX: Đợi socket.io listeners được đăng ký xong
    // Socket có thể đã connected nhưng internal listeners chưa được setup
    // Re-setup sau 200ms để đảm bảo
    setTimeout(() => {
      console.log('⚡ [Delayed re-check] Re-setting up listeners after component mount...');
      if (cleanup) cleanup();
      cleanup = setupListeners();
    }, 200);
    
    // 🔧 IMMEDIATE CHECK: Kiểm tra ngay xem socket đã connected chưa
    // Nếu đã connected thì re-setup để đảm bảo listeners được đăng ký đúng
    setTimeout(() => {
      if (socketService.isConnected) {
        console.log('⚡ [Immediate] Socket already connected, re-setting up listeners...');
        if (cleanup) cleanup();
        cleanup = setupListeners();
      }
    }, 100); // Chỉ đợi 100ms
    
    // 🔧 POLLING: Tiếp tục check định kỳ để catch trường hợp socket connect muộn
    const pollInterval = setInterval(() => {
      // Nếu socket connected NHƯNG listeners chưa được đăng ký
      if (socketService.isConnected && !listenersRegistered.current) {
        console.log('🔄 [Poll] Socket connected but listeners not registered, setting up...');
        if (cleanup) cleanup();
        cleanup = setupListeners();
      }
    }, 1000); // Check mỗi giây
    
    // Theo dõi AppState để biết app foreground/background
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      console.log(`📱 AppState changed: ${appState.current} → ${nextAppState}`);
      appState.current = nextAppState;
    });
    
    // Cleanup khi unmount
    return () => {
      clearInterval(pollInterval);
      if (cleanup) cleanup();
      subscription.remove();
    };
  }, [navigation]); // Re-run khi navigation thay đổi
  
  return (
    <Stack.Navigator initialRouteName={initialRouteName || 'Login'}>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Registers"
        component={RegistersScreen}
        options={{ headerShown: false }}
      />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="VerifySMS"
          component={VerifySMSScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="SuccessScreen"
          component={SuccessScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="FamilyMemberHome"
          component={withFooter(FamilyMemberHomeScreen, 'FamilyMemberHome')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SupporterHome"
          component={withFooter(SupporterHomeScreen, 'SupporterHome')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DefaultScreen"
          component={DefaultScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChangePhonenumber"
          component={ChangePhonenumberScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="OTPChangePhone"
          component={OtPChangePhoneScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="ChangeEmail"
          component={ChangeEmailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="OTPChangeEmail"
          component={OTPChangeEmailScreen}
          options={{ headerShown: false }}
        />

        {/* 👉 Chỉ ChangePassword có footer */}
        <Stack.Screen
          name="ChangePassword"
          component={withFooter(ChangePasswordScreen, 'me')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ElderHome"
          component={withFooter(ElderHomeScreen, 'ElderHome')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Profile"
          component={withFooter(ProfileScreen, 'me')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PersonalInfo"
          component={withFooter(PersonalInfoScreen, 'me')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FindPeople"
          component={withFooter(FindPeopleScreen, 'me')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FamilyConnection"
          component={withFooter(FamilyConnectionScreen, 'me')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FamilyConnectionList"
          component={withFooter(FamilyConnectionListScreen, 'me')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FamilyList_Family"
          component={withFooter(FamilyList_FamilyScreen, 'me')}
          options={{ headerShown: false }}
        />
        {/* Chi tiết người nhà */}
        <Stack.Screen
          name="FamilyDetail"
          component={withFooter(FamilyDetailScreen, 'me')}
          options={{
            headerShown: true,
            title: 'Chi tiết người nhà',
          }}
        />
        {/* Chi tiết nhân viên hỗ trợ */}
        <Stack.Screen
          name="SupportStaffDetail"
          component={withFooter(SupportStaffDetailScreen, 'me')}
          options={{
            headerShown: true,
            title: 'Chi tiết nhân viên hỗ trợ',
          }}
        />
        <Stack.Screen
          name="MessagesList"
          component={withFooter(MessagesListScreen, 'messages')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="VideoCall"
          component={VideoCallScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="IncomingCall"
          component={IncomingCallScreen}
          options={{ 
            headerShown: false,
            presentation: 'modal', // Hiển thị như modal để overlay lên các màn hình khác
          }}
        />
        <Stack.Screen
          name="SOSCall"
          component={SOSCallScreen}
          options={{ 
            headerShown: false,
            presentation: 'modal', // Hiển thị như modal với priority cao hơn
          }}
        />
        <Stack.Screen
          name="CreateIntroduction"
          component={withFooter(CreateIntroductionScreen, 'tasks')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ViewIntroduction"
          component={withFooter(ViewIntroductionScreen, 'tasks')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SupporterIntro"
          component={withFooter(SupporterIntroGate, 'tasks')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditIntroduction"
          component={withFooter(EditIntroductionScreen, 'tasks')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="HealthRecord"
          component={withFooter(HealthScreen, 'tasks')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FamilyHealthMonitoring"
          component={withFooter(FamilyHealthMonitoringScreen, 'home')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SupportFinder"
          component={withFooter(SupportFinderScreen, 'home')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SupporterProfile"
          component={withFooter(SupporterProfileScreen, 'home')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddressPicker"
          component={withFooter(AddressPickerScreen, 'home')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BankAccount"
          component={withFooter(BankAccountScreen, 'home')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="IntroductionCreateDoctorProfile"
          component={withFooter(
            IntroductionCreateDoctorProfileScreen,
            'calendar',
          )}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateDoctorProfile"
          component={withFooter(CreateDoctorProfileScreen, 'calendar')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ViewDoctorProfile"
          component={withFooter(ViewDoctorProfileScreen, 'calendar')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditDoctorProfile"
          component={withFooter(EditDoctorProfileScreen, 'calendar')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateWorkSchedule"
          component={withFooter(CreateWorkScheduleScreen, 'calendar')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EvaluationStatistics"
          component={withFooter(EvaluationStatisticsScreen, 'calendar')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ProfileGate"
          component={ProfileGateScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DoctorHome"
          component={withFooter(DoctorHomeScreen, 'DoctorHome')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ConsulationSummary"
          component={withFooter(ConsulationSummaryScreen, 'DoctorHome')}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="ListSumary"
          component={withFooter(ListSumaryScreen, 'DoctorHome')}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="DoctorProfile"
          component={ProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DoctorSchedule"
          component={ScheduleScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DoctorReviews"
          component={ReviewsScreen}
          options={{ headerShown: false }}
        />

        {/* Đặt lịch hẹn supporter */}
        <Stack.Screen
          name="SupporterBookingScreen"
          component={withFooter(SupporterBookingScreen, 'home')}
          options={{ headerShown: false }}
        />
        {/* Danh sách lịch hẹn đã đặt */}
        <Stack.Screen
          name="SupporterBookingListScreen"
          component={BookingListWithFooter}
          options={{ headerShown: false }}
        />

        {/* Chi tiết lịch hẹn */}
        <Stack.Screen
          name="BookingDetailScreen"
          component={BookingDetailWithFooter}
          options={{ headerShown: false }}
        />

        {/* Danh sách thành viên trong gia đình để đặt lịch hẹn */}
        <Stack.Screen
          name="FamilyListFunctionScreen"
          component={withFooter(FamilyListFunctionScreen, 'FamilyMemberHome')}
          options={{ headerShown: false }}
        />

        {/* Xem danh sách đặt lịch hẹn của vai trò người thân gia đình */}
        <Stack.Screen
          name="SupporterBookingListFamilyScreen"
          component={withFooter(SupporterBookingListFamilyScreen, 'planFamily')}
          options={{ headerShown: false }}
        />

        {/* Danh sách lịch hẹn đã đặt của người hỗ trợ */}
        <Stack.Screen
          name="SupporterBookingListSupporterScreen"
          component={withFooter(SupporterBookingListSupporterScreen, 'planFamily')}
          options={{ headerShown: false }}
        />

          {/* Chọn dịch vụ hỗ trợ khi đặt lịch */}
        <Stack.Screen
          name="ServiceSelectionScreen"
          component={withFooter(ServiceSelectionScreen, 'home')}
          options={{ headerShown: false }}
        />

        {/* Màn hình thanh toán */}
        <Stack.Screen
          name="PaymentBookingScreen"
          component={withFooter(PaymentBookingScreen, 'home')}
          options={{ headerShown: false }}
        />

        {/* SOS Emergency Screen */}
        <Stack.Screen
          name="SOSDetail"
          component={SOSDetailScreen}
          options={{
            headerShown: true,
            title: 'Chi tiết SOS',
            headerStyle: {
              backgroundColor: '#FF0000',
            },
            headerTintColor: '#FFF',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <Stack.Screen
          name="ChatWithAI"
          component={ChatWithAIScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="IntroductionBookingDoctor"
          component={withFooter(IntroductionBookingDoctorScreen, 'home')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="HealthPackageListScreen"
          component={withFooter(DoctorListBookScreen, 'home')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DoctorScheduleSelectScreen"
          component={withFooter(DoctorScheduleSelectScreen, 'home')}
          options={{ headerShown: false }}
        />
        {/* Xem chi tiết hồ sơ bác sĩ từ danh sách chọn bác sĩ */}
        <Stack.Screen
          name="ProfileDoctorScreen"
          component={withFooter(ProfileDoctorScreen, 'home')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PaymentServiceScreen"
          component={withFooter(PaymentServiceScreen, 'home')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DoctorBookingHistoryScreen"
          component={withFooter(DoctorBookingHistoryScreen, 'planFamily')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DoctorConsultationDetailScreen"
          component={withFooter(DoctorConsultationDetailScreen, 'planFamily')}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DoctorMyBookingListScreen"
          component={withFooter(DoctorMyBookingListScreen, 'DoctorHome')}
          options={{ headerShown: false }}
        />
         <Stack.Screen     
          name="ProfileSupporterScreen"
          component={withFooter(ProfileSupporterScreen, 'home')}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
  );
};

// Tạo navigationRef global để sử dụng ở ngoài component
export const navigationRef = React.createRef();

// 🔧 CRITICAL FIX: Global function để force setup listeners
// Được gọi từ LoginScreen sau khi socket connect
let globalSetupListeners = null;

export const forceSetupSocketListeners = () => {
  console.log('🔥 [FORCE] forceSetupSocketListeners called from outside');
  if (globalSetupListeners) {
    console.log('🔥 [FORCE] Running global setup listeners...');
    globalSetupListeners();
  } else {
    console.warn('⚠️  [FORCE] globalSetupListeners not ready yet');
  }
};

const AppNavigator = () => {
  const [booted, setBooted] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    const routeByRole = (role) => {
      switch ((role || '').toLowerCase()) {
        case 'doctor':
          return 'DoctorHome';
        case 'supporter':
          return 'SupporterHome';
        case 'family':
        case 'family_member':
          return 'FamilyMemberHome';
        case 'elderly':
        default:
          return 'ElderHome';
      }
    };

    const decideInitialRoute = async () => {
      try {
        const token = await userService.getToken();
        if (!token) {
          setInitialRoute('Login');
          setBooted(true);
          return;
        }
        
        // ✅ Có token → Tự động kết nối socket trước khi navigate
        try {
          console.log('🔌 Auto connecting socket on app start with existing token...');
          await socketService.connect();
          console.log('✅ Socket auto-connected successfully on app start');
        } catch (socketError) {
          console.error('❌ Socket auto-connect failed on app start:', socketError);
          // Không block navigation nếu socket connect thất bại
        }
        
        const me = await userService.getUser();
        let role = me?.data?.role || me?.data?.userRole || me?.data?.user?.role;
        if (!role) {
          try {
            const info = await userService.getUserInfo();
            role = info?.data?.role || info?.data?.user?.role;
            if (role && info?.data) {
              await userService.setUser(info.data);
            }
          } catch (err) {
            // ignore
          }
        }
        setInitialRoute(role ? routeByRole(role) : 'Login');
      } catch (e) {
        setInitialRoute('Login');
      } finally {
        setBooted(true);
      }
    };

    decideInitialRoute();
  }, []);

  useEffect(() => {
    // Khởi tạo notification service khi app mount
    const initNotifications = async () => {
      if (navigationRef.current) {
        await NotificationService.initialize(navigationRef.current);
      }
    };

    // Delay một chút để đảm bảo navigation đã sẵn sàng
    const timer = setTimeout(initNotifications, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (!booted) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <NavigationContent initialRouteName={initialRoute} />
    </NavigationContainer>
  );
};

export default AppNavigator;
