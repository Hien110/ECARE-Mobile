import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ratingService from '../../services/ratingService';

const SupporterProfileScreen = ({ navigation, route }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);

  // Get supporter data from navigation params
  const supporter = route?.params?.supporter || null;
  const user = route?.params?.user || null;
  const flag = route?.params?.flag || null;

  // Fetch reviews when component mounts
  useEffect(() => {
    const fetchReviews = async () => {
      if (supporter?.user?._id) {
        setLoading(true);
        try {
          const result = await ratingService.getRatingsByUserId(
            supporter.user._id,
          );
          if (result.success && result.data) {
            const ratingsData = result.data.data || result.data;
            if (Array.isArray(ratingsData)) {
              const formattedReviews = ratingsData.map(rating => ({
                id: rating._id,
                name: rating.reviewer?.fullName || 'Người dùng ẩn danh',
                time: formatTimeAgo(rating.ratedAt),
                avatar:
                  rating.reviewer?.avatar ||
                  'https://cdn.sforum.vn/sforum/wp-content/uploads/2023/10/avatar-trang-4.jpg',
                rating: rating.rating,
                content: rating.comment || 'Không có bình luận',
              }));
              setReviews(formattedReviews);
            } else {
              setReviews([]);
            }
          } else {
            setReviews([]);
          }
        } catch (error) {
          setReviews([]);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchReviews();
  }, [supporter]);

  // Helper function to format time ago
  const formatTimeAgo = dateString => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

    if (diffInHours < 24) {
      return `${diffInHours} giờ trước`;
    } else if (diffInHours < 24 * 7) {
      const days = Math.floor(diffInHours / 24);
      return `${days} ngày trước`;
    } else if (diffInHours < 24 * 30) {
      const weeks = Math.floor(diffInHours / (24 * 7));
      return `${weeks} tuần trước`;
    } else {
      const months = Math.floor(diffInHours / (24 * 30));
      return `${months} tháng trước`;
    }
  };

  const renderStars = rating => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Text key={i} style={styles.star}>
          ★
        </Text>,
      );
    }

    if (hasHalfStar) {
      stars.push(
        <Text key="half" style={styles.starHalf}>
          ★
        </Text>,
      );
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Text key={`empty-${i}`} style={styles.starEmpty}>
          ★
        </Text>,
      );
    }

    return stars;
  };
  
  const groupScheduleByDay = schedule => {
    const grouped = schedule.reduce((acc, current) => {
      const dayOfWeek = current.dayOfWeek;

      // Find if the day already exists in the accumulator
      const existingDay = acc.find(item => item.dayOfWeek === dayOfWeek);

      // If the day doesn't exist, create a new entry for it
      if (!existingDay) {
        acc.push({
          dayOfWeek: dayOfWeek,
          timeSlots: [current.timeSlots], // Initialize with the first time slot
        });
      } else {
        existingDay.timeSlots.push(current.timeSlots); // Add the time slot to the existing day
      }

      return acc;
    }, []);

    return grouped;
  };
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#2196F3" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông tin Supporter</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileImageContainer}>
            <Image
              source={{
                uri:
                  supporter?.avatar ||
                  'https://cdn.sforum.vn/sforum/wp-content/uploads/2023/10/avatar-trang-4.jpg',
              }}
              style={styles.profileImage}
            />
          </View>

          <Text style={styles.name}>{supporter?.name || 'Chưa có tên'}</Text>

          <View style={styles.ratingContainer}>
            <View style={styles.starsContainer}>
              {renderStars(supporter?.rating || 0)}
            </View>
            <Text style={styles.ratingText}>
              {supporter?.rating || 0} ({supporter?.reviewCount || 0} đánh giá)
            </Text>
          </View>

          <View style={styles.distanceContainer}>
            <Text style={styles.distanceText}>
              {supporter?.distance || 'N/A'}
            </Text>
          </View>
          {/* <Text style={styles.availability}>
            Phạm vi hoạt động: {supporter?.serviceArea || 0}km
          </Text> */}

          <TouchableOpacity
            style={styles.bookButton}
            onPress={() =>
              navigation.navigate('SupporterBookingScreen', { supporter, user, flag })
            }
          >
            <Text style={styles.bookButtonText}>📅 Đặt lịch</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'info' && styles.activeTab]}
            onPress={() => setActiveTab('info')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'info' && styles.activeTabText,
              ]}
            >
              Thông tin
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'reviews' && styles.activeTab]}
            onPress={() => setActiveTab('reviews')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'reviews' && styles.activeTabText,
              ]}
            >
              Đánh giá
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'info' && (
          <View style={styles.infoContent}>
            {/* Experience */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Kinh nghiệm</Text>
              <Text style={styles.sectionText}>
                {supporter?.experience ||
                  'Chưa có mô tả về kinh nghiệm làm việc.'}
              </Text>
            </View>

            {/* Work Schedule */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Lịch làm việc</Text>

              {/* Render schedule as a table */}
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderText}>Ngày</Text>
                  <Text style={styles.tableHeaderText}>Buổi sáng</Text>
                  <Text style={styles.tableHeaderText}>Buổi chiều</Text>
                  <Text style={styles.tableHeaderText}>Buổi tối</Text>
                </View>

                {/* Group the schedule by day of the week */}
                {groupScheduleByDay(supporter?.profile?.schedule).map(
                  (daySchedule, index) => (
                    <View key={index} style={styles.tableRow}>
                      <Text
                        style={styles.tableCell}
                      >{`Thứ ${daySchedule.dayOfWeek}`}</Text>

                      {/* Morning session */}
                      <Text style={styles.tableCell}>
                        {daySchedule.timeSlots.includes('morning')
                          ? `${new Intl.NumberFormat('vi-VN').format(
                              supporter?.profile?.sessionFee?.morning || 0,
                            )}đ`
                          : '-'}
                      </Text>

                      {/* Afternoon session */}
                      <Text style={styles.tableCell}>
                        {daySchedule.timeSlots.includes('afternoon')
                          ? `${new Intl.NumberFormat('vi-VN').format(
                              supporter?.profile?.sessionFee?.afternoon || 0,
                            )}đ`
                          : '-'}
                      </Text>

                      {/* Evening session */}
                      <Text style={styles.tableCell}>
                        {daySchedule.timeSlots.includes('evening')
                          ? `${new Intl.NumberFormat('vi-VN').format(
                              supporter?.profile?.sessionFee?.evening || 0,
                            )}đ`
                          : '-'}
                      </Text>
                    </View>
                  ),
                )}
              </View>
            </View>

            {/* Service Area */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Phạm vi hoạt động</Text>
              <Text style={styles.sectionText}>
                {supporter?.serviceArea || 'Chưa xác định'} km
              </Text>
            </View>

            {/* Price */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Thời gian thuê</Text>
              <Text style={styles.sectionText}>
                Buổi sáng : 8h - 12h
              </Text>
              <Text style={styles.sectionText}>
                Buổi chiều: 13h - 17h
              </Text>
              <Text style={styles.sectionText}>
                Buổi tối: 18h - 21h
              </Text>
            </View>
          </View>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <View style={styles.reviewsContent}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.loadingText}>Đang tải đánh giá...</Text>
              </View>
            ) : reviews.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Chưa có đánh giá nào</Text>
                <Text style={styles.emptySubText}>
                  Hãy là người đầu tiên đánh giá supporter này
                </Text>
              </View>
            ) : (
              reviews.map(review => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Image
                      source={{ uri: review.avatar }}
                      style={styles.reviewerAvatar}
                    />
                    <View style={styles.reviewerMeta}>
                      <Text style={styles.reviewerName}>{review.name}</Text>
                      <Text style={styles.reviewTime}>{review.time}</Text>
                    </View>
                  </View>
                  <View style={styles.reviewerStars}>
                    {renderStars(review.rating)}
                  </View>
                  <Text style={styles.reviewText}>{review.content}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 29,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  //absolute position for back button
  backButton: {
    position: 'absolute',
    left: 16,
    top: 29,
    zIndex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    marginTop: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  star: {
    color: '#f59e0b',
    fontSize: 16,
  },
  starHalf: {
    color: '#f59e0b',
    fontSize: 16,
    opacity: 0.5,
  },
  starEmpty: {
    color: '#d1d5db',
    fontSize: 16,
  },
  ratingText: {
    color: '#6b7280',
    fontSize: 14,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  distanceText: {
    color: '#6b7280',
    fontSize: 14,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f97316',
    marginBottom: 4,
  },
  availability: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 20,
  },
  bookButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2196F3',
  },
  infoContent: {
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginVertical: 8,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#4b5563',
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    color: '#4b5563',
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#4b5563',
  },
});

export default SupporterProfileScreen;
