import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password reset failed';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div data-testid="forgot-password-page">
        <div data-testid="forgot-password-success">
          <h2>Check your email</h2>
          <p>We sent a password reset link to {email}.</p>
          <Link to="/login" data-testid="forgot-password-back-to-login-link">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="forgot-password-page">
      <h2>Reset Password</h2>
      <form onSubmit={handleSubmit} data-testid="forgot-password-form">
        <div>
          <label htmlFor="reset-email">Email</label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            data-testid="forgot-password-email-input"
          />
        </div>
        {error && (
          <div data-testid="forgot-password-error" role="alert" style={{ color: 'red' }}>
            {error}
          </div>
        )}
        <button type="submit" disabled={isSubmitting} data-testid="forgot-password-submit-btn">
          {isSubmitting ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
      <div>
        <Link to="/login" data-testid="forgot-password-login-link">
          Back to login
        </Link>
      </div>
    </div>
  );
}
