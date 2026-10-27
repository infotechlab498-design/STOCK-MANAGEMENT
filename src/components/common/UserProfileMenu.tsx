import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Users, Settings, ChevronDown, Shield, Building } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { useNavigate } from 'react-router-dom';

export const UserProfileMenu: React.FC = () => {
  const { user, switchRoleProfile, hasRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  const initials = user.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2);

  const primaryRole = user.roles?.[0] || 'Viewer';
  const isSuperAdminOrManager = hasRole(['SuperAdmin', 'InventoryManager']);

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          background: 'none',
          border: 'none',
          padding: '4px 6px',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        className="user-profile-summary"
        title={`${user.fullName} (${primaryRole})`}
      >
        <div className="user-avatar" style={{ backgroundColor: 'var(--color-charcoal-800)' }}>
          {initials}
        </div>
        <div className="user-meta hide-on-mobile">
          <span className="user-name">{user.fullName}</span>
          <span
            className="user-role"
            style={{ color: 'var(--color-orange-600)', fontWeight: 600 }}
          >
            {primaryRole}
          </span>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--color-charcoal-500)' }} className="hide-on-mobile" />
      </button>

      {isOpen && (
        <div className="dropdown-menu" role="menu" style={{ width: 260 }}>
          <div className="dropdown-header">
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-charcoal-900)' }}>
              {user.fullName}
            </div>
            <div className="td-mono" style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)', marginTop: 2 }}>
              {user.email}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 'var(--space-1-5)', flexWrap: 'wrap' }}>
              {user.roles.map((r) => (
                <span
                  key={r}
                  style={{
                    fontSize: '0.625rem',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-orange-100)',
                    color: 'var(--color-orange-800)',
                    border: '1px solid var(--color-orange-300)',
                    fontWeight: 600,
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          <div className="dropdown-body">
            <div
              style={{
                padding: 'var(--space-2) var(--space-4)',
                fontSize: '0.6875rem',
                color: 'var(--color-text-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <Building size={12} />
              <span>
                {user.projectScopes.length > 0
                  ? `Assigned to ${user.projectScopes.length} projects`
                  : 'Global project visibility'}
              </span>
            </div>

            <div className="dropdown-divider" />

            {isSuperAdminOrManager && (
              <button
                type="button"
                className="dropdown-item"
                onClick={() => handleNavigate('/users')}
              >
                <Users size={16} />
                <span>Users & Access Control</span>
              </button>
            )}

            <button
              type="button"
              className="dropdown-item"
              onClick={() => handleNavigate('/settings')}
            >
              <Settings size={16} />
              <span>System Settings</span>
            </button>

            <button
              type="button"
              className="dropdown-item"
              onClick={() => handleNavigate('/architecture')}
            >
              <Shield size={16} />
              <span>Architecture & Tokens</span>
            </button>

            <div className="dropdown-divider" />

            <div
              style={{
                padding: 'var(--space-1-5) var(--space-4)',
                fontSize: '0.625rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-subtle)',
              }}
            >
              Switch Active Role (Bypass Mode)
            </div>
            {[
              { label: 'Super Admin', email: 'admin@constructcorp.com' },
              { label: 'Inventory Manager', email: 'inv.manager@constructcorp.com' },
              { label: 'Project Manager', email: 'pm.metro@constructcorp.com' },
              { label: 'Storekeeper', email: 'store.north@constructcorp.com' },
              { label: 'Procurement Officer', email: 'procurement@constructcorp.com' },
              { label: 'Accounts Officer', email: 'accounts@constructcorp.com' },
            ].map((roleOpt) => (
              <button
                key={roleOpt.email}
                type="button"
                className="dropdown-item"
                style={{
                  fontSize: '0.75rem',
                  padding: '0.35rem var(--space-4)',
                  fontWeight: user.email === roleOpt.email ? 700 : 400,
                  color: user.email === roleOpt.email ? 'var(--color-orange-600)' : undefined,
                }}
                onClick={() => {
                  switchRoleProfile(roleOpt.email);
                  setIsOpen(false);
                }}
              >
                <span>{roleOpt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

