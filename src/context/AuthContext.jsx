import { createContext, useCallback, useContext, useMemo, useState } from "react";

const AUTH_STORAGE_KEY = "cineverse_mock_auth";
const MOCK_USERNAME = "admin";
const MOCK_PASSWORD = "ea=P4D+CD4";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
    } catch {
      return null;
    }
  });

  const login = useCallback(({ username, password }) => {
    if (username !== MOCK_USERNAME || password !== MOCK_PASSWORD) {
      return false;
    }

    const nextUser = { username: MOCK_USERNAME };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoggedIn: Boolean(user),
      login,
      logout,
    }),
    [login, logout, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return auth;
};
