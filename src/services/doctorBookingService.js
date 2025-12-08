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


  getAvailableDoctors: async (params = {}) => {
    try {
      const res = await api.get('/doctor-booking/available-doctors', {
        params,
        timeout: 12000,
      });

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


  getMyBookings: async (params = {}) => {
  try {
    const res = await api.get('/doctor-booking/my-bookings', {
      params,
      timeout: 12000,
    });

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

    return {
      success,
      data: list,
      message: payload?.message || '',
    };
  } catch (err) {
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
      return {
        success: false,
        data: null,
        message: 'Không lấy được chi tiết đăng ký gói khám',
      };
    }
  },
  getBookingsByElderlyId: async (elderlyId, params = {}) => {
    if (!elderlyId) {
      return {
        success: false,
        data: [],
        message: 'Thiếu elderlyId',
      };
    }

    try {
      const res = await api.get(`/doctor-booking/by-elderly/${elderlyId}`, {
        params,
        timeout: 12000,
      });

      const payload = res?.data || {};

      // success = true trừ khi backend explicitly trả success: false
      const success =
        payload?.success === true ||
        (payload?.success === undefined && res?.status === 200);

      // Chuẩn hoá list giống getMyBookings
      const list =
        (Array.isArray(payload?.data) && payload.data) ||
        (Array.isArray(payload?.bookings) && payload.bookings) ||
        (Array.isArray(payload?.items) && payload.items) ||
        [];

      return {
        success,
        data: list,
        message: payload?.message || '',
      };
    } catch (err) {
      return {
        success: false,
        data: [],
        message:
          err?.response?.data?.message ||
          'Không lấy được lịch tư vấn bác sĩ theo người cao tuổi. Vui lòng thử lại.',
      };
    }
  },
  cancelBooking: async (bookingId, payload = {}) => {
  try {
    if (!bookingId) {
      return {
        success: false,
        data: null,
        message: 'Thiếu bookingId khi gọi cancelBooking',
      };
    }

    const res = await api.post(
      `/doctor-booking/registrations/${bookingId}/cancel`,
      payload,
    );

    const body = res?.data || {};
    const success =
      body?.success === true ||
      (body?.success === undefined && res?.status === 200);

    return {
      success,
      data: body?.data || body?.booking || body?.registration || null,
      message: body?.message || '',
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      message:
        err?.response?.data?.message ||
        'Không thể hủy lịch tư vấn bác sĩ. Vui lòng thử lại.',
    };
  }
},
updateConsultationStatus: async (bookingId, nextStatus) => {
  // gom payload cho BE: status + optional reason
  const payload = { status: nextStatus };

  // TÁI DÙNG hàm cancelBooking đã viết
  return doctorBookingService.cancelBooking(bookingId, payload);
},
  getDoctorFreeSchedule: async (doctorId, params = {}) => {
    if (!doctorId) {
      return {
        success: false,
        data: [],
        message: 'Thiếu doctorId',
      };
    }

    try {
      const res = await api.get(
        `/doctor-booking/doctors/${doctorId}/free-schedule`,
        {
          params,
          timeout: 10000,
        },
      );

      const payload = res?.data || {};
      const success = payload?.success !== false;

      const list =
        (Array.isArray(payload?.data) && payload.data) ||
        [];

      return {
        success,
        data: list,
        message: payload?.message,
      };
    } catch (err) {
      return {
        success: false,
        data: [],
        message:
          err?.response?.data?.message ||
          'Không lấy được lịch trống của bác sĩ',
      };
    }
  },

  getDefaultConsultationPrice: async () => {
    const TAG = '[doctorBookingService][getDefaultConsultationPrice]';
    try {
      const res = await api.get('/doctor-booking/default-price', {
        timeout: 8000,
      });

      const payload = res?.data || {};
      const success = payload?.success !== false;

      const price =
        typeof payload?.data?.price === 'number'
          ? payload.data.price
          : typeof payload?.price === 'number'
          ? payload.price
          : null;

      return {
        success: !!success && price !== null,
        data: price,
        message: payload?.message,
      };
    } catch (err) {
      console.log(TAG, 'ERROR', err?.message || err);
      return {
        success: false,
        data: null,
        message: 'Không lấy được giá tư vấn mặc định',
      };
    }
  },

  createRegistration: async (payload = {}) => {
    const TAG = '[doctorBookingService][createRegistration]';
    try {
      const res = await api.post('/doctor-booking/registrations', payload, {
        timeout: 15000,
      });

      const body = res?.data || {};
      const success = body?.success !== false;

      return {
        success,
        data: body?.data || null,
        message: body?.message,
      };
    } catch (err) {
      console.log(TAG, 'ERROR', err?.message || err);
      return {
        success: false,
        data: null,
        message:
          err?.response?.data?.message ||
          'Không thể tạo đăng ký tư vấn bác sĩ. Vui lòng thử lại.',
      };
    }
  },
};

export default doctorBookingService;
