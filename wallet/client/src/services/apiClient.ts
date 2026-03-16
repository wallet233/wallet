import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

// Base URL from environment or default
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

/**
 * Create a reusable axios instance for all API calls
 * Handles base URL, timeouts, headers, and can include auth token
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, // 15 seconds
  headers: {
    "Content-Type": "application/json",
  },
});

// Optional: Request interceptor (e.g., add auth token dynamically)
apiClient.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const token = localStorage.getItem("walletAuthToken"); // or from state
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Optional: Response interceptor (centralized error handling)
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    console.error("API call failed:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default apiClient;
