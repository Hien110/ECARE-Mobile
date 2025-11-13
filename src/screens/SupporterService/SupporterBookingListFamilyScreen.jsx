import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  StatusBar,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { relationshipService } from '../../services/relationshipService';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

const HEADER_COLOR = '#4F7EFF';

const FamilyListFunctionScreen = ({ route }) => {
  const navigation = useNavigation();
  const [connectedMembers, setConnectedMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // fetch lần đầu
  useEffect(() => {
    const fetchConnectedMembers = async () => {
      try {
        setLoading(true);
        setError(null);
        const result =
          await relationshipService.getAcceptedRelationshipsByFamilyId();
        if (result.success) {
          const transformedData = result.data.map(relationship => ({
            id: relationship._id,
            name: relationship.elderly?.fullName || 'Unknown',
            relationship: relationship.relationship,
            phone: relationship.elderly?.phoneNumber || 'N/A',
            avatar:
              relationship.elderly?.avatar || 'https://via.placeholder.com/100',
            isAccepted: true,
            currentLocation: relationship.elderly?.currentLocation || null,
            elderlyId: relationship.elderly?._id || null,
          }));
          setConnectedMembers(transformedData);
        } else {
          setError(result.message || 'Không thể tải danh sách thành viên');
          setConnectedMembers([]);
        }
      } catch (err) {
        console.error('Error fetching connected members:', err);
        setError('Không thể tải danh sách thành viên');
        setConnectedMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchConnectedMembers();
  }, []);

  const handleRefresh = async () => {
    try {
      setError(null);
      setRefreshing(true);
      const result =
        await relationshipService.getAcceptedRelationshipsByFamilyId();
      if (result.success) {
        const transformedData = result.data.map(relationship => ({
          id: relationship._id,
          name: relationship.elderly?.fullName || 'Unknown',
          relationship: relationship.relationship,
          phone: relationship.elderly?.phoneNumber || 'N/A',
          avatar:
            relationship.elderly?.avatar || 'https://via.placeholder.com/100',
          isAccepted: true,
          currentLocation: relationship.elderly?.currentLocation || null,
          elderlyId: relationship.elderly?._id || null,
        }));
        setConnectedMembers(transformedData);
      } else {
        setError(result.message || 'Không thể tải danh sách thành viên');
        setConnectedMembers([]);
      }
    } catch (err) {
      setError('Không thể tải danh sách thành viên');
      setConnectedMembers([]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const handleNavigate = ({ userId }) => {
    console.log(
      'Navigating to SupporterBookingListScreen with userId:',
      userId,
    );
    navigation.navigate('SupporterBookingListScreen', {
      userId,
      flag: 'BookingFromFamily',
    });
  };

  const MemberCard = ({ member }) => {
    return (
      <TouchableOpacity
        style={styles.memberCard}
        activeOpacity={0.85}
        onPress={() => handleNavigate({ userId: member.elderlyId })}
      >
        <View style={styles.memberInfo}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: member.avatar }} style={styles.avatar} />
          </View>

          <View style={styles.memberDetails}>
            <Text style={styles.memberName} numberOfLines={1}>
              {member.name}
            </Text>
            <Text style={styles.memberRelationship} numberOfLines={1}>
              + {member.phone}
            </Text>
          </View>
        </View>

        <Feather name="chevron-right" size={22} style={styles.arrowIcon} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* StatusBar & Header */}
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          {navigation.canGoBack() ? (
            <TouchableOpacity
              onPress={navigation.goBack}
              style={styles.iconBtn}
              activeOpacity={0.7}
            >
              <Feather name="chevron-left" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtnPlaceholder} />
          )}

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Danh sách lịch đặt</Text>
            <Text style={styles.headerSubtitle}>
              Chọn người thân để xem chi tiết
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.iconBtn}
            activeOpacity={0.7}
          >
            <Feather name="refresh-ccw" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Đang tải danh sách...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRefresh}
            >
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {connectedMembers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Chưa có người cao tuổi nào được kết nối
                </Text>
              </View>
            ) : (
              <View style={styles.membersList}>
                {connectedMembers.map(member => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  /* ===== Screen ===== */
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },

  /* ===== Header ===== */
  headerWrap: {
    backgroundColor: HEADER_COLOR,
    paddingHorizontal: wp('4%'),
    paddingTop: hp('1%'),
    paddingBottom: hp('2.6%'),
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: HEADER_COLOR,
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
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

  /* ===== Content ===== */
  content: {
    flex: 1,
    padding: wp('4%'),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  sectionTitle: {
    fontSize: wp('4.6%'),
    fontWeight: '700',
    color: '#1f2937',
    letterSpacing: 0.2,
  },

  /* ===== List & Card ===== */
  membersList: {
    gap: hp('1.4%'),
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7ECFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    }),
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { marginRight: 12 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#EEF2FF',
  },
  memberDetails: { flex: 1 },
  memberName: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '700',
  },
  memberRelationship: {
    fontSize: 13.5,
    color: '#6b7280',
    marginTop: 2,
  },
  arrowIcon: { marginLeft: 10, color: HEADER_COLOR },

  /* ===== States ===== */
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp('6%'),
  },
  loadingText: { fontSize: wp('4%'), color: '#666' },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp('6%'),
    paddingHorizontal: wp('5%'),
  },
  errorText: {
    fontSize: wp('4%'),
    color: '#E53E3E',
    textAlign: 'center',
    marginBottom: hp('2%'),
  },
  retryButton: {
    backgroundColor: HEADER_COLOR,
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.6%'),
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: wp('3.6%'),
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp('6%'),
  },
  emptyText: { fontSize: wp('4%'), color: '#6b7280', textAlign: 'center' },
});

export default FamilyListFunctionScreen;
