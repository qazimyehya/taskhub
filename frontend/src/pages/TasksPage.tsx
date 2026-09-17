import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Layout from '../components/layout/Layout';
import TaskCard from '../components/tasks/TaskCard';
import TaskForm from '../components/tasks/TaskForm';
import TaskFilters from '../components/tasks/TaskFilters';
import SearchInput from '../components/tasks/SearchInput';
import { getTasks, createTask, updateTask, deleteTask } from '../api/tasks.api';
import { getProjects } from '../api/projects.api';
import type { Task, TaskFilters as ITaskFilters } from '../types';
import useDebounce from '../hooks/useDebounce';

const TasksPage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  const filters: ITaskFilters = {
    search: debouncedSearch,
    status: status || undefined,
    page,
    limit: 10,
  };

  // Fetch tasks
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => getTasks(filters),
    placeholderData: keepPreviousData,
  });

  // Fetch projects for form
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const defaultProjectId = projectsData?.projects[0]?.id || 0;

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: createTask,
    onMutate: async (newTask) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData(['tasks', filters]);

      queryClient.setQueryData(['tasks', filters], (old: any) => ({
        ...old,
        tasks: [
          {
            id: Date.now(),
            ...newTask,
            project_id: newTask.projectId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tenant_id: 0,
          },
          ...(old?.tasks || []),
        ],
      }));

      return { previous };
    },
    onError: (_err, _variables, context) => {
      // Roll back on error
      queryClient.setQueryData(['tasks', filters], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowForm(false);
    },
  });

  // Update task mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateTask(id, data),
    onMutate: async ({ id, data }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData(['tasks', filters]);

      queryClient.setQueryData(['tasks', filters], (old: any) => ({
        ...old,
        tasks: old?.tasks?.map((t: Task) =>
          t.id === id ? { ...t, ...data } : t
        ),
      }));

      return { previous };
    },
    onError: (_err, _variables, context) => {
      // Roll back on error
      queryClient.setQueryData(['tasks', filters], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditingTask(null);
    },
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onMutate: async (id) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData(['tasks', filters]);

      queryClient.setQueryData(['tasks', filters], (old: any) => ({
        ...old,
        tasks: old?.tasks?.filter((t: Task) => t.id !== id),
      }));

      return { previous };
    },
    onError: (_err, _variables, context) => {
      // Roll back on error
      queryClient.setQueryData(['tasks', filters], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleSubmit = (formData: any) => {
    if (editingTask) {
      updateMutation.mutate({
        id: editingTask.id,
        data: {
          title: formData.title,
          description: formData.description,
          status: formData.status,
          priority: formData.priority,
        },
      });
    } else {
      createMutation.mutate({
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        projectId: formData.projectId || defaultProjectId,
      });
    }
  };

  const pagination = data?.pagination;

  return (
    <Layout>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '24px' }}>Tasks</h2>
        <button
          onClick={() => { setEditingTask(null); setShowForm(true); }}
          style={{
            padding: '10px 20px',
            background: '#3498db',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          + New Task
        </button>
      </div>

      {/* Search and Filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput onSearch={setSearch} />
        <TaskFilters status={status} onStatusChange={(s) => { setStatus(s); setPage(1); }} />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          Loading tasks...
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div style={{
          background: '#fee',
          color: '#e74c3c',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
        }}>
          Error loading tasks: {(error as any)?.message || 'Something went wrong'}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && data?.tasks?.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          color: '#888',
          background: '#fff',
          borderRadius: '12px',
          border: '2px dashed #ddd',
        }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>No tasks found</p>
          <p style={{ fontSize: '14px' }}>
            {search || status ? 'Try changing your filters' : 'Create your first task!'}
          </p>
        </div>
      )}

      {/* Task List */}
      {data?.tasks?.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onEdit={(t) => { setEditingTask(t); setShowForm(true); }}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      ))}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              background: page === 1 ? '#f5f5f5' : '#fff',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Previous
          </button>
          <span style={{ padding: '8px 16px', color: '#666', fontSize: '14px' }}>
            Page {page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              background: page === pagination.totalPages ? '#f5f5f5' : '#fff',
              cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Task Form Modal */}
      {showForm && (
        <TaskForm
          task={editingTask}
          projectId={defaultProjectId}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingTask(null); }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </Layout>
  );
};

export default TasksPage;