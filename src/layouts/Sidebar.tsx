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
import { useAuth } from '../app/useAuth';
import { can, canAny, type Permission } from '../security/rolePermissions';

interface SubNavItem {
  to: string;
  label: string;
  badge?: string;
  permission?: Permission;
  anyOf?: Permission[];
}

interface NavGroup {
  id: string;
  title: string;
  icon: React.ReactNode;
  to?: string;
  items?: SubNavItem[];
  permission?: Permission;
  anyOf?: Permission[];
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const {
    sidebarCollapsed,
    toggleSidebar,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useNavigation();

  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [materialCount, setMaterialCount] = useState<string | undefined>();
  const [pendingApprovals, setPendingApprovals] = useState<string | undefined>();

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { apiClient } = await import('../services/api/apiClient');
        const summary = await apiClient.get<{
          kpis?: { materialCount?: number; pendingRequisitionApprovalsCount?: number };
        }>('/dashboard/summary');
        if (cancelled) return;
        const kpis = summary.data?.kpis;
        if (typeof kpis?.materialCount === 'number') {
          setMaterialCount(String(kpis.materialCount));
        }
        if (typeof kpis?.pendingRequisitionApprovalsCount === 'number') {
          setPendingApprovals(String(kpis.pendingRequisitionApprovalsCount));
        }
      } catch {
        // badges stay empty when offline
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

  const roles = user?.roles;
  const allow = (permission?: Permission, anyOf?: Permission[]) => {
    if (anyOf?.length) return canAny(roles, anyOf);
    if (permission) return can(roles, permission);
    return true;
  };

  const navGroups: NavGroup[] = [
    {
      id: 'dashboard',
      title: 'Dashboard Overview',
      icon: <LayoutDashboard size={18} />,
      to: '/dashboard',
      permission: 'nav.dashboard',
    },
    {
      id: 'master',
      title: 'Master Data',
      icon: <Boxes size={18} />,
      anyOf: [
        'nav.master.materials.view',
        'nav.master.categories',
        'nav.master.units',
        'nav.master.suppliers.view',
        'nav.master.projects',
        'nav.master.warehouses',
      ],
      items: [
        { to: '/materials', label: 'Material Master', badge: materialCount, permission: 'nav.master.materials.view' },
        { to: '/material-categories', label: 'Categories', permission: 'nav.master.categories' },
        { to: '/units', label: 'Units of Measure', permission: 'nav.master.units' },
        { to: '/suppliers', label: 'Suppliers', permission: 'nav.master.suppliers.view' },
        { to: '/projects', label: 'Projects', permission: 'nav.master.projects' },
        { to: '/warehouses', label: 'Warehouses & Yards', permission: 'nav.master.warehouses' },
      ],
    },
    {
      id: 'requisitions',
      title: 'Material Requisitions',
      icon: <ClipboardList size={18} />,
      anyOf: ['nav.requisitions.view', 'nav.requisitions.approve'],
      items: [
        { to: '/requisitions', label: 'Site Requisitions', permission: 'nav.requisitions.view' },
        { to: '/approvals', label: 'Pending Approvals', badge: pendingApprovals, permission: 'nav.requisitions.approve' },
      ],
    },
    {
      id: 'procurement',
      title: 'Procurement',
      icon: <FileCheck size={18} />,
      anyOf: ['nav.procurement.po.view', 'nav.procurement.rates'],
      items: [
        { to: '/purchase-orders', label: 'Purchase Orders (PO)', permission: 'nav.procurement.po.view' },
        { to: '/purchase-orders/rate-comparison', label: 'Rate Comparison', permission: 'nav.procurement.rates' },
        { to: '/pending-deliveries', label: 'Pending Deliveries', permission: 'nav.procurement.po.view' },
      ],
    },
    {
      id: 'receiving',
      title: 'Goods Receiving',
      icon: <Truck size={18} />,
      anyOf: ['nav.receiving.grn.view', 'nav.receiving.grn.write'],
      items: [
        { to: '/grns', label: 'Goods Received Notes', permission: 'nav.receiving.grn.view' },
        { to: '/grns/new', label: 'New Goods Receipt', permission: 'nav.receiving.grn.write' },
      ],
    },
    {
      id: 'inventory',
      title: 'Inventory & Stock',
      icon: <Layers size={18} />,
      anyOf: [
        'nav.inventory.stock',
        'nav.inventory.ledger',
        'nav.inventory.transfers.view',
        'nav.inventory.issues.view',
        'nav.inventory.returns.view',
      ],
      items: [
        { to: '/stock', label: 'Stock Balances', permission: 'nav.inventory.stock' },
        { to: '/stock-ledger', label: 'Authoritative Ledger', permission: 'nav.inventory.ledger' },
        { to: '/stock-transfers', label: 'Inter-Site Transfers', permission: 'nav.inventory.transfers.view' },
        { to: '/stock-transfers/in-transit', label: 'In-Transit Inventory', permission: 'nav.inventory.transfers.view' },
        { to: '/stock-transfers/discrepancies', label: 'Transfer Discrepancies', permission: 'nav.inventory.transfers.view' },
        { to: '/material-issues', label: 'Material Issues', permission: 'nav.inventory.issues.view' },
        {
          to: '/material-issues/approval-inbox',
          label: 'Issue Approval Inbox',
          permission: 'nav.inventory.issues.approve',
        },
        { to: '/material-returns', label: 'Material Returns', permission: 'nav.inventory.returns.view' },
      ],
    },
    {
      id: 'reports',
      title: 'Reports & Valuation',
      icon: <FilePieChart size={18} />,
      anyOf: ['nav.reports.centre', 'nav.reports.valuation', 'nav.notifications'],
      items: [
        { to: '/reports', label: 'Reports & Export Centre', permission: 'nav.reports.centre' },
        { to: '/reports/valuation', label: 'Valuation (WAC)', permission: 'nav.reports.valuation' },
        { to: '/reports/consumption', label: 'Site Consumption', permission: 'nav.reports.consumption' },
        { to: '/notifications', label: 'Action & Notifications', permission: 'nav.notifications' },
      ],
    },
    {
      id: 'admin',
      title: 'Administration',
      icon: <Settings size={18} />,
      anyOf: ['nav.admin.users', 'nav.admin.settings', 'nav.admin.architecture'],
      items: [
        { to: '/users', label: 'Users & Access Control', badge: 'RBAC', permission: 'nav.admin.users' },
        { to: '/settings', label: 'System Settings', permission: 'nav.admin.settings' },
        { to: '/architecture', label: 'Architecture & Tokens', permission: 'nav.admin.architecture' },
      ],
    },
  ];

  const filteredGroups = navGroups.filter((group) => allow(group.permission, group.anyOf));

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
              const visibleSubItems = (group.items || []).filter((item) =>
                allow(item.permission, item.anyOf)
              );

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
