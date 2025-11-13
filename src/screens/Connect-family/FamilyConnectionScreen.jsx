import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, ScrollView, Modal, Alert } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { relationshipService } from "../../services/relationshipService";
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from "react-native-responsive-screen";

const FamilyConnectionScreen = () => {
  const navigation = useNavigation();
  const [friendRequests, setFriendRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionType, setActionType] = useState(null); // Xác định loại hành động
  const [notificationModalVisible, setNotificationModalVisible] = useState(false); // Thêm trạng thái cho modal thông báo
  const [notificationMessage, setNotificationMessage] = useState(""); // Tin nhắn thông báo

  useEffect(() => {
    const fetchData = async () => {
      const result = await relationshipService.getRequestRelationshipsById();
      console.log("API result:", result);
      if (result.success) {
        console.log("Friend requests data:", result.data);
        setFriendRequests(result.data);
      } else {
        console.log("API error:", result.message);
      }
    };
    fetchData();
  }, []);

  const privacyOptions = [
    {
      id: 1,
      title: "Dữ liệu được bảo mật",
      subtitle: "Thông tin sức khỏe của bạn được mã hóa và chỉ chia sẻ với người được chấp nhận",
      icon: "🔒",
      color: "#3B82F6",
    },
    {
      id: 2,
      title: "Kiểm soát quyền truy cập",
      subtitle: "Bạn có thể kiểm soát ai có thể xem dữ liệu sức khỏe kết nối với các ứng dụng",
      icon: "👁️",
      color: "#F59E0B",
    },
    {
      id: 3,
      title: "Thông báo minh bạch",
      subtitle: "Bạn sẽ được thông báo mỗi khi có ai đó yêu cầu truy cập thông tin của bạn",
      icon: "🔔",
      color: "#10B981",
    },
  ];

  const handleAccept = (request) => {
    console.log("Accept request:", request._id);
    setSelectedRequest(request);
    setActionType("accept");
    setModalVisible(true);
  };

  const handleDecline = (request) => {
    console.log("Decline request:", request._id);
    setSelectedRequest(request);
    setActionType("decline");
    setModalVisible(true);
  };

  const handleConfirmAction = async () => {
    try {
      if (actionType === "accept") {
        const result = await relationshipService.acceptRelationship(selectedRequest._id);
        if (result.success) {
          setFriendRequests((prev) => prev.filter((req) => req._id !== selectedRequest._id));
          setNotificationMessage("Đã chấp nhận kết nối");
        } else {
          setNotificationMessage(`Lỗi: ${result.message}`);
        }
      } else if (actionType === "decline") {
        const result = await relationshipService.rejectRelationship(selectedRequest._id);
        if (result.success) {
          setFriendRequests((prev) => prev.filter((req) => req._id !== selectedRequest._id));
          setNotificationMessage("Đã từ chối kết nối");
        } else {
          setNotificationMessage(`Lỗi: ${result.message}`);
        }
      }
    } catch (error) {
      setNotificationMessage("Có lỗi xảy ra khi thực hiện hành động");
    }
    setModalVisible(false);
    setNotificationModalVisible(true); // Hiển thị modal thông báo
  };

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  const handleCloseNotificationModal = () => {
    setNotificationModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={wp("6%")} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Kết nối gia đình</Text>
          <Text style={styles.headerSubtitle}>Yêu cầu kết nối</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Friend Requests Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Icon name="person-add" size={wp("5%")} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Yêu cầu mới</Text>
            </View>
            <View style={styles.requestBadge}>
              <Text style={styles.requestBadgeText}>{friendRequests.length} yêu cầu</Text>
            </View>
          </View>

          {friendRequests.length === 0 ? (
            <Text style={styles.noRequestsText}>Không có yêu cầu kết nối nào.</Text>
          ) : (
            friendRequests.map((request) => (
              <View key={request._id} style={styles.requestCard}>
                <View style={styles.userInfo}>
                  <View style={styles.avatarContainer}>
                    <Image source={{ uri: request.requestedBy?.avatar || "https://via.placeholder.com/48" }} style={styles.avatar} />
                  </View>
                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>{request.requestedBy?.fullName || "Unknown"}</Text>
                    <View style={styles.userMeta}>
                      <View style={styles.relationshipTag}>
                        <Icon name="verified" size={wp("4%")} color="#3B82F6" />
                        <Text style={styles.relationshipText}>{request.relationship}</Text>
                      </View>
                      <View style={styles.phoneContainer}>
                        <Icon name="phone" size={wp("4%")} color="#10B981" />
                        <Text style={styles.phoneText}>+{request.requestedBy?.phoneNumber || "N/A"}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.declineButton} onPress={() => handleDecline(request)}>
                    <Icon name="close" size={wp("4%")} color="#6B7280" />
                    <Text style={styles.declineButtonText}>Từ chối</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(request)}>
                    <Icon name="check" size={wp("4%")} color="white" />
                    <Text style={styles.acceptButtonText}>Chấp nhận</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Icon name="security" size={wp("5%")} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Quyền riêng tư</Text>
            </View>
          </View>

          {privacyOptions.map((option) => (
            <View key={option.id} style={styles.privacyCard}>
              <View style={[styles.privacyIcon, { backgroundColor: `${option.color}15` }]}>
                <Text style={styles.privacyEmoji}>{option.icon}</Text>
              </View>
              <View style={styles.privacyContent}>
                <Text style={styles.privacyTitle}>{option.title}</Text>
                <Text style={styles.privacySubtitle}>{option.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Modal Xác nhận kết nối */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {actionType === "accept" ? "Xác nhận chấp nhận" : "Xác nhận từ chối"}
              </Text>
              <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
                <Icon name="close" size={wp("6%")} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {actionType === "accept"
                ? "Bạn có chắc chắn muốn chấp nhận kết nối với:"
                : "Bạn có chắc chắn muốn từ chối kết nối với:"}
            </Text>

            <View style={styles.userInfoModal}>
              <View style={styles.divider} />

              <View style={styles.userDetailsModal}>
                <View style={styles.avatarContainer}>
                  <Image
                    source={{ uri: selectedRequest?.requestedBy?.avatar || "https://via.placeholder.com/48" }}
                    style={styles.avatar}
                  />
                </View>
                <Text style={styles.userNameModal}>{selectedRequest?.requestedBy?.fullName || "Unknown"}</Text>
                <View style={styles.userMetaModal}>
                  <Text style={styles.relationshipModal}>
                    {selectedRequest?.relationship}
                  </Text>
                </View>
                <View style={styles.phoneModal}>
                  <Icon name="phone" size={wp("4%")} color="#10B981" />
                  <Text style={styles.phoneTextModal}>+{selectedRequest?.requestedBy?.phoneNumber || "N/A"}</Text>
                </View>
              </View>

              <View style={styles.divider} />
            </View>

            {actionType === "accept" && (
              <View style={styles.permissionsContainer}>
                <Text style={styles.permissionsTitle}>Quyền truy cập sẽ được cấp:</Text>

                <View style={styles.permissionItem}>
                  <View style={styles.checkbox}>
                    <Icon name="check" size={wp("4%")} color="#3B82F6" />
                  </View>
                  <Text style={styles.permissionText}>Xem chỉ số sức khỏe hàng ngày</Text>
                </View>

                <View style={styles.permissionItem}>
                  <View style={styles.checkbox}>
                    <Icon name="check" size={wp("4%")} color="#3B82F6" />
                  </View>
                  <Text style={styles.permissionText}>Nhận thông báo về lịch uống thuốc</Text>
                </View>

                <View style={styles.permissionItem}>
                  <View style={styles.checkbox}>
                    <Icon name="check" size={wp("4%")} color="#3B82F6" />
                  </View>
                  <Text style={styles.permissionText}>Theo dõi tình trạng cảm xúc</Text>
                </View>

                <View style={styles.permissionItem}>
                  <View style={styles.checkbox}>
                    <Icon name="check" size={wp("4%")} color="#3B82F6" />
                  </View>
                  <Text style={styles.permissionText}>Nhận cảnh báo khẩn cấp</Text>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCloseModal}>
                <Text style={styles.cancelButtonText}>Hủy bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmAction}>
                <Text style={styles.confirmButtonText}>
                  {actionType === "accept" ? "Chấp nhận" : "Từ chối"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Thông báo */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={notificationModalVisible}
        onRequestClose={handleCloseNotificationModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.notificationModalContainer}>
            <View style={styles.notificationHeader}>
              <View style={styles.notificationIconContainer}>
                <Icon 
                  name={notificationMessage.includes("Lỗi") ? "error" : "check-circle"} 
                  size={wp("12%")} 
                  color={notificationMessage.includes("Lỗi") ? "#EF4444" : "#10B981"} 
                />
              </View>
              <Text style={styles.notificationTitle}>
                {notificationMessage.includes("Lỗi") ? "Lỗi" : "Thành công"}
              </Text>
            </View>
            <Text style={styles.notificationMessage}>{notificationMessage}</Text>
            <TouchableOpacity style={styles.okButton} onPress={handleCloseNotificationModal}>
              <Text style={styles.okButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    backgroundColor: "#3B82F6",
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
    padding: wp("2%"),
  },
  headerContent: {
    flex: 1,
    marginLeft: wp("2%"),
    alignItems: "center",
  },
  headerTitle: {
    fontSize: wp("4.5%"),
    fontWeight: "600",
    color: "white",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: wp("3.5%"),
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: hp("0.5%"),
    textAlign: "center",
  },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: wp("3%"),
    paddingHorizontal: wp("2%"),
    paddingVertical: hp("1%"),
  },
  badgeText: {
    color: "white",
    fontSize: wp("3.5%"),
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: wp("4%"),
  },
  section: {
    marginBottom: hp("3%"),
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp("2%"),
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: wp("4%"),
    fontWeight: "600",
    color: "#1F2937",
    marginLeft: wp("2%"),
  },
  requestBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: wp("2%"),
    paddingVertical: hp("1%"),
    borderRadius: wp("3%"),
  },
  requestBadgeText: {
    fontSize: wp("3%"),
    color: "#D97706",
    fontWeight: "500",
  },
  requestCard: {
    backgroundColor: "white",
    borderRadius: wp("3%"),
    padding: wp("4%"),
    marginBottom: hp("2%"),
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: hp("0.2%") },
    shadowOpacity: 0.05,
    shadowRadius: wp("0.5%"),
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: hp("2%"),
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: wp("12%"),
    height: wp("12%"),
    borderRadius: wp("6%"),
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: wp("3.5%"),
    height: wp("3.5%"),
    backgroundColor: "#10B981",
    borderRadius: wp("1.75%"),
    borderWidth: 2,
    borderColor: "white",
  },
  userDetails: {
    flex: 1,
    marginLeft: wp("3%"),
  },
  userName: {
    fontSize: wp("4%"),
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: hp("1%"),
  },
  userMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  relationshipTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EBF4FF",
    paddingHorizontal: wp("2%"),
    paddingVertical: hp("1%"),
    borderRadius: wp("2%"),
    marginRight: wp("2%"),
  },
  relationshipText: {
    fontSize: wp("3%"),
    color: "#3B82F6",
    fontWeight: "500",
    marginLeft: wp("1%"),
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  phoneText: {
    fontSize: wp("3%"),
    color: "#6B7280",
    marginLeft: wp("1%"),
  },
  actionButtons: {
    flexDirection: "row",
    gap: wp("3%"),
  },
  declineButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: hp("2%"),
    borderRadius: wp("2%"),
  },
  declineButtonText: {
    fontSize: wp("3.5%"),
    color: "#6B7280",
    fontWeight: "500",
    marginLeft: wp("1%"),
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: hp("2%"),
    borderRadius: wp("2%"),
  },
  acceptButtonText: {
    fontSize: wp("3.5%"),
    color: "white",
    fontWeight: "500",
    marginLeft: wp("1%"),
  },
  privacyCard: {
    backgroundColor: "white",
    borderRadius: wp("3%"),
    padding: wp("4%"),
    marginBottom: hp("2%"),
    flexDirection: "row",
    alignItems: "flex-start",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: hp("0.2%") },
    shadowOpacity: 0.05,
    shadowRadius: wp("0.5%"),
  },
  privacyIcon: {
    width: wp("10%"),
    height: wp("10%"),
    borderRadius: wp("5%"),
    alignItems: "center",
    justifyContent: "center",
    marginRight: wp("3%"),
  },
  privacyEmoji: {
    fontSize: wp("5%"),
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: wp("3.5%"),
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: hp("1%"),
  },
  privacySubtitle: {
    fontSize: wp("3%"),
    color: "#6B7280",
    lineHeight: hp("2%"),
  },
  noRequestsText: {
    textAlign: "center",
    fontSize: wp("4%"),
    color: "#6B7280",
    marginTop: hp("2%"),
  },
  // Styles for modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: wp("2%"),
  },
  modalContainer: {
    width: wp("90%"),
    backgroundColor: "white",
    borderRadius: wp("4%"),
    padding: wp("5%"),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: hp("0.5%") },
    shadowOpacity: 0.25,
    shadowRadius: wp("1%"),
    elevation: 5,
    flexGrow: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp("1.5%"),
  },
  modalTitle: {
    fontSize: wp("4.5%"),
    fontWeight: "600",
    color: "#1F2937",
  },
  closeButton: {
    padding: wp("1%"),
  },
  modalSubtitle: {
    fontSize: wp("3.5%"),
    color: "#6B7280",
    marginBottom: hp("2%"),
  },
  userInfoModal: {
    marginVertical: hp("2%"),
  },
  divider: {
    height: hp("0.2%"),
    backgroundColor: "#E5E7EB",
    marginVertical: hp("1%"),
  },
  userDetailsModal: {
    paddingVertical: hp("1%"),
    alignItems: "center",
  },
  userNameModal: {
    fontSize: wp("4.5%"),
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: hp("1%"),
  },
  userMetaModal: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: hp("1%"),
  },
  relationshipModal: {
    fontSize: wp("3.5%"),
    color: "#3B82F6",
    fontWeight: "500",
  },
  genderModal: {
    fontSize: wp("3.5%"),
    color: "#6B7280",
    marginLeft: wp("1%"),
  },
  phoneModal: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  phoneTextModal: {
    fontSize: wp("3.5%"),
    color: "#6B7280",
    marginLeft: wp("1%"),
  },
  permissionsContainer: {
    marginVertical: hp("2%"),
  },
  permissionsTitle: {
    fontSize: wp("3.5%"),
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: hp("1.5%"),
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: hp("1.5%"),
  },
  checkbox: {
    width: wp("5%"),
    height: wp("5%"),
    borderRadius: wp("1%"),
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: wp("3%"),
  },
  permissionText: {
    fontSize: wp("3.5%"),
    color: "#4B5563",
    flex: 1,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: hp("2%"),
    gap: wp("2%"),
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: hp("2%"),
    borderRadius: wp("2%"),
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: wp("4%"),
    fontWeight: "600",
    color: "#4B5563",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "#3B82F6",
    paddingVertical: hp("2%"),
    borderRadius: wp("2%"),
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: wp("4%"),
    fontWeight: "600",
    color: "white",
  },
  // Styles for notification modal
  notificationModalContainer: {
    width: wp("80%"),
    backgroundColor: "white",
    borderRadius: wp("4%"),
    padding: wp("5%"),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: hp("0.5%") },
    shadowOpacity: 0.25,
    shadowRadius: wp("1%"),
    elevation: 5,
    alignItems: "center",
  },
  notificationHeader: {
    alignItems: "center",
    width: "100%",
    marginBottom: hp("1.5%"),
    position: "relative",
  },
  notificationIconContainer: {
    marginBottom: hp("2%"),
  },
  notificationTitle: {
    fontSize: wp("4.5%"),
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
  },
  notificationMessage: {
    fontSize: wp("4%"),
    color: "#4B5563",
    textAlign: "center",
    marginBottom: hp("2%"),
  },
  okButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: hp("2%"),
    borderRadius: wp("2%"),
    width: "100%",
    alignItems: "center",
  },
  okButtonText: {
    fontSize: wp("4%"),
    fontWeight: "600",
    color: "white",
  },
});

export default FamilyConnectionScreen;