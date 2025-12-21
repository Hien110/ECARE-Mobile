import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import DoctorNavTabs from '../../components/DoctorNavTabs';
import { doctorService } from '../../services/doctorService';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAY_LABELS = ['T2','T3','T4','T5','T6','T7','CN'];
const DAY_NAMES  = ['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật'];

// Index 0..6  <->  API day 2..8
const idxToApi = (idx) => (idx === 6 ? 8 : idx + 2);
const apiToIdx = (day) => (day === 8 ? 6 : day - 2);

const TIME_OPTIONS = [
  '06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
  '18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30','23:00','23:30'
];

// ===== Helpers =====
const toMinutes = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const isValidTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(s);
const nearestOptionAtOrAfter = (min) => TIME_OPTIONS.find(t => toMinutes(t) >= min) || TIME_OPTIONS[TIME_OPTIONS.length - 1];
const cycleTime = (curr, dir = 1) => {
  const i = TIME_OPTIONS.indexOf(curr);
  return TIME_OPTIONS[(i < 0 ? 0 : i + dir + TIME_OPTIONS.length) % TIME_OPTIONS.length];
};
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));

// Lấy id từ nhiều field khác nhau
const getSlotId = (slot) =>
  slot?.slotId?.toString?.() ??
  slot?._id?.toString?.() ??
  slot?.id?.toString?.() ??
  slot?.timeSlotId?.toString?.() ??
  undefined;

// Chuẩn hoá slot từ API
const normalizeSlotFromApi = (raw) => {
  const start = raw?.start ?? raw?.startTime ?? raw?.from;
  const end   = raw?.end   ?? raw?.endTime   ?? raw?.to;
  const tRaw  = (raw?.consultationType ?? raw?.type ?? 'online').toString().toLowerCase();
  const type  = ['online','offline','both'].includes(tRaw) ? tRaw : 'online';
  const slotId = getSlotId(raw);

  const onlinePerPatient  = Number(
    raw?.timeForOnline ??
    raw?.onlinePerPatient ?? raw?.onlineDurationPerPatient ?? raw?.perPatientOnlineMinutes
  ) || undefined;

  const offlinePerPatient = Number(
    raw?.timeForOffline ??
    raw?.offlinePerPatient ?? raw?.offlineDurationPerPatient ?? raw?.perPatientOfflineMinutes
  ) || undefined;

  return {
    slotId,
    start, end,
    consultationType: type,
    onlinePerPatient,
    offlinePerPatient,
    isAvailable: raw?.isAvailable !== false,
  };
};

const extractSchedule = (rawRes) => {
  if (Array.isArray(rawRes)) return rawRes;
  if (Array.isArray(rawRes?.data)) return rawRes.data;

  const root = rawRes?.data ?? rawRes;
  const candidates = [
    root?.schedules, root?.schedule, root?.result?.schedule,
    root?.payload?.schedule, root?.profile?.schedule, root?.doctorProfile?.schedule,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c;

  const seen = new Set(); const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    for (const v of Object.values(cur)) {
      if (Array.isArray(v)) {
        if (v.length > 0 && v.every(x => x && typeof x === 'object' && 'dayOfWeek' in x && 'timeSlots' in x)) {
          return v;
        }
      } else if (v && typeof v === 'object') stack.push(v);
    }
  }
  return [];
};

// map multi-select {online,offline} -> API 'online'|'offline'|'both'
const channelsToType = (ch) => {
  const c = ch ?? { online: true, offline: false };
  if (c.online && c.offline) return 'both';
  if (c.offline) return 'offline';
  return 'online';
};

// ===== Simple in-memory cache to keep UI state across navigations =====
let __cacheSelectedDayIdxs = /** @type {number[] | null} */(null);
let __cacheDrafts = /** @type {any | null} */(null);

