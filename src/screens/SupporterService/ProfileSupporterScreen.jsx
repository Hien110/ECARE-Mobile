// src/screens/Supporter/ProfileSupporterScreen.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import {
  ScrollView,
  View,
  Text,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  Star,
  MapPin,
  Clock,
  Heart,
  Award,
  ShieldCheck,
  Phone,
  MessageCircle,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import supporterSchedulingService from '../../services/supporterSchedulingService';
import { ratingService } from '../../services/ratingService';
import Card from '../../components/Cart';

const TAG = '[ProfileSupporterScreen]';

export default function ProfileSupporterScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  // route.params vẫn giữ nguyên cho tương lai nếu cần override
  const {
    supporterName,
    supporter,
  } = route.params || {};

  const [profile, setProfile] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loadingRatings, setLoadingRatings] = useState(false);

  // ====== LOG route params ======
  useEffect(() => {
    console.log(TAG, 'route params =', route.params);
  }, [route.params]);

  // ====== Helper lấy supporterId từ route (nếu có) ======
  const supporterIdFromRoute =
    supporter?.profile?.user?._id ||   // trường hợp object có profile.user._id
    supporter?.user?._id ||            // trường hợp object có user._id
    supporter?.supporterUserId ||      // nếu backend trả sẵn field này
    supporter?.supporterId ||          // hoặc field supporterId
    supporter?.id ||                   // fallback: id (ít ưu tiên hơn)
    supporter?._id ||                  // fallback: _id
    null;

  // ====== CHỈ GỌI API getSupporterDetail (KHÔNG DÙNG getMyProfile NỮA) ======
  useEffect(() => {
    const fetchProfile = async () => {
      if (!supporterIdFromRoute) {
        console.log(
          TAG,
          '⚠️ Không có supporterIdFromRoute, không gọi getSupporterDetail',
        );
        return;
      }

      try {
        console.log(
          TAG,
          '➡️ call supporterSchedulingService.getSupporterDetail() with supporterId =',
          supporterIdFromRoute,
        );
        const res = await supporterSchedulingService.getSupporterDetail(
          supporterIdFromRoute,
        );
        console.log(
          TAG,
          '✅ getSupporterDetail response =',
          JSON.stringify(res, null, 2),
        );

        if (res?.success && res?.data) {
          setProfile(res.data); // đã giải mã address / phone / email ở BE
        } else {
          console.log(
            TAG,
            '❌ getSupporterDetail success = false',
            res?.message,
          );
        }
      } catch (e) {
        console.log(
          TAG,
          '❌ fetch profile error =',
          e?.response?.data || e?.message || e,
        );
      }
    };

    fetchProfile();
  }, [supporterIdFromRoute]);

  // LOG khi profile cập nhật
  useEffect(() => {
    console.log(TAG, 'profile state updated =', profile);
  }, [profile]);

  // ====== GỌI API LẤY DANH SÁCH ĐÁNH GIÁ ======
  useEffect(() => {
    const fetchRatings = async () => {
      if (!supporterIdFromRoute) {
        console.log(TAG, '⚠️ Không có supporterIdFromRoute, không gọi getRatingsByUserId');
        return;
      }

      setLoadingRatings(true);
      try {
        console.log(TAG, '➡️ call ratingService.getRatingsByUserId() with userId =', supporterIdFromRoute);
        const res = await ratingService.getRatingsByUserId(supporterIdFromRoute);
        console.log(TAG, '✅ getRatingsByUserId response =', JSON.stringify(res, null, 2));

        if (res?.success && res?.data?.data) {
          // Filter chỉ lấy ratings active và thuộc support_service
          const supportRatings = res.data.data.filter(
            r => r.status === 'active' && r.ratingType === 'support_service'
          );
          setRatings(supportRatings);
        } else {
          console.log(TAG, '❌ getRatingsByUserId success = false', res?.message);
          setRatings([]);
        }
      } catch (e) {
        console.log(TAG, '❌ fetch ratings error =', e?.response?.data || e?.message || e);
        setRatings([]);
      } finally {
        setLoadingRatings(false);
      }
    };

    fetchRatings();
  }, [supporterIdFromRoute]);

  // ====== LẤY DATA HIỂN THỊ – ƯU TIÊN TỪ profile (API) ======
    const userFromProfile =
    profile ||               // BE trả object user đã flatten
    profile?.user ||
    profile?.userDecrypted ||
    profile?.supporterUser ||
    null;

  // Tên hiển thị
  const displayName =
    supporterName ||
    userFromProfile?.fullName ||
    supporter?.name ||
    supporter?.fullName ||
    supporter?.user?.fullName ||
    'Người hỗ trợ';

  const avatarUri =
    userFromProfile?.avatar ||
    supporter?.avatar ||
    supporter?.user?.avatar ||
    'https://raw.githubusercontent.com/ranui-ch/images/main/doctor_profile_placeholder.png';

  // Rating & review
  const averageRatingRaw =
    typeof profile?.ratingStats?.averageRating === 'number'
      ? profile.ratingStats.averageRating
      : typeof supporter?.rating === 'number'
      ? supporter.rating
      : 0;

  const averageRating = Number.isFinite(averageRatingRaw)
    ? averageRatingRaw
    : 0;

  const totalRatings =
    typeof profile?.ratingStats?.totalRatings === 'number'
      ? profile.ratingStats.totalRatings
      : typeof supporter?.reviewCount === 'number'
      ? supporter.reviewCount
      : 0;

  // Kinh nghiệm
  const experienceSource =
  profile?.experience ||
  supporter?.profile?.experience ||   // trường hợp supporter.profile.experience = { totalYears, description }
  (typeof supporter?.experience === 'object' ? supporter.experience : null) ||
  null;

