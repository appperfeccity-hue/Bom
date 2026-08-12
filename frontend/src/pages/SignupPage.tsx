import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type SignupRole = 'DESIGNER' | 'CONSULTANT';

export function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SignupRole>('DESIGNER');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role },
        },
      });
      if (signUpError) throw signUpError;
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div data-testid="signup-page">
        <div data-testid="signup-success">
          <h2>Check your email</h2>
          <p>We sent a confirmation link to {email}.</p>
          <Link to="/login" data-testid="signup-back-to-login-link">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="signup-page">
      <h2>Create Account</h2>
      <form onSubmit={handleSubmit} data-testid="signup-form">
        <div>
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            data-testid="signup-email-input"
          />
        </div>
        <div>
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            data-testid="signup-password-input"
          />
        </div>
        <div>
          <label htmlFor="signup-role">Role</label>
          <select
            id="signup-role"
            value={role}
            onChange={(e) => setRole(e.target.value as SignupRole)}
            data-testid="signup-role-select"
          >
            <option value="DESIGNER">Designer</option>
            <option value="CONSULTANT">Consultant</option>
          </select>
        </div>
        {error && (
          <div data-testid="signup-error" role="alert" style={{ color: 'red' }}>
            {error}
          </div>
        )}
        <button type="submit" disabled={isSubmitting} data-testid="signup-submit-btn">
          {isSubmitting ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>
      <div>
        <Link to="/login" data-testid="signup-login-link">
          Already have an account? Sign in
        </Link>
      </div>
    </div>
  );
}
