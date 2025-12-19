// src/services/userService.js
import { get } from 'react-native/Libraries/TurboModule/TurboModuleRegistry';
import { api } from './api';

let RNStorage = null;
try {
  RNStorage = require('@react-native-async-storage/async-storage').default;
} catch (_) {
  // chạy web thì bỏ qua
}
// Nếu không dùng ở đây thì có thể xoá import này
// const { parseVnId } = require('./parser');

/* ========== Biến RAM (session in-memory) ========== */
let memoryToken = null;
let memoryUser = null;

/* ========== Helper chung cho bắt lỗi Axios ========== */
const shapeAxiosError = error => {
  const status = error?.response?.status || 0;
  const payload = error?.response?.data || {};
  const partialData = payload?.data || null;

  let message = payload?.message || error?.message || 'Lỗi mạng';
  if (error?.code === 'ECONNABORTED')
    message = 'Hết thời gian chờ. Vui lòng thử lại.';
  if (String(error?.message || '').includes('Network Error')) {
    const cfg = error?.config || {};
    // dùng console.warn cho RN/Chrome DevTools
    console.warn('[AXIOS NETWORK ERROR]', {
      message: error?.message,
      code: error?.code,
      baseURL: cfg?.baseURL,
      url: cfg?.url,
      method: cfg?.method,
      params: cfg?.params,
      data: cfg?.data,
      // lưu ý: không có response khi network error
    });
    message = 'Không thể kết nối máy chủ. Kiểm tra mạng và thử lại.';
  }
  if (status === 413)
    message = 'Ảnh quá lớn. Vui lòng chụp lại với chất lượng thấp hơn.';
  if (status === 422)
    message = payload?.message || 'Không trích xuất được thông tin từ ảnh.';

  return { success: false, status, data: partialData, message };
};

// Bảo đảm là Data URL: "data:<mime>;base64,<payload>"
const asDataUrl = (maybeB64, mime = 'image/jpeg') => {
  if (!maybeB64) return null;
  if (/^data:.*;base64,/.test(maybeB64)) return maybeB64;
  return `data:${mime};base64,${maybeB64}`;
};

