import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet, StatusBar, Modal } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { relationshipService } from "../../services/relationshipService";
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from "react-native-responsive-screen";
import { SafeAreaView } from 'react-native-safe-area-context';

const FamilyConnectionListScreen = () => {
    const navigation = useNavigation();
    const [connectedMembers, setConnectedMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMember, setSelectedMember] = useState(null);
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [notificationModalVisible, setNotificationModalVisible] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState("");

    useEffect(() => {
        const fetchConnectedMembers = async () => {
            try {
                setLoading(true);
                const result = await relationshipService.getAcceptedRelationships();
                if (result.success) {
                const transformedData = result.data.map((relationship) => {
                    const relStr = (relationship.relationship || '').toString().toLowerCase();

                    // Mặc định vẫn dùng requestedBy (con gái, em, v.v.)
                    let targetUser = relationship.requestedBy;

                    // Nếu là quan hệ BÁC SĨ thì ưu tiên user có role = 'doctor'
                    if (relStr === 'bác sĩ' || relStr === 'doctor') {
                        if (relationship.elderly?.role === 'doctor') {
                            targetUser = relationship.elderly;
                        } else if (relationship.family?.role === 'doctor') {
                            targetUser = relationship.family;
                        } else if (relationship.requestedBy?.role === 'doctor') {
                            targetUser = relationship.requestedBy;
                        }
                    }

                    const fullName = targetUser?.fullName || 'Chưa cập nhật tên';
                    const phone = targetUser?.phoneNumber || 'N/A';
                    const avatar = targetUser?.avatar || 'https://via.placeholder.com/100';

                    console.log(
                        '[FamilyConnectionList] item',
                        relationship._id,
                        'rel =', relationship.relationship,
                        'elderly =', relationship.elderly?._id, relationship.elderly?.role,
                        'family =', relationship.family?._id, relationship.family?.role,
                        'requestedBy =', relationship.requestedBy?._id, relationship.requestedBy?.role,
                        'targetUser =', targetUser?._id, 'name =', fullName,
                    );

                    return {
                        id: relationship._id,
                        name: fullName,
                        relationship: relationship.relationship,
                        phone,
                        avatar,
                        isAccepted: true,
                    };
                });

                setConnectedMembers(transformedData);
            } else {
                setError(result.message);
            }

            } catch (error) {
                setError('Không thể tải danh sách thành viên');
                console.error('Error fetching connected members:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchConnectedMembers();
    }, []);

    const handleBack = () => {
        // Handle back navigation
        console.log("Back pressed")
    }

    const handleCancelConnection = (member) => {
        setSelectedMember(member);
        setCancelModalVisible(true);
    }

    const handleConfirmCancel = async () => {
        try {
            const result = await relationshipService.cancelRelationship(selectedMember.id);
            if (result.success) {
                // Remove from connected members list
                setConnectedMembers(prev => prev.filter(member => member.id !== selectedMember.id));
                setNotificationMessage("Đã hủy kết nối thành công");
            } else {
                setNotificationMessage(`Lỗi: ${result.message}`);
            }
            setCancelModalVisible(false);
            setNotificationModalVisible(true);
        } catch (error) {
            setNotificationMessage("Có lỗi xảy ra khi hủy kết nối");
            setCancelModalVisible(false);
            setNotificationModalVisible(true);
        }
    }

    const handleCloseCancelModal = () => {
        setCancelModalVisible(false);
        setSelectedMember(null);
    }

    const handleCloseNotificationModal = () => {
        setNotificationModalVisible(false);
        setNotificationMessage("");
    }

    const renderMemberCard = (member) => (
        <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberInfo}>
                <View style={styles.avatarContainer}>
                    <Image source={{ uri: member.avatar }} style={styles.avatar} />
                </View>

                <View style={styles.memberDetails}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberRelationship}>
                        {member.relationship} • +{member.phone}
                    </Text>
                </View>
            </View>

            <View style={styles.actionButtons}>
                <View style={styles.acceptedBadge}>
                    <Text style={styles.acceptedText}>Đã chấp nhận</Text>
                </View>
                <TouchableOpacity style={styles.cancelButtonMain} onPress={() => handleCancelConnection(member)}>
                    <Text style={styles.cancelButtonText}>Hủy kết nối</Text>
                </TouchableOpacity>
            </View>
        </View>
    )

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#4F7EFF" barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-back" size={wp("6%")} color="white" />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Kết nối gia đình</Text>
                    <Text style={styles.headerSubtitle}>Đã kết nối ({connectedMembers.length})</Text>
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
                        <TouchableOpacity style={styles.retryButton} onPress={() => {
                            setError(null);
                            setLoading(true);
                            // Re-fetch data
                            const fetchData = async () => {
                                try {
                                    const result = await relationshipService.getAcceptedRelationships();
                                    if (result.success) {
                                    const transformedData = result.data.map((relationship) => {
                                        const relStr = (relationship.relationship || '').toString().toLowerCase();

                                        let targetUser = relationship.requestedBy;

                                        if (relStr === 'bác sĩ' || relStr === 'doctor') {
                                            if (relationship.elderly?.role === 'doctor') {
                                                targetUser = relationship.elderly;
                                            } else if (relationship.family?.role === 'doctor') {
                                                targetUser = relationship.family;
                                            } else if (relationship.requestedBy?.role === 'doctor') {
                                                targetUser = relationship.requestedBy;
                                            }
                                        }

                                        const fullName = targetUser?.fullName || 'Chưa cập nhật tên';
                                        const phone = targetUser?.phoneNumber || 'N/A';
                                        const avatar = targetUser?.avatar || 'https://via.placeholder.com/100';

                                        console.log(
                                            '[FamilyConnectionList][RETRY] item',
                                            relationship._id,
                                            'rel =', relationship.relationship,
                                            'elderly =', relationship.elderly?._id, relationship.elderly?.role,
                                            'family =', relationship.family?._id, relationship.family?.role,
                                            'requestedBy =', relationship.requestedBy?._id, relationship.requestedBy?.role,
                                            'targetUser =', targetUser?._id, 'name =', fullName,
                                        );

                                        return {
                                            id: relationship._id,
                                            name: fullName,
                                            relationship: relationship.relationship,
                                            phone,
                                            avatar,
                                            isAccepted: true,
                                        };
                                    });

                                    setConnectedMembers(transformedData);
                                } else {
                                    setError(result.message);
                                }
                                } catch (error) {
                                    setError('Không thể tải danh sách thành viên');
                                } finally {
                                    setLoading(false);
                                }
                            };
                            fetchData();
                        }}>
                            <Text style={styles.retryButtonText}>Thử lại</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View style={styles.sectionHeader}>
                            <View style={styles.userIcon}>
                                <Text style={styles.userIconText}>👥</Text>
                            </View>
                            <Text style={styles.sectionTitle}>Đã kết nối ({connectedMembers.length})</Text>
                        </View>

                        {connectedMembers.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>Chưa có thành viên nào được kết nối</Text>
                            </View>
                        ) : (
                            <View style={styles.membersList}>{connectedMembers.map(renderMemberCard)}</View>
                        )}
                    </>
                )}
            </ScrollView>

            {/* Modal Xác nhận hủy kết nối */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={cancelModalVisible}
                onRequestClose={handleCloseCancelModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Xác nhận hủy kết nối</Text>
                            <TouchableOpacity onPress={handleCloseCancelModal} style={styles.closeButton}>
                                <Icon name="close" size={wp("6%")} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>
                            Bạn có chắc chắn muốn hủy kết nối với:
                        </Text>

                        <View style={styles.userInfoModal}>
                            <View style={styles.divider} />

                            <View style={styles.userDetailsModal}>
                                <View style={styles.avatarContainer}>
                                    <Image
                                        source={{ uri: selectedMember?.avatar || "https://via.placeholder.com/48" }}
                                        style={styles.avatar}
                                    />
                                </View>
                                <Text style={styles.userNameModal}>{selectedMember?.name || "Unknown"}</Text>
                                <View style={styles.userMetaModal}>
                                    <Text style={styles.relationshipModal}>
                                        {selectedMember?.relationship || ""}
                                    </Text>
                                </View>
                                <View style={styles.phoneModal}>
                                    <Icon name="phone" size={wp("4%")} color="#10B981" />
                                    <Text style={styles.phoneTextModal}>{selectedMember?.phone || "N/A"}</Text>
                                </View>
                            </View>

                            <View style={styles.divider} />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={handleCloseCancelModal}>
                                <Text style={styles.cancelButtonText}>Hủy bỏ</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmCancel}>
                                <Text style={styles.confirmButtonText}>Hủy kết nối</Text>
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
                                    name={notificationMessage.includes("Lỗi") || notificationMessage.includes("lỗi") ? "error" : "check-circle"}
                                    size={wp("12%")}
                                    color={notificationMessage.includes("Lỗi") || notificationMessage.includes("lỗi") ? "#EF4444" : "#10B981"}
                                />
                            </View>
                            <Text style={styles.notificationTitle}>
                                {notificationMessage.includes("Lỗi") || notificationMessage.includes("lỗi") ? "Lỗi" : "Thành công"}
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
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F5F5",
    },
    header: {
        backgroundColor: "#4F7EFF",
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
    headerCenter: {
        flex: 1,
        alignItems: "center",
    },
    headerTitle: {
        color: "#FFFFFF",
        fontSize: wp("4.5%"),
        fontWeight: "bold",
    },
    headerSubtitle: {
        color: "#FFFFFF",
        fontSize: wp("3.5%"),
        opacity: 0.9,
    },
    content: {
        flex: 1,
        padding: wp("4%"),
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: hp("2%"),
    },
    userIcon: {
        marginRight: wp("3%"),
    },
    userIconText: {
        fontSize: wp("6%"),
    },
    sectionTitle: {
        fontSize: wp("4.5%"),
        fontWeight: "bold",
        color: "#333333",
    },
    membersList: {
        gap: hp("1.5%"),
    },
    memberCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: wp("3%"),
        padding: wp("4%"),
        marginBottom: hp("1.5%"),
        borderWidth: 2,
        borderColor: "#B8E6B8",
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: hp("0.2%") },
        shadowOpacity: 0.1,
        shadowRadius: wp("0.5%"),
    },
    memberInfo: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: hp("1.5%"),
    },
    avatarContainer: {
        position: "relative",
        marginRight: wp("3%"),
    },
    avatar: {
        width: wp("12%"),
        height: wp("12%"),
        borderRadius: wp("6%"),
    },
    checkmarkIcon: {
        position: "absolute",
        bottom: hp("-0.5%"),
        right: wp("-0.5%"),
        backgroundColor: "#4CAF50",
        width: wp("5%"),
        height: wp("5%"),
        borderRadius: wp("2.5%"),
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#FFFFFF",
    },
    checkmark: {
        color: "#FFFFFF",
        fontSize: wp("3%"),
        fontWeight: "bold",
    },
    memberDetails: {
        flex: 1,
    },
    memberName: {
        fontSize: wp("4%"),
        fontWeight: "bold",
        color: "#333333",
        marginBottom: hp("1%"),
    },
    memberRelationship: {
        fontSize: wp("3.5%"),
        color: "#666666",
    },
    actionButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    acceptedBadge: {
        backgroundColor: "#E8F5E8",
        paddingHorizontal: wp("3%"),
        paddingVertical: hp("1%"),
        borderRadius: wp("4%"),
    },
    acceptedText: {
        color: "#4CAF50",
        fontSize: wp("3%"),
        fontWeight: "600",
    },
    cancelButton: {
        backgroundColor: "#FF6B6B",
        paddingHorizontal: wp("3%"),
        paddingVertical: hp("1%"),
        borderRadius: wp("5%"),
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: hp("0.2%") },
        shadowOpacity: 0.2,
        shadowRadius: wp("0.5%"),
        borderWidth: 1,
        borderColor: "#FF5252",
    },
    cancelButtonText: {
        color: "#FFFFFF",
        fontSize: wp("3.5%"),
        fontWeight: "600",
        textAlign: "center",
    },
    cancelButtonMain: {
        backgroundColor: "#FF6B6B",
        paddingHorizontal: wp("3%"),
        paddingVertical: hp("1%"),
        borderRadius: wp("5%"),
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: hp("0.2%") },
        shadowOpacity: 0.2,
        shadowRadius: wp("0.5%"),
        borderWidth: 1,
        borderColor: "#FF5252",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: hp("6%"),
    },
    loadingText: {
        fontSize: wp("4%"),
        color: "#666666",
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: hp("6%"),
        paddingHorizontal: wp("5%"),
    },
    errorText: {
        fontSize: wp("4%"),
        color: "#E53E3E",
        textAlign: "center",
        marginBottom: hp("2%"),
    },
    retryButton: {
        backgroundColor: "#4F7EFF",
        paddingHorizontal: wp("5%"),
        paddingVertical: hp("2%"),
        borderRadius: wp("2%"),
    },
    retryButtonText: {
        color: "#FFFFFF",
        fontSize: wp("3.5%"),
        fontWeight: "600",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: hp("6%"),
    },
    emptyText: {
        fontSize: wp("4%"),
        color: "#666666",
        textAlign: "center",
    },
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
        backgroundColor: "#db2b2bff",
        paddingVertical: hp("2%"),
        borderRadius: wp("2%"),
        alignItems: "center",
    },
    confirmButtonText: {
        fontSize: wp("4%"),
        fontWeight: "600",
        color: "white",
    },
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

export default FamilyConnectionListScreen