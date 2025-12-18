import React, { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import consultationSummaryService from '../../services/consultationSummaryService';

const getConsultationWindowStateUtc = (scheduledDate, slot) => {
	// Use local time comparison to avoid timezone/parsing inconsistencies
    if (!scheduledDate || !slot) return 'unknown';
    const base = new Date(scheduledDate);
    if (Number.isNaN(base.getTime())) return 'unknown';

    const year = base.getFullYear();
    const month = base.getMonth();
    const day = base.getDate();

    let startHour;
    let endHour;
    if (slot === 'morning') {
        startHour = 8;
        endHour = 11;
    } else if (slot === 'afternoon') {
        startHour = 14;
        endHour = 16;
    } else {
        return 'unknown';
    }

    // build start/end in local timezone
    const start = new Date(year, month, day, startHour, 0, 0, 0);
    const end = new Date(year, month, day, endHour, 0, 0, 0);
    const now = new Date();

    if (now.getTime() < start.getTime()) return 'before';
    if (now.getTime() > end.getTime()) return 'after';
    return 'within';
};

const ConsulationSummaryScreen = () => {
	const navigation = useNavigation();
	const route = useRoute();

	const registrationId = route.params?.registrationId || null;
	const fallbackPatientName = route.params?.patientName || '';
	const fallbackPatientGender = route.params?.patientGender || '';
	const fallbackPatientDob = route.params?.patientDob || null;
	const scheduledDate = route.params?.scheduledDate || null;
	const scheduledSlot = route.params?.slot || null;

	const consultationState = getConsultationWindowStateUtc(
		scheduledDate,
		scheduledSlot,
	);
	const isEditable = consultationState === 'within' || consultationState === 'unknown';

	const buildConsultationDateLabel = (dateRaw, slot) => {
		if (!dateRaw) return '—';
		try {
			const d = new Date(dateRaw);
			if (Number.isNaN(d.getTime())) return '—';
			const dateStr = d.toLocaleDateString('vi-VN');
			let slotLabel = '';
			if (slot === 'morning') slotLabel = 'Buổi sáng';
			else if (slot === 'afternoon') slotLabel = 'Buổi chiều';
			return slotLabel ? `${dateStr} • ${slotLabel}` : dateStr;
		} catch (e) {
			return '—';
		}
	};

	const consultationDateLabel = buildConsultationDateLabel(
		scheduledDate,
		scheduledSlot,
	);

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	const [doctorInfo, setDoctorInfo] = useState(null);
	const [patientInfo, setPatientInfo] = useState(null);

	const [form, setForm] = useState({
		mainDisease: '',
		medications: '',
		mobility: '',
		bathing: '',
		feeding: '',
		systolic: '',
		diastolic: '',
		pulse: '',
		weight: '',
		bloodSugar: '',
		note: '',
	});

	const handleOpenHistory = () => {
		const elderlyId = patientInfo?._id;
		const name =
			patientInfo?.fullName ||
			fallbackPatientName ||
			'Người bệnh';

		if (!elderlyId) {
			Alert.alert(
				'Lỗi',
				'Chưa có thông tin người được khám để xem lịch sử phiếu khám.',
			);
			return;
		}

		navigation.navigate('ListSumary', {
			elderlyId,
			elderlyName: name,
		});
	};

	const updateField = (key, value) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const quickMobilityOptions = ['Tự đi lại', 'Cần hỗ trợ', 'Nằm tại giường'];
	const quickADLOptions = ['Độc lập', 'Cần hỗ trợ', 'Phụ thuộc'];

	const buildGenderLabel = (genderRaw) => {
		if (!genderRaw) return '—';
		const g = String(genderRaw).toLowerCase();
		if (g === 'male' || g === 'nam') return 'Nam';
		if (g === 'female' || g === 'nu' || g === 'nữ') return 'Nữ';
		return genderRaw;
	};

	const buildAgeDobLabel = (dobRaw) => {
		if (!dobRaw) return '';
		const dobDate = new Date(dobRaw);
		if (Number.isNaN(dobDate.getTime())) return '';
		const year = dobDate.getFullYear();
		const nowYear = new Date().getFullYear();
		const age = nowYear - year;
		return `${age} tuổi / ${year}`;
	};

	const loadSummary = useCallback(async () => {
		if (!registrationId) {
			setError('Thiếu thông tin lịch khám.');
			setLoading(false);
			return;
		}

		setLoading(true);
		setError('');
		try {
			// load participant info (doctor + beneficiary)
			const participantsRes = await consultationSummaryService.getParticipants(
				registrationId,
			);
			if (participantsRes?.success && participantsRes.data) {
				setDoctorInfo(participantsRes.data.doctor || null);
				setPatientInfo(participantsRes.data.beneficiary || null);
			} else {
				setDoctorInfo(null);
				setPatientInfo(null);
			}

			const res = await consultationSummaryService.getSummary(registrationId);
			if (res?.success && res.data) {
				const d = res.data;
					setForm({
						mainDisease: d.mainDisease || '',
						medications: d.medications || '',
						mobility: d.mobility || '',
						bathing: d.bathing || '',
						feeding: d.feeding || '',
						systolic: d.systolic != null ? String(d.systolic) : '',
						diastolic: d.diastolic != null ? String(d.diastolic) : '',
						pulse: d.pulse != null ? String(d.pulse) : '',
						weight: d.weight != null ? String(d.weight) : '',
						bloodSugar: d.bloodSugar || '',
						note: d.note || '',
					});
			}
		} catch (e) {
			setError(e?.message || 'Không thể tải phiếu khám.');
		} finally {
			setLoading(false);
		}
	}, [registrationId]);

	useEffect(() => {
		loadSummary();
	}, [loadSummary]);

	const normalizeNumber = (value) => {
		if (value == null) return null;
		const trimmed = String(value).trim();
		if (!trimmed) return null;
		// Cho phép dùng dấu phẩy hoặc chấm
		const parsed = Number(trimmed.replace(',', '.'));
		if (Number.isNaN(parsed)) return NaN;
		return parsed;
	};

	const validateForm = () => {
		if (!isEditable) {
			if (consultationState === 'before') {
				return 'Chưa đến thời gian khám, chỉ có thể chỉnh phiếu trong khung giờ khám.';
			}
			if (consultationState === 'after') {
				return 'Thời gian khám đã kết thúc, phiếu chỉ xem lại, không thể chỉnh sửa.';
			}
			return 'Hiện không thể chỉnh sửa phiếu này.';
		}
		if (!form.mainDisease.trim()) {
			return 'Vui lòng nhập đánh giá tổng quát.';
		}

		const hasSys = !!form.systolic.trim();
		const hasDia = !!form.diastolic.trim();
		const hasPulse = !!form.pulse.trim();

		if (hasSys || hasDia || hasPulse) {
			if (!hasSys || !hasDia || !hasPulse) {
				return 'Nếu nhập huyết áp/nhịp tim, vui lòng nhập đủ SYS, DIA và Pulse.';
			}

			const sys = normalizeNumber(form.systolic);
			const dia = normalizeNumber(form.diastolic);
			const pulse = normalizeNumber(form.pulse);

			if (!Number.isFinite(sys) || sys <= 0 || sys > 300) {
				return 'Giá trị SYS không hợp lệ.';
			}
			if (!Number.isFinite(dia) || dia <= 0 || dia > 200) {
				return 'Giá trị DIA không hợp lệ.';
			}
			if (!Number.isFinite(pulse) || pulse <= 0 || pulse > 250) {
				return 'Giá trị Pulse không hợp lệ.';
			}
		}

		if (form.weight.trim()) {
			const w = normalizeNumber(form.weight);
			if (!Number.isFinite(w) || w <= 0 || w > 300) {
				return 'Cân nặng không hợp lệ.';
			}
		}

		if (form.bloodSugar.trim()) {
			const bs = normalizeNumber(form.bloodSugar);
			if (!Number.isFinite(bs) || bs <= 0 || bs > 50) {
				return 'Đường huyết không hợp lệ.';
			}
		}

		return null;
	};

	const onSave = async () => {
		if (!registrationId) {
			Alert.alert('Lỗi', 'Thiếu thông tin lịch khám.');
			return;
		}

		const validationError = validateForm();
		if (validationError) {
			Alert.alert('Lỗi', validationError);
			return;
		}

		setSaving(true);
		try {
			const payload = { ...form };
			// Chuyển các trường số sang Number để backend xử lý rõ ràng hơn
			payload.systolic = normalizeNumber(form.systolic);
			payload.diastolic = normalizeNumber(form.diastolic);
			payload.pulse = normalizeNumber(form.pulse);
			payload.weight = normalizeNumber(form.weight);
			payload.bloodSugar = form.bloodSugar.trim() || '';
			const res = await consultationSummaryService.saveSummary(
				registrationId,
				payload,
			);

			if (res?.success) {
				Alert.alert('Thành công', 'Đã lưu phiếu khám', [
					{
						text: 'OK',
						onPress: () => navigation.goBack(),
					},
				]);
			} else {
				Alert.alert('Lỗi', res?.message || 'Không thể lưu phiếu khám');
			}
		} catch (e) {
			Alert.alert('Lỗi', e?.message || 'Không thể lưu phiếu khám');
		} finally {
			setSaving(false);
		}
	};

	return (
		<SafeAreaView style={styles.safe}>
			<View style={styles.header}>
				<TouchableOpacity
					onPress={() => navigation.goBack()}
					style={styles.headerBack}
					activeOpacity={0.7}
				>
					<Ionicons name="chevron-back" size={22} color="#e5edff" />
				</TouchableOpacity>
				<Text style={styles.headerTitle} numberOfLines={1}>
					Phiếu theo dõi sức khỏe
				</Text>
				<TouchableOpacity
					style={styles.headerHistory}
					onPress={handleOpenHistory}
					activeOpacity={0.7}
				>
					<Ionicons name="time-outline" size={18} color="#bbf7d0" />
					<Text style={styles.headerHistoryText}>Lịch sử</Text>
				</TouchableOpacity>
			</View>

			{loading ? (
				<View style={styles.loadingWrap}>
					<ActivityIndicator size="large" color="#0b5fff" />
					<Text style={styles.loadingText}>Đang tải phiếu khám…</Text>
				</View>
			) : (
				<ScrollView
					style={styles.container}
					contentContainerStyle={{ paddingBottom: 24 }}
				>
					{consultationState !== 'within' && consultationState !== 'unknown' && (
						<View style={styles.infoBox}>
							{consultationState === 'before' ? (
								<Text style={styles.infoText}>
									Chưa đến thời gian khám. Hiện chỉ có thể xem trước thông tin, không thể chỉnh sửa.
								</Text>
							) : (
								<Text style={styles.infoText}>
									Phiếu này đã qua thời gian khám, chỉ có thể xem lại.
								</Text>
							)}
						</View>
					)}
					{!!error && (
						<View style={styles.errorBox}>
							<Text style={styles.errorText}>{error}</Text>
						</View>
					)}

					<View style={styles.card}>
						<View style={styles.cardHeaderRow}>
							<Text style={styles.sectionTitle}>Thông tin bệnh nhân</Text>
							<View style={styles.visitDateWrap}>
								<Text style={styles.visitDateLabel}>Ngày khám</Text>
								<Text style={styles.visitDateValue}>{consultationDateLabel}</Text>
							</View>
						</View>
						<Text style={styles.label}>Người khám (bác sĩ)</Text>
						<Text style={styles.patientName}>
							{doctorInfo?.fullName || '—'}
						</Text>
						<Text style={styles.label}>Người được khám</Text>
						<Text style={styles.label}>Họ tên</Text>
						<Text style={styles.patientName}>
							{patientInfo?.fullName || fallbackPatientName || 'Người bệnh'}
						</Text>
						<Text style={styles.label}>Địa chỉ hiện tại</Text>
						<Text style={styles.patientInfoValue}>
							{patientInfo?.currentAddress || '—'}
						</Text>
						<Text style={styles.label}>Giới tính</Text>
						<Text style={styles.patientInfoValue}>
							{buildGenderLabel(
								patientInfo?.gender || fallbackPatientGender,
							)}
						</Text>
						<Text style={styles.label}>Tuổi / năm sinh</Text>
						<Text style={styles.patientInfoValue}>
							{buildAgeDobLabel(
								patientInfo?.dateOfBirth || fallbackPatientDob,
							) || '—'}
						</Text>
					</View>

					<View style={styles.card}>
						<Text style={styles.sectionTitle}>Đánh giá sức khỏe</Text>
						<Text style={styles.label}>Đánh giá tổng quát</Text>
						<TextInput
							style={styles.input}
							placeholder="Nhập ngắn gọn tình trạng chung hiện tại"
							autoCapitalize="sentences"
							returnKeyType="next"
							value={form.mainDisease}
							onChangeText={(t) => updateField('mainDisease', t)}
							editable={isEditable}
						/>

						<Text style={styles.label}>Lời khuyên</Text>
						<TextInput
							style={[styles.input, styles.multiline]}
							placeholder="Nhập lời khuyên"
							autoCapitalize="sentences"
							value={form.medications}
							onChangeText={(t) => updateField('medications', t)}
							multiline
							textAlignVertical="top"
							editable={isEditable}
						/>
					</View>

					<View style={styles.card}>
						<Text style={styles.sectionTitle}>Sinh hiệu</Text>

						<View style={styles.row}>
							<View style={styles.colThird}>
								<Text style={styles.label}>{'SYS\n(tâm thu)'}</Text>
								<TextInput
									style={styles.input}
									keyboardType="numeric"
									placeholder="vd: 115"
									value={form.systolic}
									onChangeText={(t) => updateField('systolic', t)}
									editable={isEditable}
								/>
							</View>
							<View style={styles.colThird}>
								<Text style={styles.label}>{'DIA\n(tâm trương)'}</Text>
								<TextInput
									style={styles.input}
									keyboardType="numeric"
									placeholder="vd: 75"
									value={form.diastolic}
									onChangeText={(t) => updateField('diastolic', t)}
									editable={isEditable}
								/>
							</View>
							<View style={styles.colThird}>
								<Text style={styles.label}>{'Pulse\n(bpm)'}</Text>
								<TextInput
									style={styles.input}
									keyboardType="numeric"
									placeholder="vd: 80"
									value={form.pulse}
									onChangeText={(t) => updateField('pulse', t)}
									editable={isEditable}
								/>
							</View>
						</View>

						<View style={styles.row}>
							<View style={styles.colHalf}>
								<Text style={styles.label}>Cân nặng (kg)</Text>
								<TextInput
									style={styles.input}
									keyboardType="numeric"
									placeholder="vd: 60"
									value={form.weight}
									onChangeText={(t) => updateField('weight', t)}
									editable={isEditable}
								/>
							</View>
							<View style={styles.colHalf}>
								<Text style={styles.label}>Đường huyết (mmol/L)</Text>
								<TextInput
									style={styles.input}
									keyboardType="numeric"
									placeholder="vd: 5.5"
									value={form.bloodSugar}
									onChangeText={(t) => updateField('bloodSugar', t)}
									editable={isEditable}
								/>
							</View>
						</View>
					</View>

					<View style={styles.card}>
						<Text style={styles.sectionTitle}>Đánh giá khả năng hoạt động</Text>

						<Text style={styles.subSectionHeading}>Di chuyển</Text>
						<View style={styles.chipRow}>
							{quickMobilityOptions.map((opt) => (
								<TouchableOpacity
									key={opt}
									style={[
										styles.chip,
										form.mobility === opt && styles.chipActive,
									]}
									onPress={() => updateField('mobility', opt)}
									disabled={!isEditable}
								>
									<Text
										style={[
											styles.chipText,
											form.mobility === opt && styles.chipTextActive,
										]}
									>
										{opt}
									</Text>
								</TouchableOpacity>
							))}
						</View>
						<TextInput
							style={styles.input}
							placeholder="vd: Tự đi lại, cần hỗ trợ, nằm tại giường…"
							value={form.mobility}
							onChangeText={(t) => updateField('mobility', t)}
							editable={isEditable}
						/>

						<Text style={styles.subSectionHeading}>Tắm rửa</Text>
						<View style={styles.chipRow}>
							{quickADLOptions.map((opt) => (
								<TouchableOpacity
									key={opt}
									style={[
										styles.chip,
										form.bathing === opt && styles.chipActive,
									]}
									onPress={() => updateField('bathing', opt)}
									disabled={!isEditable}
								>
									<Text
										style={[
											styles.chipText,
											form.bathing === opt && styles.chipTextActive,
										]}
									>
										{opt}
									</Text>
								</TouchableOpacity>
							))}
						</View>
						<TextInput
							style={styles.input}
							placeholder="vd: Tự tắm, cần hỗ trợ…"
							value={form.bathing}
							onChangeText={(t) => updateField('bathing', t)}
							editable={isEditable}
						/>

						<Text style={styles.subSectionHeading}>Ăn uống</Text>
						<View style={styles.chipRow}>
							{quickADLOptions.map((opt) => (
								<TouchableOpacity
									key={opt}
									style={[
										styles.chip,
										form.feeding === opt && styles.chipActive,
									]}
									onPress={() => updateField('feeding', opt)}
									disabled={!isEditable}
								>
									<Text
										style={[
											styles.chipText,
											form.feeding === opt && styles.chipTextActive,
										]}
									>
										{opt}
									</Text>
								</TouchableOpacity>
							))}
						</View>
						<TextInput
							style={styles.input}
							placeholder="vd: Ăn uống độc lập, cần hỗ trợ…"
							value={form.feeding}
							onChangeText={(t) => updateField('feeding', t)}
							editable={isEditable}
						/>
					</View>

					<View style={styles.card}>
						<Text style={styles.sectionTitle}>Ghi chú thêm</Text>
						<TextInput
							style={[styles.input, styles.multiline]}
							placeholder="Ghi chú khác (dặn dò, tái khám, chỉ định xét nghiệm…)"
							autoCapitalize="sentences"
							value={form.note}
							onChangeText={(t) => updateField('note', t)}
							multiline
							textAlignVertical="top"
							editable={isEditable}
						/>
					</View>

					<TouchableOpacity
						style={[styles.saveBtn, (saving || !isEditable) && { opacity: 0.7 }]}
						activeOpacity={0.8}
						disabled={saving || !isEditable}
						onPress={onSave}
					>
						{saving ? (
							<ActivityIndicator color="#ffffff" />
						) : (
							<Text style={styles.saveBtnText}>Lưu phiếu khám</Text>
						)}
					</TouchableOpacity>
				</ScrollView>
			)}
		</SafeAreaView>
	);
};

export default ConsulationSummaryScreen;

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: '#f3f4f6',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: '#0b5fff',
	},
	headerBack: {
		width: 40,
		paddingVertical: 4,
		paddingLeft: 4,
		justifyContent: 'flex-start',
		alignItems: 'flex-start',
	},
	headerBackText: {
		color: '#e5edff',
		fontWeight: '600',
	},
	headerTitle: {
		flex: 1,
		textAlign: 'center',
		color: '#ffffff',
		fontWeight: '700',
		fontSize: 16,
	},
	headerHistory: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 999,
		backgroundColor: '#16a34a',
	},
	headerHistoryText: {
		marginLeft: 4,
		color: '#ecfdf5',
		fontSize: 13,
		fontWeight: '600',
	},
	container: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 12,
	},
	loadingWrap: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	loadingText: {
		marginTop: 8,
		color: '#4b5563',
	},
	infoBox: {
		backgroundColor: '#eff6ff',
		borderRadius: 8,
		padding: 10,
		marginBottom: 12,
	},
	infoText: {
		color: '#1d4ed8',
		fontSize: 13,
	},
	errorBox: {
		backgroundColor: '#fef2f2',
		borderRadius: 8,
		padding: 10,
		marginBottom: 12,
	},
	errorText: {
		color: '#b91c1c',
	},
	card: {
		backgroundColor: '#ffffff',
		borderRadius: 12,
		padding: 12,
		marginBottom: 12,
	},
	cardHeaderRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		marginBottom: 4,
	},
	sectionTitle: {
		fontWeight: '700',
		fontSize: 15,
		marginBottom: 8,
		color: '#111827',
	},
	visitDateWrap: {
		alignItems: 'flex-end',
		marginLeft: 8,
	},
	visitDateLabel: {
		fontSize: 11,
		color: '#6b7280',
		marginBottom: 2,
	},
	visitDateValue: {
		fontSize: 13,
		color: '#111827',
		fontWeight: '600',
	},
	subSectionHeading: {
		marginTop: 10,
		marginBottom: 4,
		color: '#111827',
		fontSize: 14,
		fontWeight: '600',
	},
	patientName: {
		fontSize: 16,
		fontWeight: '700',
		color: '#0f172a',
	},
	patientInfoValue: {
		fontSize: 14,
		color: '#111827',
		fontWeight: '500',
	},
	label: {
		marginTop: 8,
		marginBottom: 4,
		color: '#6b7280',
		fontSize: 13,
	},
	input: {
		borderWidth: 1,
		borderColor: '#e5e7eb',
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 8,
		fontSize: 14,
		backgroundColor: '#f9fafb',
	},
	multiline: {
		minHeight: 80,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	colHalf: {
		width: '48%',
	},
	colThird: {
		width: '32%',
	},
	chipRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginTop: 6,
		marginBottom: 4,
		gap: 8,
	},
	chip: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: '#e5e7eb',
		backgroundColor: '#f9fafb',
	},
	chipActive: {
		backgroundColor: '#0b5fff11',
		borderColor: '#0b5fff',
	},
	chipText: {
		fontSize: 13,
		color: '#4b5563',
	},
	chipTextActive: {
		color: '#0b5fff',
		fontWeight: '600',
	},
	saveBtn: {
		marginTop: 4,
		marginBottom: 24,
		marginHorizontal: 16,
		backgroundColor: '#0b5fff',
		borderRadius: 999,
		paddingVertical: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	saveBtnText: {
		color: '#ffffff',
		fontWeight: '700',
		fontSize: 15,
	},
});
