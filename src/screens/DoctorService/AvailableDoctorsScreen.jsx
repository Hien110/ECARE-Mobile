import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { doctorBookingService } from '../../services/doctorBookingService';

const DoctorItem = ({ item, onPress }) => {
  const rating =
    item?.ratingStats?.averageRating ?? item.rating ?? item.avgRating ?? item.averageRating ?? null;
  const ratingCount =
    item?.ratingStats?.totalRatings ?? item.ratingCount ?? item.reviewCount ?? item.reviews ?? 0;
  return (
    <TouchableOpacity style={styles.item} onPress={() => onPress(item)}>
      <View style={styles.itemLeft}>
        {item?.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{(item.fullName || 'B').slice(0, 1)}</Text>
          </View>
        )}

        <View style={styles.infoBlock}>
          <Text style={styles.name}>{item.fullName}</Text>
          {item.specialization ? <Text style={styles.spec}>{item.specialization}</Text> : null}
          {rating != null ? (
            <View style={styles.ratingRow}>
              <Icon name="star" size={14} color="#FBBF24" />
              <Text style={styles.ratingText}>{` ${Number(rating).toFixed(1)} (${ratingCount || 0})`}</Text>
            </View>
          ) : ratingCount === 0 ? (
            <Text style={styles.noRating}>Chưa có đánh giá</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.itemRight}>
        <View style={styles.chevCircle}>
          <Icon name="chevron-forward" size={18} color="#4B5563" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const AvailableDoctorsScreen = ({ navigation, route }) => {
  const { scheduledDate, slot, specialization, elderly, family } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await doctorBookingService.getAvailableDoctors({ scheduledDate, slot, specialization });
        if (mounted && res?.success) {
          setList(res.data || []);
        } else {
          setError(res?.message || 'Không có bác sĩ khả dụng');
        }
      } catch (e) {
        setError('Lỗi khi gọi server');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [scheduledDate, slot, specialization]);

  const slotLabelDisplay = slot === 'morning' ? 'Sáng' : 'Chiều';
  const slotTime = slot === 'morning' ? '08:00 - 11:00' : '14:00 - 17:00';

  const handleSelect = (doc) => {
    // Navigate to payment/booking screen with doctor + scheduled time + elderly/family
    navigation.navigate('PaymentServiceScreen', {
      doctor: doc,
      scheduledDate,
      slot,
      slotLabel: `${slotLabelDisplay} • ${slotTime}`,
      price: doc.consultationFee || doc.price || null,
      elderly: elderly || null,
      family: family || null,
    });
  };

  const filtered = Array.isArray(list)
    ? list.filter((i) => {
        if (!search) return true;
        const name = (i.fullName || '').toLowerCase();
        return name.includes(search.trim().toLowerCase());
      })
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Chọn bác sĩ</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.container}>
        <Text style={styles.hint}>Ngày: {scheduledDate} • Ca: {slotLabelDisplay} • {slotTime}</Text>

        <View style={styles.searchContainer}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm bác sĩ theo tên"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
              <Text style={{ color: '#6B7280' }}>X</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : error ? (
          <Text style={{ color: '#DC2626', marginTop: 12 }}>{error}</Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => String(i.doctorId || i._id || i.id)}
            renderItem={({ item }) => <DoctorItem item={item} onPress={handleSelect} />}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{ paddingVertical: 12 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default AvailableDoctorsScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFF' },
  header: { height: 56, backgroundColor: '#fff', alignItems: 'center', flexDirection: 'row', paddingHorizontal: 12 },
  back: { width: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 16 },
  container: { padding: 16 },
  hint: { color: '#6B7280', marginBottom: 12 },
  item: { backgroundColor: '#fff', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4F7EFF', alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '700' },
  spec: { color: '#6B7280', marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  ratingText: { color: '#6B7280', marginLeft: 4, fontSize: 13 },
  noRating: { color: '#9CA3AF', marginTop: 6, fontSize: 13 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E6EEFF' },
  avatarInitial: { color: '#fff', fontWeight: '700', fontSize: 18 },
  infoBlock: { marginLeft: 14 },
  item: { backgroundColor: '#fff', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  itemRight: { width: 40, alignItems: 'flex-end' },
  chevCircle: { width: 34, height: 34, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchInput: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  clearBtn: { marginLeft: 8, padding: 8 },
});
