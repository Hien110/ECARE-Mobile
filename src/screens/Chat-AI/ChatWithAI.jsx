import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Sound, { createSound } from 'react-native-nitro-sound';
import aiService from '../../services/aiService';
import { transcriptionService } from '../../services/transcriptionService';
import { BASE_URL as API_BASE_URL } from '../../services/api/axiosConfig';

/* ================== Cấu hình ================== */
// Dùng cùng host với API để tránh lệch địa chỉ khi test LAN/emulator
const HEALTH_FALLBACK = `${API_BASE_URL.replace(/\/api\/?$/, '')}/health`;
const AUTO_STOP_MS = 30_000; // auto dừng ghi sau 30s

/* ================== Lọc từ cấm ================== */

const DEBUG = false; // tắt toàn bộ log

const BANNED_WORDS = [
  'dm','dit me','ditme','dit con me','dcmm','cl','cc','cac','loz','lozz','lon','buoi','cacc',
  'fuck','fucking','shit','bitch','asshole','motherfucker','mf'
];

function normalizeVN(s = '') {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}
function wordBoundaryRegex(word) {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i');
}
function containsBanned(text = '') {
  const norm = normalizeVN(text);
  for (const w of BANNED_WORDS) {
    if (wordBoundaryRegex(normalizeVN(w)).test(norm)) {
      return { hit: true, found: w };
    }
  }
  return { hit: false, found: null };
}

