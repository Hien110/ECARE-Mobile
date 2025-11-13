import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  Platform,
} from 'react-native';
// import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import api from '../../services/api/axiosConfig';

const SOSDetailScreen = ({ route, navigation }) => {
  // defensive: route.params may be undefined when navigating programmatically
  const params = route?.params || {};
  const {
    sosId,
    requesterName,
    requesterAvatar,
    address,
    latitude,
    longitude,
    message,
  } = params;

  // initialize to an empty object to avoid null dereferences that could
  // lead to accidentally rendering non-Text children
  const [sosData, setSosData] = useState({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Kiểm tra sosId có hợp lệ không trước khi fetch
    if (!sosId || sosId === 'undefined') {
      console.error('Invalid sosId:', sosId);
      Alert.alert('Lỗi', 'Không có thông tin SOS hợp lệ');
      setLoading(false);
      navigation?.goBack?.();
      return;
    }
    fetchSOSDetails();
  }, [sosId]);

  const fetchSOSDetails = async () => {
    try {
      const response = await api.get(`/sos/${sosId}`);
      setSosData(response.data.data || {});
    } catch (error) {
      // prefer structured logging, avoid passing complex objects into JSX later
      const serverMsg = error?.response?.data?.message || error?.message || 'Không xác định';
      console.error('Error fetching SOS details:', {
        status: error?.response?.status,
        body: error?.response?.data,
        message: error?.message,
      });
      Alert.alert('Lỗi', `Không thể tải thông tin SOS: ${serverMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      active: 'Đang hoạt động',
      acknowledged: 'Đã tiếp nhận',
      resolved: 'Đã giải quyết',
      cancelled: 'Đã hủy',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      active: '#FF0000',
      acknowledged: '#FFA500',
      resolved: '#4CAF50',
      cancelled: '#999',
    };
    return colorMap[status] || '#999';
  };

  const handleOpenMaps = () => {
    const lat = sosData?.location?.coordinates?.latitude || latitude;
    const lng = sosData?.location?.coordinates?.longitude || longitude;
    const label = encodeURIComponent(address || 'SOS Location');

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
    });

    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF0000" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  const currentLat = sosData?.location?.coordinates?.latitude ?? latitude ?? null;
  const currentLng = sosData?.location?.coordinates?.longitude ?? longitude ?? null;
  const currentAddress = sosData?.location?.address ?? address ?? '';
  const currentMessage = sosData?.message ?? message ?? '';
  // string-safe text for coordinates (to avoid rendering undefined/raw numbers)
  const latText = currentLat != null ? String(Number(currentLat).toFixed(6)) : '—';
  const lngText = currentLng != null ? String(Number(currentLng).toFixed(6)) : '—';
  const currentStatus = sosData?.status || 'active';

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🆘 CẢNH BÁO KHẨN CẤP</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentStatus) }]}>
          <Text style={styles.statusText}>{getStatusText(currentStatus)}</Text>
        </View>
      </View>

      {/* Requester Info */}
      <View style={styles.requesterCard}>
        <Image
          source={{
            uri: sosData?.requester?.avatar || requesterAvatar || 'https://via.placeholder.com/100',
          }}
          style={styles.avatar}
        />
        <View style={styles.requesterInfo}>
          <Text style={styles.requesterName}>
            {sosData?.requester?.fullName || requesterName || 'Không rõ'}
          </Text>
          <Text style={styles.requesterLabel}>Người gửi cầu cứu</Text>
        </View>
      </View>

      {/* Message */}
      {currentMessage && (
        <View style={styles.messageCard}>
          <Text style={styles.messageLabel}>Lời nhắn:</Text>
          <Text style={styles.messageText}>{currentMessage}</Text>
        </View>
      )}

      {/* Location Info */}
      <View style={styles.locationCard}>
        <Text style={styles.locationLabel}>📍 Vị trí:</Text>
        <Text style={styles.addressText}>{String(currentAddress)}</Text>
        <Text style={styles.coordsText}>
          Tọa độ: {latText}, {lngText}
        </Text>
      </View>

      {/* Map - Temporarily disabled due to missing API key */}
      {/* TODO: Add Google Maps API key to AndroidManifest.xml */}
      {currentLat && currentLng && (
        <View style={styles.mapContainer}>
          <TouchableOpacity style={styles.openMapsButton} onPress={handleOpenMaps}>
            <Text style={styles.openMapsText}>Mở trong Google Maps</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Timestamp */}
      {sosData?.createdAt && (
        <View style={styles.timestampCard}>
          <Text style={styles.timestampText}>
            Thời gian: {new Date(sosData.createdAt).toLocaleString('vi-VN')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#FF0000',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  requesterCard: {
    backgroundColor: '#FFF',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 15,
  },
  requesterInfo: {
    flex: 1,
  },
  requesterName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  requesterLabel: {
    fontSize: 14,
    color: '#666',
  },
  messageCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messageLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  locationCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  addressText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  coordsText: {
    fontSize: 12,
    color: '#999',
  },
  mapContainer: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
  },
  map: {
    height: 250,
  },
  openMapsButton: {
    backgroundColor: '#4285F4',
    padding: 12,
    alignItems: 'center',
  },
  openMapsText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionsContainer: {
    marginHorizontal: 15,
    marginBottom: 15,
  },
  actionButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2,
  },
  callButton: {
    backgroundColor: '#FF0000',
  },
  acknowledgeButton: {
    backgroundColor: '#FFA500',
  },
  resolveButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timestampCard: {
    marginHorizontal: 15,
    marginBottom: 30,
    padding: 10,
    alignItems: 'center',
  },
  timestampText: {
    fontSize: 12,
    color: '#999',
  },
});

export default SOSDetailScreen;
