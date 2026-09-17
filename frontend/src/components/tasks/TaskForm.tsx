import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Task } from '../../types';

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  projectId: z.number(),
  assignedTo: z.number().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface TaskFormProps {
  task?: Task | null;
  projectId: number;
  users: User[];
  onSubmit: (data: TaskFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

const TaskForm = ({ task, projectId, users, onSubmit, onCancel, loading }: TaskFormProps) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title || '',
      description: task?.description || '',
      status: (task?.status as any) || 'todo',
      priority: (task?.priority as any) || 'medium',
      projectId: task?.project_id || projectId,
      assignedTo: task?.assigned_to || undefined,
    },
  });

  useEffect(() => {
    reset({
      title: task?.title || '',
      description: task?.description || '',
      status: (task?.status as any) || 'todo',
      priority: (task?.priority as any) || 'medium',
      projectId: task?.project_id || projectId,
      assignedTo: task?.assigned_to || undefined,
    });
  }, [task]);

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    marginTop: '4px',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fff',
        padding: '32px',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ margin: '0 0 24px' }}>
          {task ? 'Edit Task' : 'Create Task'}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500 }}>Title *</label>
            <input {...register('title')} placeholder="Task title" style={inputStyle} />
            {errors.title && <span style={{ color: '#e74c3c', fontSize: '12px' }}>{errors.title.message}</span>}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500 }}>Description</label>
            <textarea
              {...register('description')}
              placeholder="Task description"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: 500 }}>Status</label>
              <select {...register('status')} style={inputStyle}>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '14px', fontWeight: 500 }}>Priority</label>
              <select {...register('priority')} style={inputStyle}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500 }}>Assign To</label>
            <select
              {...register('assignedTo', {
                setValueAs: (v) => v === '' ? undefined : parseInt(v)
              })}
              style={inputStyle}
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name} ({user.email}) — {user.role}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 24px',
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 24px',
                background: loading ? '#ccc' : '#3498db',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {loading ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;