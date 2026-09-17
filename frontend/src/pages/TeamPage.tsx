import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Layout from '../components/layout/Layout';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

const inviteSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters'),
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  role: z.enum(['admin', 'member']),
});

type InviteForm = z.infer<typeof inviteSchema>;

const roleColors: Record<string, string> = {
  admin: '#e74c3c',
  member: '#3498db',
};

const TeamPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'member' },
  });

  // Fetch users
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
  });

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: InviteForm) => {
      const res = await api.post('/users/invite', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      reset();
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to invite user');
    },
  });

  // Change role mutation
  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await api.patch(`/users/${id}/role`, { role });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // Remove user mutation
  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
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

  return (
    <Layout>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Team Members</h2>
        {user?.role === 'admin' && (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '10px 20px',
              background: '#2ecc71',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            + Invite Member
          </button>
        )}
      </div>

      {/* Invite Form */}
      {showForm && (
        <div style={{
          background: '#fff',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ margin: '0 0 16px' }}>Invite New Member</h3>

          {error && (
            <div style={{ background: '#fee', color: '#e74c3c', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit((data) => inviteMutation.mutate(data))}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>First Name</label>
                <input {...register('firstName')} placeholder="John" style={inputStyle} />
                {errors.firstName && <span style={{ color: '#e74c3c', fontSize: '12px' }}>{errors.firstName.message}</span>}
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 500 }}>Last Name</label>
                <input {...register('lastName')} placeholder="Doe" style={inputStyle} />
                {errors.lastName && <span style={{ color: '#e74c3c', fontSize: '12px' }}>{errors.lastName.message}</span>}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500 }}>Email</label>
              <input {...register('email')} type="email" placeholder="john@company.com" style={inputStyle} />
              {errors.email && <span style={{ color: '#e74c3c', fontSize: '12px' }}>{errors.email.message}</span>}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500 }}>Password</label>
              <input {...register('password')} type="password" placeholder="Min 8 characters" style={inputStyle} />
              {errors.password && <span style={{ color: '#e74c3c', fontSize: '12px' }}>{errors.password.message}</span>}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500 }}>Role</label>
              <select {...register('role')} style={inputStyle}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => { setShowForm(false); reset(); setError(''); }}
                style={{ padding: '10px 20px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviteMutation.isPending}
                style={{ padding: '10px 20px', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                {inviteMutation.isPending ? 'Inviting...' : 'Invite Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Loading team...</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {data?.users?.map((member: any, index: number) => (
            <div
              key={member.id}
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: index < data.users.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>
                  {member.first_name} {member.last_name}
                  {member.id === user?.id && (
                    <span style={{ color: '#888', fontSize: '12px', fontWeight: 400, marginLeft: '8px' }}>(you)</span>
                  )}
                </div>
                <div style={{ color: '#666', fontSize: '13px' }}>{member.email}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  background: roleColors[member.role] + '22',
                  color: roleColors[member.role],
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>
                  {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                </span>

                {user?.role === 'admin' && member.id !== user?.id && (
                  <>
                    <button
                      onClick={() => roleMutation.mutate({
                        id: member.id,
                        role: member.role === 'admin' ? 'member' : 'admin'
                      })}
                      style={{
                        padding: '6px 12px',
                        background: '#f39c12',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Make {member.role === 'admin' ? 'Member' : 'Admin'}
                    </button>
                    <button
                      onClick={() => removeMutation.mutate(member.id)}
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
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default TeamPage;