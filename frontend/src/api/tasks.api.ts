import api from './axios';
import type { Task, PaginatedTasks, TaskFilters } from '../types';

export const getTasks = async (filters: TaskFilters): Promise<PaginatedTasks> => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.assignee) params.append('assignee', filters.assignee);
  if (filters.projectId) params.append('projectId', filters.projectId);
  if (filters.search) params.append('search', filters.search);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());

  const response = await api.get(`/tasks?${params.toString()}`);
  return response.data;
};

export const createTask = async (data: {
  title: string;
  description?: string;
  status: string;
  priority?: string;
  projectId: number;
  assignedTo?: number;
  dueDate?: string;
}): Promise<{ task: Task }> => {
  const response = await api.post('/tasks', data);
  return response.data;
};

export const updateTask = async (
  id: number,
  data: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    assignedTo: number;
    dueDate: string;
  }>
): Promise<{ task: Task }> => {
  const response = await api.patch(`/tasks/${id}`, data);
  return response.data;
};

export const deleteTask = async (id: number): Promise<void> => {
  await api.delete(`/tasks/${id}`);
};