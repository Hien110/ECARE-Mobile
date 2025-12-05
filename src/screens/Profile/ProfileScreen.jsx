import AsyncStorage from '@react-native-async-storage/async-storage';
import { pick } from '@react-native-documents/picker';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import userService from '../../services/userService';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Feather from 'react-native-vector-icons/Feather';

const THEME = {
  primary: '#4F7EFF',
  primarySoft: '#EAF2FF',
  text: '#0F172A',
  subtext: '#6B7280',
  bg: '#F6F8FF',
  white: '#FFFFFF',
  border: '#E6EDFF',
  success: '#16A34A',
  danger: '#EF4444',
};
const HEADER_COLOR = '#4F7EFF';

const AVATAR_FALLBACK =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-mAf0Q5orw3lJzIC2j6NFU6Ik2VNcgB.png';
const AVATAR_STAMP_KEY = 'ecare_avatar_updated_at';

const HEADER_H = 120;
const AVATAR = 96;

const ProfileScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarStamp, setAvatarStamp] = useState(0);

  // ===== Helpers =====
  const formatDate = d => {
    if (!d) return '';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const formatPhoneVNPlus = raw => {
    if (raw == null) return '';
    let s = String(raw).trim();
    s = s.replace(/[^\d+]/g, '');
    if (s.startsWith('00')) s = '+' + s.slice(2);
    if (s.startsWith('+')) return s;
    if (s.startsWith('84')) return '+' + s;
    if (s.startsWith('0')) return '+84' + s.slice(1);
    if (/^\d+$/.test(s)) return '+84' + s;
    return s.startsWith('+') ? s : '+' + s.replace(/^\+/, '');
  };

  const pickFirst = (obj, keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v === 0) return '0';
      if (typeof v === 'string' && v.trim() !== '') return v.trim();
      if (v != null && v !== '') return String(v);
    }
    return undefined;
  };

  // ===== Fetch user =====
  const fetchUser = useCallback(async () => {
    try {
      setError('');
      setLoading(true);

      const res = await userService.getUserInfo();
      const payload =
        res?.data?.data ??
        res?.data ??
        res?.user ??
        res?.data?.user ??
        res ??
        null;

      if (!payload || typeof payload !== 'object') {
        setUser(null);
        setError(res?.message || 'Không lấy được dữ liệu người dùng.');
      } else {
        setUser(payload);
      }

      const tsStr = await AsyncStorage.getItem(AVATAR_STAMP_KEY);
      if (tsStr && !Number.isNaN(Number(tsStr))) setAvatarStamp(Number(tsStr));
    } catch (e) {
      setError('Có lỗi khi tải thông tin. Vui lòng thử lại.');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUser();
    }, [fetchUser]),
  );
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUser();
    setRefreshing(false);
  }, [fetchUser]);

  // ===== Navigation & upload avatar =====
  const goBack = () => {
    navigation.navigate('PersonalInfo', {
      avatarUpdatedAt: avatarStamp || Date.now(),
    });
  };

  const toRNFile = obj => ({
    uri: obj?.fileCopyUri || obj?.uri,
    name:
      obj?.name ||
      obj?.fileName ||
      `avatar_${Date.now()}.${
        (obj?.type || 'image/jpeg').split('/')[1] || 'jpg'
      }`,
    type: obj?.type || 'image/jpeg',
  });

  const requestStorageIfNeeded = async () => {
    if (Platform.OS !== 'android') return true;
    const r33 = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
    );
    if (
      r33 === PermissionsAndroid.RESULTS.GRANTED ||
      r33 === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    )
      return true;
    const r32 = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    );
    return (
      r32 === PermissionsAndroid.RESULTS.GRANTED ||
      r32 === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    );
  };

  const handlePickFromLibrary = async () => {
    try {
      const ok = await requestStorageIfNeeded();
      if (!ok) {
        Alert.alert(
          'Cần quyền',
          'Vui lòng cấp quyền truy cập ảnh/tệp để chọn từ thư viện.',
        );
        return;
      }
      const result = await pick({
        type: ['image/*'],
        allowMultiSelection: false,
        mode: 'import',
        presentationStyle: 'fullScreen',
      });
      const file0 = Array.isArray(result) ? result[0] : result;
      if (!file0?.uri)
        return Alert.alert('Lỗi', 'Không lấy được ảnh từ thư viện.');
      await uploadAvatar(toRNFile(file0));
    } catch (e) {
      if (e?.code !== 'OPERATION_CANCELED')
        Alert.alert('Lỗi', e?.message || 'Không chọn được ảnh.');
    }
  };

  const showPickSheet = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Huỷ', 'Chọn từ thư viện'], cancelButtonIndex: 0 },
        idx => {
          if (idx === 1) handlePickFromLibrary();
        },
      );
    } else {
      Alert.alert('Cập nhật ảnh đại diện', 'Chọn nguồn ảnh', [
        { text: 'Thư viện', onPress: handlePickFromLibrary },
        { text: 'Huỷ', style: 'cancel' },
      ]);
    }
  };

  const uploadAvatar = async file => {
    try {
      setUploadingAvatar(true);
      const res = await userService.updateAvatar(file);
      if (!res?.success)
        throw new Error(res?.message || 'Cập nhật avatar thất bại');
      const newUrl = res?.data?.avatar;
      const ts = Date.now();
      setUser(prev => (prev ? { ...prev, avatar: newUrl } : prev));
      const nextUser = { ...(user || {}), avatar: newUrl };
      await AsyncStorage.setItem('ecare_user', JSON.stringify(nextUser));
      await AsyncStorage.setItem(AVATAR_STAMP_KEY, String(ts));
      navigation.navigate('PersonalInfo', { avatarUpdatedAt: ts });
      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện.');
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không thể cập nhật ảnh đại diện.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onEditAvatar = () => showPickSheet();

  const onEditField = field => {
    if (!navigation) return;
    if (field === 'phoneNumber') {
      navigation.navigate('ChangePhonenumber', {
        currentPhoneNumber: pickFirst(user, ['phoneNumber', 'phone']) || '',
      });
    } else if (field === 'email') {
      navigation.navigate('ChangeEmail', {
        currentEmail: pickFirst(user, ['email', 'mail']) || '',
      });
    }
  };
  const Header = () => (
    <View style={styles.headerWrap}>
      <View style={styles.headerRow}>
        {navigation.canGoBack() ? (
          <TouchableOpacity
            onPress={navigation.goBack}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <Feather name="chevron-left" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtnPlaceholder} />
        )}

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Danh sách lịch đặt</Text>
          <Text style={styles.headerSubtitle}>Theo dõi & quản lý đặt lịch</Text>
        </View>

        <TouchableOpacity
          onPress={onRefresh}
          style={styles.iconBtn}
          activeOpacity={0.8}
        >
          <Feather name="refresh-ccw" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
  // ===== Loading / Empty =====
  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.screen,
          { justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={{ marginTop: 12, color: THEME.subtext }}>
          Đang tải thông tin…
        </Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header title="Hồ sơ cá nhân" onBack={goBack} />
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { alignItems: 'center' }]}>
            <Icon name="alert-circle-outline" size={28} color={THEME.danger} />
            <Text style={styles.emptyTitle}>
              Không tìm thấy thông tin người dùng
            </Text>
            {!!error && <Text style={styles.emptyText}>{error}</Text>}
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 10 }]}
              onPress={fetchUser}
            >
              <Text style={styles.primaryBtnText}>Thử tải lại</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // cache-buster cho avatar
  const avatarUri = (() => {
    const raw = user?.avatar || AVATAR_FALLBACK;
    const sep = raw.includes('?') ? '&' : '?';
    return avatarStamp ? `${raw}${sep}v=${avatarStamp}` : raw;
  })();

  const display = {
    hometown: pickFirst(user, ['hometown', 'address', 'currentAddress']),
    identityCard: pickFirst(user, ['identityCard', 'identityNumber']),
    phoneNumber: formatPhoneVNPlus(pickFirst(user, ['phoneNumber', 'phone'])),
    email: pickFirst(user, ['email', 'mail']),
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header xanh bo góc đáy */}
      <Header />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 16,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.avatarWrap}>
          <Image
            key={String(avatarUri)}
            source={{ uri: avatarUri }}
            style={styles.avatar}
          />
          {uploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
          <TouchableOpacity
            style={styles.editAvatar}
            onPress={onEditAvatar}
            activeOpacity={0.9}
          >
            <Icon name="pencil" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        {/* Tên người dùng */}
        <View style={[styles.card, styles.center, { paddingTop: 16, marginTop: 16 }]}>
          <Text style={styles.name} numberOfLines={1}>
            {user?.fullName || '—'}
          </Text>
        </View>

        {/* Thông tin cá nhân */}
        <View style={styles.card}>
          <SectionHeader title="Thông tin cá nhân" />
          <InfoRow
            icon="calendar-outline"
            label="Ngày sinh"
            value={formatDate(user?.dateOfBirth)}
          />
          <InfoRow
            icon="male-female-outline"
            label="Giới tính"
            value={user?.gender || 'Khác'}
          />
          <InfoRow
            icon="home-outline"
            label="Quê quán"
            value={display.hometown}
          />
          <InfoRow
            icon="flag-outline"
            label="Quốc tịch"
            value={user?.nationality || 'Việt Nam'}
          />
          <InfoRow
            icon="document-text-outline"
            label="Số định danh"
            value={display.identityCard}
            isLast
          />
        </View>

        {/* Liên hệ */}
        <View style={styles.card}>
          <SectionHeader title="Liên hệ" />
          <InfoRow
            icon="call-outline"
            label="Số điện thoại"
            value={display.phoneNumber}
            actionText="Chỉnh sửa"
            onPress={() => onEditField('phoneNumber')}
          />
          <InfoRow
            icon="mail-outline"
            label="Email"
            value={display.email}
            actionText="Chỉnh sửa"
            onPress={() => onEditField('email')}
            isLast
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const SectionHeader = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const InfoRow = ({
  icon,
  label,
  value,
  actionText,
  onPress,
  isLast = false,
}) => (
  <View style={[styles.infoRow, isLast ? {} : styles.rowDivider]}>
    <View style={styles.infoLeft}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={18} color={THEME.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>
          {value == null || String(value).trim() === '' ? '—' : String(value)}
        </Text>
      </View>
    </View>
    {actionText && (
      <TouchableOpacity style={styles.inlineEditBtn} onPress={onPress}>
        <Text style={styles.inlineEditText}>{actionText}</Text>
      </TouchableOpacity>
    )}
  </View>
);

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },

  /* Header xanh */
  headerWrap: {
    backgroundColor: HEADER_COLOR,
    paddingHorizontal: wp('4%'),
    paddingTop: hp('1%'),
    paddingBottom: hp('2.4%'),
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
  iconBtnPlaceholder: { width: 40, height: 40 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: wp('5%'),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: wp('3.4%'),
    marginTop: 2,
  },
  /* Fallback header (khi chưa dùng hero) */
  fallbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },

  /* Avatar nổi */
  avatarWrap: {
    alignSelf: 'center',
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 4,
    borderColor: THEME.white,
    backgroundColor: '#EEF2FF',
    overflow: 'hidden',
    zIndex: 20,
    elevation: 6,
  },
  avatar: { width: '100%', height: '100%' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatar: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 200,
  },

  /* Cards & texts */
  card: {
    backgroundColor: THEME.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    }),
  },
  center: { alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '800', color: THEME.text },

  sectionHeader: { marginBottom: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: THEME.text },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.border,
  },
  infoLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fieldLabel: { fontSize: 12, color: THEME.subtext, marginBottom: 2 },
  fieldValue: { fontSize: 15, color: THEME.text, fontWeight: '500' },

  inlineEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.primary,
    backgroundColor: '#F5F8FF',
  },
  inlineEditText: { color: THEME.primary, fontSize: 13, fontWeight: '700' },

  /* Empty state */
  emptyTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    color: THEME.subtext,
    textAlign: 'center',
  },

  /* Buttons */
  primaryBtn: {
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: THEME.primary,
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    }),
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
});

export default ProfileScreen;
