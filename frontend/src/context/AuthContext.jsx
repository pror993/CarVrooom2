import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Load user on mount if token exists
    useEffect(() => {
        const loadUser = async () => {
            if (token) {
                const result = await authAPI.getMe(token);
                if (result.success) {
                    setUser(result.user);
                } else {
                    // Token is invalid, clear it
                    localStorage.removeItem('token');
                    setToken(null);
                }
            }
            setLoading(false);
        };

        loadUser();
    }, [token]);

    const signup = async (userData) => {
        const result = await authAPI.signup(userData);
        if (result.success) {
            setToken(result.token);
            setUser(result.user);
            localStorage.setItem('token', result.token);
        }
        return result;
    };

    const login = async (credentials) => {
        const result = await authAPI.login(credentials);
        if (result.success) {
            setToken(result.token);
            setUser(result.user);
            localStorage.setItem('token', result.token);
        }
        return result;
    };

    const logout = async () => {
        if (token) {
            await authAPI.logout(token);
        }
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
    };

    const value = {
        user,
        token,
        loading,
        signup,
        login,
        logout,
        isAuthenticated: !!user,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
