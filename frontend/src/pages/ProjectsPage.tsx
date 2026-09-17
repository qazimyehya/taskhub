import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Layout from '../components/layout/Layout';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

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

  // Fetch project members when project selected
  const { data: projectDetail } = useQuery({
    queryKey: ['project', selectedProject?.id],
    queryFn: async () => {
      const res = await api.get(`/projects/${selectedProject.id}`);
      return res.data;
    },
    enabled: !!selectedProject,
  });

  // Create project mutation
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

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSelectedProject(null);
    },
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async ({ projectId, userId }: { projectId: number; userId: number }) => {
      const res = await api.post(`/projects/${projectId}/members`, { userId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', selectedProject?.id] });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ projectId, userId }: { projectId: number; userId: number }) => {
      await api.delete(`/projects/${projectId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', selectedProject?.id] });
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

        {/* RIGHT: Project Members */}
        {selectedProject && (
          <div style={{ width: '350px' }}>
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <h3 style={{ margin: '0 0 16px' }}>
                {selectedProject.name} — Members
              </h3>

              {/* Current Members */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#888', textTransform: 'uppercase' }}>
                  Current Members ({members.length})
                </h4>
                {members.length === 0 ? (
                  <p style={{ color: '#888', fontSize: '13px' }}>No members yet</p>
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

              {/* Add Members (admin only) */}
              {user?.role === 'admin' && nonMembers.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#888', textTransform: 'uppercase' }}>
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