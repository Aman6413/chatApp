import { createContext, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import io from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
axios.defaults.baseURL = backendUrl;

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [authUser, setAuthUser] = useState(null);
  const [onlineUser, setOnlineUser] = useState([]);
  const [socket, setSocket] = useState(null);

  // ✅ SET AUTH HEADER WHEN TOKEN CHANGES
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  }, [token]);

  // ✅ CHECK AUTH ON FIRST LOAD
  useEffect(() => {
    if (token) {
      checkAuth();
    }
  }, []); // intentional empty deps

  // ---------------- CHECK AUTH ----------------
  const checkAuth = async () => {
    try {
      const { data } = await axios.get("/api/auth/check");

      if (data.success) {
        setAuthUser(data.userData);
        connectSocket(data.userData);
      }
    } catch (error) {
      setAuthUser(null);
      localStorage.removeItem("token");
    }
  };

  // ---------------- LOGIN / SIGNUP ----------------
  const login = async (state, credentials) => {
    try {
      // ✅ Decide endpoint by data, NOT UI string
      const endpoint = credentials.fullName ? "signup" : "login";

      const { data } = await axios.post(`/api/auth/${endpoint}`, credentials);

      if (data.success) {
        setToken(data.token);
        localStorage.setItem("token", data.token);

        setAuthUser(data.userData);
        connectSocket(data.userData);

        toast.success(data.message);
      } else {
        toast.error(data.error || data.message || "Authentication failed");
      }
    } catch (error) {
      toast.error(error.response?.data?.error || error.message);
    }
  };

  // ---------------- LOGOUT ----------------
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setAuthUser(null);
    setOnlineUser([]);

    if (socket) {
      socket.disconnect();
      setSocket(null);
    }

    toast.success("Logged out successfully");
  };

  // ---------------- UPDATE PROFILE ----------------
  const updateProfile = async (body) => {
    try {
      const { data } = await axios.put("/api/auth/update-profile", body);

      if (data.success) {
        setAuthUser(data.userData);
        toast.success("Profile updated successfully");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // ---------------- SOCKET ----------------
  const connectSocket = (userData) => {
    if (!userData) return;

    if (socket) socket.disconnect();

    const newSocket = io(backendUrl, {
      query: { userId: userData._id },
    });

    setSocket(newSocket);

    newSocket.on("getOnlineUsers", (userIds) => {
      setOnlineUser(userIds);
    });
  };

  return (
    <AuthContext.Provider
      value={{
        authUser,
        onlineUser,
        socket,
        login,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
