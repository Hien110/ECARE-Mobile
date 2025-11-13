import { userService } from '../services/userService';

export const checkAuthStatus = async () => {
  try {
    const userResponse = await userService.getUser();
    const token = await userService.getToken();
    
    const isAuthenticated = !!(userResponse?.success && userResponse?.data && token);
    
    console.log('🔐 Auth Status Check:', {
      hasUser: !!(userResponse?.success && userResponse?.data),
      hasToken: !!token,
      isAuthenticated,
      userId: userResponse?.data?._id,
      phoneNumber: userResponse?.data?.phoneNumber
    });
    
    return {
      isAuthenticated,
      user: userResponse?.data,
      token,
      needsLogin: !isAuthenticated
    };
  } catch (error) {
    console.error('❌ Auth status check failed:', error);
    return {
      isAuthenticated: false,
      user: null,
      token: null,
      needsLogin: true,
      error: error.message
    };
  }
};

export default checkAuthStatus;
