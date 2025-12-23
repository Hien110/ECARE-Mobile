import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { userService } from '../../services/userService';
import relationshipService from '../../services/relationshipService';
import { doctorBookingService } from '../../services/doctorBookingService';
import supporterSchedulingService from '../../services/supporterSchedulingService';

/** ========= THEME ========= */
const C = {
  background: '#ffffff',
  foreground: '#111827',
  card: '#ffffff',
  cardFg: '#1f2937',
  mutedBg: '#f8fafc',
  mutedFg: '#6b7280',
  border: '#e5e7eb',
  indigo: '#4f46e5',
  purple: '#7c3aed',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  orange: '#f59e0b',
  red: '#ef4444',
};
const S = { radius: 14 };

export default function EnhancedHealthAppRN() {
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const isLarge = width > 420;
  const styles = useMemo(
    () => makeStyles({ isSmall, isLarge }),
    [isSmall, isLarge],
  );

  /** ========= LOCAL UI PARTS ========= */
  function RNProgress({ value = 0 }) {
    const pct = Math.max(0, Math.min(100, value));
    return (
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    );
  }
  
  function Card({ children, style }) {
    return <View style={[styles.card, style]}>{children}</View>;
  }
  function ContactTile({ contact, onPress }) {
    return (
      <Pressable style={styles.contactTile} onPress={onPress}>
        <View style={{ position: 'relative', alignItems: 'center' }}>
          {contact.avatar ? (
            <Image source={{ uri: contact.avatar }} style={styles.tileAvatar} />
          ) : (
            <View
              style={[styles.tileIconCircle, { backgroundColor: contact.color }]}
            >
              <Text style={styles.tileIconText}>{contact.icon}</Text>
            </View>
          )}
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  contact.status === 'online' ? '#22c55e' : '#9ca3af',
              },
            ]}
          />
        </View>
        <Text style={styles.contactName} numberOfLines={2} ellipsizeMode="tail">
          {contact.name}
        </Text>
        {contact.type !== 'family' && contact.subtitle ? (
          <Text style={styles.contactSub} numberOfLines={1}>{contact.subtitle}</Text>
        ) : null}
      </Pressable>
    );
  }

  /** ========= STATE / DATA ========= */
  const [activeFeature, setActiveFeature] = useState(null);
  const [activeTimeframe, setActiveTimeframe] = useState('today');
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [elderlies, setElderlies] = useState([]);
  const [selectedElderlyId, setSelectedElderlyId] = useState(null);
  const [familyContacts, setFamilyContacts] = useState([]);
  const [supportStaffContacts, setSupportStaffContacts] = useState([]);

  useEffect(() => {
    setActiveFeature(null);
    let mounted = true;

    const pickElderlyId = item =>
      item?.elderlyId || item?.userId || item?.elderly?._id || item?._id || null;

    const toContact = (entity = {}, { type = 'family' } = {}) => {
      const id = entity?._id || entity?.userId || entity?.user?._id || Math.random().toString(36).slice(2);
      const fullName =
        entity?.fullName || entity?.name || entity?.user?.fullName || entity?.user?.name || 'Ẩn danh';
      const avatar = entity?.avatar || entity?.avatarUrl || null;
      const rawSubtitle = type === 'doctor' ? 'Bác sĩ' : type === 'supporter' ? 'Người hỗ trợ' : (entity?.relationship || '');
      const color = type === 'doctor' ? C.blue : type === 'supporter' ? C.orange : C.purple;
      const icon = type === 'doctor' ? '🩺' : type === 'supporter' ? '💁‍♀️' : '📞';

      // For family (elderly), prefix honorific if missing
      let displayName = fullName;
      if (type === 'family' && fullName && !/^Bác\s+/i.test(fullName)) {
        displayName = `Bác ${fullName}`;
      }

      return {
        id: `${type}-${id}`,
        type,
        name: displayName,
        rawName: fullName,
        subtitle: rawSubtitle,
        color,
        icon,
        avatar,
        status: 'offline',
      };
    };

    (async () => {
      try {
        // Current user
        const resUser = await userService.getUser();
        const user = resUser?.data?.data || resUser?.data || resUser || null;
        if (mounted && user) setMe(user);

        // Elderlies this account can act for
        const resElders = await doctorBookingService.getElderlies();
        const elderList = Array.isArray(resElders?.data) ? resElders.data : [];
        if (mounted) setElderlies(elderList);

        const eId = pickElderlyId(elderList?.[0]);
        if (mounted) setSelectedElderlyId(eId);

        if (eId) {
          // Family: lấy theo familyId, trả về elderly + relationship
          try {
            const myId = user?._id || user?.id;
            const relRes = myId
              ? await relationshipService.getAllRelationshipsByFamilyId(myId, { status: 'accepted' })
              : null;
            const relRaw = Array.isArray(relRes?.data) ? relRes.data : [];
            const famContacts = relRaw
              .filter(item => item?.elderly)
              .map(item =>
                toContact(
                  {
                    _id: item.elderly?._id,
                    fullName: item.elderly?.fullName,
                    relationship: item.relationship,
                  },
                  { type: 'family' },
                ),
              );
            if (mounted) setFamilyContacts(famContacts);
          } catch (_) {
            if (mounted) setFamilyContacts([]);
          }

          // Doctors: prefer relationships/members (by userId), fallback to bookings
          let doctorContacts = [];
          try {
            // Try to get family members (some setups store linked users including doctors)
            let membersRes = null;
            try {
              if (userService.getFamilyMembersByElderlyId) {
                try {
                  membersRes = await userService.getFamilyMembersByElderlyId(eId);
                } catch (err) {
                  membersRes = await userService.getFamilyMembersByElderlyId({ elderlyId: eId });
                }
              }
            } catch (err) {
              membersRes = null;
            }

            const members = Array.isArray(membersRes?.data)
              ? membersRes.data
              : Array.isArray(membersRes)
              ? membersRes
              : [];

            if (members.length > 0) {
              const map = new Map();
              members
                .filter(m => (m?.role || '').toLowerCase() === 'doctor')
                .forEach(d => {
                  const id = d?._id || d?.userId;
                  if (!id) return;
                  const key = String(id);
                  if (map.has(key)) return;
                  map.set(key, toContact({ _id: id, fullName: d?.fullName || d?.name }, { type: 'doctor' }));
                });
              doctorContacts = Array.from(map.values());
            } else {
              // Fallback: derive from bookings (legacy behavior)
              const bRes = await doctorBookingService.getBookingsByElderlyId(eId);
              const bookings = Array.isArray(bRes?.data) ? bRes.data : [];

              // Collect unique doctor ids using a Set and normalize to string
              const candidateDoctorIds = new Set();
              bookings.forEach(bk => {
                const d = bk?.doctor || bk?.doctorProfile || {};
                const dUser = d?.user || d?.userInfo || {};
                const id = dUser?._id || d?.userId || d?._id;
                if (id) candidateDoctorIds.add(String(id));
              });

              // Bulk-check relationship statuses between elderly and these doctor ids
              const docRelMap = {};
              const candidateArr = Array.from(candidateDoctorIds);
              if (candidateArr.length > 0) {
                try {
                  const bulkRes = await userService.checkRelationshipsBulk({ elderlyId: eId, familyIds: candidateArr });
                  const list = Array.isArray(bulkRes?.data) ? bulkRes.data : [];
                  list.forEach(item => {
                    if (item && item.familyId) docRelMap[String(item.familyId)] = item;
                  });
                } catch (err) {
                  // ignore errors and treat as no cancelled relationships
                }
              }

              const map = new Map();
              bookings.forEach(bk => {
                const d = bk?.doctor || bk?.doctorProfile || {};
                const dUser = d?.user || d?.userInfo || {};
                const id = dUser?._id || d?.userId || d?._id;
                if (!id) return;
                const key = String(id);
                if (map.has(key)) return;

                const rel = docRelMap[String(id)];
                if (rel && String(rel.status) === 'cancelled') return;

                map.set(key, toContact({ _id: id, fullName: dUser?.fullName || d?.fullName }, { type: 'doctor' }));
              });

              doctorContacts = Array.from(map.values());
            }
          } catch (_) {
            doctorContacts = [];
          }

          let supporterContacts = [];
          try {
            const myId = user?._id || user?.id;

            // Prefer backend relationships endpoint to retrieve staff (if backend returns staff lists)
            let relList = [];
            try {
              const relResp = myId
                ? await relationshipService.getAllRelationshipsByFamilyId(myId, { status: 'accepted' })
                : null;
              relList = Array.isArray(relResp?.data) ? relResp.data : [];
            } catch (err) {
              relList = [];
            }

            // If backend provided staff info inside relationship items, extract them
            const staffCandidates = [];
            relList.forEach(item => {
              if (Array.isArray(item.supporters)) staffCandidates.push(...item.supporters);
              if (Array.isArray(item.doctors)) staffCandidates.push(...item.doctors);
              if (Array.isArray(item.staff)) staffCandidates.push(...item.staff);
              if (item.supporter) staffCandidates.push(item.supporter);
              if (item.doctor) staffCandidates.push(item.doctor);
            });

            if (staffCandidates.length > 0) {
              const map = new Map();
              staffCandidates.forEach(s => {
                const id = s?._id || s?.userId || s?.id;
                if (!id) return;
                const key = String(id);
                if (map.has(key)) return;
                const role = (s?.role || s?.type || '').toString().toLowerCase();
                const type = role.includes('doctor') ? 'doctor' : role.includes('supporter') ? 'supporter' : 'supporter';
                map.set(key, toContact({ _id: id, fullName: s?.fullName || s?.name, avatar: s?.avatar }, { type }));
              });
              supporterContacts = Array.from(map.values());
            }

            // Fallback to previous logic if backend didn't return staff lists
            if (supporterContacts.length === 0) {
              let membersRes = null;
              try {
                if (userService.getFamilyMembersByElderlyId) {
                  try {
                    membersRes = await userService.getFamilyMembersByElderlyId(eId);
                  } catch (err) {
                    membersRes = await userService.getFamilyMembersByElderlyId({ elderlyId: eId });
                  }
                }
              } catch (err) {
                membersRes = null;
              }

              const members = Array.isArray(membersRes?.data)
                ? membersRes.data
                : Array.isArray(membersRes)
                ? membersRes
                : [];

              if (members.length > 0) {
                const map = new Map();
                members
                  .filter(m => (m?.role || '').toLowerCase() === 'supporter')
                  .forEach(s => {
                    const id = s?._id || s?.userId;
                    if (!id) return;
                    const key = String(id);
                    if (!map.has(key)) {
                      map.set(key, toContact({ _id: id, fullName: s?.fullName || s?.name }, { type: 'supporter' }));
                    }
                  });
                supporterContacts = Array.from(map.values());
              } else {
                const sRes = await supporterSchedulingService.getSchedulingsByUserId(eId);
                const scheds = Array.isArray(sRes?.data) ? sRes.data : [];
                const map = new Map();

                const candidateIds = [];
                scheds.forEach(s => {
                  const sup = s?.supporter || s?.supporterProfile || {};
                  const sUser = sup?.user || sup?.userInfo || {};
                  const id = sUser?._id || sup?.userId || sup?._id || s?.supporterId;
                  if (id && !candidateIds.includes(String(id))) candidateIds.push(String(id));
                });

                let relMap = {};
                if (candidateIds.length > 0) {
                  try {
                    const bulkRes = await userService.checkRelationshipsBulk({ elderlyId: eId, familyIds: candidateIds });
                    const list = Array.isArray(bulkRes?.data) ? bulkRes.data : [];
                    list.forEach(item => {
                      if (item && item.familyId) relMap[String(item.familyId)] = item;
                    });
                  } catch (err) {
                  }
                }

                for (const s of scheds) {
                  const sup = s?.supporter || s?.supporterProfile || {};
                  const sUser = sup?.user || sup?.userInfo || {};
                  const id = sUser?._id || sup?.userId || sup?._id || s?.supporterId;
                  if (!id) continue;
                  if (map.has(id)) continue;

                  const rel = relMap[String(id)];
                  if (rel && String(rel.status) === 'cancelled') continue;

                  map.set(id, toContact({ _id: id, fullName: sUser?.fullName || sup?.fullName }, { type: 'supporter' }));
                }

                supporterContacts = Array.from(map.values());
              }
            }
          } catch (_) {
            supporterContacts = [];
          }

          if (mounted) {
            // Filter combined staff by accepted relationships with the elderly (so UI shows only active staff)
            try {
              // Deduplicate across groups (prefer first occurrence - doctors first)
              const mapByRaw = new Map();
              const source = [...doctorContacts, ...supporterContacts];
              for (const c of source) {
                const rawId = (c?.id || '').replace(/^(doctor|supporter|family)-/, '');
                if (!rawId) continue;
                if (!mapByRaw.has(rawId)) mapByRaw.set(rawId, c);
              }
              const uniqueCombined = Array.from(mapByRaw.values());

              const candidateIds = uniqueCombined.map(c => (c?.id || '').replace(/^(doctor|supporter|family)-/, '')).filter(Boolean);

              if (candidateIds.length > 0) {
                try {
                  const bulk = await userService.checkRelationshipsBulk({ elderlyId: eId, familyIds: candidateIds });
                  const list = Array.isArray(bulk?.data) ? bulk.data : [];
                  const relMap = {};
                  list.forEach(it => {
                    if (it && it.familyId) relMap[String(it.familyId)] = it;
                  });

                  const filtered = uniqueCombined.filter(c => {
                    const rawId = (c?.id || '').replace(/^(doctor|supporter|family)-/, '');
                    const rel = relMap[String(rawId)];
                    return rel && String(rel.status) === 'accepted';
                  });

                  setSupportStaffContacts(filtered);
                } catch (err) {
                  // If bulk check fails, fallback to showing deduped list
                  setSupportStaffContacts(uniqueCombined);
                }
              } else {
                setSupportStaffContacts(uniqueCombined);
              }
            } catch (_) {
              setSupportStaffContacts([...doctorContacts, ...supporterContacts]);
            }
          }
        } else {
          if (mounted) {
            setFamilyContacts([]);
            setSupportStaffContacts([]);
          }
        }
      } finally {
        mounted && setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const features = useMemo(
    () => [
      {
        id: 'appointment',
        icon: '🧑🏻‍⚕️',
        label: 'Đặt lịch tư vấn',
        color: C.background,
        desc: 'Đặt lịch hẹn với bác sĩ',
        navTo: 'IntroductionBookingDoctor',
        message: 'Chức năng đặt lịch bác sĩ',
      },
      {
        id: 'bookingSupporter',
        icon: '💁‍♀️',
        label: 'Đặt lịch hỗ trợ',
        color: C.background,
        desc: 'Đặt lịch hẹn với người hỗ trợ',
        navTo: 'FamilyListFunctionScreen',
        message: 'Chức năng đặt lịch hỗ trợ',
      },
      {
        id: 'connection',
        icon: '📶',
        label: 'Kết nối người thân',
        color: C.background,
        desc: 'Tìm kiếm và kết nối với người thân',
        navTo: 'FindPeople',
      },
    ],
    [],
  );

  const familyCount = familyContacts.length;
  const staffCount = supportStaffContacts.length;

  

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Header Card ===== */}
        <Card style={[styles.headerCard, { backgroundColor: C.indigo }]}>
          {/* Row chính */}
          <View style={styles.headerRow}>
            {/* Avatar + online */}
            <View style={styles.avatarWrap}>
              <View style={styles.avatarRing} />
              <Image
                source={{
                  uri:
                    me?.avatar ||
                    me?.avatarUrl ||
                    'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=faces',
                }}
                style={styles.avatar}
              />
              <View style={styles.onlineDot} />
            </View>

            {/* Texts */}
            <View style={styles.headerTextCol}>
              <Text
                style={styles.hTitle}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                Theo dõi sức khỏe gia đình
              </Text>
              <Text style={styles.hSub} numberOfLines={1} ellipsizeMode="tail">
                {me?.fullName || me?.name || me?.username || 'Người dùng'}
              </Text>
            </View>

          </View>
        </Card>

        {/* ===== Features ===== */}
        <Card style={{ padding: 14 }}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconSquare]}>
                <Text
                  style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}
                >
                  🔑
                </Text>
              </View>
              <Text style={styles.sectionTitle}>Các chức năng</Text>
            </View>
            {/* <Button title="Tùy chỉnh" variant="ghost" /> */}
          </View>

          <View style={styles.grid2or3}>
            {features.map(f => {
              const active = activeFeature === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  activeOpacity={0.9}
                  onPress={() =>
                    nav.navigate(f.navTo || f.id, {
                      id: f.id, // Truyền ID
                      message: f.message, // Truyền message
                    })
                  }
                  style={[
                    styles.featureTile,
                    {
                      borderColor: active ? C.indigo : C.border,
                      backgroundColor: active ? '#eef2ff' : '#fff',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.tileIconCircle,
                      { backgroundColor: f.color },
                    ]}
                  >
                    <Text style={styles.tileIconText}>{f.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.tileTitle}>
                      {f.label}
                    </Text>
                    <Text numberOfLines={2} style={styles.tileDesc}>
                      {f.desc}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* ===== Family & Doctors ===== */}
        <Card style={{ padding: 14 }}>
          {/* Group: Người nhà */}
          <View style={styles.groupHeader}>
            <View style={styles.groupHeaderLeft}>
              <View style={[styles.iconSquare]}>
                <Text
                  style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}
                >
                  👨‍👩‍👧‍👦
                </Text>
              </View>
              <Text style={styles.sectionTitle}>Người nhà</Text>
            </View>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>
                  {familyCount}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => nav.navigate('FamilyList_Family')}
                style={styles.viewAllBtn}
              >
                <Text style={styles.viewAllText}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>
          </View>

          {familyContacts.length ? (
            <View style={styles.contactsGrid}>
              {familyContacts.map(c => (
                <ContactTile
                  key={c.id}
                  contact={c}
                  onPress={() =>
                    nav.navigate('FamilyDetail', {
                      elderlyId: c.id?.replace(/^family-/, ''),
                      name: c.name,
                      relationship: c.subtitle,
                      avatar: c.avatar || null,
                    })
                  }
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Chưa có người nhà nào được liên kết
            </Text>
          )}

          {/* Group: Bác sĩ */}
          <View style={[styles.groupHeader, { marginTop: 14 }]}>
            <View style={styles.groupHeaderLeft}>
              <View style={[styles.iconSquare, { backgroundColor: C.blue }]}>
                <Text
                  style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}
                >
                  🩺
                </Text>
              </View>
              <Text style={styles.sectionTitle}>Nhân viên hỗ trợ</Text>
            </View>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{staffCount}</Text>
            </View>
          </View>

          {supportStaffContacts.length ? (
            <View style={styles.contactsGrid}>
              {supportStaffContacts.map(c => (
                <ContactTile
                  key={c.id}
                  contact={c}
                  onPress={() =>
                    nav.navigate('SupportStaffDetail', {
                      staffId: c.id?.replace(/^(supporter|doctor)-/, ''),
                      name: c.name,
                      avatar: c.avatar || null,
                      type: c.type || (c.id || '').includes('doctor') ? 'doctor' : 'supporter',
                    })
                  }
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Chưa có nhân viên hỗ trợ nào được liên kết
            </Text>
          )}
          

          {/* Action buttons */}
          {/* <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Button
              title="Cảnh báo khẩn cấp"
              left={<Text style={{ fontSize: 12 }}>🔔</Text>}
              style={{ flex: 1, backgroundColor: C.red, borderColor: C.red }}
            />
            <Button
              title="Gửi tin nhắn"
              left={<Text style={{ fontSize: 12 }}>📨</Text>}
              style={{
                flex: 1,
                backgroundColor: C.green,
                borderColor: C.green,
              }}
            />
          </View> */}
        </Card>

        {/* ===== Activities ===== */}

        {loading && (
          <View style={{ padding: 16 }}>
            <ActivityIndicator />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** ========= STYLES (factory) ========= */
function makeStyles({ isSmall, isLarge }) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    container: { padding: 16, gap: 14, paddingBottom: 24 },

    /** Header */
    headerCard: {
      borderRadius: S.radius,
      padding: 14,
      elevation: 3,
      position: 'relative',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerTextCol: { flex: 1, minWidth: 0 },
    hTitle: {
      color: '#fff',
      fontWeight: '800',
      lineHeight: isSmall ? 18 : 20,
      fontSize: isSmall ? 14 : isLarge ? 18 : 16,
    },
    hSub: {
      color: 'rgba(255,255,255,0.95)',
      fontSize: isSmall ? 11 : 12,
      marginTop: 4,
    },

    avatarWrap: {
      width: 48,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.35)',
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    avatarRing: {
      position: 'absolute',
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.25)',
    },
    onlineDot: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#22c55e',
      borderWidth: 2,
      borderColor: '#4f46e5',
    },

    badgeMini: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
    },

    ketNoiPill: {
      position: 'absolute',
      top: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.22)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      ...(Platform.OS === 'ios'
        ? {
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          }
        : {}),
    },
    ketNoiPillPressed: {
      backgroundColor: 'rgba(255,255,255,0.30)',
      borderColor: 'rgba(255,255,255,0.45)',
      transform: [{ scale: 0.98 }],
    },

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      gap: 6,
    },
    metaIcon: { color: 'rgba(255,255,255,0.95)', fontSize: 12 },
    metaText: { color: 'rgba(255,255,255,0.95)', fontSize: isSmall ? 11 : 12 },

    /** Time bar */
    timeBar: {
      backgroundColor: C.mutedBg,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      paddingVertical: 14,
      paddingHorizontal: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    timeNow: { fontSize: 24, fontWeight: '800', color: '#1f2937' },
    dateNow: { fontSize: 12, color: C.mutedFg, marginTop: 2 },
    scheduleCount: { fontSize: 16, fontWeight: '700', color: C.blue },
    scheduleDay: { fontSize: 12, color: C.mutedFg },

    /** Generic card */
    card: {
      backgroundColor: C.card,
      borderRadius: S.radius,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: C.cardFg,
      marginLeft: 8,
    },
    iconSquare: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /** Features */
    grid2or3: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    featureTile: {
      width: '99%',
      borderRadius: 14,
      borderWidth: 1,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    tileIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileIconText: { color: '#fff', fontSize: 20 },
    tileTitle: {
      fontSize: isSmall ? 12 : 13,
      fontWeight: '700',
      color: C.cardFg,
    },
    tileDesc: { fontSize: isSmall ? 10 : 11, color: C.mutedFg, marginTop: 2 },

    /** Contacts */
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    groupHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
    countPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: '#f1f5f9',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
    },
    countPillText: { fontSize: 12, color: C.mutedFg, fontWeight: '700' },
    viewAllBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: C.indigo,
      borderRadius: 8,
    },
    viewAllText: { fontSize: 11, color: '#fff', fontWeight: '700' },
    emptyText: { fontSize: 12, color: C.mutedFg, marginBottom: 6 },

    contactsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' },
    contactTile: {
      width: '30%',
      minWidth: 92,
      backgroundColor: '#fff',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: 'center',
      gap: 6,
    },
    contactName: {
      fontSize: isSmall ? 12 : 13,
      fontWeight: '700',
      color: C.cardFg,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 16,
    },
    contactSub: { fontSize: isSmall ? 10 : 11, color: C.mutedFg, textAlign: 'center', marginTop: 4 },
    statusDot: {
      position: 'absolute',
      top: -3,
      right: -3,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: '#fff',
    },

    /** Buttons */
    btn: {
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: C.indigo,
    },
    btnSolid: { backgroundColor: C.indigo },
    btnGhost: { backgroundColor: 'transparent' },
    btnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: { fontWeight: '700', fontSize: 13 },

    
    tileAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      backgroundColor: '#f3f4f6',
    },
  });
}
