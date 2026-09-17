import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Layout from '../components/layout/Layout';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

const statusColors: Record<string, string> = {
  todo: '#f39c12',
  in_progress: '#3498db',
  done: '#2ecc71',
};

const priorityColors: Record<string, string> = {
  low: '#95a5a6',
  medium: '#e67e22',
  high: '#e74c3c',
};

const ProjectsPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [error, setError] = useState('');

  const { register, handleSubmit, reset } = useForm();

  // Fetch projects
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data;
    },
  });

  // Fetch users
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
  });

  // Fetch project detail (members + tasks)
  const { data: projectDetail } = useQuery({
    queryKey: ['project', selectedProject?.id],
    queryFn: async () => {
      const res = await api.get(`/projects/${selectedProject.id}`);
      return res.data;
    },
    enabled: !!selectedProject,
  });

  // Fetch tasks for selected project
  const { data: tasksData } = useQuery({
    queryKey: ['tasks', { projectId: selectedProject?.id }],
    queryFn: async () => {
      const res = await api.get(`/tasks?projectId=${selectedProject.id}&limit=50`);
      return res.data;
    },
    enabled: !!selectedProject,
  });

  // Create project
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/projects', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreateForm(false);
      reset();
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create project');
    },
  });

  // Delete project
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSelectedProject(null);
    },
  });

  // Add member
  const addMemberMutation = useMutation({
    mutationFn: async ({ projectId, userId }: { projectId: number; userId: number }) => {
      const res = await api.post(`/projects/${projectId}/members`, { userId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', selectedProject?.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: async ({ projectId, userId }: { projectId: number; userId: number }) => {
      await api.delete(`/projects/${projectId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', selectedProject?.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    marginTop: '4px',
  };

  const members = projectDetail?.members || [];
  const memberIds = members.map((m: any) => m.id);
  const nonMembers = usersData?.users?.filter((u: any) => !memberIds.includes(u.id)) || [];
  const tasks = tasksData?.tasks || [];

  return (
    <Layout>
      <div style={{ display: 'flex', gap: '24px' }}>

        {/* LEFT: Projects List */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Projects</h2>
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                style={{
                  padding: '10px 20px',
                  background: '#3498db',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                + New Project
              </button>
            )}
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div style={{
              background: '#fff',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
              <h3 style={{ margin: '0 0 16px' }}>Create Project</h3>
              {error && (
                <div style={{ background: '#fee', color: '#e74c3c', padding: '10px', borderRadius: '6px', marginBottom: '12px', fontSize: '14px' }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Project Name *</label>
                  <input {...register('name', { required: true })} placeholder="Website Redesign" style={inputStyle} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500 }}>Description</label>
                  <textarea {...register('description')} placeholder="Project description" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => { setShowCreateForm(false); reset(); setError(''); }}
                    style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    style={{ padding: '8px 16px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Projects List */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Loading projects...</div>
          ) : projectsData?.projects?.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px', color: '#888',
              background: '#fff', borderRadius: '12px', border: '2px dashed #ddd',
            }}>
              <p>No projects yet!</p>
              {user?.role === 'admin' && <p style={{ fontSize: '14px' }}>Create your first project above.</p>}
            </div>
          ) : (
            projectsData?.projects?.map((project: any) => (
              <div
                key={project.id}
                onClick={() => setSelectedProject(project)}
                style={{
                  background: selectedProject?.id === project.id ? '#ebf5fb' : '#fff',
                  border: selectedProject?.id === project.id ? '2px solid #3498db' : '1px solid #eee',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>{project.name}</h3>
                    {project.description && (
                      <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#666' }}>{project.description}</p>
                    )}
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      {project.member_count} member{project.member_count !== '1' ? 's' : ''}
                    </span>
                  </div>
                  {user?.role === 'admin' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(project.id); }}
                      style={{
                        padding: '6px 12px',
                        background: '#e74c3c',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* RIGHT: Project Detail */}
        {selectedProject && (
          <div style={{ width: '380px' }}>
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '17px' }}>
                {selectedProject.name}
              </h3>

              {/* TASKS SECTION */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{
                  margin: '0 0 10px',
                  fontSize: '12px',
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Tasks ({tasks.length})
                </h4>

                {tasks.length === 0 ? (
                  <p style={{ color: '#aaa', fontSize: '13px', fontStyle: 'italic' }}>
                    No tasks in this project yet
                  </p>
                ) : (
                  tasks.map((task: any) => (
                    <div
                      key={task.id}
                      style={{
                        padding: '10px 12px',
                        background: '#f9f9f9',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        borderLeft: `3px solid ${statusColors[task.status] || '#ddd'}`,
                      }}
                    >
                      <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '4px' }}>
                        {task.title}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: statusColors[task.status] + '22',
                          color: statusColors[task.status],
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}>
                          {task.status === 'in_progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                        </span>
                        {task.priority && (
                          <span style={{
                            background: priorityColors[task.priority] + '22',
                            color: priorityColors[task.priority],
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 500,
                          }}>
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </span>
                        )}
                        {task.assigned_to_email && (
                          <span style={{
                            background: '#f0f0f0',
                            color: '#555',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                          }}>
                            👤 {task.assigned_to_email}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* DIVIDER */}
              <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '0 0 20px' }} />

              {/* MEMBERS SECTION */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{
                  margin: '0 0 10px',
                  fontSize: '12px',
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Members ({members.length})
                </h4>
                {members.length === 0 ? (
                  <p style={{ color: '#aaa', fontSize: '13px' }}>No members yet</p>
                ) : (
                  members.map((member: any) => (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px',
                        background: '#f9f9f9',
                        borderRadius: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>
                          {member.first_name} {member.last_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>{member.email}</div>
                      </div>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => removeMemberMutation.mutate({
                            projectId: selectedProject.id,
                            userId: member.id,
                          })}
                          style={{
                            padding: '4px 10px',
                            background: '#e74c3c',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* ADD MEMBERS */}
              {user?.role === 'admin' && nonMembers.length > 0 && (
                <div>
                  <h4 style={{
                    margin: '0 0 10px',
                    fontSize: '12px',
                    color: '#888',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Add Members
                  </h4>
                  {nonMembers.map((u: any) => (
                    <div
                      key={u.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px',
                        background: '#f0fff4',
                        borderRadius: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>
                          {u.first_name} {u.last_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>{u.email}</div>
                      </div>
                      <button
                        onClick={() => addMemberMutation.mutate({
                          projectId: selectedProject.id,
                          userId: u.id,
                        })}
                        style={{
                          padding: '4px 10px',
                          background: '#2ecc71',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProjectsPage;