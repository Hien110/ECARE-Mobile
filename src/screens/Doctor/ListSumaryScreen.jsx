import React, { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import consultationSummaryService from '../../services/consultationSummaryService';
import { SafeAreaView } from 'react-native-safe-area-context';
 
const ListSumaryScreen = () => {
	const navigation = useNavigation();
	const route = useRoute();

	const elderlyId = route.params?.elderlyId || null;
	const elderlyName = route.params?.elderlyName || 'Người cao tuổi';

	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState('');
	const [items, setItems] = useState([]);

	const buildConsultationDateLabel = (registration) => {
		if (!registration?.scheduledDate) return '—';
		try {
			const d = new Date(registration.scheduledDate);
			if (Number.isNaN(d.getTime())) return '—';
			const dateStr = d.toLocaleDateString('vi-VN');
			let slotLabel = '';
			if (registration.slot === 'morning') slotLabel = 'Buổi sáng (8h - 11h)';
			else if (registration.slot === 'afternoon')
				slotLabel = 'Buổi chiều (14h - 16h)';
			return slotLabel ? `${dateStr} • ${slotLabel}` : dateStr;
		} catch (e) {
			return '—';
		}
	};

	const loadData = useCallback(
		async (isRefresh = false) => {
			if (!elderlyId) {
				setError('Thiếu thông tin người được khám.');
				setLoading(false);
				return;
			}

			if (isRefresh) setRefreshing(true);
			else setLoading(true);
			setError('');

			try {
				const res = await consultationSummaryService.getSummariesByElderly(
					elderlyId,
				);
				if (res?.success) {
					setItems(Array.isArray(res.data) ? res.data : []);
				} else {
					setItems([]);
					setError(
						res?.message || 'Không thể tải lịch sử phiếu khám.',
					);
				}
			} catch (e) {
				setItems([]);
				setError(e?.message || 'Không thể tải lịch sử phiếu khám.');
			} finally {
				if (isRefresh) setRefreshing(false);
				else setLoading(false);
			}
		},
		[elderlyId],
	);

	useEffect(() => {
		loadData(false);
	}, [loadData]);

	const onPressItem = (item) => {
		const reg = item?.registration;
		if (!reg?._id) return;

		navigation.navigate('ConsulationSummary', {
			registrationId: reg._id,
			patientName: item?.beneficiary?.fullName,
			patientGender: item?.beneficiary?.gender,
			patientDob: item?.beneficiary?.dateOfBirth,
			scheduledDate: reg.scheduledDate,
			slot: reg.slot,
		});
	};

	const renderItem = ({ item }) => {
		const reg = item?.registration || null;
		const doctorName = item?.doctor?.fullName || 'Bác sĩ';
		const patientName = item?.beneficiary?.fullName || elderlyName;
		const patientAddress = item?.beneficiary?.currentAddress || '';
		const mainDisease = item?.mainDisease || '';
		const createdAtLabel = item?.createdAt
			? new Date(item.createdAt).toLocaleDateString('vi-VN')
			: '';
		const dateLabel = buildConsultationDateLabel(reg);

		return (
			<TouchableOpacity
				style={styles.itemCard}
				activeOpacity={0.8}
				onPress={() => onPressItem(item)}
			>
				<View style={styles.itemHeaderRow}>
					<Text style={styles.itemTitle} numberOfLines={1}>
						Phiếu khám
					</Text>
					<Text style={styles.itemDate}>{createdAtLabel}</Text>
				</View>
				<Text style={styles.itemLabel} numberOfLines={1}>
					Bệnh nhân: <Text style={styles.itemValue}>{patientName}</Text>
				</Text>
				{!!patientAddress && (
					<Text style={styles.itemLabel} numberOfLines={1}>
						Địa chỉ:{' '}
						<Text style={styles.itemValue}>{patientAddress}</Text>
					</Text>
				)}
				<Text style={styles.itemLabel} numberOfLines={1}>
					Bác sĩ:{' '}
					<Text style={styles.itemValue}>{doctorName}</Text>
				</Text>
				<Text style={styles.itemLabel} numberOfLines={2}>
					Tổng quát:{' '}
					<Text style={styles.itemValue}>{mainDisease || '—'}</Text>
				</Text>
				<View style={styles.itemFooterRow}>
					<Text style={styles.itemSlot} numberOfLines={1}>
						{dateLabel}
					</Text>
					<Text style={styles.itemLink}>Xem chi tiết</Text>
				</View>
			</TouchableOpacity>
		);
	};

	const renderEmpty = () => (
		<View style={styles.emptyWrap}>
			<Text style={styles.emptyText}>Chưa có phiếu khám nào.</Text>
		</View>
	);

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
				<View style={styles.headerCenter}>
					<Text style={styles.headerTitle} numberOfLines={1}>
						Lịch sử phiếu khám
					</Text>
					<Text style={styles.headerSubtitle} numberOfLines={1}>
						{elderlyName}
					</Text>
				</View>
				<View style={{ width: 40 }} />
			</View>

			{loading ? (
				<View style={styles.loadingWrap}>
					<ActivityIndicator size="large" color="#0b5fff" />
					<Text style={styles.loadingText}>Đang tải lịch sử phiếu khám…</Text>
				</View>
			) : (
				<FlatList
					data={items}
					keyExtractor={(item) => String(item._id)}
					renderItem={renderItem}
					contentContainerStyle={
						items?.length ? styles.listContent : styles.listContentEmpty
					}
					refreshing={refreshing}
					onRefresh={() => loadData(true)}
					ListEmptyComponent={!error ? renderEmpty : null}
				/>
			)}

			{!!error && !loading && (
				<View style={styles.errorBox}>
					<Text style={styles.errorText}>{error}</Text>
				</View>
			)}
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: '#f3f4f6',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 10,
		backgroundColor: '#0b5fff',
	},
	headerBack: {
		width: 40,
		height: 40,
		borderRadius: 999,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(255,255,255,0.08)',
	},
	headerCenter: {
		flex: 1,
		marginHorizontal: 8,
	},
	headerTitle: {
		color: '#e5edff',
		fontSize: 18,
		fontWeight: '600',
	},
	headerSubtitle: {
		color: '#c7d2fe',
		fontSize: 13,
		marginTop: 2,
	},
	loadingWrap: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 24,
	},
	loadingText: {
		marginTop: 12,
		fontSize: 15,
		color: '#4b5563',
	},
	listContent: {
		padding: 16,
		paddingBottom: 24,
	},
	listContentEmpty: {
		flexGrow: 1,
		padding: 16,
		justifyContent: 'center',
	},
	emptyWrap: {
		alignItems: 'center',
	},
	emptyText: {
		fontSize: 15,
		color: '#6b7280',
	},
	itemCard: {
		backgroundColor: '#ffffff',
		borderRadius: 12,
		padding: 14,
		marginBottom: 12,
		shadowColor: '#000',
		shadowOpacity: 0.05,
		shadowRadius: 4,
		shadowOffset: { width: 0, height: 2 },
		elevation: 2,
	},
	itemHeaderRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 6,
	},
	itemTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#111827',
	},
	itemDate: {
		fontSize: 12,
		color: '#6b7280',
	},
	itemLabel: {
		fontSize: 14,
		color: '#4b5563',
		marginTop: 2,
	},
	itemValue: {
		fontWeight: '600',
		color: '#111827',
	},
	itemFooterRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 8,
	},
	itemSlot: {
		fontSize: 13,
		color: '#374151',
		flex: 1,
		marginRight: 12,
	},
	itemLink: {
		fontSize: 13,
		fontWeight: '600',
		color: '#0b5fff',
	},
	errorBox: {
		position: 'absolute',
		left: 16,
		right: 16,
		bottom: 16,
		backgroundColor: '#fef2f2',
		borderRadius: 8,
		padding: 10,
		borderWidth: 1,
		borderColor: '#fecaca',
	},
	errorText: {
		fontSize: 13,
		color: '#b91c1c',
		textAlign: 'center',
	},
});

export default ListSumaryScreen;

