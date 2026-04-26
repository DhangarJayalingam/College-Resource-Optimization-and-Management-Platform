import { FormEvent, useMemo, useState } from 'react';
import { Chrome, Facebook, GraduationCap, Linkedin, Lock, Mail, ShieldCheck, Twitter, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
  forgotPassword,
  login,
  registerSelf,
  resetPassword,
  sendVerificationCode,
  socialLogin
} from '../services/api';
import '../styles/auth.css';

type AuthMode = 'signin' | 'signup' | 'forgot';

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score += 1;

  const labelByScore = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  return {
    score,
    label: labelByScore[Math.min(score, 5)],
    widthPercent: `${Math.min(score, 5) * 20}%`
  };
}

export function LoginPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupCode, setSignupCode] = useState('');

  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');

  const signupStrength = useMemo(() => passwordStrength(signupPassword), [signupPassword]);
  const resetStrength = useMemo(() => passwordStrength(resetNewPassword), [resetNewPassword]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      setError('');
      setInfo('');
      await login(email, password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : `${t('login.signIn', 'Sign In')} failed.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendSignupCode() {
    if (!signupEmail) {
      setError('Enter signup email to receive verification code.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const response = await sendVerificationCode({
        email: signupEmail,
        fullName: signupName,
        purpose: 'REGISTRATION'
      });
      setSignupCode(response.demoCode);
      setInfo(`Verification code sent. Demo code: ${response.demoCode} (valid ${response.expiresInMinutes} min).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send verification code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(event: FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      setError('');
      setInfo('');
      await registerSelf({
        fullName: signupName,
        email: signupEmail,
        password: signupPassword,
        verificationCode: signupCode
      });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : `${t('login.signUp', 'Sign Up')} failed.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendResetCode() {
    if (!resetEmail) {
      setError('Enter your account email first.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const response = await forgotPassword(resetEmail);
      setResetCode(response.demoCode);
      setInfo(`Reset code sent. Demo code: ${response.demoCode} (valid ${response.expiresInMinutes} min).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event: FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      setError('');
      const message = await resetPassword({
        email: resetEmail,
        verificationCode: resetCode,
        newPassword: resetNewPassword
      });
      setInfo(message);
      setMode('signin');
      setPassword('');
      setEmail(resetEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${t('login.resetPassword', 'Reset Password')} failed.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialLogin(provider: 'GOOGLE' | 'LINKEDIN') {
    try {
      setLoading(true);
      setError('');
      setInfo('');

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1';
      const authorizePath = provider === 'GOOGLE'
        ? '/auth/oauth2/authorize/google'
        : '/auth/oauth2/authorize/linkedin';

      // Redirect to backend OAuth authorization endpoint
      window.location.href = `${apiBaseUrl}${authorizePath}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : `${provider} login failed.`);
      setLoading(false);
    }
  }

  return (
    <div className="codehal-page">
      <div className="background" />

      <main className="container">
        <section className="content">
          <h2 className="logo">
            <GraduationCap size={24} />
            Codehal
          </h2>

          <div className="text-sci">
            <h2>
              {t('login.welcome', 'Welcome!')}
              <br />
              <span>{t('login.welcomeSubtitle', 'To College Resource Optimization.')}</span>
            </h2>
            <p>{t('login.welcomeBody', 'Managed by Principal & HODs. Login with your Real Name identity and verified credentials.')}</p>
            <div className="social-icons">
              <a href="#" aria-label="LinkedIn">
                <Linkedin size={18} />
              </a>
              <a href="#" aria-label="Facebook">
                <Facebook size={18} />
              </a>
              <a href="#" aria-label="Twitter">
                <Twitter size={18} />
              </a>
            </div>
          </div>
        </section>

        <section className="logreg-box">
          <div className="form-box login">
            {mode === 'signin' ? (
              <form onSubmit={handleLogin}>
                <h2>{t('login.signIn', 'Sign In')}</h2>
                <div className="input-box">
                  <span className="icon">
                    <Mail size={16} />
                  </span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                  <label>{t('login.loginEmail', 'Login Email / Real Identity')}</label>
                </div>

                <div className="input-box">
                  <span className="icon">
                    <Lock size={16} />
                  </span>
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                  <label>{t('login.password', 'Password')}</label>
                </div>

                <div className="remember-forgot">
                  <label>
                    <input type="checkbox" />
                    {t('login.rememberMe', 'Remember me')}
                  </label>
                  <button
                    type="button"
                    className="ghost-link"
                    onClick={() => {
                      setMode('forgot');
                      setResetEmail(email);
                      setError('');
                      setInfo('');
                    }}
                  >
                    {t('login.forgotPassword', 'Forgot password?')}
                  </button>
                </div>

                <button type="submit" className="btn" disabled={loading}>
                  {loading ? t('login.signingIn', 'Signing In...') : t('login.signIn', 'Sign In')}
                </button>

                <div className="social-login">
                  <p>{t('login.orContinue', 'or continue with')}</p>
                  <div className="social-btn-row">
                    <button type="button" className="social-btn" onClick={() => handleSocialLogin('GOOGLE')}>
                      <Chrome size={16} />
                      Google
                    </button>
                    <button type="button" className="social-btn" onClick={() => handleSocialLogin('LINKEDIN')}>
                      <Linkedin size={16} />
                      LinkedIn
                    </button>
                  </div>
                </div>

                <div className="login-register">
                  <p>
                    {t('login.noAccount', "Don't have an account?")}{' '}
                    <button
                      type="button"
                      className="ghost-link"
                      onClick={() => {
                        setMode('signup');
                        setError('');
                        setInfo('');
                      }}
                    >
                      {t('login.signUp', 'Sign Up')}
                    </button>
                  </p>
                </div>
              </form>
            ) : mode === 'signup' ? (
              <form onSubmit={handleSignup}>
                <h2>{t('login.signUp', 'Sign Up')}</h2>
                <div className="input-box">
                  <span className="icon">
                    <UserRound size={16} />
                  </span>
                  <input
                    type="text"
                    value={signupName}
                    onChange={(event) => setSignupName(event.target.value)}
                    required
                  />
                  <label>{t('login.realFullName', 'Real Full Name')}</label>
                </div>

                <div className="input-box">
                  <span className="icon">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(event) => setSignupEmail(event.target.value)}
                    required
                  />
                  <label>{t('login.email', 'Email')}</label>
                </div>

                <div className="input-box">
                  <span className="icon">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(event) => setSignupPassword(event.target.value)}
                    required
                  />
                  <label>{t('login.password', 'Password')}</label>
                </div>
                <div className="password-strength">
                  <div className="password-strength-track">
                    <span style={{ width: signupStrength.widthPercent }} />
                  </div>
                  <p>
                    <ShieldCheck size={14} />
                    {signupStrength.label}
                  </p>
                </div>

                <div className="input-box">
                  <span className="icon">
                    <ShieldCheck size={16} />
                  </span>
                  <input
                    type="text"
                    value={signupCode}
                    onChange={(event) => setSignupCode(event.target.value)}
                    required
                  />
                  <label>{t('login.verificationCode', 'Email Verification Code')}</label>
                </div>

                <div className="dual-actions">
                  <button type="button" className="btn secondary" onClick={handleSendSignupCode} disabled={loading}>
                    {t('login.sendCode', 'Send Code')}
                  </button>
                  <button type="submit" className="btn" disabled={loading}>
                    {loading ? t('login.creating', 'Creating...') : t('login.createAccount', 'Create Account')}
                  </button>
                </div>

                <div className="login-register">
                  <p>
                    {t('login.haveAccount', 'Already have an account?')}{' '}
                    <button
                      type="button"
                      className="ghost-link"
                      onClick={() => {
                        setMode('signin');
                        setError('');
                        setInfo('');
                      }}
                    >
                      {t('login.signIn', 'Sign In')}
                    </button>
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                <h2>{t('login.resetPassword', 'Reset Password')}</h2>

                <div className="input-box">
                  <span className="icon">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                    required
                  />
                  <label>{t('login.email', 'Email')}</label>
                </div>

                <div className="input-box">
                  <span className="icon">
                    <ShieldCheck size={16} />
                  </span>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(event) => setResetCode(event.target.value)}
                    required
                  />
                  <label>{t('login.resetVerificationCode', 'Reset Verification Code')}</label>
                </div>

                <div className="input-box">
                  <span className="icon">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    value={resetNewPassword}
                    onChange={(event) => setResetNewPassword(event.target.value)}
                    required
                  />
                  <label>{t('login.newPassword', 'New Password')}</label>
                </div>
                <div className="password-strength">
                  <div className="password-strength-track">
                    <span style={{ width: resetStrength.widthPercent }} />
                  </div>
                  <p>
                    <ShieldCheck size={14} />
                    {resetStrength.label}
                  </p>
                </div>

                <div className="dual-actions">
                  <button type="button" className="btn secondary" onClick={handleSendResetCode} disabled={loading}>
                    {t('login.sendCode', 'Send Code')}
                  </button>
                  <button type="submit" className="btn" disabled={loading}>
                    {loading ? 'Resetting...' : t('login.resetPassword', 'Reset Password')}
                  </button>
                </div>

                <div className="login-register">
                  <p>
                    {t('login.backTo', 'Back to')}{' '}
                    <button
                      type="button"
                      className="ghost-link"
                      onClick={() => {
                        setMode('signin');
                        setError('');
                        setInfo('');
                      }}
                    >
                      {t('login.signIn', 'Sign In')}
                    </button>
                  </p>
                </div>
              </form>
            )}

            {(error || info) ? <div className={`alert-box ${error ? 'error' : 'info'}`}>{error || info}</div> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
