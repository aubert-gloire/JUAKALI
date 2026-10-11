import { api } from './api';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const aiApi = {
  chat: (message: string, history: ChatMessage[]) =>
    api.post<{ reply: string }>('/ai/chat', { message, history }),
};
