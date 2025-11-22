// services/doctorBookingService.js
import { api } from './api';

export const doctorBookingService = {

  getElderlies: async () => {
    const TAG = '[doctorBookingService][getElderlies]';
    try {
      const res = await api.get('/doctor-booking/elderlies', {
        timeout: 10000,
      });

      const payload = res?.data || {};
      const success = payload?.success !== false;

      // chấp nhận nhiều kiểu trả về
      const list =
        (Array.isArray(payload?.data) && payload.data) ||
        (Array.isArray(payload?.elderlies) && payload.elderlies) ||
        [];

      return { success, data: list };
    } catch (err) {
      console.log(TAG, 'ERROR', err?.message || err);
      return { success: false, data: [], message: 'Không lấy được danh sách người cao tuổi' };
    }
  },


  getPackages: async (params = {}) => {
    const TAG = '[doctorBookingService][getPackages]';
    try {
      const res = await api.get('/doctor-booking/packages', {
        params,
        timeout: 10000,
      });

      const payload = res?.data || {};
      const success = payload?.success !== false;

      const list =
        (Array.isArray(payload?.data) && payload.data) ||
        (Array.isArray(payload?.packages) && payload.packages) ||
        [];

      return { success, data: list };
    } catch (err) {
      console.log(TAG, 'ERROR', err?.message || err);
      return { success: false, data: [], message: 'Không lấy được danh sách gói sức khỏe' };
    }
  },


  getPackageDetail: async (packageId) => {
    const TAG = '[doctorBookingService][getPackageDetail]';
    if (!packageId) {
      return { success: false, message: 'Thiếu packageId' };
    }

    try {
      const res = await api.get(`/doctor-booking/packages/${packageId}`, {
        timeout: 10000,
      });

      const payload = res?.data || {};
      const success = payload?.success !== false;

      const detail =
        payload?.data ||
        payload?.package ||
        payload?.healthPackage ||
        null;

      return { success, data: detail };
    } catch (err) {
      console.log(TAG, 'ERROR', err?.message || err);
      return { success: false, data: null, message: 'Không lấy được chi tiết gói sức khỏe' };
    }
  },


  getAvailableDoctors: async (params = {}) => {
    const TAG = '[doctorBookingService][getAvailableDoctors]';
    try {
      console.log(TAG, 'REQUEST PARAMS =', params);

      const res = await api.get('/doctor-booking/available-doctors', {
        params,
        timeout: 12000,
      });

      console.log(
        TAG,
        'HTTP =',
        res?.status,
        'DATA =',
        JSON.stringify(res?.data, null, 2),
      );

      const payload = res?.data || {};
      const success = payload?.success !== false;

      const list = Array.isArray(payload?.data?.doctors)
        ? payload.data.doctors
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.doctors)
        ? payload.doctors
        : [];

      return {
        success,
        data: list,
        period: payload?.data?.period || null,
        pkg: payload?.data?.package || null,
        message: payload?.message,
      };
    } catch (err) {
      console.log(
        TAG,
        'ERROR message=',
        err?.message,
        'status=',
        err?.response?.status,
        'data=',
        err?.response?.data,
      );
      return {
        success: false,
        data: [],
        message: 'Không lấy được danh sách bác sĩ khả dụng',
      };
    }
  },


  getDoctorDetail: async (doctorId) => {
    const TAG = '[doctorBookingService][getDoctorDetail]';
    if (!doctorId) {
      return { success: false, message: 'Thiếu doctorId' };
    }

    try {
      const res = await api.get(`/doctor-booking/doctors/${doctorId}`, {
        timeout: 10000,
      });

      const payload = res?.data || {};
      const success = payload?.success !== false;

      const detail =
        payload?.data ||
        payload?.doctor ||
        payload?.doctorProfile ||
        null;

      return { success, data: detail };
    } catch (err) {
      console.log(TAG, 'ERROR', err?.message || err);
      return {
        success: false,
        data: null,
        message: 'Không lấy được thông tin bác sĩ',
      };
    }
  },


  bookDoctor: async (payload) => {
  const TAG = '[doctorBookingService][bookDoctor]';
  console.log(TAG, 'START payload =', JSON.stringify(payload, null, 2));

  try {
    // Gửi request
    const res = await api.post('/doctor-booking/book', payload, {
      timeout: 15000,
    });

    console.log(TAG, 'RAW_RESPONSE =', res?.data);

    const payloadRes = res?.data || {};

    // success = false nếu server trả "success: false"
    const success = payloadRes?.success !== false;

    const booking =
      payloadRes?.data ||
      payloadRes?.booking ||
      null;

    console.log(TAG, 'PARSED_RESPONSE =', {
      success,
      message: payloadRes?.message,
      booking,
    });

    return {
      success,
      data: booking,
      message:
        payloadRes?.message ||
        (success ? 'Đặt lịch thành công' : 'Đặt lịch không thành công'),
    };

  } catch (err) {
    console.log(TAG, 'CATCH_ERROR =', {
      message: err?.message,
      response: err?.response?.data,
      status: err?.response?.status,
    });

    const message =
      err?.response?.data?.message ||
      err?.message ||
      'Không thể đặt lịch bác sĩ';

    return { success: false, data: null, message };
  }
},


  getMyBookings: async (params = {}) => {
  const TAG = '[doctorBookingService][getMyBookings]';
  try {
    console.log(TAG, 'CALL API with params =', params);

    const res = await api.get('/doctor-booking/my-bookings', {
      params,
      timeout: 12000,
    });

    console.log(
      TAG,
      'RAW_RESPONSE =',
      res?.status,
      JSON.stringify(res?.data, null, 2)
    );

    const payload = res?.data || {};

    // success = true trừ khi backend explicitly trả success: false
    const success =
      payload?.success === true ||
      (payload?.success === undefined && res?.status === 200);

    // Chuẩn hóa list bookings từ các key khác nhau
    const list =
      (Array.isArray(payload?.data) && payload.data) ||
      (Array.isArray(payload?.bookings) && payload.bookings) ||
      (Array.isArray(payload?.items) && payload.items) ||
      [];

    console.log(TAG, 'PARSED_BOOKINGS_COUNT =', list.length);

    return {
      success,
      data: list,
      message: payload?.message || '',
    };
  } catch (err) {
    console.log(
      TAG,
      'ERROR =',
      err?.message,
      '| STATUS =',
      err?.response?.status,
      '| DATA =',
      err?.response?.data
    );

    return {
      success: false,
      data: [],
      message:
        err?.response?.data?.message ||
        'Không lấy được lịch sử đặt lịch. Vui lòng thử lại.',
    };
  }
},
  getRegistrationDetail: async (registrationId) => {
    const TAG = '[doctorBookingService][getRegistrationDetail]';
    if (!registrationId) {
      return { success: false, data: null, message: 'Thiếu registrationId' };
    }

    try {
      const res = await api.get(`/doctor-booking/registrations/${registrationId}`, {
        timeout: 12000,
      });

      const payload = res?.data || {};
      const ok = payload?.success !== false;

      return {
        success: !!ok,
        data: payload?.data || null,
        message: payload?.message,
      };
    } catch (err) {
      console.log(TAG, 'ERROR', err?.message || err);
      return {
        success: false,
        data: null,
        message: 'Không lấy được chi tiết đăng ký gói khám',
      };
    }
  },
};

export default doctorBookingService;
