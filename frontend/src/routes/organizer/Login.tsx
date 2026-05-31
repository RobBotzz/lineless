import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import { paths } from '../../paths';

export default function OrganizerLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where to send the user after a successful login (set by RequireAuth).
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    paths.organizer.root;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login fehlgeschlagen');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Organizer Login</h1>
      <input
        type="email"
        placeholder="E-Mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Passwort"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Anmelden…' : 'Anmelden'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
