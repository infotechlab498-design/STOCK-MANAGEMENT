import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Building,
  Warehouse,
  KeyRound,
  Edit2,
  Power,
  RefreshCw,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../app/useAuth';
import { useNavigation } from '../app/NavigationContext';
import { useNavigate } from 'react-router-dom';
import { authService, UserProfile, RoleInfo, CreateUserPayload, UpdateUserPayload } from '../services/api/authService';
import { ApiClientException } from '../services/api/apiClient';

const availableProjectDefs = [
  { id: 'PRJ-101', code: 'PRJ-METRO-01', name: 'Downtown Metro Station' },
  { id: 'PRJ-102', code: 'PRJ-BRIDGE-04', name: 'River Crossing Viaduct' },
  { id: 'PRJ-103', code: 'PRJ-TOWER-09', name: 'Horizon Commercial High-Rise' },
];

const availableWarehouseDefs = [
  { id: 'WH-01', code: 'WH-CENTRAL', name: 'Central Holding Yard' },
  { id: 'WH-02', code: 'WH-SITE-A', name: 'Metro North Site Store' },
  { id: 'WH-03', code: 'WH-SITE-B', name: 'Viaduct Pier Staging Depot' },
];

export const UsersManagementPage: React.FC = () => {
  const { user: currentUser, hasRole } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [apiError, setApiError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [statusTogglingUser, setStatusTogglingUser] = useState<UserProfile | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState<CreateUserPayload>({
    username: '',
    email: '',
    fullName: '',
    password: '',
    roles: ['Viewer'],
    projectScopes: ['PRJ-101'],
    warehouseScopes: ['WH-01'],
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Edit form state
  const [editForm, setEditForm] = useState<UpdateUserPayload>({
    fullName: '',
    email: '',
    roles: [],
    projectScopes: [],
    warehouseScopes: [],
  });
  const [editError, setEditError] = useState<string | null>(null);

  const fetchUsersAndRoles = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        authService.getUsers(searchTerm, roleFilter, statusFilter),
        authService.getRoles().catch(() => ({ success: true, data: [] })),
      ]);

      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data);
      }
      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientException) {
        setApiError(err.message);
      } else {
        setApiError('Failed to load user directory. Ensure you have administrator permissions.');
      }
    } finally {
      setLoading(false);
    }
  }, [searchTerm, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsersAndRoles();
  }, [fetchUsersAndRoles]);

  // Handle Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsSubmitting(true);

    try {
      const res = await authService.createUser(createForm);
      if (res.success) {
        setActionSuccess(`User '${createForm.username}' created successfully.`);
        setShowCreateModal(false);
        setCreateForm({
          username: '',
          email: '',
          fullName: '',
          password: '',
          roles: ['Viewer'],
          projectScopes: ['PRJ-101'],
          warehouseScopes: ['WH-01'],
        });
        await fetchUsersAndRoles();
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientException) {
        setCreateError(err.message);
      } else {
        setCreateError('Error creating user account');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setEditForm({
      fullName: u.fullName,
      email: u.email,
      roles: [...u.roles],
      projectScopes: [...u.projectScopes],
      warehouseScopes: [...u.warehouseScopes],
    });
    setEditError(null);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setIsSubmitting(true);

    try {
      const res = await authService.updateUser(editingUser.id, editForm);
      if (res.success) {
        setActionSuccess(`User profile for '${editingUser.username}' updated.`);
        setEditingUser(null);
        await fetchUsersAndRoles();
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientException) {
        setEditError(err.message);
      } else {
        setEditError('Error updating user');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Status Toggle (Activate/Deactivate)
  const handleConfirmStatusToggle = async () => {
    if (!statusTogglingUser) return;
    const targetStatus = !statusTogglingUser.isActive;
    setIsSubmitting(true);
    setApiError(null);

    try {
      const res = await authService.updateUserStatus(
        statusTogglingUser.id,
        targetStatus,
        targetStatus ? 'Reactivated by admin' : 'Deactivated by admin'
      );
      if (res.success) {
        setActionSuccess(
          `User '${statusTogglingUser.username}' has been ${targetStatus ? 'activated' : 'deactivated'}.`
        );
        setStatusTogglingUser(null);
        await fetchUsersAndRoles();
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientException) {
        setApiError(err.message);
      } else {
        setApiError('Unable to update user status.');
      }
      setStatusTogglingUser(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'SuperAdmin':
        return <Badge key={roleName} variant="danger">Super Admin</Badge>;
      case 'InventoryManager':
        return <Badge key={roleName} variant="orange">Inventory Mgr</Badge>;
      case 'ProjectManager':
        return <Badge key={roleName} variant="transit">Project Mgr</Badge>;
      case 'Storekeeper':
        return <Badge key={roleName} variant="warning">Storekeeper</Badge>;
      case 'ProcurementOfficer':
        return <Badge key={roleName} variant="neutral">Procurement</Badge>;
      case 'AccountsOfficer':
        return <Badge key={roleName} variant="success">Accounts</Badge>;
      default:
        return <Badge key={roleName} variant="neutral">{roleName}</Badge>;
    }
  };

  const totalUsers = users.length;
  const activeCount = users.filter((u) => u.isActive).length;
  const disabledCount = users.filter((u) => !u.isActive).length;
  const isSuperAdmin = hasRole('SuperAdmin');

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'StructStock', onClick: () => navigate('/dashboard') },
        { label: 'System Administration' },
        { label: 'Users & Access Control', active: true },
      ]}
      title="User Directory & Access Control"
      description="Enterprise role assignments, project boundary scoping, and active session governance."
      actions={
        <>
          <Button
            variant="secondary"
            icon={<RefreshCw size={14} className={loading ? 'loading-spinner' : ''} />}
            onClick={() => fetchUsersAndRoles()}
          >
            Refresh
          </Button>
          {isSuperAdmin && (
            <Button
              variant="primary"
              icon={<UserPlus size={16} />}
              onClick={() => {
                setShowCreateModal(true);
                setCreateError(null);
              }}
            >
              Add New User
            </Button>
          )}
        </>
      }
    >
      {/* Alert Notices */}
      {actionSuccess && (
        <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {apiError && (
        <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>
          <AlertTriangle size={16} />
          <span>{apiError}</span>
          <button
            type="button"
            onClick={() => setApiError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid-dashboard-stats">
        <StatCard
          label="Registered Personnel"
          value={totalUsers}
          accent="charcoal"
          icon={<Users size={18} />}
          meta={<span>Total authorized user directory</span>}
        />
        <StatCard
          label="Active Accounts"
          value={activeCount}
          accent="success"
          icon={<CheckCircle2 size={18} />}
          meta={<span>Authenticated with access privileges</span>}
        />
        <StatCard
          label="Disabled Accounts"
          value={disabledCount}
          accent={disabledCount > 0 ? 'orange' : 'charcoal'}
          icon={<XCircle size={18} />}
          meta={<span>Login access immediately revoked</span>}
        />
        <StatCard
          label="Enterprise Roles"
          value={roles.length || 7}
          accent="transit"
          icon={<KeyRound size={18} />}
          meta={<span>Strict policy-based authorization</span>}
        />
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 1, minWidth: 260 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Search by name, email, or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-charcoal-500)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Filter size={14} style={{ color: 'var(--color-charcoal-600)' }} />
              <select
                className="form-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ width: 'auto', fontSize: 'var(--font-size-xs)' }}
                aria-label="Filter by role"
              >
                <option value="ALL">All Roles</option>
                <option value="SuperAdmin">Super Admin</option>
                <option value="InventoryManager">Inventory Manager</option>
                <option value="ProjectManager">Project Manager</option>
                <option value="ProcurementOfficer">Procurement Officer</option>
                <option value="Storekeeper">Storekeeper</option>
                <option value="AccountsOfficer">Accounts Officer</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>

            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 'auto', fontSize: 'var(--font-size-xs)' }}
              aria-label="Filter by account status"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="DISABLED">Disabled Only</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="table-container" style={{ marginTop: 'var(--space-4)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User / Personnel</th>
                <th>Corporate Email</th>
                <th>Assigned Roles</th>
                <th>Project & Warehouse Scopes</th>
                <th>Status</th>
                <th>Last Login (UTC)</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                return (
                  <tr key={u.id} style={!u.isActive ? { opacity: 0.7, backgroundColor: '#FFF5F5' } : undefined}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: u.roles.includes('SuperAdmin')
                              ? 'var(--color-orange-500)'
                              : 'var(--color-charcoal-800)',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          {u.fullName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>
                            {u.fullName}
                            {isSelf && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontSize: '0.625rem',
                                  padding: '1px 5px',
                                  backgroundColor: 'var(--color-charcoal-200)',
                                  borderRadius: 'var(--radius-sm)',
                                  color: 'var(--color-charcoal-700)',
                                }}
                              >
                                You
                              </span>
                            )}
                          </div>
                          <div className="td-mono" style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)' }}>
                            @{u.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="td-mono" style={{ fontSize: '0.8125rem' }}>
                      {u.email}
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {u.roles.map((r) => getRoleBadge(r))}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {u.projectScopes.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--color-charcoal-700)' }}>
                            <Building size={12} style={{ color: 'var(--color-orange-500)' }} />
                            <span>{u.projectScopes.join(', ')}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)' }}>All Projects (Global)</span>
                        )}

                        {u.warehouseScopes.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--color-charcoal-600)' }}>
                            <Warehouse size={12} style={{ color: 'var(--color-charcoal-600)' }} />
                            <span>{u.warehouseScopes.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      {u.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="danger">Disabled</Badge>
                      )}
                    </td>

                    <td className="td-mono" style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
                      {u.lastLoginAtUtc ? new Date(u.lastLoginAtUtc).toUTCString().replace('GMT', 'UTC') : 'Never'}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      {isSuperAdmin && (
                        <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Edit2 size={12} />}
                            onClick={() => openEditModal(u)}
                            title="Edit user roles and project boundaries"
                          >
                            Edit
                          </Button>
                          <Button
                            variant={u.isActive ? 'danger' : 'secondary'}
                            size="sm"
                            icon={<Power size={12} />}
                            onClick={() => setStatusTogglingUser(u)}
                            title={u.isActive ? 'Deactivate user access' : 'Activate user account'}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="sidebar-backdrop" style={{ zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 580,
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-border)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-charcoal-900)' }}>
                Create New Personnel Account
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--color-charcoal-600)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ padding: 'var(--space-6)' }}>
              {createError && (
                <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>
                  <AlertTriangle size={16} />
                  <span>{createError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label required">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Jordan Miller"
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. j.miller"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label required">Corporate Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="j.miller@constructcorp.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">Initial Password (min 8 chars)</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••••••"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              {/* Roles Multi-select Checkboxes */}
              <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                <label className="form-label required">Assign System Roles</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                  {[
                    'SuperAdmin',
                    'InventoryManager',
                    'ProjectManager',
                    'ProcurementOfficer',
                    'Storekeeper',
                    'AccountsOfficer',
                    'Viewer',
                  ].map((r) => {
                    const isChecked = createForm.roles.includes(r);
                    return (
                      <label
                        key={r}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-2)',
                          borderRadius: 'var(--radius-md)',
                          border: isChecked ? '1px solid var(--color-orange-500)' : '1px solid var(--color-border)',
                          backgroundColor: isChecked ? 'var(--color-orange-100)' : 'var(--color-bg-surface)',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-xs)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const newRoles = e.target.checked
                              ? [...createForm.roles, r]
                              : createForm.roles.filter((x) => x !== r);
                            setCreateForm({ ...createForm, roles: newRoles });
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>{r}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Project Scope Assignment */}
              <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                <label className="form-label">Project Boundary Scopes (Access Control)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {availableProjectDefs.map((p) => {
                    const isChecked = (createForm.projectScopes || []).includes(p.id);
                    return (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = createForm.projectScopes || [];
                            const updated = e.target.checked
                              ? [...current, p.id]
                              : current.filter((x) => x !== p.id);
                            setCreateForm({ ...createForm, projectScopes: updated });
                          }}
                        />
                        <span><strong>{p.code}</strong> — {p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Warehouse Scope Assignment */}
              <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                <label className="form-label">Warehouse Depot Scopes</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {availableWarehouseDefs.map((w) => {
                    const isChecked = (createForm.warehouseScopes || []).includes(w.id);
                    return (
                      <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = createForm.warehouseScopes || [];
                            const updated = e.target.checked
                              ? [...current, w.id]
                              : current.filter((x) => x !== w.id);
                            setCreateForm({ ...createForm, warehouseScopes: updated });
                          }}
                        />
                        <span><strong>{w.code}</strong> — {w.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Save & Provision Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="sidebar-backdrop" style={{ zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 580,
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-border)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-charcoal-900)' }}>
                  Edit Personnel: {editingUser.fullName}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)' }}>
                  @{editingUser.username}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--color-charcoal-600)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ padding: 'var(--space-6)' }}>
              {editError && (
                <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>
                  <AlertTriangle size={16} />
                  <span>{editError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label required">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">Corporate Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Roles Checkboxes */}
              <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                <label className="form-label required">Assigned System Roles</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                  {[
                    'SuperAdmin',
                    'InventoryManager',
                    'ProjectManager',
                    'ProcurementOfficer',
                    'Storekeeper',
                    'AccountsOfficer',
                    'Viewer',
                  ].map((r) => {
                    const isChecked = editForm.roles.includes(r);
                    return (
                      <label
                        key={r}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-2)',
                          borderRadius: 'var(--radius-md)',
                          border: isChecked ? '1px solid var(--color-orange-500)' : '1px solid var(--color-border)',
                          backgroundColor: isChecked ? 'var(--color-orange-100)' : 'var(--color-bg-surface)',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-xs)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const newRoles = e.target.checked
                              ? [...editForm.roles, r]
                              : editForm.roles.filter((x) => x !== r);
                            setEditForm({ ...editForm, roles: newRoles });
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>{r}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Project Scopes */}
              <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                <label className="form-label">Project Boundary Scopes</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {availableProjectDefs.map((p) => {
                    const isChecked = (editForm.projectScopes || []).includes(p.id);
                    return (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = editForm.projectScopes || [];
                            const updated = e.target.checked
                              ? [...current, p.id]
                              : current.filter((x) => x !== p.id);
                            setEditForm({ ...editForm, projectScopes: updated });
                          }}
                        />
                        <span><strong>{p.code}</strong> — {p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Warehouse Scopes */}
              <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                <label className="form-label">Warehouse Scopes</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {availableWarehouseDefs.map((w) => {
                    const isChecked = (editForm.warehouseScopes || []).includes(w.id);
                    return (
                      <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = editForm.warehouseScopes || [];
                            const updated = e.target.checked
                              ? [...current, w.id]
                              : current.filter((x) => x !== w.id);
                            setEditForm({ ...editForm, warehouseScopes: updated });
                          }}
                        />
                        <span><strong>{w.code}</strong> — {w.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Update User Profile
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM STATUS TOGGLE DIALOG */}
      {statusTogglingUser && (
        <div className="sidebar-backdrop" style={{ zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 440,
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-border)',
              padding: 'var(--space-6)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: statusTogglingUser.isActive ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                color: statusTogglingUser.isActive ? 'var(--color-danger-text)' : 'var(--color-success-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-3) auto',
              }}
            >
              <Power size={24} />
            </div>

            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-charcoal-900)' }}>
              {statusTogglingUser.isActive ? 'Deactivate Account?' : 'Reactivate Account?'}
            </h3>

            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
              {statusTogglingUser.isActive
                ? `Deactivating '${statusTogglingUser.fullName}' will immediately terminate any active sessions and prevent future sign-ins.`
                : `Reactivating '${statusTogglingUser.fullName}' will restore their access with their previously assigned roles and project scopes.`}
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
              <Button variant="secondary" onClick={() => setStatusTogglingUser(null)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant={statusTogglingUser.isActive ? 'danger' : 'primary'}
                onClick={handleConfirmStatusToggle}
                isLoading={isSubmitting}
              >
                {statusTogglingUser.isActive ? 'Yes, Deactivate' : 'Yes, Activate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};
