import api from './axios';
import type { Project } from '../types';

export const getProjects = async (): Promise<{ projects: Project[] }> => {
  const response = await api.get('/projects');
  return response.data;
};

export const createProject = async (data: {
  name: string;
  description?: string;
}): Promise<{ project: Project }> => {
  const response = await api.post('/projects', data);
  return response.data;
};