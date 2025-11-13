import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Modal,
  Image,
  Alert,
  Dimensions,
  AppState,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { userService } from "../../services/userService";
import { relationshipService } from "../../services/relationshipService";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";

// Relationship suggestions
const relationshipSuggestions = ["Con", "Cháu", "Người chăm sóc", "Em"];

const ConfirmConnectionModal = ({
  selectedUser,
  showConfirmModal,
  setShowConfirmModal,
  selectedRelationship,
  handleRelationshipChange,
  handleConfirmConnection,
  handleCancelConnection,
}) => (
  <Modal
    visible={showConfirmModal}
    transparent={true}
    animationType="slide"
    onRequestClose={() => setShowConfirmModal(false)}
  >
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.largeAvatar}>
            {selectedUser?.avatar && selectedUser.avatar.startsWith("http") ? (
              <Image
                source={{ uri: selectedUser.avatar }}
                style={styles.largeAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.largeAvatarPlaceholder, { backgroundColor: "#FFB6C1" }]}>
                <Text style={styles.largeAvatarText}>
                  {selectedUser?.avatar || selectedUser?.name?.charAt(0).toUpperCase() || "N"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Title */}
        <Text style={styles.modalTitle}>Xác nhận kết nối</Text>

        {/* Subtitle */}
        <Text style={styles.modalSubtitle}>Bạn muốn kết nối với</Text>

        {/* User Info */}
        <View style={styles.userInfoSection}>
          <Text style={styles.userNameModal}>{selectedUser?.name || "Trần Hoàng Anh"}</Text>
          <Text style={styles.userDetailsModal}>
            {selectedUser?.age || 24} tuổi • {selectedUser?.location || "Chưa cập nhật"}
          </Text>
        </View>

        {/* Relationship Selection */}
        <View style={styles.relationshipSection}>
          <Text style={styles.relationshipTitle}>Mối quan hệ với bạn:</Text>
          <TextInput
            style={styles.relationshipInput}
            placeholder="Nhập mối quan hệ (vd: con, cháu, người chăm sóc...)"
            placeholderTextColor="#999"
            value={selectedRelationship}
            onChangeText={handleRelationshipChange}
          />
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Gợi ý:</Text>
            <View style={styles.suggestionsRow}>
              {relationshipSuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionChip}
                  onPress={() => handleRelationshipChange(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmConnection}
          >
            <Text style={styles.confirmButtonText}>Xác nhận</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelConnection}
          >
            <Text style={styles.cancelButtonText}>Hủy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const ConnectionSuccessModal = ({
  showSuccessModal,
  selectedUser,
  selectedRelationship,
  handleCloseSuccess,
}) => (
  <Modal
    visible={showSuccessModal}
    transparent={true}
    animationType="fade"
    onRequestClose={handleCloseSuccess}
  >
    <View style={styles.modalContainer}>
      <View style={styles.successModalContent}>
        {/* Success Icon */}
        <View style={styles.successIcon}>
          <Icon name="checkmark" size={hp("5%")} color="white" />
        </View>

        {/* Title */}
        <Text style={styles.successTitle}>Đã xác nhận kết nối</Text>

        {/* Subtitle */}
        <Text style={styles.successSubtitle}>Yêu cầu kết nối với</Text>

        {/* User Info */}
        <View style={styles.successUserInfo}>
          <Text style={styles.successUserName}>{selectedUser?.name || "Trần Hoàng Anh"}</Text>
          <Text style={styles.successUserRelationship}>({selectedRelationship})</Text>
        </View>

        {/* Pending Approval Notice */}
        <View style={styles.pendingNotice}>
          <View style={styles.pendingNoticeHeader}>
            <View style={styles.noticeIcon}>
              <Icon name="information-circle" size={hp("2%")} color="white" />
            </View>
            <Text style={styles.noticeTitle}>Chờ duyệt yêu cầu</Text>
          </View>
          <Text style={styles.noticeText}>
            Yêu cầu kết nối đã được gửi. Bạn sẽ nhận được thông báo khi yêu cầu được duyệt.
          </Text>
        </View>

        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={handleCloseSuccess}>
          <Text style={styles.closeButtonText}>Đóng</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const FindPeopleScreen = ({ navigation }) => {
  const [searchText, setSearchText] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState("");
  const [users, setUsers] = useState([]);
  const [originalUsers, setOriginalUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Hàm lấy dữ liệu relationships
  const fetchRelationships = useCallback(async () => {
    try {
      const relResult = await relationshipService.getAllRelationships();
      if (relResult.success) {
        console.log('Fetched relationships:', relResult.data);
        setRelationships(relResult.data);
        return relResult.data;
      }
      return [];
    } catch (error) {
      console.error("Lỗi khi lấy danh sách relationships:", error);
      return [];
    }
  }, []);

  // Hàm lấy dữ liệu người già
  const fetchElderly = useCallback(async () => {
    try {
      const elderlyResult = await userService.getAllElderly();
      if (elderlyResult.success) {
        const transformedUsers = elderlyResult.data.map((user) => ({
          id: user._id,
          name: user.fullName,
          phoneNumber: user.phoneNumber,
          age: user.dateOfBirth
            ? new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear()
            : 65,
          location: user.address || "Chưa cập nhật",
          avatar: user.avatar,
        }));
        setOriginalUsers(transformedUsers);
        return transformedUsers;
      }
      return [];
    } catch (error) {
      console.error("Lỗi khi lấy danh sách người già:", error);
      return [];
    }
  }, []);

  // Hàm refresh dữ liệu
  const refreshData = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setRefreshing(true);
    }
    
    try {
      await Promise.all([
        fetchRelationships(),
        fetchElderly()
      ]);
    } catch (error) {
      console.error("Lỗi khi refresh dữ liệu:", error);
    } finally {
      if (showLoader) {
        setRefreshing(false);
      }
    }
  }, [fetchRelationships, fetchElderly]);

  // Gọi API lấy dữ liệu ban đầu
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);

        // Lấy thông tin user hiện tại
        const userResult = await userService.getUserInfo();
        if (userResult.success) {
          console.log('Current user info:', userResult.data);
          setCurrentUser(userResult.data);
        }

        // Lấy dữ liệu ban đầu
        await refreshData();

      } catch (error) {
        console.error("Lỗi khi gọi API:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [refreshData]);

  // Setup interval để refresh relationships theo thời gian thực
  useEffect(() => {
    const startInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Refresh relationships mỗi 5 giây
      intervalRef.current = setInterval(() => {
        if (appStateRef.current === 'active') {
          fetchRelationships();
        }
      }, 5000);
    };

    // Bắt đầu interval khi component mount
    startInterval();

    // Cleanup interval khi component unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchRelationships]);

  // Lắng nghe app state thay đổi
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App trở lại foreground, refresh dữ liệu
        refreshData();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [refreshData]);

  // Tìm kiếm theo số điện thoại - chỉ hiển thị khi nhập đầy đủ
  useEffect(() => {
    if (searchText.trim() === "") {
      setUsers([]);
    } else {
      const run = async () => {
        try {
          const res = await userService.searchElderlyByPhone({ phoneNumber: searchText.trim() });
          if (res.success) {
            const transformed = (res.data || []).map((user) => ({
              id: user._id,
              name: user.fullName,
              phoneNumber: user.phoneNumber,
              age: user.dateOfBirth
                ? new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear()
                : 65,
              location: user.address || "Chưa cập nhật",
              avatar: user.avatar,
            }));
            setUsers(transformed);
          } else {
            setUsers([]);
          }
        } catch (e) {
          console.log('searchElderlyByPhone error:', e?.message);
          setUsers([]);
        }
      };
      run();
    }
  }, [searchText, originalUsers]);

  const handleConnect = useCallback((user) => {
    setSelectedUser(user);
    setShowConfirmModal(true);
  }, []);

  const handleRelationshipChange = useCallback((relationship) => {
    setSelectedRelationship(relationship);
  }, []);

  const handleConfirmConnection = useCallback(async () => {
    if (!selectedUser || !selectedRelationship.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mối quan hệ");
      return;
    }

    try {
      const result = await relationshipService.createRelationship({
        elderlyId: selectedUser.id,
        relationship: selectedRelationship.trim(),
      });

      if (result.success) {
        setShowConfirmModal(false);
        setShowSuccessModal(true);
        // Refresh relationships ngay lập tức sau khi tạo thành công
        await fetchRelationships();
      } else {
        Alert.alert("Lỗi", result.message);
      }
    } catch (error) {
      Alert.alert("Lỗi", "Có lỗi xảy ra khi gửi yêu cầu kết nối");
      console.error("Create relationship error:", error);
    }
  }, [selectedUser, selectedRelationship, fetchRelationships]);

  const handleCancelConnection = useCallback(() => {
    setShowConfirmModal(false);
  }, []);

  const handleCloseSuccess = useCallback(() => {
    setShowSuccessModal(false);
    setSelectedRelationship(""); // Reset relationship input
    setSelectedUser(null); // Reset selected user
  }, []);

  // Hàm lấy trạng thái relationship giữa current user và elderly
  const getRelationshipStatus = useCallback((elderlyId) => {
    if (!currentUser || !relationships.length) return null;
    
    // Debug logging
    console.log('Current User ID:', currentUser._id);
    console.log('Elderly ID to find:', elderlyId);
    console.log('Total relationships:', relationships.length);
    
    // Tìm relationship giữa current user và elderly
    const relationship = relationships.find(r => {
      // Xử lý trường hợp elderly có thể là object hoặc string ID
      let elderlyIdFromRel = r.elderly;
      if (typeof r.elderly === 'object' && r.elderly._id) {
        elderlyIdFromRel = r.elderly._id;
      }
      
      // Xử lý trường hợp family có thể là object hoặc string ID  
      let familyIdFromRel = r.family;
      if (typeof r.family === 'object' && r.family._id) {
        familyIdFromRel = r.family._id;
      }
      
      const elderlyMatch = elderlyIdFromRel === elderlyId;
      const familyMatch = familyIdFromRel === currentUser._id;
      
      console.log('Checking relationship:', {
        relationshipId: r._id,
        elderlyFromRel: elderlyIdFromRel,
        familyFromRel: familyIdFromRel,
        elderlyToFind: elderlyId,
        currentUserId: currentUser._id,
        elderlyMatch,
        familyMatch,
        status: r.status
      });
      
      return elderlyMatch && familyMatch;
    });
    
    console.log('Found relationship:', relationship);
    return relationship ? relationship.status : null;
  }, [currentUser, relationships]);

  // Hàm lấy thông tin chi tiết relationship
  const getRelationshipInfo = useCallback((elderlyId) => {
    if (!currentUser || !relationships.length) return null;
    
    const relationship = relationships.find(r => {
      // Xử lý trường hợp elderly có thể là object hoặc string ID
      let elderlyIdFromRel = r.elderly;
      if (typeof r.elderly === 'object' && r.elderly._id) {
        elderlyIdFromRel = r.elderly._id;
      }
      
      // Xử lý trường hợp family có thể là object hoặc string ID  
      let familyIdFromRel = r.family;
      if (typeof r.family === 'object' && r.family._id) {
        familyIdFromRel = r.family._id;
      }
      
      const elderlyMatch = elderlyIdFromRel === elderlyId;
      const familyMatch = familyIdFromRel === currentUser._id;
      
      return elderlyMatch && familyMatch;
    });
    
    return relationship || null;
  }, [currentUser, relationships]);

  const renderUserItem = (user) => {
    const status = getRelationshipStatus(user.id);
    const relationshipInfo = getRelationshipInfo(user.id);

    // Hàm render button/status dựa trên trạng thái
    const renderConnectionStatus = () => {
      switch (status) {
        case 'pending':
          return (
            <View style={styles.statusContainer}>
              <View style={styles.pendingStatus}>
                <Icon name="time-outline" size={wp("4%")} color="#FF9800" />
                <Text style={styles.pendingStatusText}>Chờ chấp nhận</Text>
              </View>
              {relationshipInfo && (
                <Text style={styles.relationshipTypeText}>
                  ({relationshipInfo.relationship})
                </Text>
              )}
            </View>
          );
        case 'accepted':
          return (
            <View style={styles.statusContainer}>
              <View style={styles.acceptedStatus}>
                <Icon name="checkmark-circle" size={wp("4%")} color="#4CAF50" />
                <Text style={styles.acceptedStatusText}>Đã kết nối</Text>
              </View>
              {relationshipInfo && (
                <Text style={styles.relationshipTypeText}>
                  ({relationshipInfo.relationship})
                </Text>
              )}
            </View>
          );
        case 'rejected':
          return (
            <View style={styles.statusContainer}>
              <View style={styles.rejectedStatus}>
                <Icon name="close-circle" size={wp("4%")} color="#F44336" />
                <Text style={styles.rejectedStatusText}>Đã từ chối</Text>
              </View>
            </View>
          );
        default:
          return (
            <TouchableOpacity style={styles.connectButton} onPress={() => handleConnect(user)}>
              <Text style={styles.connectButtonText}>Kết nối</Text>
            </TouchableOpacity>
          );
      }
    };

    return (
      <View key={user.id} style={styles.userItem}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {user.avatar && user.avatar.startsWith("http") ? (
              <Image
                source={{ uri: user.avatar }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: "#FFB6C1" }]}>
                <Text style={styles.avatarText}>
                  {user.avatar || user.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userLocation}>
              {user.age} tuổi
            </Text>
          </View>
        </View>

        {renderConnectionStatus()}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2196F3" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={wp("6%")} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tìm kiếm người thân</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search" size={wp("5%")} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nhập số điện thoại..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
            keyboardType="phone-pad"
          />
          {searchText.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={() => setSearchText("")}>
              <Icon name="close-circle" size={wp("5%")} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results Header */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>
          {searchText.trim() ? `Kết quả tìm kiếm "${searchText}"` : "Tìm kiếm người thân theo số điện thoại"}
        </Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={() => refreshData(true)}
          disabled={refreshing}
        >
          <Icon 
            name={refreshing ? "sync" : "refresh"} 
            size={wp("4%")} 
            color="#2196F3" 
            style={refreshing ? styles.spinning : null}
          />
        </TouchableOpacity>
        <Text style={styles.resultsCount}>
          {loading ? "Đang tải..." : searchText.trim() ? `${users.length} người` : ""}
        </Text>
      </View>

      {/* User List */}
      <ScrollView style={styles.userList} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Đang tải danh sách người già...</Text>
          </View>
        ) : !searchText.trim() ? (
          <View style={styles.emptyContainer}>
            <Icon name="search" size={wp("12%")} color="#ccc" style={styles.searchIconLarge} />
            <Text style={styles.emptyText}>Nhập số điện thoại để tìm kiếm người thân</Text>
            <Text style={styles.emptySubtext}>Nhập đầy đủ số điện thoại để hiển thị kết quả</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="search" size={wp("12%")} color="#ccc" style={styles.searchIconLarge} />
            <Text style={styles.emptyText}>
              Không tìm thấy người nào với số điện thoại "{searchText}"
            </Text>
            <Text style={styles.emptySubtext}>Kiểm tra lại số điện thoại</Text>
          </View>
        ) : (
          users.map(renderUserItem)
        )}
      </ScrollView>

      {/* Confirm Connection Modal */}
      <ConfirmConnectionModal
        selectedUser={selectedUser}
        showConfirmModal={showConfirmModal}
        setShowConfirmModal={setShowConfirmModal}
        selectedRelationship={selectedRelationship}
        handleRelationshipChange={handleRelationshipChange}
        handleConfirmConnection={handleConfirmConnection}
        handleCancelConnection={handleCancelConnection}
      />

      {/* Success Connection Modal */}
      <ConnectionSuccessModal
        showSuccessModal={showSuccessModal}
        selectedUser={selectedUser}
        selectedRelationship={selectedRelationship}
        handleCloseSuccess={handleCloseSuccess}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#2196F3",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp("4%"),
    paddingVertical: hp("1.5%"),
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: hp("0.2%") },
    shadowOpacity: 0.1,
    shadowRadius: wp("1%"),
  },
  backButton: {
    marginRight: wp("4%"),
  },
  headerTitle: {
    color: "white",
    fontSize: wp("4.5%"),
    fontWeight: "600",
  },
  searchContainer: {
    backgroundColor: "#2196F3",
    paddingHorizontal: wp("4%"),
    paddingBottom: hp("2%"),
  },
  searchBar: {
    backgroundColor: "white",
    borderRadius: wp("6%"),
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp("4%"),
    paddingVertical: hp("1.5%"),
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: hp("0.1%") },
    shadowOpacity: 0.1,
    shadowRadius: wp("0.5%"),
  },
  searchIcon: {
    marginRight: wp("3%"),
  },
  clearButton: {
    marginLeft: wp("2%"),
    padding: wp("1%"),
  },
  searchInput: {
    flex: 1,
    fontSize: wp("4%"),
    color: "#333",
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: wp("4%"),
    paddingVertical: hp("2%"),
    backgroundColor: "white",
  },
  resultsTitle: {
    flex: 1,
    fontSize: wp("4%"),
    fontWeight: "600",
    color: "#333",
  },
  refreshButton: {
    padding: wp("2%"),
    marginHorizontal: wp("2%"),
  },
  spinning: {
    transform: [{ rotate: '360deg' }],
  },
  resultsCount: {
    fontSize: wp("3.5%"),
    color: "#666",
  },
  userList: {
    flex: 1,
    backgroundColor: "white",
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp("4%"),
    paddingVertical: hp("2%"),
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  userInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: wp("12%"),
    height: wp("12%"),
    borderRadius: wp("6%"),
    justifyContent: "center",
    alignItems: "center",
    marginRight: wp("3%"),
    position: "relative",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: wp("6%"),
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: wp("6%"),
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: wp("5%"),
    fontWeight: "600",
    color: "#333",
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: wp("4%"),
    fontWeight: "600",
    color: "#333",
    marginBottom: hp("0.5%"),
  },
  userLocation: {
    fontSize: wp("3.5%"),
    color: "#666",
    marginBottom: hp("0.8%"),
  },
  connectButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: wp("4%"),
    paddingVertical: hp("1%"),
    borderRadius: wp("5%"),
  },
  connectButtonText: {
    color: "white",
    fontSize: wp("3.5%"),
    fontWeight: "600",
  },
  statusContainer: {
    alignItems: "flex-end",
    minWidth: wp("25%"),
  },
  pendingStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    paddingHorizontal: wp("2.5%"),
    paddingVertical: hp("0.8%"),
    borderRadius: wp("3%"),
    borderWidth: 1,
    borderColor: "#FF9800",
  },
  pendingStatusText: {
    fontSize: wp("3%"),
    fontWeight: "600",
    color: "#FF9800",
    marginLeft: wp("1%"),
  },
  acceptedStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E8",
    paddingHorizontal: wp("2.5%"),
    paddingVertical: hp("0.8%"),
    borderRadius: wp("3%"),
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  acceptedStatusText: {
    fontSize: wp("3%"),
    fontWeight: "600",
    color: "#4CAF50",
    marginLeft: wp("1%"),
  },
  rejectedStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    paddingHorizontal: wp("2.5%"),
    paddingVertical: hp("0.8%"),
    borderRadius: wp("3%"),
    borderWidth: 1,
    borderColor: "#F44336",
  },
  rejectedStatusText: {
    fontSize: wp("3%"),
    fontWeight: "600",
    color: "#F44336",
    marginLeft: wp("1%"),
  },
  relationshipTypeText: {
    fontSize: wp("2.8%"),
    color: "#666",
    fontStyle: "italic",
    marginTop: hp("0.3%"),
  },
  statusText: {
    fontSize: wp("3.5%"),
    fontWeight: "600",
    color: "#666",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: wp("2%"),
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: wp("4%"),
    padding: wp("4%"),
    width: wp("90%"),
    alignItems: "center",
    flexGrow: 1,
  },
  successModalContent: {
    backgroundColor: "white",
    borderRadius: wp("4%"),
    padding: wp("6%"),
    width: wp("90%"),
    alignItems: "center",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: hp("2%"),
  },
  largeAvatar: {
    width: wp("18%"),
    height: wp("18%"),
    borderRadius: wp("9%"),
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  largeAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: wp("9%"),
  },
  largeAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: wp("9%"),
    justifyContent: "center",
    alignItems: "center",
  },
  largeAvatarText: {
    fontSize: wp("7%"),
    fontWeight: "600",
    color: "#333",
  },
  modalTitle: {
    fontSize: wp("5%"),
    fontWeight: "600",
    color: "#333",
    marginBottom: hp("1%"),
  },
  modalSubtitle: {
    color: "#666",
    fontSize: wp("3.5%"),
    marginBottom: hp("1%"),
  },
  userInfoSection: {
    alignItems: "center",
    marginBottom: hp("2%"),
  },
  userNameModal: {
    fontSize: wp("4.5%"),
    fontWeight: "600",
    color: "#333",
    marginBottom: hp("0.5%"),
  },
  userDetailsModal: {
    color: "#666",
    fontSize: wp("3.5%"),
  },
  relationshipSection: {
    width: "100%",
    marginBottom: hp("2%"),
    flex: 1,
  },
  relationshipTitle: {
    fontSize: wp("4%"),
    fontWeight: "600",
    color: "#333",
    marginBottom: hp("1.5%"),
  },
  relationshipInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: wp("2%"),
    paddingHorizontal: wp("3%"),
    paddingVertical: hp("1.5%"),
    fontSize: wp("4%"),
    color: "#333",
    backgroundColor: "#f9f9f9",
    marginBottom: hp("1.5%"),
  },
  suggestionsContainer: {
    marginTop: hp("1%"),
  },
  suggestionsTitle: {
    fontSize: wp("3.5%"),
    fontWeight: "500",
    color: "#666",
    marginBottom: hp("1%"),
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: wp("2%"),
  },
  suggestionChip: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: wp("3%"),
    paddingVertical: hp("0.8%"),
    borderRadius: wp("4%"),
    borderWidth: 1,
    borderColor: "#2196F3",
  },
  suggestionText: {
    fontSize: wp("3.5%"),
    color: "#2196F3",
    fontWeight: "500",
  },
  actionButtons: {
    width: "100%",
    marginTop: hp("1%"),
  },
  confirmButton: {
    backgroundColor: "#2196F3",
    paddingVertical: hp("1.5%"),
    borderRadius: wp("2%"),
    alignItems: "center",
    marginBottom: hp("1%"),
  },
  confirmButtonText: {
    color: "white",
    fontSize: wp("4%"),
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
    paddingVertical: hp("1.5%"),
    borderRadius: wp("2%"),
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: wp("4%"),
    fontWeight: "600",
  },
  successIcon: {
    width: wp("20%"),
    height: wp("20%"),
    borderRadius: wp("10%"),
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: hp("2.5%"),
  },
  successTitle: {
    fontSize: wp("5%"),
    fontWeight: "600",
    color: "#333",
    marginBottom: hp("1.5%"),
    textAlign: "center",
  },
  successSubtitle: {
    color: "#666",
    fontSize: wp("4%"),
    marginBottom: hp("1%"),
    textAlign: "center",
  },
  successUserInfo: {
    alignItems: "center",
    marginBottom: hp("3%"),
  },
  successUserName: {
    fontSize: wp("4.5%"),
    fontWeight: "600",
    color: "#333",
    marginBottom: hp("0.5%"),
  },
  successUserRelationship: {
    color: "#666",
    fontSize: wp("3.5%"),
  },
  pendingNotice: {
    width: "100%",
    backgroundColor: "#f5f5f5",
    borderRadius: wp("2%"),
    padding: wp("4%"),
    marginBottom: hp("3%"),
  },
  pendingNoticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: hp("1%"),
  },
  noticeIcon: {
    width: wp("5%"),
    height: wp("5%"),
    borderRadius: wp("2.5%"),
    backgroundColor: "#FF9800",
    justifyContent: "center",
    alignItems: "center",
    marginRight: wp("2%"),
  },
  noticeTitle: {
    fontSize: wp("4%"),
    fontWeight: "600",
    color: "#333",
  },
  noticeText: {
    fontSize: wp("3.5%"),
    color: "#666",
    lineHeight: hp("2.5%"),
  },
  closeButton: {
    backgroundColor: "#2196F3",
    paddingVertical: hp("1.5%"),
    borderRadius: wp("2%"),
    alignItems: "center",
    width: "100%",
  },
  closeButtonText: {
    color: "white",
    fontSize: wp("4%"),
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: hp("6%"),
  },
  loadingText: {
    fontSize: wp("4%"),
    color: "#666",
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: hp("6%"),
  },
  searchIconLarge: {
    marginBottom: hp("2%"),
  },
  emptyText: {
    fontSize: wp("4%"),
    color: "#999",
    textAlign: "center",
    marginBottom: hp("1%"),
  },
  emptySubtext: {
    fontSize: wp("3.5%"),
    color: "#ccc",
    textAlign: "center",
  },
});

export default FindPeopleScreen;