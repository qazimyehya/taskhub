import { useAuthStore } from '../store/authStore';
import { login, signup, logout } from '../api/auth.api';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export const useAuth = () => {
  const { user, accessToken, tenantName, setAuth, clearAuth, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleLogin = async (data: {
    email: string;
    password: string;
    tenantSlug: string;
  }) => {
    const response = await login(data);
    setAuth(response.user, response.accessToken);
    // Clear ALL cached data from previous session
    queryClient.clear();
    navigate('/tasks');
    return response;
  };

  const handleSignup = async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    tenantName: string;
    tenantSlug: string;
  }) => {
    const response = await signup(data);
    setAuth(response.user, response.accessToken, data.tenantName);
    queryClient.clear();
    navigate('/tasks');
    return response;
  };

  const handleLogout = async () => {
    await logout();
    clearAuth();
    // Clear ALL cached data on logout
    queryClient.clear();
    navigate('/login');
  };

  return {
    user,
    accessToken,
    tenantName,
    isAuthenticated: isAuthenticated(),
    login: handleLogin,
    signup: handleSignup,
    logout: handleLogout,
  };
};