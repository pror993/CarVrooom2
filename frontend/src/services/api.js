const API_URL = 'http://localhost:3000/api';

// Helper function to handle API responses
const handleResponse = async (response) => {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
    }

    return data;
};

// Auth API
export const authAPI = {
    signup: async (userData) => {
        try {
            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    login: async (credentials) => {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    getMe: async (token) => {
        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    logout: async (token) => {
        try {
            const response = await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
};

// User API
export const userAPI = {
    getProfile: async (token) => {
        try {
            const response = await fetch(`${API_URL}/users/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    updateProfile: async (token, profileData) => {
        try {
            const response = await fetch(`${API_URL}/users/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(profileData),
            });
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
};

// Pipeline API — Fleet Dashboard
export const pipelineAPI = {
    // Scheduler control
    getStatus: async () => {
        try {
            const response = await fetch(`${API_URL}/pipeline/status`);
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    start: async () => {
        try {
            const response = await fetch(`${API_URL}/pipeline/start`, { method: 'POST' });
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    stop: async () => {
        try {
            const response = await fetch(`${API_URL}/pipeline/stop`, { method: 'POST' });
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    reset: async (clearData = false) => {
        try {
            const response = await fetch(`${API_URL}/pipeline/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clearData }),
            });
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Fleet data
    getVehicles: async () => {
        try {
            const response = await fetch(`${API_URL}/pipeline/vehicles`);
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    getVehicle: async (vehicleId) => {
        try {
            const response = await fetch(`${API_URL}/pipeline/vehicles/${vehicleId}`);
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    getPredictions: async (vehicleId = null, limit = 50) => {
        try {
            let url = `${API_URL}/pipeline/predictions?limit=${limit}`;
            if (vehicleId) url += `&vehicleId=${vehicleId}`;
            const response = await fetch(url);
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    getCases: async (status = 'active') => {
        try {
            const response = await fetch(`${API_URL}/pipeline/cases?status=${status}`);
            return await handleResponse(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
};

export default { authAPI, userAPI, pipelineAPI };