/* ================== Bubble loading ================== */
const LoadingBubble = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makePulse = (av, delayMs) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(av, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(av, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      );

    const a1 = makePulse(dot1, 0);
    const a2 = makePulse(dot2, 150);
    const a3 = makePulse(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  const Dot = ({ av }) => (
    <Animated.View
      style={{
        width: 6, height: 6, borderRadius: 3,
        marginHorizontal: 3, backgroundColor: '#1E88E5',
        transform: [{ translateY: av.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
        opacity: av.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
      }}
    />
  );

  return (
    <View style={[styles.messageContainer, { alignItems: 'flex-start' }]}>
      <View style={[styles.messageBubble, { backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center' }]}>
        <Text style={[styles.messageText, { marginRight: 6 }]}>Đang trả lời</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Dot av={dot1} />
          <Dot av={dot2} />
          <Dot av={dot3} />
        </View>
      </View>
    </View>
  );
};

/* ================== Quyền Micro ================== */
async function requestMicPermission() {
  if (Platform.OS === 'android') {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

/* ================== Màn hình Chat ================== */
const ChatWithAI = ({ navigation, route }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [uploading, setUploading] = useState(false);

  // ghi âm (React Native thuần)
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef(null);
  const stopTimerRef = useRef(null);
  const recorder = useRef(createSound()).current;

  const [loadingHistory, setLoadingHistory] = useState(false);

  // Quản lý danh sách sessions
  const [sessions, setSessions] = useState([]); // [{id, title, updatedAt}]
  const [showSessions, setShowSessions] = useState(false);

  // Banner ngắn khi tạo mới
  const [bannerText, setBannerText] = useState('');

  const scrollRef = useRef(null);

  // Kết nối BE
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const HEALTH_URL = route?.params?.healthUrl ?? HEALTH_FALLBACK;

  // 1 sessionId cho phiên hiện tại
  const sessionIdRef = useRef(
    route?.params?.sessionId ||
    (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8))
  );

  const baseTitle = route?.params?.title ?? 'Trợ lý AI';
  const baseSubtitle = route?.params?.subtitle ?? 'Hỗ trợ tâm lý';
  const title = baseTitle;
  const subtitle =
    uploading ? 'Đang chuyển giọng nói thành văn bản…' :
    sending ? 'Đang trả lời…' :
    connecting ? 'Đang kết nối…' :
    connected ? 'Đã kết nối máy chủ' : baseSubtitle;

  const scrollToEnd = () =>
    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true })
    );

  const toHistory = useCallback(
    () => messages.map(m => ({ role: m.role, content: m.content })),
    [messages],
  );

  const addMessage = useCallback((role, content) => {
    setMessages(prev => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role, content, ts: Date.now() },
    ]);
  }, []);

  const didWelcome = useRef(false);
  const WELCOME_TEXT =
    '👋 Chào mừng bạn đến với Trợ lý AI của E-Care! ' +
    'Mình ở đây để lắng nghe và đồng hành cùng bạn. ' +
    'Bạn có thể nhắn: “Tôi muốn gặp bác sĩ”, “Tôi cần người hỗ trợ”, hoặc kể vấn đề bạn đang gặp nhé.';

  // ========= Helpers lưu/đọc session list ở local =========
  const SESS_KEY = 'ai_sessions_v1';

  const loadSessionsLocal = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SESS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) setSessions(arr);
    } catch {}
  }, []);

  const saveSessionsLocal = useCallback(async list => {
    try {
      setSessions(list);
      await AsyncStorage.setItem(SESS_KEY, JSON.stringify(list));
    } catch {}
  }, []);

  const upsertSessionMeta = useCallback(async ({ id, title }) => {
    const normTitle = String(title || 'Cuộc trò chuyện').trim();
    setSessions(prev => {
      const rest = prev.filter(s => s.id !== id);
      const next = [
        { id, title: normTitle, updatedAt: Date.now() },
        ...rest,
      ].slice(0, 50);
      AsyncStorage.setItem(SESS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // ========= LẤY DANH SÁCH SESSIONS TỪ SERVER =========
  const refreshSessionsFromServer = useCallback(async () => {
    try {
      let list = [];
      if (aiService.listSessions) {
        const resp = await aiService.listSessions();
        const ok = resp?.success !== false;
        const arr = Array.isArray(resp?.data) ? resp.data : [];
        list = arr
          .map(x => {
            const id = String(x.sessionId || x.id || x._id || '');
            const title = x.title || x.lastText || 'Cuộc trò chuyện';
            const updatedAtSrc =
              x.updatedAt || x.lastMessageAt || x.lastUpdatedAt || Date.now();
            const updatedAt = Number(new Date(updatedAtSrc));
            return id ? { id, title, updatedAt } : null;
          })
          .filter(Boolean);
        if (!ok) list = [];
      } else {
        const r = await fetch('/ai/sessions');
        const j = await r.json().catch(() => ({}));
        const arr = Array.isArray(j?.data) ? j.data : [];
        list = arr
          .map(x => {
            const id = String(x.sessionId || x.id || x._id || '');
            const title = x.title || x.lastText || 'Cuộc trò chuyện';
            const updatedAtSrc =
              x.updatedAt || x.lastMessageAt || x.lastUpdatedAt || Date.now();
            const updatedAt = Number(new Date(updatedAtSrc));
            return id ? { id, title, updatedAt } : null;
          })
          .filter(Boolean);
      }

      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      await saveSessionsLocal(list);
    } catch {}
  }, [saveSessionsLocal]);

  // ========= Khởi tạo =========
  useEffect(() => {
    loadSessionsLocal();
    refreshSessionsFromServer();
  }, [loadSessionsLocal, refreshSessionsFromServer]);

  // welcome
  useEffect(() => {
    addMessage(
      'assistant',
      '👋 Chào mừng bạn đến với Trợ lý AI của E-Care! ' +
        'Nhấn "Kết nối" để bắt đầu nói chuyện bằng giọng nói 🎙️',
    );
    scrollToEnd();
  }, [addMessage]);

  // clear timer khi unmount
  useEffect(
    () => () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
    },
    [],
  );

  /* ====== Ghi âm (không dùng Expo) ====== */
  const startRecord = useCallback(async () => {
    const ok = await requestMicPermission();
    if (!ok) {
      addMessage(
        'assistant',
        '⚠️ Không có quyền micro. Vui lòng cấp quyền để ghi âm.',
      );
      return null;
    }
    try {
      console.log('[voice] startRecord');
      // Không chỉ định path => lib tự chọn: iOS .m4a, Android .mp4
      const uri = await recorder.startRecorder();
      console.log('[voice] started at', uri);
      recordingRef.current = { uriStarted: uri };
      setIsRecording(true);
      return true;
    } catch (e) {
      setIsRecording(false);
      addMessage(
        'assistant',
        'Không thể bắt đầu ghi âm. Vui lòng thử lại.',
      );
      return null;
    }
  }, [addMessage, recorder]);

  const stopRecordGetUri = useCallback(async () => {
    if (!isRecording) return null;
    try {
      const uri = await recorder.stopRecorder();
      console.log('[voice] stopped at', uri);
      recorder.removeRecordBackListener?.();
      return uri;
    } catch {
      return null;
    } finally {
      setIsRecording(false);
      recordingRef.current = null;
    }
  }, [isRecording, recorder]);

  const handleSend = async text => {
    const msg = (text ?? '').trim();
    if (!msg || sending) return;

    const ban = containsBanned(msg);
    if (ban.hit) {
      addMessage(
        'assistant',
        `⚠️ Từ/ cụm từ bạn dùng nằm trong danh sách cấm (“${ban.found}”). Vui lòng sử dụng ngôn từ lịch sự.`,
      );
      addMessage(
        'assistant',
        `⚠️ Từ/ cụm từ bạn dùng nằm trong danh sách cấm (“${ban.found}”). Vui lòng sử dụng ngôn từ lịch sự và tôn trọng.`,
      );
      setMessage('');
      scrollToEnd();
      return;
    }

    setSending(true);
    setFollowUps([]);
    setBannerText('');

    addMessage('user', msg);
    setMessage('');
    scrollToEnd();

    try {
      const { success, data } = await aiService.chat({
        message: msg,
        history: toHistory(),
        sessionId: sessionIdRef.current,
      });

      const firstLine =
        msg.split('\n').map(s => s.trim()).find(Boolean) || 'Cuộc trò chuyện';
      upsertSessionMeta({
        id: sessionIdRef.current,
        title: firstLine.slice(0, 60),
      });

      if (data?.reply) addMessage('assistant', data.reply);
      if (data?.emotion?.supportMessage)
        addMessage('assistant', `💬 ${data.emotion.supportMessage}`);
      if (Array.isArray(data?.emotion?.followUps)) {
        setFollowUps(data.emotion.followUps.slice(0, 2).filter(Boolean));
      }
    } catch {
      addMessage(
        'assistant',
        'Kết nối hơi chậm 🌿. Mình gửi gợi ý nhanh nhé: thử hít thở sâu và chia sẻ thêm cho mình biết nhé.',
      );
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  const transcribeAndAppend = useCallback(
    async uri => {
      if (!uri) return;
      try {
        setUploading(true);
        const isAndroid = Platform.OS === 'android';
        const fileName = isAndroid ? 'voice.mp4' : 'voice.m4a';
        const resp = await transcriptionService.create({
          uri,
          fileName,
          language: 'vi',
          durationSec: 0,
          model: 'whisper-large-v3',
        });
        const text = (resp?.text || '').trim();
        if (text) {
          await handleSend(text);
        } else {
          addMessage('assistant', 'Không nhận được văn bản từ máy chủ.');
        }
      } catch (e) {
        console.error('Transcription error:', e);
        addMessage(
          'assistant',
          '❌ Lỗi khi chuyển giọng nói thành văn bản.',
        );
      } finally {
        setUploading(false);
        scrollToEnd();
      }
    },
    [addMessage, handleSend],
  );

  /* ====== Kết nối + auto-record ====== */
  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 6000);
      const res = await fetch(HEALTH_URL, { signal: ac.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setConnected(true);
      addMessage(
        'assistant',
        '🔌 Đã kết nối máy chủ. 🎙️ Bắt đầu ghi âm...',
      );
      const started = await startRecord();
      if (!started) return;

      // Auto stop
      stopTimerRef.current = setTimeout(async () => {
        const uri = await stopRecordGetUri();
        await transcribeAndAppend(uri);
        stopTimerRef.current = null;
      }, AUTO_STOP_MS);
    } catch (e) {
      setConnected(false);
      addMessage(
        'assistant',
        '⚠️ Kết nối thất bại. Kiểm tra mạng hoặc URL máy chủ.',
      );
    } finally {
      setConnecting(false);
      scrollToEnd();
    }
  }, [HEALTH_URL, addMessage, startRecord, stopRecordGetUri, transcribeAndAppend]);

  // ========= Tải lịch sử của session hiện tại =========
  const loadHistory = useCallback(
    async opts => {
      const sessionId = (opts && opts.sessionId) || sessionIdRef.current;
      if (loadingHistory || !sessionId) return;
      setLoadingHistory(true);
      try {
        const res = await (aiService.history
          ? aiService.history({ sessionId, limit: 200 })
          : fetch(
              '/ai/history?sessionId=' +
                encodeURIComponent(sessionId) +
                '&limit=200',
            ).then(r => r.json()));

        const ok =
          res?.success ??
          (typeof res?.success === 'undefined' ? true : res.success);
        const data = res?.data ?? [];
        if (ok && Array.isArray(data)) {
          const mapped = data.map(m => ({
            id: String(m._id || `${m.role}-${Math.random()}`),
            role:
              m.role === 'assistant' || m.role === 'system'
                ? 'assistant'
                : 'user',
            content: String(m.content || ''),
            ts: new Date(m.createdAt || Date.now()).getTime(),
          }));
          setMessages(mapped.length ? mapped : []);
          if (!mapped.length) addMessage('assistant', WELCOME_TEXT);
          requestAnimationFrame(scrollToEnd);
        } else {
          addMessage(
            'assistant',
            'Không tải được lịch sử. Bạn thử lại sau nhé.',
          );
        }
      } catch {
        addMessage(
          'assistant',
          'Mạng hơi chập chờn nên chưa lấy được lịch sử. Bạn thử lại sau nhé.',
        );
      } finally {
        setLoadingHistory(false);
      }
    },
    [addMessage, loadingHistory],
  );

  // ========= Chuyển session từ panel =========
  const switchSession = useCallback(
    async id => {
      if (!id) return;
      sessionIdRef.current = id;
      setShowSessions(false);
      setFollowUps([]);
      setBannerText('');
      setMessages([]);
      didWelcome.current = true;
      await loadHistory({ sessionId: id });
    },
    [loadHistory],
  );

  // ====== Helper: tạo Session trên server (DB) ======
  const createSessionOnServer = useCallback(async ({ id, title }) => {
    try {
      if (aiService.createSession) {
        const resp = await aiService.createSession({ sessionId: id, title });
        return resp?.success !== false;
      }
      const r = await fetch('/ai/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, title }),
      });
      const j = await r.json().catch(() => ({}));
      return j?.success !== false;
    } catch {
      return false;
    }
  }, []);

  // ========= Tạo session mới =========
  const newChat = useCallback(async () => {
    const newId =
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 8);

    const ok = await createSessionOnServer({
      id: newId,
      title: 'Cuộc trò chuyện mới',
    });
    if (!ok) {
      setBannerText('Không khởi tạo được trên máy chủ. Vẫn tạo phiên tạm.');
      setTimeout(() => setBannerText(''), 2500);
    } else {
      setBannerText('Đã tạo cuộc trò chuyện mới');
      setTimeout(() => setBannerText(''), 2000);
    }

    sessionIdRef.current = newId;
    setShowSessions(false);
    setFollowUps([]);
    setMessages([]);
    didWelcome.current = false;
    addMessage('assistant', WELCOME_TEXT);

    await upsertSessionMeta({ id: newId, title: 'Cuộc trò chuyện mới' });
    refreshSessionsFromServer();

    requestAnimationFrame(scrollToEnd);
  }, [addMessage, upsertSessionMeta, createSessionOnServer, refreshSessionsFromServer]);

  // ========= Xoá toàn bộ một session =========
  const deleteSession = useCallback(
    async id => {
      if (!id) return;
      Alert.alert(
        'Xoá cuộc trò chuyện',
        'Bạn có chắc muốn xoá toàn bộ cuộc trò chuyện này? Hành động này không thể hoàn tác.',
        [
          { text: 'Huỷ', style: 'cancel' },
          {
            text: 'Xoá',
            style: 'destructive',
            onPress: async () => {
              let ok = false;
              try {
                if (aiService.deleteSession) {
                  const resp = await aiService.deleteSession({
                    sessionId: id,
                  });
                  ok = resp?.success !== false;
                } else {
                  const r = await fetch(
                    '/ai/sessions?sessionId=' +
                      encodeURIComponent(id),
                    { method: 'DELETE' },
                  );
                  const j = await r.json().catch(() => ({}));
                  ok = j?.success !== false;
                }
              } catch {
                ok = false;
              }

              if (!ok) {
                Alert.alert('Không xoá được', 'Vui lòng thử lại sau.');
                return;
              }

              setSessions(prev => {
                const next = prev.filter(s => s.id !== id);
                AsyncStorage.setItem(SESS_KEY, JSON.stringify(next)).catch(
                  () => {},
                );
                return next;
              });

              await refreshSessionsFromServer();

              if (sessionIdRef.current === id) {
                await newChat();
              }
            },
          },
        ],
      );
    },
    [newChat, refreshSessionsFromServer],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { marginRight: 8 }]}
          onPress={() => navigation?.goBack?.()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AI</Text>
          </View>
        </View>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>

        {/* Menu lịch sử & Tạo mới */}
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={async () => {
              await refreshSessionsFromServer();
              setShowSessions(true);
            }}>
            <Ionicons name="menu" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { marginLeft: 8 }]}
            onPress={newChat}>
            <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Nút Mic/Dừng thủ công */}
        <TouchableOpacity
          style={[
            styles.connectButton,
            {
              marginLeft: 8,
              backgroundColor: isRecording ? '#E53935' : 'transparent',
            },
          ]}
          onPress={async () => {
            if (isRecording) {
              if (stopTimerRef.current) {
                clearTimeout(stopTimerRef.current);
                stopTimerRef.current = null;
              }
              const uri = await stopRecordGetUri();
              await transcribeAndAppend(uri);
            } else {
              const started = await startRecord();
              if (started)
                addMessage(
                  'assistant',
                  '🎙️ Đang ghi âm… Nhấn Dừng để chuyển thành văn bản.',
                );
            }
          }}>
          <Ionicons
            name={isRecording ? 'stop-circle' : 'mic'}
            size={20}
            color="#FFF"
          />
          <Text style={styles.connectText}>
            {isRecording ? 'Dừng' : 'Mic'}
          </Text>
        </TouchableOpacity>
      </View>

      {!!bannerText && (
        <View
          style={{
            backgroundColor: '#F1F8E9',
            paddingVertical: 6,
            paddingHorizontal: 16,
          }}>
          <Text style={{ color: '#558B2F', fontSize: 12 }}>{bannerText}</Text>
        </View>
      )}

      {loadingHistory && (
        <View
          style={{
            backgroundColor: '#E3F2FD',
            paddingVertical: 8,
            paddingHorizontal: 16,
          }}>
          <Text style={{ color: '#1E88E5', fontSize: 13 }}>
            Đang tải lịch sử cuộc trò chuyện…
          </Text>
        </View>
      )}

      {/* Chat */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatContainer}
        onContentSizeChange={scrollToEnd}>
        {messages.map(m => (
          <View
            key={m.id}
            style={[
              styles.messageContainer,
              m.role === 'user'
                ? { alignItems: 'flex-end' }
                : { alignItems: 'flex-start' },
            ]}>
            <View
              style={[
                styles.messageBubble,
                m.role === 'user'
                  ? { backgroundColor: '#E3F2FD' }
                  : { backgroundColor: '#FFFFFF' },
              ]}>
              <Text style={styles.messageText}>{m.content}</Text>
            </View>
          </View>
        ))}

        {(sending || uploading) && <LoadingBubble />}

        {followUps.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {followUps.map((s, i) => (
                <TouchableOpacity
                  key={`${i}-${s}`}
                  onPress={() => handleSend(s)}
                  style={styles.followChip}>
                  <Text style={styles.followChipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#999"
            value={message}
            onChangeText={setMessage}
            editable={!sending}
            returnKeyType="send"
            onSubmitEditing={() => handleSend(message)}
            selectionColor="#1E88E5"
          />

          <TouchableOpacity
            style={[styles.sendButton, sending && { opacity: 0.6 }]}
            onPress={() => handleSend(message)}
            disabled={sending}>
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Panel lịch sử */}
      {showSessions && (
        <View style={styles.sessionsOverlay}>
          <TouchableOpacity
            style={styles.sessionsBackdrop}
            onPress={() => setShowSessions(false)}
          />
          <View style={styles.sessionsPanel}>
            <View style={styles.sessionsHeader}>
              <Text style={styles.sessionsTitle}>Lịch sử trò chuyện</Text>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  onPress={newChat}
                  style={{ padding: 6, marginRight: 6 }}>
                  <Ionicons
                    name="add-circle-outline"
                    size={22}
                    color="#1E88E5"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowSessions(false)}
                  style={{ padding: 6 }}>
                  <Ionicons name="close" size={22} color="#1E88E5" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{ flex: 1 }}>
              {sessions.length === 0 && (
                <View style={{ padding: 16 }}>
                  <Text style={{ color: '#616161' }}>
                    Chưa có lịch sử. Hãy bắt đầu cuộc trò chuyện mới.
                  </Text>
                </View>
              )}
              {sessions.map(s => (
                <View key={s.id} style={styles.sessionItem}>
                  <TouchableOpacity
                    onPress={() => switchSession(s.id)}
                    style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.sessionTitle} numberOfLines={1}>
                      {s.title || 'Cuộc trò chuyện'}
                    </Text>
                    <Text style={styles.sessionMeta}>
                      {new Date(s.updatedAt || Date.now()).toLocaleString()}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => deleteSession(s.id)}
                    style={{ padding: 6, marginRight: 6 }}>
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#E53935"
                    />
                  </TouchableOpacity>

                  {s.id === sessionIdRef.current ? (
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={18}
                      color="#1E88E5"
                    />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#9E9E9E"
                    />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

/* ================== Styles ================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E88E5',
    paddingHorizontal: 16,
    paddingVertical: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backButton: { marginRight: 12, marginTop: 4 },
  avatarContainer: { marginRight: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6F00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  headerTextContainer: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  headerSubtitle: { color: '#E3F2FD', fontSize: 12, marginTop: 2 },

  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  iconButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },

  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    marginLeft: 8,
  },
  connectText: { color: '#FFFFFF', marginLeft: 6, fontSize: 12 },

  chatContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  messageContainer: { marginBottom: 16 },
  messageBubble: {
    borderRadius: 16,
    padding: 16,
    maxWidth: '80%',
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messageText: { fontSize: 15, color: '#212121', lineHeight: 22 },
  followChip: {
    backgroundColor: '#EFF6FF',
    borderColor: '#CFE2FF',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  followChipText: { color: '#1E88E5', fontSize: 13 },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 60,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  textInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    marginHorizontal: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
    color: '#111',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E88E5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sessionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  sessionsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sessionsPanel: {
    width: '78%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  sessionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  sessionsTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E88E5',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  sessionTitle: { fontSize: 14, color: '#212121', marginBottom: 2 },
  sessionMeta: { fontSize: 11, color: '#757575' },
});

export default ChatWithAI;
