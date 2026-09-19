import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';

const signupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  tenantName: z.string().min(1, 'Organization name is required'),
  tenantSlug: z.string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, hyphens'),
});

type SignupForm = z.infer<typeof signupSchema>;

const SignupPage = () => {
  const { signup } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    try {
      setLoading(true);
      setError('');
      await signup(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 500,
  };

  return (
    <div className="auth-page" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f5'
    }}>
      <div className="auth-card" style={{
        background: '#fff',
        padding: '40px',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 24px', textAlign: 'center' }}>
          Create Account
        </h2>

        {error && (
          <div style={{
            background: '#fee',
            color: '#e74c3c',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>First Name</label>
              <input {...register('firstName')} placeholder="Alice" style={inputStyle} />
              {errors.firstName && <span style={{ color: '#e74c3c', fontSize: '12px' }}>{errors.firstName.message}</span>}
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input {...register('lastName')} placeholder="Smith" style={inputStyle} />
              {errors.lastName && <span style={{ color: '#e74c3c', fontSize: '12px' }}>{errors.lastName.message}</span>}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Email</label>
            <input {...register('email')} type="email" placeholder="alice@company.com" style={inputStyle} />
            {errors.email && <span style={{ color: '#e74c3c', fontSize: '12px' }}>{errors.email.message}</span>}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Password</label>
            <input {...register('password')} type="password" placeholder="••••••••" style={inputStyle} />
            {errors.password && <span style={{ color: '#e74c3c', fontSize: '12px' }}>{errors.password.message}</span>}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Organization Name</label>
            <input {...register('tenantName')} placeholder="Acme Corp" style={inputStyle} />
            {errors.tenantName && <span style={{ color: '#e74c3c', fontSize: '12px' }}>{errors.tenantName.message}</span>}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Organization Slug</label>
            <input {...register('tenantSlug')} placeholder="acme" style={inputStyle} />
            {errors.tenantSlug && <span style={{ color: '#e74c3c', fontSize: '12px' }}>{errors.tenantSlug.message}</span>}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#ccc' : '#2ecc71',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: '#666' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#3498db' }}>Login</Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;