export const userService = {
  /* ========== Token / User local ========== */
  getToken: async () => {
    if (memoryToken) return memoryToken;
    if (RNStorage) {
      const token = await RNStorage.getItem('ecare_token');
      memoryToken = token || null;
      return memoryToken;
    }
    return null;
  },

  setToken: async token => {
    if (!RNStorage) return;
    if (token) {
      await RNStorage.setItem('ecare_token', token);
      memoryToken = token;
    } else {
      await RNStorage.removeItem('ecare_token');
      memoryToken = null;
    }
  },

  getUser: async () => {
    if (memoryUser) return { success: true, data: memoryUser };
    if (RNStorage) {
      const userStr = await RNStorage.getItem('ecare_user');
      memoryUser = userStr ? JSON.parse(userStr) : null;
      return { success: true, data: memoryUser };
    }
    return { success: true, data: null };
  },

  setUser: async user => {
    if (!RNStorage) return;
    if (user) {
      await RNStorage.setItem('ecare_user', JSON.stringify(user));
      memoryUser = user;
    } else {
      await RNStorage.removeItem('ecare_user');
      memoryUser = null;
    }
  },

  /* ========== B1/B2: OTP ========== */
  sendOTP: async ({ phoneNumber, role }) => {
    try {
      const response = await api.post('/users/send-otp', { phoneNumber, role });
      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  verifyOTP: async ({ phoneNumber, otp }) => {
    try {
      const response = await api.post('/users/verify-otp', {
        phoneNumber,
        otp,
      });
      return {
        success: true,
        status: response.status,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  /* ========== BƯỚC 3: Upload CCCD (multipart) -> OCR (server) -> lưu tạm Redis ========== */
  uploadCCCD: async ({ phoneNumber, frontFile, backFile }) => {
    try {
      const form = new FormData();
      form.append('phoneNumber', (phoneNumber ?? '').trim());
      if (frontFile) {
        form.append('frontImage', {
          uri: frontFile.uri,
          type: frontFile.type || 'image/jpeg',
          name: frontFile.name || 'front.jpg',
        });
      }
      if (backFile) {
        form.append('backImage', {
          uri: backFile.uri,
          type: backFile.type || 'image/jpeg',
          name: backFile.name || 'back.jpg',
        });
      }

      const res = await api.post('/users/register/kyc/cccd', form, {
        // thực ra có thể bỏ headers, axios tự set boundary, nhưng để vậy cũng được
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return {
        success: true,
        status: res.status,
        data: res.data?.data,
        message: res.data?.message || 'Đã trích xuất CCCD',
        nextStep: res.data?.nextStep || null,
      };
    } catch (error) {
      const shaped = shapeAxiosError(error);
      const nextStep = error?.response?.data?.nextStep || null;
      return { ...shaped, nextStep };
    }
  },

  /* ========== BƯỚC 4: Hoàn tất hồ sơ (tạo user) ========== */
  completeProfile: async ({
    phoneNumber,
    password,
    email,
    fullName,
    gender,
    dateOfBirth,
    address,
    storeSession = true,
  }) => {
    try {
      const body = { phoneNumber, password };
      if (email) body.email = email;
      if (fullName) body.fullName = fullName;
      if (gender) body.gender = gender;
      if (dateOfBirth) body.dateOfBirth = dateOfBirth; // "dd/mm/yyyy" hoặc ISO
      if (address) body.address = address;

      const res = await api.post('/users/register/complete', body);
      const token = res.data?.data?.token || res.data?.token;
      const user = res.data?.data?.user || res.data?.user;

      if (storeSession && token && user) {
        await userService.setToken(token);
        await userService.setUser(user);
      }

      return {
        success: true,
        status: res.status,
        token,
        user,
        message: res.data?.message || 'Hoàn tất đăng ký',
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  /* ========== Đăng nhập / thông tin / đăng xuất ========== */
  loginUser: async ({ phoneNumber, password }) => {
    try {
      const cleanPhone = (phoneNumber ?? '').replace(/\s+/g, '');
      const res = await api.post('/users/loginUser', {
        phoneNumber: cleanPhone,
        password,
      });
      const token = res.data?.token || res.data?.data?.token;
      const user = res.data?.user || res.data?.data?.user;
      return {
        success: true,
        status: res.status,
        token,
        user,
        message: res.data?.message || 'Đăng nhập thành công',
      };
    } catch (error) {
      const shaped = shapeAxiosError(error);
      return { ...shaped, token: null, user: null };
    }
  },

  getUserInfo: async () => {
    try {
      const res = await api.get('/users/getUserInfo');
      return { success: true, status: res.status, data: res.data?.data };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  getUserById: async userId => {
    try {
      const res = await api.get(`/users/${userId}`);
      return { success: true, status: res.status, data: res.data?.data };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  logout: async ({ token } = {}) => {
    try {
      const socketService = require('./socketService').default;
      socketService.disconnect();
    } catch (error) {
      console.log('Socket disconnect warning:', error?.message);
    }
    
    // Gọi API logout backend nếu có token
    if (token) {
      try {
        console.log('📤 Calling backend logout API...');
        await api.post('/sos/logout', { token });
        console.log('✅ Backend logout successful');
      } catch (error) {
        console.log('⚠️  Backend logout warning:', error?.message);
        // Không throw error - tiếp tục logout locally ngay cả khi backend call fail
      }
    }
    
    await userService.setToken(null);
    await userService.setUser(null);
  },

  // Cleanup Redis temp session
  cleanupTempData: async ({ phoneNumber }) => {
    try {
      const response = await api.post('/users/cleanup-temp', { phoneNumber });
      return {
        success: true,
        status: response.status,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  // Lấy dữ liệu đăng ký tạm từ Redis
  getTempRegisterData: async ({ phoneNumber }) => {
    try {
      const response = await api.get(
        `/users/temp-register?phoneNumber=${phoneNumber}`,
      );
      return {
        success: response.data?.success || false,
        data: response.data?.data || null,
        message: response.data?.message || null,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        message: error.response?.data?.message || error.message,
      };
    }
  },
  //Thay đổi mật khẩu

  /* ========== Đổi mật khẩu / sđt / email ========== */
  changePassword: async ({ oldPassword, newPassword }) => {
    try {
      const response = await api.put(
        '/users/change-password',
        { oldPassword, newPassword },
        {
          headers: { Authorization: `Bearer ${await userService.getToken()}` },
        },
      );
      return {
        success: true,
        status: response.status,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  sendChangePhoneOTP: async ({ phoneNumber }) => {
    try {
      const response = await api.post('/users/change-phone/send-otp', {
        phoneNumber,
      });
      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  verifyChangePhoneOTP: async ({ phoneNumber, otp }) => {
    try {
      const response = await api.post('/users/change-phone/verify', {
        phoneNumber,
        otp,
      });
      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  sendChangeEmailOTP: async ({ email }) => {
    try {
      const res = await api.post('/users/change-email/send-otp', { email });
      return {
        success: true,
        status: res.status,
        data: res.data?.data,
        message: res.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  verifyChangeEmailOTP: async ({ email, otp }) => {
    try {
      const res = await api.post('/users/change-email/verify', { email, otp });
      return {
        success: true,
        status: res.status,
        data: res.data?.data,
        message: res.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  /* ========== Danh sách người già & avatar ========== */
  getAllElderly: async () => {
    try {
      const response = await api.get('/users/get-elderly', {
        headers: { Authorization: `Bearer ${await userService.getToken()}` },
      });
      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  searchElderlyByPhone: async ({ phoneNumber }) => {
    try {
      const token = await userService.getToken();
      const params = new URLSearchParams({
        phoneNumber: (phoneNumber ?? '').trim(),
      });
      const response = await api.get(
        `/users/search-elderly-by-phone?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return {
        success: true,
        status: response.status,
        data: response.data?.data,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  updateAvatar: async file => {
    const formData = new FormData();
    formData.append('avatar', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    });
    try {
      const token = await userService.getToken();
      const response = await api.post('/users/me/avatar', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message || 'Cập nhật avatar thành công',
      };
    } catch (error) {
      console.log('[userService.updateAvatar] axios error:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      return shapeAxiosError(error);
    }
  },

  /* ========== Cập nhật địa chỉ hiện tại ========== */
  updateCurrentAddress: async ({ currentAddress, currentLocation }) => {
    try {
      const token = await userService.getToken();
      const body = { currentAddress };

      // Add currentLocation if provided
      if (currentLocation) {
        body.currentLocation = currentLocation;
      }

      const response = await api.put('/users/update-address', body, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Update local user data
      if (response.data?.data) {
        await userService.setUser(response.data.data);
      }

      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message || 'Cập nhật địa chỉ thành công',
      };
    } catch (error) {
      console.log('[userService.updateCurrentAddress] error:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      return shapeAxiosError(error);
    }
  },

  /* ========== Cập nhật tài khoản ngân hàng ========== */
  updateBankAccount: async (token, { bankName, bankAccountNumber, bankAccountHolderName }) => {
    try {
      const response = await api.put(
        '/users/update-bank-account',
        { bankName, bankAccountNumber, bankAccountHolderName },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Update local user data
      if (response.data?.data) {
        await userService.setUser(response.data.data);
      }

      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message || 'Cập nhật tài khoản ngân hàng thành công',
      };
    } catch (error) {
      console.log('[userService.updateBankAccount] error:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      return shapeAxiosError(error);
    }
  },

  getAllSupporters: async () => {
    try {
      const response = await api.get('/users/get-supporters', {
        headers: { Authorization: `Bearer ${await userService.getToken()}` },
      });
      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },
  getAllSupporterProfiles: async () => {
    try {
      const response = await api.get('/users/get-supporter-profiles', {
        headers: { Authorization: `Bearer ${await userService.getToken()}` },
      });
      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  getSupporterProfileByUserId: async supporterId => {
    try {
      console.log('Supporter Id Services', supporterId);

      const response = await api.get(
        `/users/supporter-profile/${supporterId}`,
        {
          headers: { Authorization: `Bearer ${await userService.getToken()}` },
        },
      );
      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },
  // Lấy tất cả family members theo elderlyId
  getFamilyMembersByElderlyId: async ({ elderlyId }) => {
    try {
      const token = await userService.getToken();
      const response = await api.get(`/users/family-members/${elderlyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  // Lấy tất cả mối quan hệ theo familyId (tập trung elderly + relationship)
  getRelationshipsByFamilyId: async (familyId, { status } = {}) => {
    try {
      const token = await userService.getToken();
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const response = await api.get(`/relationships/family/${familyId}${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },

  // Check relationship statuses in bulk
  checkRelationshipsBulk: async ({ elderlyId, familyIds }) => {
    try {
      const token = await userService.getToken();
      const response = await api.post(
        `/relationships/check-status-bulk`,
        { elderlyId, familyIds },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return {
        success: true,
        status: response.status,
        data: response.data?.data,
        message: response.data?.message,
      };
    } catch (error) {
      return shapeAxiosError(error);
    }
  },
};

export default userService;
