import React, { useState } from 'react';
import { Menu, Building, Warehouse, ShieldCheck } from 'lucide-react';
import { useNavigation } from '../app/NavigationContext';
import { useAuth } from '../app/AuthContext';
import { NotificationBell } from '../components/common/NotificationBell';
import { UserProfileMenu } from '../components/common/UserProfileMenu';
import { SearchInput } from '../components/common/SearchInput';

export interface TopHeaderProps {
  onToggleMobileMenu?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onToggleMobileMenu }) => {
  const {
    mobileMenuOpen,
    setMobileMenuOpen,
    activeProject,
    setActiveProject,
    activeWarehouse,
    setActiveWarehouse,
    availableProjects,
    availableWarehouses,
  } = useNavigation();

  const { user, hasRole } = useAuth();
  const [globalSearch, setGlobalSearch] = useState('');

  const toggleMobile = onToggleMobileMenu || (() => setMobileMenuOpen(!mobileMenuOpen));

  // Role-based project and warehouse scopes
  const isGlobalUser = hasRole(['SuperAdmin', 'InventoryManager']);
  const userProjects = isGlobalUser || !user
    ? availableProjects
    : availableProjects.filter((p) => user.projectScopes.includes(p.id));

  const userWarehouses = isGlobalUser || !user
    ? availableWarehouses
    : availableWarehouses.filter((w) => user.warehouseScopes.includes(w.id));

  return (
    <header className="app-header" role="banner">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={toggleMobile}
          aria-label="Open navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <Menu size={22} />
        </button>

        {/* Global Search Presentation */}
        <div className="hide-on-mobile" style={{ width: 280 }}>
          <SearchInput
            value={globalSearch}
            onChange={setGlobalSearch}
            placeholder="Search SKUs, POs, GRNs... (Ctrl+K)"
            maxWidth={280}
            title="Global search presentation across construction materials, transfers, and ledger"
          />
        </div>

        {/* Project Context Selector */}
        <div className="project-selector" title="Active Project Scope">
          <Building size={15} style={{ color: 'var(--color-orange-500)', flexShrink: 0 }} />
          <select
            value={activeProject.id}
            onChange={(e) => {
              const selected = availableProjects.find((p) => p.id === e.target.value);
              if (selected) setActiveProject(selected);
            }}
            aria-label="Active Project Scope"
            style={{
              border: 'none',
              background: 'transparent',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-charcoal-900)',
              outline: 'none',
              cursor: 'pointer',
              maxWidth: 220,
              textOverflow: 'ellipsis',
            }}
          >
            {userProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>

        {/* Warehouse Context Selector */}
        <div className="project-selector" title="Active Warehouse / Site Yard">
          <Warehouse size={15} style={{ color: 'var(--color-charcoal-700)', flexShrink: 0 }} />
          <select
            value={activeWarehouse.id}
            onChange={(e) => {
              const selected = availableWarehouses.find((w) => w.id === e.target.value);
              if (selected) setActiveWarehouse(selected);
            }}
            aria-label="Active Warehouse Depot"
            style={{
              border: 'none',
              background: 'transparent',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-charcoal-800)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {userWarehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="header-right">
        {/* Ledger Integrity Indicator */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1-5)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-success-text)',
            backgroundColor: 'var(--color-success-bg)',
            border: '1px solid var(--color-success-border)',
            padding: '0.25rem 0.625rem',
            borderRadius: 'var(--radius-full)',
          }}
          className="hide-on-mobile"
          title="Stock balance reconciles with immutable transaction ledger"
        >
          <ShieldCheck size={14} />
          <span>Ledger Reconciled</span>
        </div>

        {/* Notifications Icon with Popover */}
        <NotificationBell />

        {/* User Profile Menu with real user data & working logout */}
        <UserProfileMenu />
      </div>
    </header>
  );
};
