import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { conversationService } from '../../services/conversationService';
import { userService } from '../../services/userService';
import socketService from '../../services/socketService';
import { formatTime, formatMessagePreview } from '../../utils/timeFormat';

// Responsive helpers
const { width, height } = Dimensions.get('window');
const wp = percent => width * (parseFloat(percent) / 100);
const hp = percent => height * (parseFloat(percent) / 100);

const HEADER_COLOR = '#4F7EFF';

const MessagesListScreen = () => {
  const navigation = useNavigation();

  const [conversations, setConversations] = useState([]);
  const [query, setQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // ===== Socket handlers =====
  const updateConversationList = useCallback(
    (conversationId, latestMessage) => {
      setConversations(prev => {
        const updated = prev.map(c =>
          c._id === conversationId ? { ...c, latestMessage } : c,
        );
        return updated.sort((a, b) => {
          const ta = a.latestMessage
            ? new Date(a.latestMessage.createdAt)
            : new Date(a.createdAt);
          const tb = b.latestMessage
            ? new Date(b.latestMessage.createdAt)
            : new Date(b.createdAt);
          return tb - ta;
        });
      });
    },
    [],
  );

  const handleNewMessage = useCallback(
    data => {
      updateConversationList(data.conversationId, data.message);
    },
    [updateConversationList],
  );

  const handleConversationUpdated = useCallback(
    data => {
      updateConversationList(data.conversationId, data.latestMessage);
    },
    [updateConversationList],
  );

  useEffect(() => {
    // lắng nghe
    socketService.on('new_message', handleNewMessage);
    socketService.on('conversation_updated', handleConversationUpdated);
    return () => {
      // cleanup
      socketService.off('new_message', handleNewMessage);
      socketService.off('conversation_updated', handleConversationUpdated);
    };
  }, [handleNewMessage, handleConversationUpdated]);

  // ===== Fetch =====
  const fetchConversations = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(null);

      const userResponse = await userService.getUser();
      if (!userResponse?.success) {
        setError('Không thể lấy thông tin người dùng');
        return;
      }
      const me = userResponse.data;
      setCurrentUser(me);

      const res = await conversationService.getAllConversationsByUserId(me._id);
      if (res?.success) {
        const data = res.data?.data || res.data || [];
        setConversations(Array.isArray(data) ? data : []);
      } else {
        setError(res?.message || 'Không thể tải danh sách cuộc trò chuyện');
      }
    } catch (e) {
      setError(e?.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
  }, [fetchConversations]);

  // ===== Filter by search =====
  const filteredConversations = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.trim().toLowerCase();
    return conversations.filter(c => {
      const other = c.participants?.find(p => p.user?._id !== currentUser?._id);
      const name = other?.user?.fullName?.toLowerCase() || '';
      const preview =
        formatMessagePreview(
          c.latestMessage,
          currentUser?._id,
        )?.toLowerCase() || '';
      return name.includes(q) || preview.includes(q);
    });
  }, [conversations, query, currentUser]);

  // ===== UI Components =====
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
          <Text style={styles.headerTitle}>Tin nhắn</Text>
          <Text style={styles.headerSubtitle}>Trao đổi và hỗ trợ nhanh</Text>
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

  const ConversationItem = ({ item }) => {
    const other = item.participants?.find(
      p => p.user?._id !== currentUser?._id,
    );
    const name = other?.user?.fullName || 'Không xác định';
    const avatar = other?.user?.avatar;
    const avatarLetter = name?.charAt(0)?.toUpperCase?.() || '?';

    const latest = item.latestMessage;
    const preview =
      formatMessagePreview(latest, currentUser?._id) || 'Cuộc trò chuyện mới';
    const timeText = formatTime(latest?.createdAt);

    const isUnread =
      latest &&
      latest.sender?._id !== currentUser?._id &&
      latest.status !== 'read' &&
      !latest.readBy?.some(r => r.user === currentUser?._id);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.card, isUnread && styles.cardUnread]}
        onPress={() =>
          navigation.navigate('Chat', {
            conversationId: item._id,
            otherParticipant: other,
          })
        }
      >
        <View style={styles.row}>
          <View style={styles.avatar}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            )}
          </View>

          <View style={styles.cardBody}>
            <View style={styles.rowBetween}>
              <Text
                numberOfLines={1}
                style={[styles.name, isUnread && styles.nameUnread]}
              >
                {name}
              </Text>
              <View style={styles.timeWrap}>
                <Text style={[styles.time, isUnread && styles.timeUnread]}>
                  {timeText}
                </Text>
                {isUnread && <View style={styles.unreadDot} />}
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.preview, isUnread && styles.previewUnread]}
            >
              {preview}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => <ConversationItem item={item} />;

  // ===== Screens =====
  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={HEADER_COLOR} />
          <Text style={styles.helperText}>Đang tải cuộc trò chuyện…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <Text style={styles.errorText}>Lỗi: {error}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Header />
      {/* Search inside header */}
      <View style={styles.searchBar}>
        <Icon
          name="search"
          size={20}
          color="#93A3FF"
          style={{ marginRight: 8 }}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm kiếm cuộc trò chuyện…"
          placeholderTextColor="#93A3FF"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            style={styles.clearBtn}
            activeOpacity={0.8}
          >
            <Icon name="close" size={18} color="#93A3FF" />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={filteredConversations}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[HEADER_COLOR]}
            tintColor={HEADER_COLOR}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Icon name="message" size={64} color="#cbd5e1" />
            <Text style={[styles.helperText, { marginTop: 8 }]}>
              Chưa có cuộc trò chuyện nào
            </Text>
            <Text style={styles.subHelper}>Kéo xuống để làm mới</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  /* Screen */
  screen: { flex: 1, backgroundColor: '#F6F8FF' },

  /* Header */
  headerWrap: {
    backgroundColor: HEADER_COLOR,
    paddingHorizontal: wp(4),
    paddingTop: hp(1),
    paddingBottom: hp(2.2),
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

  searchBar: {
    marginTop: hp(1.6),
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6EDFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
    }),
    marginRight: 16,
    marginLeft: 16,
  },
  searchInput: { flex: 1, color: '#1f2937', fontSize: wp(3.8) },
  clearBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* List */
  list: { paddingHorizontal: 14, paddingVertical: 14 },

  /* Card (conversation item) */
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAF0FF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 1 },
    }),
  },
  cardUnread: {
    backgroundColor: '#F4F7FF',
    borderColor: '#DCE6FF',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#6b7280' },

  cardBody: { flex: 1 },
  name: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: wp(58),
  },
  nameUnread: { color: '#0b1324' },
  timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontSize: 12, color: '#64748b' },
  timeUnread: { color: HEADER_COLOR, fontWeight: '700' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HEADER_COLOR,
  },

  preview: { marginTop: 4, fontSize: 13.5, color: '#475569' },
  previewUnread: { color: '#0f172a', fontWeight: '600' },

  /* States */
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  helperText: { color: '#475569', marginTop: 6 },
  subHelper: { color: '#94a3b8', marginTop: 2 },
  errorText: { color: '#b91c1c', textAlign: 'center', marginBottom: 12 },
  primaryBtn: {
    backgroundColor: HEADER_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
});

export default MessagesListScreen;
