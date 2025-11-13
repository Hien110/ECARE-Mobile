import axios from 'axios';
import { Platform } from 'react-native';
// Optional lazy load for file system if we need to copy content:// URIs
let RNFS = null;
import { BASE_URL as API_BASE_URL } from './api/axiosConfig';
import userService from './userService';

async function ensureFileUri(u) {
  if (!u) return u;
  if (u.startsWith('file://')) return u;
  if (u.startsWith('content://')) {
    try {
      // Copy content:// to a temp file path for reliable multipart upload
      if (!RNFS) RNFS = require('react-native-fs');
      const dest = `${RNFS.TemporaryDirectoryPath}voice_${Date.now()}.${Platform.OS === 'android' ? 'mp4' : 'm4a'}`;
      await RNFS.copyFile(u, dest);
      return `file://${dest}`;
    } catch (e) {
      console.log('[transcription] copy content uri failed ->', e.message);
      return u; // fallback to original
    }
  }
  // Plain path (no scheme)
  return `file://${u}`;
}

async function makeRNFilePart({ uri, fileName, mimeType }) {
  const safeUri = await ensureFileUri(uri);
  const name = fileName || safeUri?.split('/')?.pop() || (Platform.OS === 'android' ? 'voice.mp4' : 'voice.m4a');
  const type = mimeType || (Platform.OS === 'android' ? 'audio/mp4' : 'audio/m4a');
  return { uri: safeUri, name, type };
}

export const transcriptionService = {
  create: async ({
    uri,
    fileName,
    mimeType,
    language = 'vi',
    durationSec = 0,
    model = 'whisper-large-v3',
  }) => {
    if (!uri) throw new Error('Thiếu URI của file âm thanh');

    const form = new FormData();
  const filePart = await makeRNFilePart({ uri, fileName, mimeType });
    // Debug thông tin file gửi lên
    console.log('[transcription] upload ->', {
      url: `${API_BASE_URL}/transcriptions`,
      originalUri: uri,
      finalUri: filePart.uri,
      name: filePart.name,
      type: filePart.type,
    });
    form.append('file', filePart);
    form.append('language', language);
    form.append('durationSec', String(durationSec));
    form.append('model', model);

    try {
      const token = await userService.getToken?.();
      const res = await axios.post(`${API_BASE_URL}/transcriptions`, form, {
        headers: {
          // KHÔNG set 'Content-Type' multipart/form-data ở RN (Axios tự thêm boundary)
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        timeout: 60000, // tăng để hạn chế timeout với file hơi dài
      });
      return res.data;
    } catch (e) {
      console.log('[transcription] upload error ->', {
        message: e?.message,
        code: e?.code,
        status: e?.response?.status,
        data: e?.response?.data,
        toJSON: e?.toJSON?.(),
      });
      // Fallback: use fetch if Axios produced a generic Network Error
      if (!e?.response) {
        try {
          const token = await userService.getToken?.();
          const formFetch = new FormData();
          formFetch.append('file', filePart);
          formFetch.append('language', language);
          formFetch.append('durationSec', String(durationSec));
          formFetch.append('model', model);

          const resp = await fetch(`${API_BASE_URL}/transcriptions`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formFetch,
          });
          const data = await resp.json().catch(() => null);
          if (!resp.ok) {
            const err = new Error(`HTTP ${resp.status}`);
            err.response = { status: resp.status, data };
            throw err;
          }
          return data;
        } catch (e2) {
          console.log('[transcription] fetch fallback error ->', {
            message: e2?.message,
            status: e2?.response?.status,
            data: e2?.response?.data ?? e2?.message,
          });
          throw e2;
        }
      }
      throw e;
    }
  },

  list: async (limit = 20) => {
    const res = await axios.get(`${BASE_URL}/transcriptions`, { params: { limit } });
    return res.data;
  },

  getById: async (id) => {
    const res = await axios.get(`${BASE_URL}/transcriptions/${id}`);
    return res.data;
  },

  remove: async (id) => {
    const res = await axios.delete(`${BASE_URL}/transcriptions/${id}`);
    return res.data;
  },
};

export default transcriptionService;
