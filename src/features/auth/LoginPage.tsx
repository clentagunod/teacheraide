import { Eye, EyeOff, GraduationCap } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { TrademarkFooter } from '@/components/layout/TrademarkFooter';
import { useAuth } from '@/context/AuthContext';
import { ShapeArt } from '@/features/auth/ShapeArt';
import { getErrorMessage } from '@/lib/errors';
import { isValidEmail } from '@/lib/validation';

const MAX_FAILURES = 5;
const LOCK_SECONDS = 30;

export default function LoginPage() {
  const { signIn, sendReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Client-side cool-down after repeated failures. Firebase enforces the real rate limit server-side;
  // this just discourages hammering and gives clear feedback.
  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const locked = secondsLeft > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || locked) return;
    setError(null);
    setInfo(null);

    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setBusy(true);
    try {
      await signIn(email, password, remember);
      // On success the auth listener redirects; nothing else to do here.
    } catch (err) {
      const next = failures + 1;
      if (next >= MAX_FAILURES) {
        setFailures(0);
        setSecondsLeft(LOCK_SECONDS);
      } else {
        setFailures(next);
      }
      setError(getErrorMessage(err));
      setPassword('');
      setBusy(false);
    }
  }

  async function handleReset() {
    setError(null);
    setInfo(null);
    if (!isValidEmail(email)) {
      setError('Enter your email above first, then choose “Forgot password”.');
      return;
    }
    try {
      await sendReset(email);
    } catch (err) {
      const message = getErrorMessage(err);
      if (message.startsWith('Network')) {
        setError(message);
        return;
      }
      // Any other failure is reported neutrally so the form never reveals which emails have accounts.
    }
    setInfo('If an account exists for that email, a password reset link is on its way.');
  }

  return (
    <div className="auth-page">
      <div className="auth">
        <div className="auth__card">
          <section className="auth__form-side">
            <div className="auth__brand">
              <span className="brand-mark" aria-hidden="true"><GraduationCap size={20} /></span>
              <span className="auth__brand-name">Teacher<span>.aide</span></span>
            </div>

            <h1 className="auth__title">Welcome back</h1>
            <p className="auth__subtitle">Sign in to manage attendance, tasks and deadlines.</p>

            <form onSubmit={handleSubmit} noValidate className="auth__form">
              <Field label="Email">
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                    autoFocus
                  />
                )}
              </Field>

              <Field label="Password">
                {(p) => (
                  <div className="input-wrap">
                    <input
                      {...p}
                      className="input input--with-action"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                    />
                    <button
                      type="button"
                      className="input-wrap__action"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  </div>
                )}
              </Field>

              <div className="auth__row">
                <label className="check">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>Keep me signed in</span>
                </label>
                <button type="button" className="link-btn" onClick={handleReset}>Forgot password?</button>
              </div>

              {error && <div className="banner banner--error" role="alert">{error}</div>}
              {info && <div className="banner banner--info" role="status">{info}</div>}
              {locked && <div className="banner banner--warn" role="status">Too many failed attempts. Try again in {secondsLeft}s.</div>}

              <Button type="submit" size="md" className="btn--block" loading={busy} disabled={locked}>
                Sign in
              </Button>
            </form>

            <p className="auth__foot">Accounts are created by your school administrator.</p>
          </section>

          <aside className="auth__showcase">
            <ShapeArt />
            <h2>Everything for the school day, in one calm place.</h2>
            <ul>
              <li>Take attendance in seconds</li>
              <li>Assign tasks per learner or per section</li>
              <li>Overdue work flagged automatically</li>
            </ul>
          </aside>
        </div>
      </div>
      <TrademarkFooter />
    </div>
  );
}
