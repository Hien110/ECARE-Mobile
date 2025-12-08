import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import socketService from '../../services/socketService';
import userService from '../../services/userService';
import { disableFloating } from '../../utils/floatingCheckinHelper';

import {
  heightPercentageToDP as hp,
  widthPercentageToDP as wp,
} from 'react-native-responsive-screen';
/* ====== Theme ====== */
const PRIMARY = '#2F66FF';
const PRIMARY_DARK = '#1E4EEB';
const WHITE = '#FFFFFF';
const SURFACE = '#F6F8FF';
const TEXT = '#0F172A';
const SUB = '#6B7280';
const BORDER = '#E6EDFF';
const HEADER_COLOR = '#4F7EFF';

const AVATAR_FALLBACK =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-mAf0Q5orw3lJzIC2j6NFU6Ik2VNcgB.png';

const AVATAR_STAMP_KEY = 'ecare_avatar_updated_at';

const COVER_H = 90;
const AVATAR_SIZE = 96;

const PersonalInfoScreen = ({ navigation }) => {
  const route = useRoute();

  const [user, setUser] = useState(null);
  const [avatarStamp, setAvatarStamp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  /* ===== Helpers ===== */
  const readLocalUser = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('ecare_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const readLocalStamp = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(AVATAR_STAMP_KEY);
      return raw ? Number(raw) : 0;
    } catch {
      return 0;
    }
  }, []);

  /* ===== API ===== */
  const fetchUser = useCallback(async () => {
    try {
      setError('');
      setLoading(true);

      const res = await userService.getUser?.();
      if (res?.success) {
        let nextUser = res.data || null;

        // Ưu tiên avatar local nếu vừa cập nhật
        const routeStamp = route?.params?.avatarUpdatedAt || 0;
        const [localUser, localStamp] = await Promise.all([
          readLocalUser(),
          readLocalStamp(),
        ]);
        const effectiveStamp = routeStamp || localStamp;

        if (effectiveStamp && localUser?.avatar) {
          nextUser = { ...(nextUser || {}), avatar: localUser.avatar };
        }

        setUser(nextUser);
        try {
          await AsyncStorage.setItem('ecare_user', JSON.stringify(nextUser));
        } catch {}
      } else {
        setUser(null);
        setError(res?.message || 'Không tải được thông tin người dùng.');
      }
    } catch {
      setUser(null);
      setError('Có lỗi khi tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [readLocalUser, readLocalStamp, route?.params?.avatarUpdatedAt]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [local, stamp] = await Promise.all([
          readLocalUser(),
          readLocalStamp(),
        ]);
        if (local) setUser(local);
        if (stamp) setAvatarStamp(stamp);
        await fetchUser();
      })();
    }, [fetchUser, readLocalUser, readLocalStamp]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUser();
    setRefreshing(false);
  }, [fetchUser]);

  const onLogout = useCallback(async () => {
    try {
      // Lấy FCM token từ AsyncStorage để gửi lên backend
      const fcmToken = await AsyncStorage.getItem('fcm_token');
      
      // Gọi API logout để xóa FCM token trên backend
      if (fcmToken) {
        try {
          console.log('📤 Calling logout API to remove FCM token...');
          await userService.logout?.({ token: fcmToken });
        } catch (error) {
          console.log('⚠️  Warning - logout API call failed:', error?.message);
          // Tiếp tục logout ngay cả khi API call fail
        }
      }
      
      await disableFloating();
      socketService.disconnect();
      await AsyncStorage.multiRemove([
        'ecare_token',
        'ecare_user',
        AVATAR_STAMP_KEY,
        'fcm_token',
      ]);
    } finally {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  }, [navigation]);

  /* ===== Derived ===== */
  const routeStamp = route?.params?.avatarUpdatedAt || 0;
  const effectiveStamp = routeStamp || avatarStamp;

  const avatarUri = useMemo(() => {
    const raw = (user?.avatar && String(user.avatar)) || AVATAR_FALLBACK;
    if (!effectiveStamp) return raw;
    const sep = raw.includes('?') ? '&' : '?';
    return `${raw}${sep}v=${effectiveStamp}`;
  }, [user?.avatar, effectiveStamp]);

  const role = String(user?.role || '').toLowerCase();
  const isElderly = role === 'elderly';
  const roleLabel =
    role === 'elderly'
      ? 'Người cao tuổi'
      : role === 'family'
      ? 'Người thân'
      : role === 'supporter'
      ? 'Người hỗ trợ'
      : role || '—';

  /* ===== UI pieces ===== */
  const MenuItem = ({
    bg,
    icon,
    iconLib = 'ion',
    color,
    title,
    value,
    onPress,
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.menuLeft}>
        <View style={[styles.menuIcon, { backgroundColor: bg }]}>
          {iconLib === 'ion' ? (
            <Icon name={icon} size={20} color={color} />
          ) : (
            <MaterialIcons name={icon} size={20} color={color} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuTitle}>{title}</Text>
          {!!value && <Text style={styles.menuSub}>{value}</Text>}
        </View>
      </View>
      <Icon name="chevron-forward" size={18} color="#A3AED0" />
    </TouchableOpacity>
  );

  const Header = () => (
    <View style={styles.headerWrap}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Icon name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Cá nhân</Text>
          <Text style={styles.headerSubtitle}>Quản lí hồ sơ cá nhân</Text>
        </View>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onRefresh}
          activeOpacity={0.8}
        >
          <Icon name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      {/* Cover + Header */}
      <Header />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Avatar floating */}
        <View style={styles.avatarWrap}>
          {loading ? (
            <View style={[styles.avatar, styles.avatarCenter]}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          ) : (
            <Image
              key={String(avatarUri)}
              source={{ uri: avatarUri }}
              style={styles.avatar}
            />
          )}
        </View>
        {/* Name + role */}
        <View style={styles.identityCard}>
          <Text style={styles.nameText} numberOfLines={1}>
            {user?.fullName || ' '}
          </Text>
          {!!roleLabel && (
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
          )}
        </View>

        {/* Error box */}
        {!!error && (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchUser} style={styles.retryBtn}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Menu cards */}
        <View style={styles.card}>
          <MenuItem
            bg="#EAF2FF"
            iconLib="mat"
            icon="person"
            color={PRIMARY}
            title="Thông tin cá nhân"
            onPress={() => navigation.navigate('Profile')}
          />

          {isElderly && (
            <MenuItem
              bg="#EAF7F0"
              icon="heart"
              color="#22C55E"
              title="Thông tin sức khỏe"
              onPress={() => navigation.navigate('HealthRecord')}
            />
          )}

          <MenuItem
            bg="#FFF3E0"
            iconLib="mat"
            icon="lock"
            color="#F59E0B"
            title="Thay đổi mật khẩu"
            onPress={() => navigation.navigate('ChangePassword')}
          />

          <MenuItem
            bg="#FBE8FF"
            iconLib="mat"
            icon="home"
            color="#A855F7"
            title="Địa chỉ nhà"
            onPress={() => navigation.navigate('AddressPicker')}
          />

          <MenuItem
            bg="#FFE4E6"
            iconLib="mat"
            icon="logout"
            color="#EF4444"
            title="Đăng xuất"
            onPress={onLogout}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

/* ===== Styles ===== */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SURFACE },

  /* Cover / Header */
  headerWrap: {
    backgroundColor: HEADER_COLOR,
    paddingHorizontal: wp(4),
    paddingTop: hp(1),
    paddingBottom: hp(2.2),
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: wp(3.4),
    marginTop: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  circle: {
    borderRadius: 9999,
    backgroundColor: PRIMARY_DARK,
    opacity: 0.18,
  },

  /* Avatar float */
  avatarWrap: {
    top: 10,
    alignSelf: 'center',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: WHITE,
    backgroundColor: '#EEF2FF',
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarCenter: { alignItems: 'center', justifyContent: 'center' },

  /* Identity */
  identityCard: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  nameText: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
  },
  rolePill: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: BORDER,
  },
  roleText: { color: PRIMARY, fontWeight: '700', fontSize: 12 },

  /* Error box */
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFF1F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: { flex: 1, color: '#9F1239', fontSize: 13 },
  retryBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  retryText: { color: PRIMARY, fontWeight: '700', fontSize: 13 },

  /* Menu card */
  card: {
    marginHorizontal: 16,
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5FF',
    justifyContent: 'space-between',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuTitle: { fontSize: 15.5, color: TEXT, fontWeight: '600' },
  menuSub: { fontSize: 12, color: SUB, marginTop: 2 },
});

export default PersonalInfoScreen;
