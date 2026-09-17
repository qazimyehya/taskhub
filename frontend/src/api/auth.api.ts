import api from './axios';
import type { AuthResponse } from '../types';

export const signup = async (data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
  tenantSlug: string;
}): Promise<AuthResponse> => {
  const response = await api.post('/auth/signup', data);
  return response.data;
};

export const login = async (data: {
  email: string;
  password: string;
  tenantSlug: string;
}): Promise<AuthResponse> => {
  const response = await api.post('/auth/login', data);
  return response.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const refreshToken = async (): Promise<{ accessToken: string }> => {
  const response = await api.post('/auth/refresh');
  return response.data;
};