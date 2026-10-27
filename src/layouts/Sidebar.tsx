import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  Tags,
  Ruler,
  Building2,
  Warehouse,
  ClipboardList,
  CheckSquare,
  FileCheck,
  Clock,
  Truck,
  Layers,
  FileSpreadsheet,
  ArrowLeftRight,
  TrendingUp,
  FilePieChart,
  Users,
  Settings,
  Shield,
  HardHat,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Contact2,
  X,
} from 'lucide-react';
import { useNavigation } from '../app/NavigationContext';
import { useAuth } from '../app/AuthContext';

interface SubNavItem {
  to: string;
  label: string;
  badge?: string;
  allowedRoles?: string[];
}

interface NavGroup {
  id: string;
  title: string;
  icon: React.ReactNode;
  to?: string;
  items?: SubNavItem[];
  allowedRoles?: string[];
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const {
    sidebarCollapsed,
    toggleSidebar,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useNavigation();

  const { user, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Track expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    master: true,
    requisitions: false,
    procurement: false,
    receiving: false,
    inventory: true,
    reports: false,
    admin: false,
  });

  // Handle Escape key to close mobile drawer
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, setMobileMenuOpen]);

  const toggleGroup = (id: string) => {
    if (sidebarCollapsed) {
      toggleSidebar();
    }
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const closeMobileNav = () => {
    setMobileMenuOpen(false);
  };

  const navGroups: NavGroup[] = [
    {
      id: 'dashboard',
      title: 'Dashboard Overview',
      icon: <LayoutDashboard size={18} />,
      to: '/dashboard',
    },
    {
      id: 'master',
      title: 'Master Data',
      icon: <Boxes size={18} />,
      items: [
        { to: '/materials', label: 'Material Master', badge: '640' },
        { to: '/material-categories', label: 'Categories' },
        { to: '/units', label: 'Units of Measure' },
        { to: '/suppliers', label: 'Suppliers' },
        { to: '/projects', label: 'Projects' },
        { to: '/warehouses', label: 'Warehouses & Yards' },
      ],
    },
    {
      id: 'requisitions',
      title: 'Material Requisitions',
      icon: <ClipboardList size={18} />,
      items: [
        { to: '/requisitions', label: 'Site Requisitions' },
        { to: '/approvals', label: 'Pending Approvals', badge: '3' },
      ],
      allowedRoles: ['SuperAdmin', 'InventoryManager', 'ProjectManager', 'Storekeeper'],
    },
    {
      id: 'procurement',
      title: 'Procurement',
      icon: <FileCheck size={18} />,
      items: [
        { to: '/purchase-orders', label: 'Purchase Orders (PO)' },
        { to: '/pending-deliveries', label: 'Pending Deliveries' },
      ],
      allowedRoles: ['SuperAdmin', 'InventoryManager', 'ProcurementOfficer'],
    },
    {
      id: 'receiving',
      title: 'Goods Receiving',
      icon: <Truck size={18} />,
      to: '/grns',
      badge: 'GRN',
      allowedRoles: ['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProcurementOfficer'],
    },
    {
      id: 'inventory',
      title: 'Inventory & Stock',
      icon: <Layers size={18} />,
      items: [
        { to: '/stock', label: 'Stock Balances' },
        { to: '/stock-ledger', label: 'Authoritative Ledger' },
        { to: '/stock-transfers', label: 'Inter-Site Transfers', badge: '2 In-Transit' },
        { to: '/material-issues', label: 'Material Issues' },
        { to: '/material-returns', label: 'Material Returns' },
      ],
      allowedRoles: ['SuperAdmin', 'InventoryManager', 'Storekeeper', 'AccountsOfficer', 'ProjectManager', 'Viewer'],
    },
    {
      id: 'reports',
      title: 'Reports & Valuation',
      icon: <FilePieChart size={18} />,
      items: [
        { to: '/reports', label: 'Inventory Reports' },
        { to: '/reports/valuation', label: 'Valuation (WAC)' },
        { to: '/reports/consumption', label: 'Site Consumption' },
      ],
      allowedRoles: ['SuperAdmin', 'InventoryManager', 'AccountsOfficer', 'ProjectManager', 'Viewer'],
    },
    {
      id: 'admin',
      title: 'Administration',
      icon: <Settings size={18} />,
      items: [
        { to: '/users', label: 'Users & Access Control', badge: 'RBAC', allowedRoles: ['SuperAdmin', 'InventoryManager'] },
        { to: '/settings', label: 'System Settings', allowedRoles: ['SuperAdmin'] },
        { to: '/architecture', label: 'Architecture & Tokens' },
      ],
      allowedRoles: ['SuperAdmin', 'InventoryManager', 'Viewer'],
    },
  ];

  // Filter groups by user permissions
  const filteredGroups = navGroups.filter((group) => {
    if (!group.allowedRoles) return true;
    return hasRole(group.allowedRoles);
  });

  return (
    <>
      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeMobileNav}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${
          mobileMenuOpen ? 'mobile-open' : ''
        }`}
        aria-label="Application Main Navigation"
      >
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div
            className="brand-badge"
            onClick={() => {
              navigate('/dashboard');
              closeMobileNav();
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="brand-icon-box" title="StructStock Construction Inventory">
              <HardHat size={20} />
            </div>
            {!sidebarCollapsed && (
              <div className="brand-text">
                <span className="brand-title">STRUCTSTOCK</span>
                <span className="brand-subtitle">Construction Stock</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className="sidebar-toggle-btn hide-on-mobile"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? 'Expand navigation (Ctrl+[)' : 'Collapse navigation'}
              aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            {mobileMenuOpen && (
              <button
                type="button"
                className="sidebar-toggle-btn"
                onClick={closeMobileNav}
                aria-label="Close navigation drawer"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Items List */}
        <nav className="sidebar-nav">
          <ul className="nav-list">
            {filteredGroups.map((group) => {
              const hasSubItems = Boolean(group.items && group.items.length > 0);
              const isGroupExpanded = expandedGroups[group.id] ?? false;

              // If it's a direct route without children
              if (!hasSubItems && group.to) {
                const isActive = location.pathname === group.to;
                return (
                  <li key={group.id}>
                    <NavLink
                      to={group.to}
                      className={({ isActive: active }) =>
                        `nav-item ${active || isActive ? 'active' : ''}`
                      }
                      onClick={closeMobileNav}
                      title={sidebarCollapsed ? group.title : undefined}
                    >
                      <span className="nav-item-icon">{group.icon}</span>
                      {!sidebarCollapsed && (
                        <>
                          <span style={{ flex: 1 }}>{group.title}</span>
                          {group.badge && <span className="nav-item-badge">{group.badge}</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              }

              // Group with children
              const visibleSubItems = (group.items || []).filter((item) => {
                if (!item.allowedRoles) return true;
                return hasRole(item.allowedRoles);
              });

              if (visibleSubItems.length === 0) return null;

              const isChildActive = visibleSubItems.some((sub) => location.pathname === sub.to);

              return (
                <li key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button
                    type="button"
                    className={`nav-item ${isChildActive ? 'active' : ''}`}
                    onClick={() => toggleGroup(group.id)}
                    title={sidebarCollapsed ? group.title : undefined}
                    style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    aria-expanded={isGroupExpanded}
                  >
                    <span className="nav-item-icon">{group.icon}</span>
                    {!sidebarCollapsed && (
                      <>
                        <span style={{ flex: 1 }}>{group.title}</span>
                        <ChevronDown
                          size={14}
                          style={{
                            transform: isGroupExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform var(--transition-fast)',
                            color: 'var(--color-charcoal-500)',
                          }}
                        />
                      </>
                    )}
                  </button>

                  {/* Sub-navigation Items */}
                  {!sidebarCollapsed && isGroupExpanded && (
                    <ul
                      style={{
                        paddingLeft: 'var(--space-6)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        marginTop: 2,
                      }}
                    >
                      {visibleSubItems.map((sub) => (
                        <li key={sub.to}>
                          <NavLink
                            to={sub.to}
                            className={({ isActive }) =>
                              `nav-item ${isActive ? 'active' : ''}`
                            }
                            onClick={closeMobileNav}
                            style={{
                              fontSize: '0.8125rem',
                              padding: '0.45rem var(--space-3)',
                            }}
                          >
                            <span style={{ flex: 1 }}>{sub.label}</span>
                            {sub.badge && (
                              <span
                                className="nav-item-badge"
                                style={
                                  sub.badge.includes('Transit')
                                    ? { backgroundColor: 'var(--color-orange-600)' }
                                    : undefined
                                }
                              >
                                {sub.badge}
                              </span>
                            )}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer with current role scope */}
        {!sidebarCollapsed && (
          <div className="sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Shield size={14} style={{ color: '#38A169' }} />
              <span style={{ fontWeight: 600 }}>{user?.fullName || 'Active Session'}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: '0.625rem', color: 'var(--color-orange-300)' }}>
              Role: {user?.roles?.join(', ') || 'Authorized'}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
