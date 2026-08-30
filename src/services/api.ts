import axios from 'axios';

export const api = axios.create({
    baseURL: 'https://jack-jill-api.onrender.com/api', 
    withCredentials: true, 
});

// Intercepta cada petición antes de que salga y le pega el Token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token'); 
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});