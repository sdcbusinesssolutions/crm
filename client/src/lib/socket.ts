import { io } from 'socket.io-client';
import { AppConfig } from '../AppConfig';

const SOCKET_URL = AppConfig.VITE_CLIENT_URL;

export const socket = io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true,
    transports: ['websocket', 'polling']
});