const experienceYears =
  typeof experienceSource?.totalYears === 'number'
    ? experienceSource.totalYears
    : typeof supporter?.totalYears === 'number'
    ? supporter.totalYears
    : null;

const experienceDescription =
  (experienceSource?.description &&
    String(experienceSource.description).trim()) ||
  (typeof supporter?.experience === 'string' &&
    supporter.experience.trim()) ||
  null;

  // Phạm vi hỗ trợ (km)
  const serviceArea =
    typeof profile?.serviceArea === 'number'
      ? profile.serviceArea
      : typeof supporter?.distanceValue === 'number'
      ? supporter.distanceValue
      : null;

  const serviceAreaText =
    serviceArea != null ? `Trong bán kính ${serviceArea} km` : 'Đang cập nhật';

  const lastRatingText = useMemo(() => {
    if (!profile?.ratingStats?.lastRatingAt) return 'Chưa có đánh giá';
    const d = new Date(profile.ratingStats.lastRatingAt);
    if (Number.isNaN(d.getTime())) return 'Chưa có đánh giá';
    return `Cập nhật gần nhất: ${d.toLocaleDateString('vi-VN')}`;
  }, [profile]);

  // 🔹 ĐỊA CHỈ: ƯU TIÊN field giải mã trả từ API mới
  const currentAddress =
  // ƯU TIÊN địa chỉ đã giải mã từ API BE
  (typeof profile?.currentAddress === 'string' &&
    profile.currentAddress.trim()) ||
  (typeof profile?.address === 'string' && profile.address.trim()) ||
  (userFromProfile?.currentAddress &&
    String(userFromProfile.currentAddress).trim()) ||
  // Fallback sang data trong params (có thể là chuỗi mã hoá)
  (supporter?.currentAddress &&
    String(supporter.currentAddress).trim()) ||
  (supporter?.user?.currentAddress &&
    String(supporter.user.currentAddress).trim()) ||
  'Đang cập nhật';

  const phoneNumber =
  (typeof profile?.phoneNumber === 'string' &&
    profile.phoneNumber.trim()) ||
  (userFromProfile?.phoneNumber &&
    userFromProfile.phoneNumber.trim()) ||
  (supporter?.phoneNumber && supporter.phoneNumber.trim()) ||
  (supporter?.user?.phoneNumber && supporter.user.phoneNumber.trim()) ||
  'Đang cập nhật';

