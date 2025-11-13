// Cache rất nhẹ trong module (sống theo vòng đời JS runtime)
let _cachedProfile = null;
let _fetchedAt = 0;

const pickProfile = (res) =>
  res?.data?.doctorProfile ??
  res?.data?.profile ??
  res?.doctorProfile ??
  res?.profile ??
  res?.data ??
  null;

export const hasDoctorProfile = (p) =>
  !!(p && (p._id || p.id || p.user || Array.isArray(p.schedule)));

export const getCachedDoctorProfile = () => _cachedProfile;

export async function fetchDoctorProfile(doctorService, { force = false, ttlMs = 30000 } = {}) {
  const now = Date.now();
  if (!force && _cachedProfile && now - _fetchedAt < ttlMs) return _cachedProfile;

  try {
    const res =
      (await doctorService.getMyProfile?.()) ??
      (await doctorService.getProfile?.());
    _cachedProfile = pickProfile(res);
    _fetchedAt = now;
    return _cachedProfile;
  } catch (e) {
    // vẫn cập nhật mốc thời gian để tránh spam API
    _cachedProfile = null;
    _fetchedAt = now;
    throw e;
  }
}
