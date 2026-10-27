import React, { useState } from 'react';
import { HardHat, Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { Button } from '../common/Button';

export const LoginPage: React.FC = () => {
  const { login, error, clearError, isLoading } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState('admin@constructcorp.com');
  const [password, setPassword] = useState('Admin@2026!Stock');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!usernameOrEmail.trim() || !password) {
      setLocalError('Please enter both your username or email and password.');
      return;
    }

    try {
      await login(usernameOrEmail.trim(), password);
    } catch (err: unknown) {
      // Error handled via AuthContext error state
    }
  };

  const handleQuickFill = (email: string, pass: string) => {
    setUsernameOrEmail(email);
    setPassword(pass);
    setLocalError(null);
    clearError();
  };

  const activeError = localError || error;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--color-bg-page)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}
      >
        {/* Header Ribbon */}
        <div
          style={{
            backgroundColor: 'var(--color-charcoal-900)',
            padding: 'var(--space-6) var(--space-6)',
            color: '#FFFFFF',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              backgroundColor: 'var(--color-orange-500)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-3) auto',
              boxShadow: '0 4px 12px rgba(221, 107, 32, 0.4)',
            }}
          >
            <HardHat size={28} color="#FFFFFF" />
          </div>
          <h1 style={{ fontSize: 'var(--font-size-lg)', color: '#FFFFFF', fontWeight: 700 }}>
            STRUCTSTOCK
          </h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-orange-300)', marginTop: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Enterprise Inventory & Access Control
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: 'var(--space-6)' }}>
          <div style={{ marginBottom: 'var(--space-4)', textAlign: 'center' }}>
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-charcoal-900)' }}>
              Sign In to Your Workspace
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', marginTop: 2 }}>
              Authorized personnel credentials and project scope verification
            </p>
          </div>

          {activeError && (
            <div
              className="alert alert-danger"
              style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-xs)' }}
              role="alert"
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{activeError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label required" htmlFor="login-username">
                Username or Corporate Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-username"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="e.g. admin@constructcorp.com"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
                <User
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-charcoal-500)',
                  }}
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="login-password">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-charcoal-500)',
                  }}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-charcoal-500)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              style={{ width: '100%', marginTop: 'var(--space-3)' }}
              isLoading={isLoading}
              icon={<ArrowRight size={16} />}
              iconPosition="right"
            >
              Sign In to StructStock
            </Button>
          </form>

          {/* Quick-fill Role Switcher for verification */}
          <div
            style={{
              marginTop: 'var(--space-6)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'var(--color-charcoal-600)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-2)',
              }}
            >
              Quick Test Credentials (RBAC Verification):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickFill('admin@constructcorp.com', 'Admin@2026!Stock')}
                title="Super Admin: Full user administration & configuration"
                style={{ justifyContent: 'flex-start', fontSize: '0.6875rem' }}
              >
                <span className="badge-dot" style={{ backgroundColor: 'var(--color-orange-500)' }} />
                Super Admin
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickFill('inv.manager@constructcorp.com', 'Manager@2026!Inv')}
                title="Inventory Manager: Global visibility"
                style={{ justifyContent: 'flex-start', fontSize: '0.6875rem' }}
              >
                <span className="badge-dot" style={{ backgroundColor: '#38A169' }} />
                Inv Manager
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickFill('pm.metro@constructcorp.com', 'Project@2026!Metro')}
                title="Project Manager: Scoped to Metro Station"
                style={{ justifyContent: 'flex-start', fontSize: '0.6875rem' }}
              >
                <span className="badge-dot" style={{ backgroundColor: '#319795' }} />
                Project Mgr
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickFill('store.north@constructcorp.com', 'Store@2026!Keeper')}
                title="Storekeeper: Scoped to Metro North Store"
                style={{ justifyContent: 'flex-start', fontSize: '0.6875rem' }}
              >
                <span className="badge-dot" style={{ backgroundColor: '#D69E2E' }} />
                Storekeeper
              </button>
            </div>
            <div style={{ marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => handleQuickFill('disabled.user@constructcorp.com', 'Disabled@2026!Test')}
                title="Test disabled account handling (403 Forbidden)"
                style={{ width: '100%', fontSize: '0.6875rem', color: 'var(--color-danger-text)' }}
              >
                Test Inactive Account (Disabled Personnel)
              </button>
            </div>
          </div>
        </div>

        {/* Security Footer */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-6)',
            backgroundColor: 'var(--color-charcoal-100)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-subtle)',
          }}
        >
          <ShieldCheck size={14} style={{ color: '#38A169' }} />
          <span>PBKDF2 SHA-256 Hashing & Short-Lived JWT Protection</span>
        </div>
      </div>
    </div>
  );
};
