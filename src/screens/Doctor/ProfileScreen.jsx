// src/screens/Doctor/ProfileScreen.jsx
import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useRoute } from '@react-navigation/native';
import doctorService from '../../services/doctorService';
import { ScrollView, View, Text, Image } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { Star, Calendar, MapPin, Clock, Heart, Award } from "lucide-react-native";
import Card from "../../components/Cart";
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const route = useRoute();
  const { doctorName, doctorId } = route.params || {};
  const [profile, setProfile] = useState(null);
  const displayName = doctorName || profile?.user?.fullName || 'Bác sĩ';

  const specializationText = useMemo(() => {
    // Ưu tiên trường specialization (string) mới trên DoctorProfile
    const directSpec = (profile?.specialization || profile?.doctorProfile?.specialization || '')
      .toString()
      .trim();

    if (directSpec) return directSpec;

    if (Array.isArray(profile?.specializations) && profile.specializations.length) {
      return profile.specializations.join(', ');
    }
    if (
      profile?.doctorProfile?.specializations &&
      Array.isArray(profile.doctorProfile.specializations) &&
      profile.doctorProfile.specializations.length
    ) {
      return profile.doctorProfile.specializations.join(', ');
    }
    return 'Bác sĩ chuyên khoa';
  }, [profile]);

  const ratingStats = useMemo(() => {
    return profile?.ratingStats || profile?.doctorProfile?.ratingStats || null;
  }, [profile]);

  const averageRatingText = useMemo(() => {
    const avg = ratingStats?.averageRating;
    if (typeof avg === 'number') return avg.toFixed(1);
    return '—';
  }, [ratingStats]);

  const ratingCountText = useMemo(() => {
    const total = ratingStats?.totalReviews || ratingStats?.count || ratingStats?.total;
    if (typeof total === 'number' && total > 0) return `(${total} đánh giá)`;
    return '(Chưa có đánh giá)';
  }, [ratingStats]);

  const experienceYears = useMemo(() => {
    if (typeof profile?.experience === 'number') return profile.experience;
    if (typeof profile?.doctorProfile?.experience === 'number') return profile.doctorProfile.experience;
    return null;
  }, [profile]);

  // Simple mapper: convert hospitalName to approximate coordinates
  // Mapping function removed since map is hidden

  const hospitalName = useMemo(() => {
    return profile?.hospitalName || profile?.doctorProfile?.hospitalName || 'Bệnh viện Đà Nẵng';
  }, [profile]);

  // const hospitalCoords = useMemo(() => getCoordinatesFromHospitalName(hospitalName), [hospitalName]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!doctorId) return;
      const res = await doctorService.getProfileById(doctorId);
      if (res?.success) {
        setProfile(res.data);
      }
    };
    fetchProfile();
  }, [doctorId]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <LinearGradient
        colors={["#2563EB", "#3B82F6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingVertical: 12, paddingHorizontal: 16 }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>Xem hồ sơ bác sĩ</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Profile Card */}
        <Card style={{ overflow: "hidden" }}>
          <LinearGradient
            colors={["#2563EB", "#3B82F6", "#60A5FA"]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 20 }}
          >
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", borderWidth: 3, borderColor: "rgba(255,255,255,0.3)" }}>
                <Image
                  source={{ uri: (profile?.user?.avatar || profile?.doctorProfile?.user?.avatar || "https://raw.githubusercontent.com/ranui-ch/images/main/doctor_profile_placeholder.png") }}
                  style={{ width: "100%", height: "100%" }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 20 }}>{displayName}</Text>
                <Text style={{ color: "#DBEAFE", marginTop: 2 }}>{specializationText}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <Star size={16} color="#FACC15" fill="#FACC15" />
                  <Text style={{ color: "#fff", fontWeight: "700" }}>{averageRatingText}</Text>
                  <Text style={{ color: "#DBEAFE", fontSize: 12 }}>{ratingCountText}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Card>

        {/* Status */}
        <Card style={{ padding: 16, marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
            <View>
              <Text style={{ fontWeight: "700", color: "#111827" }}>Thông tin chuyên môn</Text>
              <Text style={{ color: "#6B7280" }}>Trực tuyến và sẵn sàng tư vấn</Text>
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <RowDot title="Lĩnh vực chuyên môn" subtitle={specializationText} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <RowIcon
                icon={<Clock color="#6B7280" size={16} />}
                title="Kinh nghiệm"
                subtitle={experienceYears != null ? `${experienceYears} năm` : 'Đang cập nhật'}
              />
              <RowIcon
                icon={<Heart color="#EF4444" size={16} />}
                title=""
                subtitle="Nhiều bệnh nhân đã tin tưởng"
                right
              />
            </View>
          </View>
        </Card>

        {/* Workplace */}
        <Card style={{ padding: 16, marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <Award size={18} color="#F97316" />
            <Text style={{ fontWeight: "700", color: "#111827" }}>Nơi làm việc hiện tại</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <MapPin size={16} color="#6B7280" />
            <Text style={{ fontWeight: "600", color: "#111827" }}>{hospitalName}</Text>
          </View>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: '700', color: '#111827' }}>Giới thiệu</Text>
            </View>
            <Text style={{ color: '#374151' }}>
              {profile?.bio || 'Bác sĩ tận tâm, nhiều kinh nghiệm trong khám và tư vấn sức khỏe.'}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <Text style={{ fontWeight: '700', color: '#111827' }}>Chuyên khoa</Text>
            </View>
            <Text style={{ color: '#374151' }}>
              {Array.isArray(profile?.specializations) && profile.specializations.length
                ? profile.specializations.join(', ')
                : 'Đang cập nhật'}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <RowIcon
                icon={<Clock color="#6B7280" size={16} />}
                title="Kinh nghiệm"
                subtitle={`${profile?.experience ?? profile?.doctorProfile?.experience ?? '—'} năm`}
              />
              {(() => {
                const avg = profile?.ratingStats?.averageRating ?? profile?.doctorProfile?.ratingStats?.averageRating;
                const avgText = typeof avg === 'number' ? avg.toFixed(1) : '—';
                return (
                  <RowIcon
                    icon={<Star color="#F59E0B" size={16} />}
                    title="Đánh giá"
                    subtitle={`${avgText} điểm`}
                    right
                  />
                );
              })()}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <Text style={{ fontWeight: '700', color: '#111827' }}>Thông tin liên hệ</Text>
            </View>
            <Text style={{ color: '#374151' }}>
              Nơi làm việc: {profile?.hospitalName || profile?.doctorProfile?.hospitalName || 'Đang cập nhật'}
            </Text>
            {!!profile?.clinicAddress && (
              <Text style={{ color: '#6B7280' }}>Địa chỉ: {profile.clinicAddress}</Text>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <Text style={{ fontWeight: '700', color: '#111827' }}>Dịch vụ phổ biến</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {['Khám tổng quát', 'Tư vấn online', 'Theo dõi điều trị'].map((t) => (
                <View key={t} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#EEF2FF' }}>
                  <Text style={{ color: '#374151', fontWeight: '600', fontSize: 12 }}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function PriceBox({ icon, label, value }) {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.35)", borderWidth: 1, borderRadius: 12, padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {icon}
        <Text style={{ color: "#DBEAFE", fontSize: 12 }}>{label}</Text>
      </View>
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>{value}</Text>
    </View>
  );
}

PriceBox.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

function RowDot({ title, subtitle }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
      <View>
        <Text style={{ fontWeight: "600", color: "#111827" }}>{title}</Text>
        <Text style={{ color: "#6B7280" }}>{subtitle}</Text>
      </View>
    </View>
  );
}

RowDot.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
};

function RowIcon({ icon, title, subtitle, right }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {icon}
      <View style={{ alignItems: right ? "flex-end" : "flex-start" }}>
        {!!title && <Text style={{ fontWeight: "600", color: "#111827" }}>{title}</Text>}
        <Text style={{ color: "#6B7280", fontWeight: right ? "700" : "400" }}>{subtitle}</Text>
      </View>
    </View>
  );
}

RowIcon.propTypes = {
  icon: PropTypes.node.isRequired,
  title: PropTypes.string,
  subtitle: PropTypes.string.isRequired,
  right: PropTypes.bool,
};

RowIcon.defaultProps = {
  title: '',
  right: false,
};