const email =
  (typeof profile?.email === 'string' && profile.email.trim()) ||
  (userFromProfile?.email && userFromProfile.email.trim()) ||
  (supporter?.user?.email && supporter.user.email.trim()) ||
  'Đang cập nhật';

  const trustText =
    totalRatings > 0
      ? 'Được nhiều gia đình tin tưởng'
      : 'Đang xây dựng uy tín';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <LinearGradient
        colors={['#2563EB', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 2, y: 0 }}
        style={{
            paddingVertical: 16,
            paddingHorizontal: 16,
            paddingTop: 40,
            flexDirection: 'row',
            alignItems: 'center',
        }}
        >
        {/* NÚT BACK */}
        <Feather
            name="arrow-left"
            size={24}
            color="#fff"
            onPress={() => navigation.goBack()}
            style={{ marginRight: 12 }}
        />

        {/* TITLE */}
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18, alignItems: 'center', marginLeft: 100 }}>
            Hồ sơ người hỗ trợ
        </Text>
        </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* PROFILE CARD */}
        <Card style={{ overflow: 'hidden' }}>
          <LinearGradient
            colors={['#2563EB', '#3B82F6', '#60A5FA']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 20 }}
          >
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  overflow: 'hidden',
                  borderWidth: 3,
                  borderColor: 'rgba(255,255,255,0.3)',
                }}
              >
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: '100%', height: '100%' }}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: 20,
                  }}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text style={{ color: '#DBEAFE', marginTop: 2 }}>
                  Người hỗ trợ & chăm sóc tại nhà
                </Text>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  <Star size={16} color="#FACC15" fill="#FACC15" />
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {averageRating.toFixed(1)}
                  </Text>
                  <Text style={{ color: '#DBEAFE', fontSize: 12 }}>
                    ({totalRatings} đánh giá)
                  </Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <InfoBox
                icon={<ShieldCheck color="#fff" size={16} />}
                label="Mức độ tin cậy"
                value={trustText}
              />
              <InfoBox
                icon={<Heart color="#fff" size={16} />}
                label="Phạm vi hỗ trợ"
                value={currentAddress}
              />
            </View>
          </LinearGradient>
        </Card>

        {/* THÔNG TIN KINH NGHIỆM & HOẠT ĐỘNG */}
        <Card style={{ padding: 16, marginTop: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
          </View>

          <View style={{ gap: 12 }}>
            <RowDot
              title="Giới thiệu"
              subtitle={experienceDescription || 'Đang cập nhật'}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 4,
              }}
            >
              <RowIcon
                icon={<Clock color="#6B7280" size={16} />}
                title="Kinh nghiệm"
                subtitle={
                  experienceYears != null
                    ? `${experienceYears} năm`
                    : 'Đang cập nhật'
                }
              />
              <RowIcon
                icon={<Star color="#F59E0B" size={16} />}
                title="Đánh giá"
                subtitle={`${averageRating.toFixed(1)} điểm`}
                right
              />
            </View>
          </View>
        </Card>

        {/* KHU VỰC HOẠT ĐỘNG & VỊ TRÍ */}
        <Card style={{ padding: 16, marginTop: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <Award size={18} color="#F97316" />
            <Text style={{ fontWeight: '700', color: '#111827' }}>
              Khu vực & phạm vi hỗ trợ
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <MapPin size={16} color="#6B7280" />
            <Text style={{ fontWeight: '600', color: '#111827' }}>
              {currentAddress}
            </Text>
          </View>

          <Text style={{ color: '#374151' }}>
            {serviceArea != null ? (
              <>
                Người hỗ trợ có thể di chuyển trong bán kính{' '}
                <Text style={{ fontWeight: '600' }}>{serviceArea} km</Text> từ
                nơi ở hiện tại để hỗ trợ sinh hoạt, đồng hành đi khám và nhắc
                uống thuốc cho người cao tuổi.
              </>
            ) : (
              'Phạm vi hỗ trợ đang được cập nhật.'
            )}
          </Text>
        </Card>

        {/* ĐÁNH GIÁ TỪ KHÁCH HÀNG */}
        <Card style={{ padding: 16, marginTop: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Star size={18} color="#F59E0B" fill="#F59E0B" />
            <Text style={{ fontWeight: '700', color: '#111827', fontSize: 16 }}>
              Đánh giá từ khách hàng
            </Text>
            <Text style={{ color: '#6B7280', fontSize: 14 }}>
              ({ratings.length} đánh giá)
            </Text>
          </View>

          {loadingRatings ? (
            <Text style={{ color: '#6B7280', textAlign: 'center', paddingVertical: 20 }}>
              Đang tải đánh giá...
            </Text>
          ) : ratings.length === 0 ? (
            <View style={{ 
              alignItems: 'center', 
              paddingVertical: 30,
              backgroundColor: '#F9FAFB',
              borderRadius: 12,
            }}>
              <Star size={40} color="#D1D5DB" />
              <Text style={{ color: '#6B7280', marginTop: 8, fontSize: 14 }}>
                Chưa có đánh giá nào
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {ratings.map((rating, index) => (
                <RatingItem key={rating._id || index} rating={rating} />
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ====== Components con ====== */

function InfoBox({ icon, label, value }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderColor: 'rgba(255,255,255,0.35)',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6,
        }}
      >
        {icon}
        <Text style={{ color: '#DBEAFE', fontSize: 12 }}>{label}</Text>
      </View>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
        {value}
      </Text>
    </View>
  );
}

function RowDot({ title, subtitle }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#22C55E',
        }}
      />
      <View>
        <Text style={{ fontWeight: '600', color: '#111827' }}>{title}</Text>
        <Text style={{ color: '#6B7280' }}>{subtitle}</Text>
      </View>
    </View>
  );
}

function RowIcon({ icon, title, subtitle, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {icon}
      <View
        style={{ alignItems: right ? 'flex-end' : 'flex-start', maxWidth: 180 }}
      >
        {!!title && (
          <Text style={{ fontWeight: '600', color: '#111827' }}>
            {title}
          </Text>
        )}
        <Text
          style={{
            color: '#6B7280',
            fontWeight: right ? '700' : '400',
          }}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function RatingItem({ rating }) {
  const reviewerName = rating?.reviewer?.fullName || 'Người dùng';
  const reviewerAvatar = rating?.reviewer?.avatar || 'https://raw.githubusercontent.com/ranui-ch/images/main/doctor_profile_placeholder.png';
  const ratingValue = rating?.rating || 0;
  const comment = rating?.comment || '';
  const ratedAt = rating?.ratedAt ? new Date(rating.ratedAt) : null;
  
  const formattedDate = ratedAt && !isNaN(ratedAt.getTime())
    ? ratedAt.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  return (
    <View
      style={{
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
      }}
    >
      {/* Header: Avatar + Name + Rating */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
        <Image
          source={{ uri: reviewerAvatar }}
          style={{ width: 40, height: 40, borderRadius: 20 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: '#111827', fontSize: 14 }}>
            {reviewerName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={14}
                color={star <= ratingValue ? '#F59E0B' : '#D1D5DB'}
                fill={star <= ratingValue ? '#F59E0B' : '#D1D5DB'}
              />
            ))}
            <Text style={{ color: '#6B7280', fontSize: 12, marginLeft: 4 }}>
              {formattedDate}
            </Text>
          </View>
        </View>
      </View>

      {/* Comment */}
      {comment ? (
        <Text style={{ color: '#374151', fontSize: 14, lineHeight: 20 }}>
          {comment}
        </Text>
      ) : null}
    </View>
  );
}
