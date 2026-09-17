export type Role = 'admin' | 'member';

export interface User {
  id: number;
  email: string;
  role: Role;
  tenantId: number;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  tenant_id: number;
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  project_id: number;
  tenant_id: number;
  assigned_to?: number;
  due_date?: string;
  created_at: string;
  updated_at: string;
  project_name?: string;
  assigned_to_email?: string;
}

export interface PaginatedTasks {
  tasks: Task[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface TaskFilters {
  status?: string;
  assignee?: string;
  projectId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  message: string;
}