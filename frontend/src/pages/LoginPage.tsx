import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-testid="login-page">
      <h2>Sign In</h2>
      <form onSubmit={handleSubmit} data-testid="login-form">
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            data-testid="login-email-input"
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            minLength={6}
            data-testid="login-password-input"
          />
        </div>
        {error && (
          <div data-testid="login-error" role="alert" style={{ color: 'red' }}>
            {error}
          </div>
        )}
        <button type="submit" disabled={isSubmitting} data-testid="login-submit-btn">
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <div>
        <Link to="/signup" data-testid="login-signup-link">
          Don&apos;t have an account? Sign up
        </Link>
      </div>
      <div>
        <Link to="/forgot-password" data-testid="login-forgot-password-link">
          Forgot password?
        </Link>
      </div>
    </div>
  );
}