const CreateWorkScheduleScreen = ({ navigation }) => {
  // ===== State =====
  const [selectedDayIdxs, setSelectedDayIdxs] = useState(
    Array.isArray(__cacheSelectedDayIdxs) ? __cacheSelectedDayIdxs : []
  );
  const selectedApiDays = useMemo(() => selectedDayIdxs.map(idxToApi), [selectedDayIdxs]);

  // Dữ liệu tuần
  const blankWeek = {2:[],3:[],4:[],5:[],6:[],7:[],8:[]};
  const blankHas  = {2:false,3:false,4:false,5:false,6:false,7:false,8:false};
  const [weeklySlots, setWeeklySlots]   = useState(blankWeek);
  const [serverHasDay, setServerHasDay] = useState(blankHas);

  // DRAFT PER DAY
  const defaultDraft = {
    start:'08:00', end:'12:00',
    channels:{online:true, offline:false},
    onlinePerPatient: 30,
    offlinePerPatient: 30,
  };
  const makeAllDrafts = () => ({
    2:{...defaultDraft},3:{...defaultDraft},4:{...defaultDraft},5:{...defaultDraft},
    6:{...defaultDraft},7:{...defaultDraft},8:{...defaultDraft}
  });
  const [drafts, setDrafts] = useState(makeAllDrafts());

  // nạp/lưu cache
  useEffect(() => { if (__cacheDrafts) setDrafts((prev) => ({ ...prev, ...__cacheDrafts })); }, []);
  useEffect(() => { __cacheSelectedDayIdxs = selectedDayIdxs; }, [selectedDayIdxs]);
  useEffect(() => { __cacheDrafts = drafts; }, [drafts]);

  const updateDraft = (apiDay, patch) =>
    setDrafts(prev => ({ ...prev, [apiDay]: { ...prev[apiDay], ...patch }}));

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingIndex, setEditingIndex]   = useState(-1);
  const [editingDayApi, setEditingDayApi] = useState(2);
  const [editStart, setEditStart]         = useState('08:00');
  const [editEnd, setEditEnd]             = useState('12:00');
  const [editChannels, setEditChannels]   = useState({ online: true, offline: false });
  const [editOnlinePer, setEditOnlinePer] = useState(30);
  const [editOfflinePer, setEditOfflinePer] = useState(30);

  // Copy
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyFromApi, setCopyFromApi]           = useState(2);
  const [copyTargets, setCopyTargets]           = useState([]);

  // Messages & submitting
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const clearMessage = () => setMessage({ type: '', text: '' });

  // ==== SUCCESS POPUP STATE ====
  const [successModal, setSuccessModal] = useState({ visible:false, title:'', description:'' });
  const showSuccess = (title, description='') =>
    setSuccessModal({ visible:true, title, description });
  const closeSuccessAndReturn = () => {
    setSuccessModal({ visible:false, title:'', description:'' });
    // Điều hướng quay lại đúng trang tạo lịch
    navigation?.navigate?.('CreateWorkSchedule');
  };

  // Defaults
  const [defaultDuration, setDefaultDuration] = useState(30);
  const [breakMinutes, setBreakMinutes] = useState(15);
  const stepDuration = (d)=>setDefaultDuration(v=>clamp(v+d*5,5,180));
  const progressPct  = (val,min,max)=>((val-min)/(max-min))*100;
  const suggestEndFromStart = (st) => nearestOptionAtOrAfter(toMinutes(st) + defaultDuration);

  // ===== Helpers: đồng bộ state theo dữ liệu server =====
  const syncFromServer = useCallback((serverResLike) => {
    const list = extractSchedule(
      serverResLike?.schedules
        ? { data: { schedules: serverResLike.schedules } }
        : serverResLike?.data
          ? { data: serverResLike.data }
          : serverResLike
    );

    const nextWeek = {2:[],3:[],4:[],5:[],6:[],7:[],8:[]};
    const nextHas  = {2:false,3:false,4:false,5:false,6:false,7:false,8:false};

    list.forEach((item) => {
      const apiDay = Number(item?.dayOfWeek);
      if (!(apiDay >= 2 && apiDay <= 8)) return;
      const slotsRaw = item?.timeSlots ?? item?.slots ?? [];
      if (!Array.isArray(slotsRaw)) return;
      const slots = slotsRaw.map(normalizeSlotFromApi);
      nextWeek[apiDay] = slots;
      nextHas[apiDay]  = slots.length > 0;
    });

    setWeeklySlots(nextWeek);
    setServerHasDay(nextHas);
  }, []);

  // ===== Load Week =====
  const loadWeek = useCallback(async () => {
    try {
      const tryCalls = [
        doctorService.getMyWeeklySchedule?.bind(doctorService),
        doctorService.getMySchedule?.bind(doctorService),
        doctorService.getSchedule?.bind(doctorService),
        doctorService.getMyProfile?.bind(doctorService),
        doctorService.getDoctorProfile?.bind(doctorService),
      ].filter(Boolean);

      let serverObj = null;
      for (const fn of tryCalls) {
        const res = await fn();
        const arr = extractSchedule(res);
        if (arr.length) { serverObj = res; break; }
      }

      if (!serverObj) throw new Error('no schedules');
      syncFromServer(serverObj);
    } catch {
      setMessage({ type: 'error', text: 'Không tải được lịch từ máy chủ' });
    }
  }, [syncFromServer]);

  useEffect(() => {
    loadWeek();
    const unsub = navigation?.addListener?.('focus', loadWeek);
    return () => { unsub && unsub(); };
  }, [loadWeek, navigation]);

  // ===== Validate =====
  const validateAndNormalize = (slots) => {
    const cleaned = [...slots]
      .map(s => ({
        start: s.start,
        end: s.end,
        consultationType: s.consultationType,
        onlinePerPatient: Number.isFinite(Number(s.onlinePerPatient)) ? Math.trunc(Number(s.onlinePerPatient)) : undefined,
        offlinePerPatient: Number.isFinite(Number(s.offlinePerPatient)) ? Math.trunc(Number(s.offlinePerPatient)) : undefined,
        isAvailable: s.isAvailable !== false
      }))
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    for (const s of cleaned) {
      if (!isValidTime(s.start) || !isValidTime(s.end)) return { error: 'Thời gian không đúng định dạng HH:MM' };
      if (toMinutes(s.start) >= toMinutes(s.end))       return { error: 'Giờ bắt đầu phải nhỏ hơn giờ kết thúc' };
      if (!['online','offline','both'].includes(s.consultationType)) return { error: 'Loại tư vấn không hợp lệ' };

      if (s.consultationType === 'online' || s.consultationType === 'both') {
        if (!Number.isInteger(s.onlinePerPatient) || s.onlinePerPatient < 5 || s.onlinePerPatient > 180)
          return { error: 'Thời gian/1 người (Online) phải từ 5 đến 180 phút' };
      }
      if (s.consultationType === 'offline' || s.consultationType === 'both') {
        if (!Number.isInteger(s.offlinePerPatient) || s.offlinePerPatient < 5 || s.offlinePerPatient > 180)
          return { error: 'Thời gian/1 người (Offline) phải từ 5 đến 180 phút' };
      }
    }
    for (let i = 1; i < cleaned.length; i++) {
      if (toMinutes(cleaned[i - 1].end) > toMinutes(cleaned[i].start)) return { error: 'Các khung giờ trong ngày không được chồng lấn' };
    }
    return { data: cleaned };
  };

  // ===== Persist 1 day =====
  const persistDaySlots = async (apiDay, normalizedSlots) => {
    const timeSlots = normalizedSlots.map((s) => {
      const type = s.consultationType;
      const online  = Number.isFinite(Number(s.onlinePerPatient))  ? Math.trunc(Number(s.onlinePerPatient))  : 0;
      const offline = Number.isFinite(Number(s.offlinePerPatient)) ? Math.trunc(Number(s.offlinePerPatient)) : 0;
      return {
        start: s.start,
        end: s.end,
        consultationType: type,
        isAvailable: s.isAvailable !== false,
        timeForOnline:  (type === 'offline') ? 0 : online,
        timeForOffline: (type === 'online')  ? 0 : offline,
      };
    });

    const payload = { dayOfWeek: apiDay, timeSlots };
    try {
      let res;
      if (serverHasDay[apiDay]) {
        res = await doctorService.updateScheduleForDay(payload);
      } else {
        res = await doctorService.createScheduleForDay(payload);
        if (res?.success) setServerHasDay(prev => ({ ...prev, [apiDay]: true }));
      }
      if (res?.success) syncFromServer(res);
      return res;
    } catch (e) {
      return { success: false, message: e?.message || 'Không kết nối được máy chủ' };
    }
  };

  // ===== UI Actions =====
  const toggleSelectDay = (idx) => {
    setSelectedDayIdxs(prev => {
      const has = prev.includes(idx);
      if (has) return prev.filter(i => i !== idx);
      return [...prev, idx].sort((a,b)=>a-b);
    });
  };

  const openAddFormForDay = (apiDay) => {
    const idx = apiToIdx(apiDay);
    const daySlots = weeklySlots[apiDay] || [];
    const lastEnd = daySlots.length ? daySlots[daySlots.length - 1].end : '08:00';
    const nextStart = nearestOptionAtOrAfter(toMinutes(lastEnd) + breakMinutes);
    const nextEnd   = suggestEndFromStart(nextStart);

    updateDraft(apiDay, {
      start: nextStart,
      end: nextEnd,
      channels: drafts[apiDay]?.channels ?? { online: true, offline: false },
      onlinePerPatient: drafts[apiDay]?.onlinePerPatient ?? defaultDuration,
      offlinePerPatient: drafts[apiDay]?.offlinePerPatient ?? defaultDuration,
    });

    setSelectedDayIdxs(prev => (prev.includes(idx) ? prev : [...prev, idx].sort((a,b)=>a-b)));
    clearMessage();
  };

  const addNewSlotForDay = async (apiDay) => {
    const d = drafts[apiDay] || defaultDraft;
    const ch = d.channels ?? { online: true, offline: false };

    if (!isValidTime(d.start) || !isValidTime(d.end))
      throw new Error(`(${DAY_NAMES[apiToIdx(apiDay)]}) Giờ không đúng định dạng HH:MM`);
    if (toMinutes(d.start) >= toMinutes(d.end))
      throw new Error(`(${DAY_NAMES[apiToIdx(apiDay)]}) Giờ bắt đầu phải nhỏ hơn giờ kết thúc`);

    const payloadSlot = {
      start: d.start,
      end: d.end,
      consultationType: channelsToType(ch),
      onlinePerPatient: ch.online ? Math.trunc(d.onlinePerPatient || defaultDuration) : undefined,
      offlinePerPatient: ch.offline ? Math.trunc(d.offlinePerPatient || defaultDuration) : undefined,
      isAvailable: true
    };

    const next = [...(weeklySlots[apiDay] || []), payloadSlot];
    const check = validateAndNormalize(next);
    if (check.error) throw new Error(`(${DAY_NAMES[apiToIdx(apiDay)]}) ${check.error}`);

    const res = await persistDaySlots(apiDay, check.data);
    if (!res?.success) throw new Error(res?.message || `Lưu lịch thất bại (${DAY_NAMES[apiToIdx(apiDay)]})`);

    // Ẩn form sau khi thêm
    setSelectedDayIdxs(prev => prev.filter(i => i !== apiToIdx(apiDay)));

    // Gợi ý draft tiếp theo
    const ns = nearestOptionAtOrAfter(toMinutes(d.end) + breakMinutes);
    updateDraft(apiDay, { start: ns, end: suggestEndFromStart(ns) });
  };

  // Thêm cho tất cả ngày đã chọn
  const addSlotsForAllSelectedDays = async () => {
    if (submitting || selectedApiDays.length === 0) return;
    setSubmitting(true); clearMessage();
    try {
      for (const apiDay of selectedApiDays) {
        await addNewSlotForDay(apiDay);
      }
      setMessage({ type:'success', text:`Đã thêm ca cho ${selectedApiDays.length} ngày` });
      // === POPUP SUCCESS: tạo lịch ===
      showSuccess('Đã tạo lịch làm việc thành công', 'Các ca làm việc đã được lưu.');
    } catch (e) {
      setMessage({ type:'error', text: e?.message || 'Thêm lịch thất bại' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (apiDay, idx) => {
    const s = weeklySlots[apiDay][idx];
    setEditingIndex(idx);
    setEditingDayApi(apiDay);
    setEditStart(s.start); setEditEnd(s.end);
    setEditChannels({
      online: s.consultationType === 'online' || s.consultationType === 'both',
      offline: s.consultationType === 'offline' || s.consultationType === 'both',
    });
    setEditOnlinePer(s.onlinePerPatient || defaultDuration);
    setEditOfflinePer(s.offlinePerPatient || defaultDuration);
    setShowEditModal(true);
    clearMessage();
  };

  const applyEdit = async () => {
    if (!isValidTime(editStart) || !isValidTime(editEnd))
      return setMessage({ type:'error', text:'Thời gian không đúng định dạng HH:MM' });
    if (toMinutes(editStart) >= toMinutes(editEnd))
      return setMessage({ type:'error', text:'Giờ bắt đầu phải nhỏ hơn giờ kết thúc' });

    const type = channelsToType(editChannels);
    const cur = [...(weeklySlots[editingDayApi] || [])];
    cur[editingIndex] = {
      start: editStart, end: editEnd,
      consultationType: type, isAvailable: true,
      onlinePerPatient: (type === 'online' || type === 'both') ? Math.trunc(editOnlinePer) : undefined,
      offlinePerPatient: (type === 'offline' || type === 'both') ? Math.trunc(editOfflinePer) : undefined,
    };
    const check = validateAndNormalize(cur);
    if (check.error) return setMessage({ type:'error', text: check.error });

    setSubmitting(true);
    const res = await persistDaySlots(editingDayApi, check.data);
    setSubmitting(false);

    if (res?.success) {
      setShowEditModal(false);
      setMessage({ type:'success', text:'Đã lưu thay đổi' });
      // === POPUP SUCCESS: cập nhật lịch ===
      showSuccess('Đã cập nhật lịch làm việc thành công', 'Thay đổi đã được lưu.');
    } else setMessage({ type:'error', text: res?.message || 'Lưu thay đổi thất bại' });
  };

  const deleteSlot = async (apiDay, idx) => {
    const slot = weeklySlots[apiDay]?.[idx];
    if (!slot) return;

    setSubmitting(true); clearMessage();
    try {
      const sid = getSlotId(slot);
      if (sid) {
        const res = await doctorService.deleteSchedule({ dayOfWeek: apiDay, slotId: sid });
        if (!res?.success) throw new Error(res?.message || 'Xoá ca thất bại');
        syncFromServer(res);
        setMessage({ type:'success', text:'Đã xoá ca' });
      } else {
        const cur = [...(weeklySlots[apiDay] || [])];
        cur.splice(idx, 1);
        const check = validateAndNormalize(cur);
        if (check.error) throw new Error(check.error);
        const res = await persistDaySlots(apiDay, check.data);
        if (!res?.success) throw new Error(res?.message || 'Xoá ca thất bại');
        setMessage({ type:'success', text:'Đã xoá ca' });
      }
    } catch (e) {
      setMessage({ type:'error', text: e?.message || 'Xoá ca thất bại' });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteDay = async (apiDay) => {
    setSubmitting(true); clearMessage();
    try {
      const res = await doctorService.deleteSchedule({ dayOfWeek: apiDay });
      if (!res?.success) throw new Error(res?.message || 'Xoá ngày thất bại');
      syncFromServer(res);
      setMessage({ type:'success', text:'Đã xoá lịch của ngày' });
    } catch (e) {
      setMessage({ type:'error', text: e?.message || 'Xoá ngày thất bại' });
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Copy helpers =====
  const selectableCopyIdxs = useMemo(() => {
    return DAY_LABELS
      .map((_, idx) => idx)
      .filter(idx => {
        const api = idxToApi(idx);
        return api !== copyFromApi && !serverHasDay[api];
      });
  }, [serverHasDay, copyFromApi]);

  useEffect(() => {
    setCopyTargets(prev => prev.filter(idx => selectableCopyIdxs.includes(idx)));
  }, [selectableCopyIdxs]);

  const openCopyModalForDay = (apiDay) => {
    setCopyFromApi(apiDay);
    setCopyTargets([]);
    setCopyModalVisible(true);
    clearMessage();
  };

  // ===== Memo =====
  const summaryCount = useMemo(
    () => Object.values(weeklySlots).reduce((acc, arr) => acc + (arr?.length || 0), 0),
    [weeklySlots]
  );

  // Small component: per-person duration block
  const PerPersonSetting = ({ title, value, onChange, color='blue', note='Đã tính cả thời gian nghỉ' }) => {
    const min = 5, max = 180;
    const pct = progressPct(value, min, max);
    return (
      <View style={styles.inlineBlock}>
        <Text style={styles.blockLabel}>{title}</Text>
        <View style={styles.defaultsRow}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => onChange(clamp(value-5,min,max))} disabled={submitting}>
            <Icon name="remove" size={18} color="#9AA7CC" />
          </TouchableOpacity>
          <Text style={[styles.durationValue, color==='orange' ? {color:'#FF8A00'} : null]}>
            {value} <Text style={styles.unitText}>phút</Text>
          </Text>
          <TouchableOpacity style={styles.circleBtn} onPress={() => onChange(clamp(value+5,min,max))} disabled={submitting}>
            <Icon name="add" size={18} color="#9AA7CC" />
          </TouchableOpacity>
        </View>
        <View style={styles.sliderWrap}>
          <View style={styles.sliderTrack}>
            <View style={[color==='orange' ? styles.sliderFillOrange : styles.sliderFillBlue, { width: `${pct}%` }]} />
          </View>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderHint}>5 phút</Text>
            <Text style={styles.sliderHint}>180 phút</Text>
          </View>
        </View>
        {!!note && (
          <View style={styles.noteWrap}>
            <Icon name="information-circle-outline" size={14} color="#9AA7CC" />
            <Text style={styles.noteText}>{note}</Text>
          </View>
        )}
      </View>
    );
  };

  // ===== UI =====
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2F6FED" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Tạo lịch làm việc</Text>
          <Text style={styles.headerSubtitle}>Thiết lập thời gian tư vấn cho người cao tuổi</Text>
        </View>
      </View>

      {/* Tabs */}
      <DoctorNavTabs
        navigation={navigation}
        active={'schedule'}
        routes={{
          profile: ['ProfileGate','ViewDoctorProfile','IntroductionCreateDoctorProfile','EditDoctorProfile'],
          schedule: ['CreateWorkSchedule'],
          statistics: ['EvaluationStatistics'],
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={styles.summaryTitle}>Lịch tuần này</Text>
              <Text style={styles.summarySubtitle}>Quản lý thời gian tư vấn hiệu quả</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryRightNumber}>{summaryCount}</Text>
              <Text style={styles.summaryRightLabel}>ca làm việc</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <View style={styles.dotGreen} />
            <Text style={styles.summaryNote}>Sẵn sàng tiếp nhận</Text>
          </View>
        </View>

        {/* Chọn ngày hiển thị FORM */}
        <View style={styles.calendarSection}>
          <Text style={styles.calendarTitle}>Chọn ngày để thêm ca</Text>
          <View style={styles.calendarContainer}>
            {DAY_LABELS.map((label, idx) => {
              const apiDay = idxToApi(idx);
              const active = selectedDayIdxs.includes(idx);
              const has = serverHasDay[apiDay];
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => toggleSelectDay(idx)}
                  style={[
                    styles.dayBtn,
                    has && !active && styles.dayBtnHas,
                    active && styles.dayBtnActive
                  ]}
                  disabled={submitting}
                >
                  <Text style={[
                    styles.dayBtnText,
                    has && styles.dayBtnTextHas,
                    active && styles.dayBtnTextActive
                  ]}>
                    {label}
                  </Text>
                  {active
                    ? <View style={styles.activeDot} />
                    : has
                      ? <View style={styles.hasDot} />
                      : <View style={styles.inactiveDot} />
                  }
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* FORMS: theo các ngày đã chọn */}
        {selectedApiDays.map((apiDay) => {
          const idx = apiToIdx(apiDay);
          const d = drafts[apiDay] || defaultDraft;
          const ch = d.channels ?? { online:true, offline:false };

          return (
            <View key={`form-${apiDay}`} style={styles.addCard}>
              <View style={styles.addHeaderRow}>
                <View style={styles.addIconWrap}><Icon name="add" size={18} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addTitle}>Thêm ca làm việc mới</Text>
                  <Text style={styles.addSubtitle}>Thêm lịch cho {DAY_NAMES[idx]}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => updateDraft(apiDay, {
                    start:'08:00',
                    end:suggestEndFromStart('08:00'),
                    channels:{online:true,offline:false},
                    onlinePerPatient: defaultDuration,
                    offlinePerPatient: defaultDuration
                  })}
                  disabled={submitting}
                >
                  <Icon name="refresh" size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.inlineBlock}>
                <Text style={styles.blockLabel}>Thời gian làm việc</Text>
                <View style={styles.timeRow}>
                  <View style={styles.timeItem}>
                    <Text style={styles.timeSmallLabel}>Bắt đầu</Text>
                    <View style={styles.timeSelector}>
                      <TouchableOpacity onPress={() => { const n = cycleTime(d.start, -1); updateDraft(apiDay, { start:n, end:suggestEndFromStart(n) }); }} disabled={submitting}>
                        <Icon name="chevron-back" size={18} color="#2F6FED" />
                      </TouchableOpacity>
                      <Text style={styles.timeText}>{d.start}</Text>
                      <TouchableOpacity onPress={() => { const n = cycleTime(d.start, +1); updateDraft(apiDay, { start:n, end:suggestEndFromStart(n) }); }} disabled={submitting}>
                        <Icon name="chevron-forward" size={18} color="#2F6FED" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.timeItem}>
                    <Text style={styles.timeSmallLabel}>Kết thúc</Text>
                    <View style={styles.timeSelector}>
                      <TouchableOpacity onPress={() => updateDraft(apiDay, { end: cycleTime(d.end, -1) })} disabled={submitting}>
                        <Icon name="chevron-back" size={18} color="#2F6FED" />
                      </TouchableOpacity>
                      <Text style={styles.timeText}>{d.end}</Text>
                      <TouchableOpacity onPress={() => updateDraft(apiDay, { end: cycleTime(d.end, +1) })} disabled={submitting}>
                        <Icon name="chevron-forward" size={18} color="#2F6FED" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.inlineBlock}>
                <Text style={styles.blockLabel}>Hình thức tư vấn</Text>
                <View style={styles.locationButtons}>
                  <TouchableOpacity
                    style={[styles.locationButton, ch.online && styles.locationButtonActiveBlue]}
                    onPress={() => {
                      const next = !ch.online;
                      updateDraft(apiDay, {
                        channels: { ...(d.channels ?? {online:true,offline:false}), online: next },
                        onlinePerPatient: next ? (d.onlinePerPatient || defaultDuration) : d.onlinePerPatient
                      });
                    }}
                    disabled={submitting}
                  >
                    <Icon name="videocam-outline" size={16} color={ch.online ? '#fff' : '#2F6FED'} />
                    <Text style={[styles.locationText, ch.online && styles.locationTextActive]}>Online</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.locationButton, ch.offline && styles.locationButtonActiveGray]}
                    onPress={() => {
                      const next = !ch.offline;
                      updateDraft(apiDay, {
                        channels: { ...(d.channels ?? {online:true,offline:false}), offline: next },
                        offlinePerPatient: next ? (d.offlinePerPatient || defaultDuration) : d.offlinePerPatient
                      });
                    }}
                    disabled={submitting}
                  >
                    <MaterialIcons name="local-hospital" size={16} color={ch.offline ? '#fff' : '#2F6FED'} />
                    <Text style={[styles.locationText, ch.offline && styles.locationTextActive]}>Tại phòng khám</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{fontSize:11,color:'#6B7280',marginTop:6}}>Bật hình thức nào thì cài đặt thời gian khám / 1 người cho hình thức đó</Text>
              </View>

              {ch.online && (
                <PerPersonSetting
                  title="Thời gian khám / 1 người (Online)"
                  value={Math.trunc(d.onlinePerPatient || defaultDuration)}
                  onChange={(val)=>updateDraft(apiDay,{ onlinePerPatient: val })}
                  color="blue"
                  note="Đã tính cả thời gian nghỉ"
                />
              )}
              {ch.offline && (
                <PerPersonSetting
                  title="Thời gian khám / 1 người (Tại phòng khám)"
                  value={Math.trunc(d.offlinePerPatient || defaultDuration)}
                  onChange={(val)=>updateDraft(apiDay,{ offlinePerPatient: val })}
                  color="orange"
                  note="Đã tính cả thời gian nghỉ"
                />
              )}

              <View style={styles.ctaRow}>
                <TouchableOpacity
                  style={[styles.ctaGhost, submitting && {opacity:0.7}]}
                  onPress={() => setSelectedDayIdxs(prev => prev.filter(i => i !== apiToIdx(apiDay)))}
                  disabled={submitting}
                >
                  <Icon name="close-circle-outline" size={18} color="#6B7280" />
                  <Text style={styles.ctaGhostText}>Hủy bỏ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.ctaPrimary, submitting && {opacity:0.9}]}
                  onPress={async ()=>{
                    setSubmitting(true); clearMessage();
                    try{
                      await addNewSlotForDay(apiDay);
                      setMessage({ type:'success', text:`Đã thêm ca cho ${DAY_NAMES[apiToIdx(apiDay)]}` });
                      // === POPUP SUCCESS: tạo lịch ===
                      showSuccess('Đã tạo lịch làm việc thành công', 'Ca làm việc đã được lưu.');
                    }catch(e){
                      setMessage({ type:'error', text: e?.message || 'Thêm lịch thất bại' });
                    }finally{
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting}
                >
                  <Icon name="add-circle" size={20} color="#fff" />
                  <Text style={styles.ctaPrimaryText}>Thêm lịch</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Nút thêm tất cả ngày đã chọn (nếu muốn) */}
        {selectedApiDays.length > 1 && (
          <View style={{paddingHorizontal:4, marginBottom:16}}>
            <TouchableOpacity
              style={[styles.btnPrimary, submitting && {opacity:0.8}]}
              onPress={addSlotsForAllSelectedDays}
              disabled={submitting}
            >
              <Icon name="calendar-outline" size={18} color="#fff" />
              <Text style={styles.btnPrimaryText}>Thêm cho {selectedApiDays.length} ngày đã chọn</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Defaults */}
        <View style={styles.defaultsCard}>
          <Text style={styles.defaultsTitle}>Cài đặt mặc định</Text>
          <Text style={styles.defaultsLabel}>Thời lượng mặc định mỗi buổi tư vấn</Text>
          <View style={styles.defaultsRow}>
            <TouchableOpacity style={styles.circleBtn} onPress={() => stepDuration(-1)} disabled={submitting}><Icon name="remove" size={18} color="#9AA7CC" /></TouchableOpacity>
            <Text style={styles.durationValue}>{defaultDuration} <Text style={styles.unitText}>phút</Text></Text>
            <TouchableOpacity style={styles.circleBtn} onPress={() => stepDuration(1)} disabled={submitting}><Icon name="add" size={18} color="#9AA7CC" /></TouchableOpacity>
          </View>
          <View style={styles.sliderWrap}>
            <View style={styles.sliderTrack}><View style={[styles.sliderFillBlue, { width: `${progressPct(defaultDuration, 5, 180)}%` }]} /></View>
            <View style={styles.sliderLabels}><Text style={styles.sliderHint}>5 phút</Text><Text style={styles.sliderHint}>180 phút</Text></View>
          </View>
          <TouchableOpacity
            style={styles.saveDefaultsBtn}
            onPress={async ()=>{
              setSubmitting(true); clearMessage();
              try{
                const res = await doctorService.updateMyProfile({ consultationDuration: defaultDuration, breakBetweenSessions: breakMinutes });
                if (res?.success){
                  setMessage({ type:'success', text:'Đã lưu cài đặt mặc định' });
                  // === POPUP SUCCESS: cài đặt thời lượng ===
                  showSuccess('Đã cài đặt thời lượng thành công', 'Thiết lập mặc định đã được lưu.');
                } else {
                  setMessage({ type:'error', text: res?.message || 'Lưu cài đặt thất bại' });
                }
              } catch {
                setMessage({ type:'error', text:'Có lỗi khi lưu cài đặt' });
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
          >
            <Icon name="save-outline" size={18} color="#fff" />
            <Text style={styles.saveDefaultsText}>Lưu cài đặt</Text>
          </TouchableOpacity>
        </View>

        {/* Danh sách theo ngày */}
        {(() => {
          const daysWithSlots = [2,3,4,5,6,7,8].filter(d => (weeklySlots[d] || []).length > 0);

          if (daysWithSlots.length === 0) {
            return (
              <View style={[styles.daySection, { alignItems: 'center' }]}>
                <View style={styles.emptyBox}>
                  <View style={styles.emptyIcon}><Icon name="calendar-outline" size={18} color="#2F6FED" /></View>
                  <Text style={styles.emptyTitle}>Chưa có lịch nào tuần này</Text>
                </View>
              </View>
            );
          }

          return daysWithSlots.map((apiDay) => {
            const idx = apiToIdx(apiDay);
            const daySlots = weeklySlots[apiDay] || [];
            return (
              <View key={`list-${apiDay}`} style={styles.daySection}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{DAY_NAMES[idx]}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={styles.copyScheduleButtonHeader}
                      onPress={() => openAddFormForDay(apiDay)}
                      disabled={submitting}
                      accessibilityLabel="Thêm ca cho ngày này"
                    >
                      <Icon name="add" size={16} color="#2F6FED" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.copyScheduleButtonHeader} onPress={() => openCopyModalForDay(apiDay)} disabled={submitting}>
                      <Icon name="copy-outline" size={16} color="#2F6FED" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.copyScheduleButtonHeader}
                      onPress={() => deleteDay(apiDay)}
                      disabled={submitting}
                      accessibilityLabel="Xoá toàn bộ lịch của ngày này"
                    >
                      <Icon name="trash-outline" size={16} color="#E53935" />
                    </TouchableOpacity>
                  </View>
                </View>

                {daySlots.map((slot, sIdx) => {
                  const t = slot.consultationType;
                  const showOnline  = t === 'online' || t === 'both';
                  const showOffline = t === 'offline' || t === 'both';
                  return (
                    <View key={getSlotId(slot) || sIdx} style={styles.slotCard}>
                      <View style={styles.slotLeftIcon}><Icon name="time-outline" size={16} color="#2F6FED" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.slotTime}>{slot.start} - {slot.end}</Text>
                        <Text style={styles.slotSub}>Thời gian tư vấn</Text>
                        <View style={styles.slotBadgesRow}>
                          <View style={[styles.badge, t === 'offline' ? styles.badgeOrange : styles.badgeBlue]}>
                            <Text style={[styles.badgeText, t === 'offline' ? styles.badgeTextOrange : styles.badgeTextBlue]}>
                              {t === 'offline' ? 'Tại phòng khám' : (t === 'both' ? 'Online/Offline' : 'Online')}
                            </Text>
                          </View>
                          {showOnline && (
                            <View style={styles.badgeLight}>
                              <Icon name="person-outline" size={12} color="#6B7280" />
                              <Text style={styles.badgeLightText}>{slot.onlinePerPatient} phút/ca (Online)</Text>
                            </View>
                          )}
                          {showOffline && (
                            <View style={styles.badgeLight}>
                              <Icon name="person-outline" size={12} color="#6B7280" />
                              <Text style={styles.badgeLightText}>{slot.offlinePerPatient} phút/ca (Offline)</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.statusRow}><View style={styles.statusDot} /><Text style={styles.statusText}>Đang hoạt động</Text></View>
                      </View>
                      <View style={styles.actionsCol}>
                        <TouchableOpacity onPress={() => openEditModal(apiDay, sIdx)} style={styles.actBtn} disabled={submitting}><Icon name="pencil" size={16} color="#637381" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteSlot(apiDay, sIdx)} style={styles.actBtn} disabled={submitting}><Icon name="trash-outline" size={16} color="#E53935" /></TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          });
        })()}

        {!!message.text && (
          <View style={[styles.msgBox, message.type === 'success' ? styles.msgSuccess : styles.msgError]}>
            <Text style={[styles.msgText, message.type === 'success' ? styles.msgTextSuccess : styles.msgTextError]}>{message.text}</Text>
          </View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.addHeaderRow}>
              <View style={[styles.addIconWrap, { backgroundColor: '#2F6FED' }]}><Icon name="pencil" size={18} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addTitle}>Chỉnh sửa ca làm việc</Text>
                <Text style={styles.addSubtitle}>{DAY_NAMES[apiToIdx(editingDayApi)]}</Text>
              </View>
            </View>

            <View style={styles.inlineBlock}>
              <Text style={styles.blockLabel}>Thời gian làm việc</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeItem}>
                  <Text style={styles.timeSmallLabel}>Bắt đầu</Text>
                  <View style={styles.timeSelector}>
                    <TouchableOpacity onPress={() => setEditStart(cycleTime(editStart, -1))} disabled={submitting}><Icon name="chevron-back" size={18} color="#2F6FED" /></TouchableOpacity>
                    <Text style={styles.timeText}>{editStart}</Text>
                    <TouchableOpacity onPress={() => setEditStart(cycleTime(editStart, +1))} disabled={submitting}><Icon name="chevron-forward" size={18} color="#2F6FED" /></TouchableOpacity>
                  </View>
                </View>
                <View style={styles.timeItem}>
                  <Text style={styles.timeSmallLabel}>Kết thúc</Text>
                  <View style={styles.timeSelector}>
                    <TouchableOpacity onPress={() => setEditEnd(cycleTime(editEnd, -1))} disabled={submitting}><Icon name="chevron-back" size={18} color="#2F6FED" /></TouchableOpacity>
                    <Text style={styles.timeText}>{editEnd}</Text>
                    <TouchableOpacity onPress={() => setEditEnd(cycleTime(editEnd, +1))} disabled={submitting}><Icon name="chevron-forward" size={18} color="#2F6FED" /></TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.inlineBlock}>
              <Text style={styles.blockLabel}>Hình thức tư vấn</Text>
              <View style={styles.locationButtons}>
                <TouchableOpacity
                  style={[styles.locationButton, editChannels.online && styles.locationButtonActiveBlue]}
                  onPress={() => setEditChannels(c => ({...c, online: !c.online}))}
                  disabled={submitting}
                >
                  <Icon name="videocam-outline" size={16} color={editChannels.online ? '#fff' : '#2F6FED'} />
                  <Text style={[styles.locationText, editChannels.online && styles.locationTextActive]}>Online</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.locationButton, editChannels.offline && styles.locationButtonActiveGray]}
                  onPress={() => setEditChannels(c => ({...c, offline: !c.offline}))}
                  disabled={submitting}
                >
                  <MaterialIcons name="local-hospital" size={16} color={editChannels.offline ? '#fff' : '#2F6FED'} />
                  <Text style={[styles.locationText, editChannels.offline && styles.locationTextActive]}>Tại phòng khám</Text>
                </TouchableOpacity>
              </View>
            </View>

            {editChannels.online && (
              <PerPersonSetting
                title="Thời gian khám / 1 người (Online)"
                value={Math.trunc(editOnlinePer)}
                onChange={setEditOnlinePer}
                color="blue"
                note="Đã tính cả thời gian nghỉ"
              />
            )}
            {editChannels.offline && (
              <PerPersonSetting
                title="Thời gian khám / 1 người (Tại phòng khám)"
                value={Math.trunc(editOfflinePer)}
                onChange={setEditOfflinePer}
                color="orange"
                note="Đã tính cả thời gian nghỉ"
              />
            )}

            <View style={styles.addActions}>
              {/* Nút Hủy bỏ: ghost, bo tròn, viền đẹp */}
              <TouchableOpacity
                style={[styles.btnGhost, submitting && {opacity:0.7}]}
                onPress={() => setShowEditModal(false)}
                disabled={submitting}
              >
                <Icon name="close-circle-outline" size={18} color="#6B7280" />
                <Text style={styles.cancelText}>Hủy bỏ</Text>
              </TouchableOpacity>

              {/* Nút Lưu thay đổi: primary, đổ bóng nhẹ */}
              <TouchableOpacity
                style={[styles.btnPrimary, submitting && { opacity: 0.7 }]}
                onPress={applyEdit}
                disabled={submitting}
              >
                <Icon name="save-outline" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Lưu thay đổi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Copy modal */}
      <Modal
        visible={copyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCopyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.copyModalContainer}>
            <View style={styles.copyHeader}>
              <Text style={styles.copyTitle}>Sao chép lịch</Text>
              <TouchableOpacity onPress={() => setCopyModalVisible(false)}>
                <Icon name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.copySubtitle}>
              Áp dụng lịch của <Text style={{fontWeight:'700'}}>{DAY_NAMES[apiToIdx(copyFromApi)]}</Text> cho các ngày:
            </Text>
            <Text style={styles.copyHint}>
              Chỉ hiện các ngày <Text style={{fontWeight:'700'}}>chưa có lịch</Text>. Đã chọn {copyTargets.length}/{selectableCopyIdxs.length}.
            </Text>

            {selectableCopyIdxs.length > 0 && (
              <View style={styles.copyQuickRow}>
                <TouchableOpacity onPress={() => setCopyTargets(selectableCopyIdxs)} style={styles.quickBtn}>
                  <Icon name="checkbox-outline" size={16} color="#2F6FED" />
                  <Text style={styles.quickBtnText}>Chọn tất cả</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCopyTargets([])} style={styles.quickBtn}>
                  <Icon name="close-circle-outline" size={16} color="#6B7280" />
                  <Text style={styles.quickBtnText}>Bỏ chọn</Text>
                </TouchableOpacity>
              </View>
            )}

            {selectableCopyIdxs.length === 0 ? (
              <View style={[styles.emptyBox, { marginTop: 8 }]}>
                <View style={styles.emptyIcon}>
                  <Icon name="checkmark-done-outline" size={18} color="#2F6FED" />
                </View>
                <Text style={styles.emptyTitle}>Tất cả ngày đã có lịch</Text>
              </View>
            ) : (
              <View style={styles.copyDaysWrap}>
                {selectableCopyIdxs.map((idx) => {
                  const selected = copyTargets.includes(idx);
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() =>
                        setCopyTargets(prev =>
                          prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]
                        )
                      }
                      style={[
                        styles.copyChip,
                        selected && styles.copyChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.copyChipText,
                          selected && styles.copyChipTextSelected,
                        ]}
                      >
                        {DAY_LABELS[idx]}
                      </Text>
                      {selected && <Icon name="checkmark" size={14} color="#fff" style={{marginLeft:6}} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.btnGhost}
                onPress={() => setCopyModalVisible(false)}
                disabled={submitting}
              >
                <Icon name="close-circle-outline" size={18} color="#6B7280" />
                <Text style={styles.btnGhostText}>Hủy bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnPrimary, (submitting || copyTargets.length === 0) && {opacity:0.7}]}
                disabled={submitting || copyTargets.length === 0}
                onPress={async () => {
                  const validIdxs = copyTargets.filter(idx => selectableCopyIdxs.includes(idx));
                  const toApis  = validIdxs.map(idxToApi);
                  if (!toApis.length) return;

                  setCopyModalVisible(false);
                  setSubmitting(true);
                  clearMessage();

                  try {
                    const res = await doctorService.copySchedule({ fromDayOfWeek: copyFromApi, toDays: toApis });
                    if (res?.success) {
                      syncFromServer(res);
                      setMessage({ type:'success', text:'Đã sao chép lịch cho ngày được chọn' });
                    } else setMessage({ type:'error', text: res?.message || 'Sao chép lịch thất bại' });
                  } catch {
                    setMessage({ type:'error', text:'Có lỗi khi sao chép lịch' });
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <MaterialIcons name="content-copy" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Sao chép</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==== SUCCESS POPUP (dùng chung) ==== */}
      <Modal
        visible={successModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeSuccessAndReturn}
      >
        <View style={styles.centerOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Icon name="checkmark-circle" size={36} color="#2ECC71" />
            </View>
            <Text style={styles.successTitle}>{successModal.title}</Text>
            {!!successModal.description && (
              <Text style={styles.successDesc}>{successModal.description}</Text>
            )}
            <TouchableOpacity style={styles.successBtn} onPress={closeSuccessAndReturn}>
              <Text style={styles.successBtnText}>Quay về</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ===== Styles =====
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#2F6FED', minHeight: 80 },
  backButton: { padding: 8, marginRight: 12 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#E3F2FD', lineHeight: 18 },
  content: { flex: 1, padding: 16 },

  summaryCard: { backgroundColor: '#2F6FED', borderRadius: 16, padding: 20, marginBottom: 16 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  summarySubtitle: { fontSize: 13, color: '#D7E3FF', marginTop: 4 },
  summaryRight: { alignItems: 'flex-end' },
  summaryRightNumber: { fontSize: 24, fontWeight: '800', color: '#fff' },
  summaryRightLabel: { fontSize: 12, color: '#D7E3FF' },
  dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2ECC71', marginRight: 6 },
  summaryNote: { fontSize: 12, color: '#D7E3FF' },

  calendarSection: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 12 },
  calendarTitle: { fontSize: 14, color: '#111827', fontWeight: '600', marginBottom: 8 },
  calendarContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  dayBtn: { width: 44, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  dayBtnActive: { backgroundColor: '#2F6FED' },
  dayBtnText: { fontSize: 12, fontWeight: '600', color: '#111827' },
  dayBtnTextActive: { color: '#fff' },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', marginTop: 6 },
  inactiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB', marginTop: 6 },

  // highlight ngày đã có lịch
  dayBtnHas: { backgroundColor: '#FFF2E0', borderWidth: 1, borderColor: '#FFD8A8' },
  dayBtnTextHas: { color: '#FF8A00' },
  hasDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF8A00', marginTop: 6, opacity: 0.9 },

  addCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  addHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  addIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2F6FED', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  addTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  addSubtitle: { fontSize: 13, color: '#6B7280' },

  inlineBlock: { backgroundColor: '#F6F7FB', borderRadius: 12, padding: 12, marginTop: 6 },
  inlineBlockLight: { backgroundColor: '#FFF7EA', borderRadius: 12, padding: 12, marginTop: 6 },
  blockLabel: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 8 },

  timeRow: { flexDirection: 'row', gap: 12 },
  timeItem: { flex: 1 },
  timeSmallLabel: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  timeSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10 },
  timeText: { fontSize: 16, fontWeight: '600', color: '#111827' },

  locationButtons: { flexDirection: 'row', gap: 8 },
  locationButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2F6FED', borderRadius: 12, paddingVertical: 12, backgroundColor: '#fff' },
  locationButtonActiveBlue: { backgroundColor: '#2F6FED' },
  locationButtonActiveGray: { backgroundColor: '#2F6FED' },
  locationText: { marginLeft: 8, fontSize: 14, color: '#2F6FED', fontWeight: '600' },
  locationTextActive: { color: '#fff' },

  defaultsCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 16 },
  defaultsTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 6 },
  defaultsLabel: { fontSize: 14, color: '#000', marginTop: 6, marginBottom: 10, fontWeight: '500' },
  defaultsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circleBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  durationValue: { fontSize: 24, fontWeight: '800', color: '#2F6FED' },
  breakValue: { fontSize: 24, fontWeight: '800', color: '#FF8A00' },
  unitText: { fontSize: 12, fontWeight: '600', color: '#666' },
  sliderWrap: { marginTop: 10, marginBottom: 4 },
  sliderTrack: { height: 8, borderRadius: 4, backgroundColor: '#E6ECFF', overflow: 'hidden' },
  sliderFillBlue: { height: 8, backgroundColor: '#2F6FED' },
  sliderFillOrange: { height: 8, backgroundColor: '#FF8A00' },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sliderHint: { fontSize: 12, color: '#6B7280' },

  saveDefaultsBtn: { marginTop: 12, backgroundColor: '#2F6FED', borderRadius: 10, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  saveDefaultsText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 6 },

  daySection: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 16 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  dayTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  copyScheduleButtonHeader: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F0FE', alignItems: 'center', justifyContent: 'center' },

  emptyBox: { alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#F6F8FF', borderRadius: 12 },
  emptyIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F0FE', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },

  slotCard: { flexDirection: 'row', backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEF2F7', borderRadius: 12, padding: 12, marginBottom: 12 },
  slotLeftIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  slotTime: { fontSize: 16, fontWeight: '800', color: '#111827' },
  slotSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  slotBadgesRow: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'flex-start', flexWrap: 'wrap' },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  badgeBlue: { backgroundColor: '#E6F0FF' },
  badgeOrange: { backgroundColor: '#FFF2E0' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextBlue: { color: '#2F6FED' },
  badgeTextOrange: { color: '#FF8A00' },
  badgeLight: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F2F4F7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeLightText: { fontSize: 12, color: '#6B7280' },

  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E8F5E9', borderWidth: 2, borderColor: '#2ECC71' },
  statusText: { marginLeft: 8, fontSize: 12, color: '#2E7D32' },

  actionsCol: { alignItems: 'flex-end', justifyContent: 'space-between' },
  actBtn: { padding: 6 },

  copyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6F8FF', borderRadius: 12, padding: 12, marginTop: 8 },
  copyRowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F0FE', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  copyRowTitle: { fontSize: 14, fontWeight: '700', color: '#2F6FED' },
  copyRowSub: { fontSize: 12, color: '#6B7280' },

  msgBox: { marginHorizontal:16, marginBottom: 18, borderRadius: 8, padding: 12 },
  msgSuccess: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#C8E6C9' },
  msgError: { backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2' },
  msgText: { fontSize: 13, textAlign: 'center' },
  msgTextSuccess: { color: '#2E7D32' },
  msgTextError: { color: '#C62828' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '85%' },

  copyModalContainer: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, margin: 24 },
  copyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  copyTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  copySubtitle: { fontSize: 13, color: '#111827', marginBottom: 4 },
  copyHint: { fontSize: 12, color: '#6B7280', marginBottom: 10 },
  copyQuickRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickBtnText: { fontSize: 13, color: '#2F6FED', fontWeight: '600' },
  copyDaysWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  copyChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#F1F5FF', borderWidth: 1, borderColor: '#E1E7FF' },
  copyChipSelected: { backgroundColor: '#2F6FED', borderColor: '#2F6FED' },
  copyChipText: { fontSize: 13, color: '#2F6FED', fontWeight: '700' },
  copyChipTextSelected: { color: '#fff' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btnGhost: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', flexDirection: 'row', gap: 8 },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  btnPrimary: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#2F6FED', flexDirection: 'row', gap: 8, shadowColor: '#2F6FED', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // CTA & notes
  ctaRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  ctaGhost: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', flexDirection: 'row', gap: 6 },
  ctaGhostText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  ctaPrimary: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#2F6FED', flexDirection: 'row', gap: 8, shadowColor: '#2F6FED', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  ctaPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  noteWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  noteText: { fontSize: 11, color: '#6B7280' },

  // ==== SUCCESS POPUP styles ====
  centerOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.55)', alignItems:'center', justifyContent:'center', padding:24 },
  successCard: { width:'100%', maxWidth:420, backgroundColor:'#fff', borderRadius:16, padding:20, alignItems:'center' },
  successIconWrap: { width:56, height:56, borderRadius:28, backgroundColor:'#EAF8F0', alignItems:'center', justifyContent:'center', marginBottom:10 },
  successTitle: { fontSize:16, fontWeight:'800', color:'#111827', textAlign:'center' },
  successDesc: { fontSize:13, color:'#4B5563', textAlign:'center', marginTop:6 },
  successBtn: { marginTop:14, backgroundColor:'#2F6FED', paddingVertical:12, paddingHorizontal:18, borderRadius:12, flexDirection:'row', alignItems:'center', gap:8 },
  successBtnText: { color:'#fff', fontSize:14, fontWeight:'700' },

  // ===== NEW: khu vực nút trong Edit Modal =====
  addActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
});

export default CreateWorkScheduleScreen;
