import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import socketService from '../services/socketService';
import CallService from '../services/CallService';

/**
 * Hook để lắng nghe các sự kiện SOS call từ socket
 * Sử dụng trong main navigation hoặc root component
 */
export const useSOSCallListener = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const handleSOSCallRequest = (data) => {
      const { sosId, callId, requester, recipientIndex, totalRecipients } = data;

      console.log('🆘📞 Received SOS call request:', {
        sosId,
        callId,
        requesterName: requester?.fullName,
        recipientIndex,
        totalRecipients,
      });

      // Check if this call has been processed
      if (CallService.hasProcessedCall(callId)) {
        console.log('⚠️ SOS call already processed, ignoring:', callId);
        return;
      }

      // Mark as processed
      CallService.markCallAsProcessed(callId);

      // Navigate to SOSCallScreen
      try {
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
      } catch (error) {
        console.error('❌ Error navigating to SOSCall screen:', error);
      }
    };

    // Register listener
    socketService.on('sos_call_request', handleSOSCallRequest);

    // Cleanup
    return () => {
      socketService.off('sos_call_request', handleSOSCallRequest);
    };
  }, [navigation]);
};

export default useSOSCallListener;
