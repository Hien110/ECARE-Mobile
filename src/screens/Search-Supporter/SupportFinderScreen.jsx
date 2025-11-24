import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import userService from '../../services/userService';
import routingService from '../../services/routingService';
import supporterService from '../../services/supporterService';

const SupportFinderScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();

  // ---- route params ----
  const { elderlyId } = route.params || {};
  const bookingDraft = route.params?.bookingDraft || null;

  // ---- state chính ----
  const [searchText, setSearchText] = useState('');
  const [supporters, setSupporters] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null); // location mặc định của người già (từ backend)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('distance'); // "distance" | "rating"
  const [hasCheckedLocation, setHasCheckedLocation] = useState(false);
  const [user, setUser] = useState(null); // người già nhận lịch

  // override địa chỉ/tọa độ để đặt lịch (không sửa DB)
  const [overrideAddress, setOverrideAddress] = useState(null);
  const [overrideLocation, setOverrideLocation] = useState(null);

  // UI nhập địa chỉ (Modal)
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressInput, setAddressInput] = useState(''); // số nhà, tên đường
  const [selectedCommune, setSelectedCommune] = useState('');
  const [communes, setCommunes] = useState([]);
  const [loadingCommunes, setLoadingCommunes] = useState(false);
  const [loadingCoordinates, setLoadingCoordinates] = useState(false);
  const [showCommuneDropdown, setShowCommuneDropdown] = useState(false);

  // danh sách supporter khả dụng theo bookingDraft (mảng userId)
  const [availableSupporters, setAvailableSupporters] = useState(null); // null = chưa load
  const [availableLoading, setAvailableLoading] = useState(false);

  // ---- load availableSupporters từ bookingDraft (nếu có) -----------------
  useEffect(() => {
    if (!bookingDraft) {
      // không có bookingDraft → không giới hạn supporter
      setAvailableSupporters(null);
      return;
    }

    const fetchAvailableSupporters = async () => {
      try {
        setAvailableLoading(true);
        const res = await supporterService.getAvailableSupporters(bookingDraft);

        if (res?.success) {
          console.log(res.data);
          
          const ids = res.data?.availableSupporterIds || [];
          setAvailableSupporters(ids);
        } else {
          // API fail → coi như không có supporter khả dụng cho booking này
          setAvailableSupporters([]);
          console.log('Available supporters: 0 (service fail)');
        }
      } catch (err) {
        console.error('Error fetching available supporters:', err);
        setAvailableSupporters([]);
      } finally {
        setAvailableLoading(false);
      }
    };

    fetchAvailableSupporters();
  }, [bookingDraft]);

  // ---- load elderly user từ elderlyId ----
  const fetchUser = useCallback(async () => {
    if (!elderlyId) {
      Alert.alert('Thiếu thông tin', 'Không có elderlyId. Vui lòng quay lại.');
      navigation.goBack?.();
      return;
    }

    const result = await userService.getUserById(elderlyId);
    if (result?.success && result.data) {
      setUser(result.data);

      // nếu backend đã có currentLocation thì set luôn (chỉ dùng khi chưa override)
      const coords = result.data?.currentLocation?.coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        const lon = Number(coords[0]);
        const lat = Number(coords[1]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          setCurrentLocation({ latitude: lat, longitude: lon });
        }
      }
    } else {
      Alert.alert('Lỗi', 'Không tải được thông tin người dùng.');
    }
  }, [elderlyId, navigation]);

  // Mỗi lần màn hình được focus → fetch user lại (nhưng KHÔNG reset override)
  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        if (!active) return;
        await fetchUser();
        // cho phép tính lại khoảng cách
        setHasCheckedLocation(false);
      })();

      return () => {
        active = false;
      };
    }, [fetchUser]),
  );

  // ---- user đã "áp" override (chỉ dùng trong flow đặt lịch) --------------
  const effectiveUser = useMemo(() => {
    if (!user) return null;

    const updated = { ...user };

    if (overrideAddress) {
      updated.currentAddress = overrideAddress;
    }

    if (overrideLocation) {
      updated.currentLocation = {
        type: 'Point',
        coordinates: [overrideLocation.longitude, overrideLocation.latitude],
      };
    }

    return updated;
  }, [user, overrideAddress, overrideLocation]);

  // Địa chỉ đang dùng để hiển thị & truyền đi
  const effectiveAddress =
    effectiveUser?.currentAddress || user?.currentAddress || null;

  // Toạ độ đang dùng để tính khoảng cách & truyền đi
  const effectiveLocation = useMemo(() => {
    const coords =
      effectiveUser?.currentLocation?.coordinates ||
      user?.currentLocation?.coordinates ||
      null;

    if (Array.isArray(coords) && coords.length === 2) {
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return { latitude: lat, longitude: lon };
      }
    }

    return overrideLocation || currentLocation || null;
  }, [effectiveUser, user, overrideLocation, currentLocation]);

  // ---- helpers: lấy location mặc định từ user (khi chưa override) ----
  const getCurrentUserLocation = async () => {
    try {
      if (!user) return null;

      const coords = user?.currentLocation?.coordinates;
      if (Array.isArray(coords) && coords.length === 2) {
        const lon = Number(coords[0]);
        const lat = Number(coords[1]);

        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const loc = { latitude: lat, longitude: lon };
          setCurrentLocation(loc);
          return loc;
        }
      }

      // Không có địa chỉ → để người thân nhập địa chỉ mới
      Alert.alert(
        'Thiết lập địa chỉ',
        'Người nhận lịch chưa có địa chỉ. Vui lòng nhập địa chỉ để đo khoảng cách.',
      );
      setLoading(false);
      return null;
    } catch (error) {
      console.error('Error getting current location:', error);
      setLoading(false);
      return null;
    }
  };

  // ---- fetch supporters theo 1 location cụ thể ----
  const fetchSupporters = async userLocation => {
    if (!userLocation) return;

    // Nếu có bookingDraft nhưng availableSupporters chưa load xong → chưa fetch
    if (bookingDraft && availableSupporters === null) {
      console.log(
        'Waiting for availableSupporters to load, skip fetchSupporters this time.',
      );
      return;
    }

    setLoading(true);

    try {
      let profiles = [];

      if (bookingDraft) {
        // Có bookingDraft → dùng danh sách supporter khả dụng
        if (
          Array.isArray(availableSupporters) &&
          availableSupporters.length > 0
        ) {
          const promises = availableSupporters.map(uid =>
            userService.getSupporterProfileByUserId(uid)
          );
          const results = await Promise.all(promises);
          
          profiles = results.filter(r => r?.success && r.data).map(r => r.data);
        } else if (
          Array.isArray(availableSupporters) &&
          availableSupporters.length === 0
        ) {
          // Có bookingDraft nhưng không có supporter khả dụng
          profiles = [];
        }
      } else {
        // Không có bookingDraft → lấy toàn bộ supporter
        const result = await userService.getAllSupporterProfiles();
        if (result?.success && Array.isArray(result.data)) {
          profiles = result.data;
        }
      }

      if (!Array.isArray(profiles) || profiles.length === 0) {
        setSupporters([]);
        setHasCheckedLocation(true);
        return;
      }
      console.log("danh sách người hỗ trợ", profiles);
      
      // ---- Tính khoảng cách ----
      const destinations = profiles
        .filter(p => {
          const c = p?.user?.currentLocation?.coordinates;
          return (
            Array.isArray(c) &&
            c.length === 2 &&
            c.every(n => Number.isFinite(Number(n)))
          );
        })
        .map(p => {
          const lon = Number(p.user.currentLocation.coordinates[0]);
          const lat = Number(p.user.currentLocation.coordinates[1]);
          return { lat, lon, profile: p };
        });

        console.log("Khoảng cách", destinations);
        
      const test = await routingService.calculateRoute(15.977962, 108.261863, 15.978579, 108.251182);
      console.log("TEst", test);
      let distanceResults = [];
      if (userLocation && destinations.length > 0) {
        distanceResults = await routingService.calculateMultipleDistances(
          userLocation.latitude,
          userLocation.longitude,
          destinations,
        );
      }

      
      console.log("khoảng cách từng người", distanceResults);
      console.log("Tọa độ mỗi người",userLocation);
      

      const supportersWithDistance = profiles.map(profile => {
        let distance = null,
          duration = null,
          distanceText = 'N/A',
          durationText = '';
        const c = profile?.user?.currentLocation?.coordinates;

        if (userLocation && Array.isArray(c) && c.length === 2) {
          const idx = destinations.findIndex(
            d => d.profile?._id === profile?._id,
          );
          const r = idx > -1 ? distanceResults[idx] : null;
          if (r?.success) {
            distance = r.distance;
            duration = r.duration;
            if (typeof distance === 'number') {
              distanceText = `${distance.toFixed(1)}km`;
              if (typeof duration === 'number')
                durationText = ` • ~${Math.round(duration)}p`;
            }
          }
        }

        return {
          id: profile?._id ?? `${Math.random()}`,
          name: profile?.user?.fullName || 'Chưa có tên',
          rating: profile?.ratingStats?.averageRating || 0,
          reviewCount: profile?.ratingStats?.totalRatings || 0,
          distance: distanceText + durationText,
          distanceValue: distance,
          duration,
          experience: profile?.experience?.description || 'Chưa có mô tả',
          avatar:
            profile?.user?.avatar ||
            'https://cdn.sforum.vn/sforum/wp-content/uploads/2023/10/avatar-trang-4.jpg',
          serviceArea: profile?.serviceArea || 10,
          totalYears: profile?.experience?.totalYears || 0,
          user: profile?.user,
          profile,
        };
      });

      // ---- Sắp xếp theo khoảng cách ----
      supportersWithDistance.sort((a, b) => {
        if (a.distanceValue == null && b.distanceValue == null) return 0;
        if (a.distanceValue == null) return 1;
        if (b.distanceValue == null) return -1;
        return a.distanceValue - b.distanceValue;
      });

      setSupporters(supportersWithDistance);
      setHasCheckedLocation(true);
    } catch (e) {
      console.error('Error fetching supporters:', e);
      setSupporters([]);
      setHasCheckedLocation(true);
    } finally {
      setLoading(false);
    }
  };

  // ---- lifecycle: sau khi đã có user / location thì mới fetch supporters ----
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const run = async () => {
        if (!user) return; // chờ load người già

        // Ưu tiên dùng location override, nếu không thì location mặc định
        let loc = overrideLocation || effectiveLocation || currentLocation;

        if (!loc) {
          loc = await getCurrentUserLocation();
        }

        if (!isActive) return;
        if (loc && !hasCheckedLocation) {
          await fetchSupporters(loc);
        }
      };

      run();
      return () => {
        isActive = false;
      };
    }, [
      user,
      overrideLocation,
      effectiveLocation,
      currentLocation,
      hasCheckedLocation,
      bookingDraft,
      availableSupporters,
    ]),
  );

  // ---- refresh ----
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      let loc =
        overrideLocation ||
        effectiveLocation ||
        currentLocation ||
        (await getCurrentUserLocation());
      if (loc) await fetchSupporters(loc);
    } finally {
      setRefreshing(false);
    }
  }, [overrideLocation, effectiveLocation, currentLocation, user, bookingDraft, availableSupporters]);

  // ---- GEOCODING & COMMUNE ----------------------------------------------

  const fetchCommunes = useCallback(async () => {
    setLoadingCommunes(true);
    try {
      const response = await fetch(
        'https://production.cas.so/address-kit/2025-07-01/provinces/48/communes',
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const communesList = data.communes || [];
      setCommunes(communesList);

      // auto chọn xã từ currentAddress nếu có
      if (effectiveAddress && communesList.length > 0 && !selectedCommune) {
        const addressParts = effectiveAddress.split(',');
        if (addressParts.length > 1) {
          const communePart = addressParts[1].trim().toLowerCase();
          const matching = communesList.find(
            c =>
              c.name.toLowerCase().includes(communePart) ||
              communePart.includes(c.name.toLowerCase()),
          );
          if (matching) {
            setSelectedCommune(matching.code);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching communes:', error);
      setCommunes([]);
      Alert.alert('Lỗi', 'Không thể tải danh sách xã. Vui lòng thử lại.');
    } finally {
      setLoadingCommunes(false);
    }
  }, [effectiveAddress, selectedCommune]);

  useEffect(() => {
    fetchCommunes();
  }, [fetchCommunes]);

  const getSelectedCommuneLabel = () => {
    if (!Array.isArray(communes) || communes.length === 0) {
      return 'Chọn xã/phường';
    }
    const commune = communes.find(c => c.code === selectedCommune);
    return commune ? commune.name : 'Chọn xã/phường';
  };

  // Geocode địa chỉ → trả về tọa độ
  const getCoordinatesFromAddress = async fullAddress => {
    try {
      setLoadingCoordinates(true);

      // Mặc định: trung tâm Đà Nẵng
      let baseCoordinates = {
        latitude: 16.0471,
        longitude: 108.2068,
      };

      // điều chỉnh nhẹ theo commune cho đa dạng
      const selectedCommuneObj = communes.find(c => c.code === selectedCommune);
      if (selectedCommuneObj) {
        const offset = parseInt(selectedCommuneObj.code, 10) % 100;
        baseCoordinates.latitude += offset * 0.001 - 0.05;
        baseCoordinates.longitude += offset * 0.0015 - 0.075;
      }

      // cố gắng gọi Nominatim, nếu fail thì dùng baseCoordinates
      try {
        const encodedAddress = encodeURIComponent(fullAddress);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=vn`,
          {
            headers: {
              'User-Agent': 'ECare-Mobile-App/1.0',
            },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            const { lat, lon } = data[0];
            baseCoordinates = {
              latitude: parseFloat(lat),
              longitude: parseFloat(lon),
            };
          }
        }
      } catch (geoErr) {
        console.log(
          'Geocoding failed, using base coordinates:',
          geoErr.message,
        );
      }

      return baseCoordinates;
    } catch (error) {
      console.error('Get coordinates error:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi lấy tọa độ.');
      return null;
    } finally {
      setLoadingCoordinates(false);
    }
  };

  // Khi bấm nút Lưu trong modal, set overrideAddress & overrideLocation
  const handleSaveAddressOverride = async () => {
    if (!addressInput.trim() || !selectedCommune) {
      Alert.alert(
        'Thông báo',
        'Vui lòng điền đầy đủ địa chỉ và chọn xã/phường',
      );
      return;
    }

    const communeObj = communes.find(c => c.code === selectedCommune);
    const fullAddress = `${addressInput.trim()}, ${
      communeObj?.name || ''
    }, Đà Nẵng, Việt Nam`;

    const coords = await getCoordinatesFromAddress(fullAddress);
    if (!coords) return;

    // Lưu địa chỉ/toạ độ này để dùng cho lần đặt lịch hiện tại
    setOverrideAddress(fullAddress);
    setOverrideLocation(coords);
    setShowAddressModal(false);

    // Sau khi đổi địa chỉ → tính lại khoảng cách
    await fetchSupporters(coords);
  };

  // Khi mở modal → preset từ effectiveAddress
  const openAddressModal = () => {
    if (effectiveAddress) {
      const parts = effectiveAddress.split(',');
      if (parts.length > 0) {
        setAddressInput(parts[0].trim());
      }
    } else {
      setAddressInput('');
    }
    setShowCommuneDropdown(false);
    setShowAddressModal(true);
  };

  // ---- derived data: filter & sort supporters ----------------------------
  const filtered = useMemo(() => {
    const q = (searchText || '').toLowerCase();
    return supporters.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.experience.toLowerCase().includes(q),
    );
  }, [supporters, searchText]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (activeFilter === 'distance') {
      arr.sort((a, b) => {
        if (a.distanceValue == null && b.distanceValue == null) return 0;
        if (a.distanceValue == null) return 1;
        if (b.distanceValue == null) return -1;
        return a.distanceValue - b.distanceValue;
      });
    } else if (activeFilter === 'rating') {
      arr.sort((a, b) => b.rating - a.rating);
    }
    return arr;
  }, [filtered, activeFilter]);

  // ---- UI elements -------------------------------------------------------
  const StarRow = ({ rating }) => {
    const full = Math.floor(rating);
    const half = rating % 1 !== 0;
    const items = [];
    for (let i = 0; i < full; i++) {
      items.push(
        <Text key={i} style={styles.star}>
          ★
        </Text>,
      );
    }
    if (half) {
      items.push(
        <Text key="half" style={styles.star}>
          ☆
        </Text>,
      );
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {items}
        <Text style={styles.ratingText}> {rating} </Text>
      </View>
    );
  };

  const Chip = ({ active, label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipOutline]}
    >
      <Text
        style={[
          styles.chipText,
          active ? styles.chipTextActive : styles.chipTextOutline,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const Badge = ({ text }) => (
    <View style={styles.badge}>
      <Icon name="navigate" size={12} color="#1e3a8a" />
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );

  const ProviderCard = ({ item: p }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Image source={{ uri: p.avatar }} style={styles.avatar} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{p.name}</Text>
          <StarRow rating={p.rating} />
          <Text numberOfLines={2} style={styles.bio}>
            {p.experience}
          </Text>
          <View style={{ marginTop: 6 }}>
            <Badge text={p.distance} />
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() =>
            navigation.navigate('SupporterProfile', {
              supporter: p,
              user: effectiveUser || user,
            })
          }
        >
          <Text style={styles.btnPrimaryText}>Xem chi tiết</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() =>
            navigation.navigate('PaymentBookingScreen', {
              supporter: p,
              bookingDraft,
              user: effectiveUser || user, // user mang địa chỉ/toạ độ mới
              visitAddress: effectiveAddress,
              visitLocation: effectiveLocation,
            })
          }
        >
          <Text style={styles.btnPrimaryText}>Chọn người hỗ trợ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Banner hiển thị địa chỉ đang dùng + nút Thay đổi
  const LocationNotice = () => {
    if (!effectiveAddress && !effectiveLocation) return null;

    const addressText =
      effectiveAddress ||
      (effectiveLocation
        ? `(${effectiveLocation.latitude?.toFixed(
            5,
          )}, ${effectiveLocation.longitude?.toFixed(5)})`
        : '');

    return (
      <View style={styles.locationNotice}>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}
        >
          <Icon
            name="location-outline"
            size={16}
            color="#0ea5e9"
            style={{ marginTop: 2 }}
          />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={styles.locationTitle}>
              Đang dùng địa chỉ này để đo khoảng cách
            </Text>
            <Text style={styles.locationText}>{addressText}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.changeBtn} onPress={openAddressModal}>
          <Text style={styles.changeBtnText}>Thay đổi</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const ListHeader = () => (
    <>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tìm người hỗ trợ</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Icon name="search" size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Nhập để tìm kiếm..."
            placeholderTextColor="#9ca3af"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        <Chip
          label="Khoảng cách"
          active={activeFilter === 'distance'}
          onPress={() => setActiveFilter('distance')}
        />
        <Chip
          label="Đánh giá"
          active={activeFilter === 'rating'}
          onPress={() => setActiveFilter('rating')}
        />
      </View>

      {/* Location notice */}
      <LocationNotice />
    </>
  );

  // ---- render ------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar backgroundColor="#2563eb" barStyle="light-content" />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Đang tìm kiếm người hỗ trợ...</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item =>
            item.id || item.user?._id || Math.random().toString(36)
          }
          renderItem={ProviderCard}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2563eb']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Không tìm thấy người hỗ trợ nào
              </Text>
              <Text style={styles.emptySubText}>
                Thử tìm kiếm với từ khoá khác
              </Text>
            </View>
          }
          ListFooterComponent={
            sorted.length > 0 ? (
              <View style={styles.infoContainer}>
                <Text style={styles.infoTitle}>ℹ️ Thông tin khoảng cách:</Text>
                <Text style={styles.infoText}>
                  • Khoảng cách tính theo đường đi thực tế.
                </Text>
                <Text style={styles.infoText}>
                  • "~Xp" là thời gian di chuyển ước tính.
                </Text>
                <Text style={styles.infoText}>
                  • "N/A" nếu không tính được đường đi.
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Modal nhập địa chỉ ngay trên SupportFinder */}
      <Modal
        visible={showAddressModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Địa chỉ đặt lịch</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 450 }}
              contentContainerStyle={{ padding: 16 }}
            >
              {/* Street address */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Số nhà, tên đường <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={addressInput}
                  onChangeText={setAddressInput}
                  placeholder="VD: 123 Nguyễn Văn Linh"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* City (fixed) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Tỉnh/Thành phố <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.fixedInput}>
                  <Text style={styles.fixedInputText}>Đà Nẵng</Text>
                </View>
              </View>

              {/* Commune picker */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Xã/Phường <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => {
                    if (!communes.length) {
                      fetchCommunes();
                    }
                    setShowCommuneDropdown(prev => !prev); // toggle mở/đóng
                  }}
                  disabled={loadingCommunes}
                >
                  {loadingCommunes ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.dropdownText,
                          !selectedCommune && styles.placeholderText,
                        ]}
                      >
                        {getSelectedCommuneLabel()}
                      </Text>
                      <Text style={styles.dropdownArrow}>▼</Text>
                    </>
                  )}
                </TouchableOpacity>

                {showCommuneDropdown &&
                  !loadingCommunes &&
                  communes.length > 0 && (
                    <View style={styles.communeList}>
                      <ScrollView
                        style={{ maxHeight: 160 }}
                        nestedScrollEnabled
                      >
                        {communes.map(c => (
                          <TouchableOpacity
                            key={c.code}
                            style={[
                              styles.communeItem,
                              selectedCommune === c.code &&
                                styles.communeItemSelected,
                            ]}
                            onPress={() => {
                              setSelectedCommune(c.code);
                              setShowCommuneDropdown(false); // chọn xong đóng dropdown
                            }}
                          >
                            <Text
                              style={[
                                styles.communeItemText,
                                selectedCommune === c.code &&
                                  styles.communeItemTextSelected,
                              ]}
                            >
                              {c.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
              </View>

              {/* Hint */}
              <Text style={styles.modalHint}>
                Địa chỉ này chỉ dùng để đo khoảng cách và đặt lịch lần này,
                không thay đổi địa chỉ mặc định trong hồ sơ người già.
              </Text>

              {/* Save button */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (loadingCoordinates ||
                    !addressInput.trim() ||
                    !selectedCommune) &&
                    styles.saveButtonDisabled,
                ]}
                onPress={handleSaveAddressOverride}
                disabled={
                  loadingCoordinates || !addressInput.trim() || !selectedCommune
                }
              >
                {loadingCoordinates ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Lưu địa chỉ</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // layout
  container: { flex: 1, backgroundColor: '#f5f7fb' },

  // header
  header: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  backButton: { padding: 6, marginRight: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // search
  searchWrap: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  searchBar: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#0f172a' },

  // filters
  filterRow: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 10,
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
  chipActive: { backgroundColor: '#2563eb' },
  chipOutline: {
    borderWidth: 1,
    borderColor: '#1e3a8a',
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipTextOutline: { color: '#2563eb' },

  // list/card
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e5e7eb',
  },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  star: { color: '#f59e0b', fontSize: 14 },
  ratingText: { fontSize: 12, color: '#6b7280' },
  bio: { marginTop: 6, fontSize: 13, color: '#4b5563' },

  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0e7ff',
    borderColor: '#c7d2fe',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: { color: '#2563eb', fontSize: 12, fontWeight: '600' },

  cardActions: { marginTop: 12, flexDirection: 'row', gap: 10 },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },

  // states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: { marginTop: 10, fontSize: 15, color: '#475569' },

  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySubText: { fontSize: 13, color: '#64748b' },

  infoContainer: {
    backgroundColor: '#f8fafc',
    padding: 14,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  infoText: { fontSize: 12, color: '#475569', lineHeight: 16 },

  // location notice
  locationNotice: {
    backgroundColor: '#ecfeff',
    borderColor: '#bae6fd',
    borderWidth: 1,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0c4a6e',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#0c4a6e',
  },
  changeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#06b6d4',
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  changeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },

  // Modal & address form
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2563eb',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    fontSize: 20,
    color: '#bfdbfe',
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  required: {
    color: '#ef4444',
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fixedInput: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  fixedInputText: {
    fontSize: 15,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  dropdownButton: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },
  placeholderText: {
    color: '#9ca3af',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6b7280',
  },
  communeList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  communeItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  communeItemSelected: {
    backgroundColor: '#dbeafe',
  },
  communeItemText: {
    fontSize: 14,
    color: '#111827',
  },
  communeItemTextSelected: {
    fontWeight: '600',
    color: '#1d4ed8',
  },
  modalHint: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default SupportFinderScreen;
