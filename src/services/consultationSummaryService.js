import { api } from './api';


export const consultationSummaryService = {
	saveSummary: async (registrationId, payload = {}) => {
		if (!registrationId) {
			return { success: false, data: null, message: 'Thiếu registrationId' };
		}

		try {
			const res = await api.post(
				`/consultation-summaries/${registrationId}`,
				payload,
			);

			return {
				success: true,
				data: res.data?.data || null,
				message: res.data?.message || 'Lưu tóm tắt tư vấn thành công',
			};
		} catch (error) {
			return {
				success: false,
				data: null,
				message: error?.response?.data?.message || error.message || 'Lỗi lưu tóm tắt tư vấn',
			};
		}
	},

	getSummary: async (registrationId) => {
		if (!registrationId) {
			return { success: false, data: null, message: 'Thiếu registrationId' };
		}

		try {
			const res = await api.get(`/consultation-summaries/${registrationId}`);

			return {
				success: true,
				data: res.data?.data || null,
				message: res.data?.message || 'Lấy tóm tắt tư vấn thành công',
			};
		} catch (error) {
			return {
				success: false,
				data: null,
				message:
					error?.response?.data?.message ||
					error.message ||
					'Không lấy được tóm tắt tư vấn',
			};
		}
	},

	deleteSummary: async (registrationId) => {
		if (!registrationId) {
			return { success: false, message: 'Thiếu registrationId' };
		}

		try {
			const res = await api.delete(`/consultation-summaries/${registrationId}`);

			return {
				success: true,
				message: res.data?.message || 'Xóa tóm tắt tư vấn thành công',
			};
		} catch (error) {
			return {
				success: false,
				message:
					error?.response?.data?.message ||
					error.message ||
					'Không xóa được tóm tắt tư vấn',
			};
		}
	},
 
	getParticipants: async (registrationId) => {
		if (!registrationId) {
			return { success: false, data: null, message: 'Thiếu registrationId' };
		}

		try {
			const res = await api.get(
				`/consultation-summaries/${registrationId}/participants`,
			);

			return {
				success: true,
				data: res.data?.data || null,
				message:
					res.data?.message ||
					'Lấy thông tin người khám và người được khám thành công',
			};
		} catch (error) {
			return {
				success: false,
				data: null,
				message:
					error?.response?.data?.message ||
					error.message ||
					'Không lấy được thông tin người khám / người được khám',
			};
		}
	},
};

export default consultationSummaryService;

