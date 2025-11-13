// src/screens/FamilyListFunctionScreen.jsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  StatusBar,
} from 'react-native';

import Feather from 'react-native-vector-icons/Feather';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { relationshipService } from '../../services/relationshipService';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

import { SafeAreaView } from 'react-native-safe-area-context';

const FamilyListFunctionScreen = ({ route }) => {
  const navigation = useNavigation();
  const [connectedMembers, setConnectedMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // message có thể không có trong params
  const message = route?.params?.message ?? 'Chọn người thân';

  const fetchConnectedMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const result =
        await relationshipService.getAcceptedRelationshipsByFamilyId();
      if (result.success) {
        const transformedData = (result.data || []).map(relationship => ({
          id: relationship._id, // id của quan hệ
          name: relationship.elderly?.fullName || 'Unknown',
          relationship: relationship.relationship,
          phone: relationship.elderly?.phoneNumber || 'N/A',
          avatar:
            relationship.elderly?.avatar || 'https://via.placeholder.com/100',
          isAccepted: true,
          currentLocation: relationship.elderly?.currentLocation || null,
          elderlyId: relationship.elderly?._id || null, // <-- chỉ cần trường này để điều hướng
        }));
        setConnectedMembers(transformedData);
      } else {
        setError(result.message || 'Không thể tải danh sách thành viên');
      }
    } catch (err) {
      console.error('Error fetching connected members:', err);
      setError('Không thể tải danh sách thành viên');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectedMembers();
  }, []);

  // ✅ Chỉ truyền elderlyId
  const handleNavigate = elderlyId => {
    if (!elderlyId) return; // phòng lỗi dữ liệu
    navigation.navigate('ServiceSelectionScreen', {
      elderlyId, // <-- chỉ gửi id
      source: 'FamilyListFunction',
    });
  };

  const MemberCard = ({ member }) => {
    return (
      <TouchableOpacity
        style={styles.memberCard}
        onPress={() => handleNavigate(member.elderlyId)}
      >
        <View style={styles.memberInfo}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: member.avatar }} style={styles.avatar} />
          </View>
          <View style={styles.memberDetails}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberRelationship}>+ {member.phone}</Text>
          </View>
        </View>
        <Feather
          name="chevron-right"
          size={24}
          color="#4f46e5"
          style={styles.arrowIcon}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4F7EFF" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={wp('6%')} color="white" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{message}</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Đang tải danh sách...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchConnectedMembers}
            >
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="sectionHeader" style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Hãy chọn người thân</Text>
            </View>

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

// giữ nguyên styles của bạn
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#4F7EFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: hp('0.2%') },
    shadowOpacity: 0.1,
    shadowRadius: wp('1%'),
  },
  backButton: { padding: wp('2%') },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: wp('4.5%'), fontWeight: 'bold' },
  content: { flex: 1, padding: wp('4%') },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  sectionTitle: { fontSize: wp('4.5%'), fontWeight: 'bold', color: '#333333' },
  membersList: { gap: hp('1.5%') },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { marginRight: 12 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  memberDetails: { flex: 1 },
  memberName: { fontSize: 16, color: '#111827', fontWeight: 'bold' },
  memberRelationship: { fontSize: 14, color: '#6b7280' },
  arrowIcon: { marginLeft: 10 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp('6%'),
  },
  loadingText: { fontSize: wp('4%'), color: '#666666' },
  errorContainer: {
    flex: 1,
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
    backgroundColor: '#4F7EFF',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    borderRadius: wp('2%'),
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp('6%'),
  },
  emptyText: { fontSize: wp('4%'), color: '#666666', textAlign: 'center' },
});

export default FamilyListFunctionScreen;
