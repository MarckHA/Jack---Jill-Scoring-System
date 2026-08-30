import axios from 'axios';

export const api = axios.create({
    baseURL: 'https://jack-jill-api.onrender.com/api', // Apunta a tu servidor de Node
    withCredentials: true, // ¡Vital para que funcionen las cookies!
});