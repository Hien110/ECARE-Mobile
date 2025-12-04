import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import userService from "../userService";

export const BASE_URL = "http://172.26.106.33:3000/api";

// ===== Token storage (in-memory + AsyncStorage) =====
const TOKEN_KEY = "ecare_token";
let inMemoryToken = null;

export async function getAPIToken() {
  if (inMemoryToken) return inMemoryToken;
  const t = await AsyncStorage.getItem(TOKEN_KEY);
  inMemoryToken = t;
  return t;
}

// Tạo instance axios

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Gắn Authorization mỗi request
api.interceptors.request.use(
  async (config) => {
    const token = await userService.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// (tuỳ chọn) Nếu 401 có thể auto-logout tại đây
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // if (error?.response?.status === 401) {
    //   await setAPIToken(null);
    //   await setSavedUser(null);
    // }
    return Promise.reject(error);
  }
);

export default api;
export { api };