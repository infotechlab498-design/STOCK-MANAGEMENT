import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Eye,
  Edit2,
  Send,
  Trash2,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { Badge } from '../components/common/Badge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import {
  requisitionService,
  MaterialRequisitionDto,
  ProjectDto,
} from '../services/api/requisitionService';

export const RequisitionListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [requisitions, setRequisitions] = useState<MaterialRequisitionDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters from query params
  const initialSearch = searchParams.get('search') || '';
  const initialStatus = searchParams.get('status') || 'ALL';
  const initialProject = searchParams.get('projectId') || 'ALL';

  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [projectFilter, setProjectFilter] = useState<string>(initialProject);

  // Modals & Action States
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [submitId, setSubmitId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isApprover = hasRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']);

  // Fetch initial data with independent degradation for filter catalog vs requisition list
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projResult, reqResult] = await Promise.allSettled([
        requisitionService.getProjects(),
        requisitionService.getRequisitions({
          search: searchQuery || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          projectId: projectFilter !== 'ALL' ? projectFilter : undefined,
          pageSize: 100,
        }),
      ]);

      if (projResult.status === 'fulfilled') {
        setProjects(Array.isArray(projResult.value) ? projResult.value : []);
      } else {
        console.error('Failed to load project filter options (/api/v1/projects):', projResult.reason);
      }

      if (reqResult.status === 'fulfilled') {
        setRequisitions(reqResult.value?.items || []);
        if (projResult.status === 'rejected') {
          setActionMessage({
            type: 'error',
            text: `Project filter options unavailable (/api/v1/projects): ${projResult.reason?.message || 'Request failed'}`,
          });
        }
      } else {
        const reqReason = reqResult.reason;
        const projFailureSuffix =
          projResult.status === 'rejected'
            ? ` (Project catalog GET /api/v1/projects also failed: ${projResult.reason?.message || 'Unknown error'})`
            : '';
        setError(
          `Failed to load requisitions (GET /api/v1/requisitions): ${
            reqReason?.message || 'Failed to communicate with construction inventory backend'
          }${projFailureSuffix}`
        );
      }
    } catch (err: any) {
      console.error('Failed to load requisitions:', err);
      setError(err?.message || 'Failed to communicate with construction inventory backend');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, projectFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync state to URL params
  const handleFilterChange = (key: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value && value !== 'ALL') {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
    setSearchParams(nextParams);

    if (key === 'search') setSearchQuery(value);
    if (key === 'status') setStatusFilter(value);
    if (key === 'projectId') setProjectFilter(value);
  };

  // Compute stat metrics
  const stats = useMemo(() => {
    const total = requisitions.length;
    const pending = requisitions.filter((r) => r.status === 'Submitted').length;
    const approved = requisitions.filter((r) => r.status === 'Approved').length;
    const returned = requisitions.filter((r) => r.status === 'ReturnedForCorrection').length;
    return { total, pending, approved, returned };
  }, [requisitions]);

  // Handle Quick Submit
  const handleConfirmSubmit = async () => {
    if (!submitId) return;
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      await requisitionService.submitRequisition(submitId, 'Submitted from site requisition dashboard.');
      setActionMessage({ type: 'success', text: 'Requisition submitted for Project Manager approval review.' });
      setSubmitId(null);
      await fetchData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to submit requisition.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Draft
  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    setActionMessage(null);
    try {
      await requisitionService.deleteRequisition(deleteId);
      setActionMessage({ type: 'success', text: 'Draft requisition removed successfully.' });
      setDeleteId(null);
      await fetchData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to delete requisition.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'danger';
      case 'High':
        return 'orange';
      case 'Medium':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'StructStock', onClick: () => navigate('/dashboard') },
        { label: 'Material Requisitions' },
        { label: 'Site Requisitions', active: true },
      ]}
      title="Site Material Requisitions"
      description="Manage engineering material requests, track site delivery dates, and follow approval workflows."
      actions={
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {isApprover && (
            <Button
              variant="secondary"
              size="md"
              icon={<ClipboardList size={16} />}
              onClick={() => navigate('/approvals')}
              aria-label="View Approval Queue"
            >
              Approval Inbox
              {stats.pending > 0 && (
                <span
                  style={{
                    marginLeft: 'var(--space-1)',
                    backgroundColor: 'var(--color-orange-500)',
                    color: '#fff',
                    borderRadius: 'var(--border-radius-full)',
                    padding: '2px 7px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {stats.pending}
                </span>
              )}
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            icon={<Plus size={16} />}
            onClick={() => navigate('/requisitions/new')}
            aria-label="Create New Material Requisition"
          >
            New Requisition
          </Button>
        </div>
      }
    >
      {/* Notifications */}
      {actionMessage && (
        <div
          role="alert"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: actionMessage.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            color: actionMessage.type === 'success' ? 'var(--color-success-text)' : 'var(--color-danger-text)',
            border: `1px solid ${actionMessage.type === 'success' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {actionMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: 600,
              fontSize: '1.1rem',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard
          label="Total Requisitions"
          value={stats.total}
          icon={<FileText size={20} />}
          meta="Total logged requests"
          accent="charcoal"
        />
        <StatCard
          label="Pending Approval"
          value={stats.pending}
          icon={<Clock size={20} />}
          meta="Awaiting PM review"
          accent="orange"
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          icon={<CheckCircle2 size={20} />}
          meta="Ready for staging"
          accent="success"
        />
        <StatCard
          label="Returned for Correction"
          value={stats.returned}
          icon={<AlertCircle size={20} />}
          meta="Requires revision"
          accent="orange"
        />
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-4)' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Search Box */}
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 'var(--space-3)',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-charcoal-500)',
              }}
            />
            <input
              type="text"
              placeholder="Search by MR#, project, material or requester..."
              value={searchQuery}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3) var(--space-2) 2.25rem',
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-main)',
                fontSize: '0.875rem',
              }}
            />
          </div>

          {/* Project Filter */}
          <div style={{ flex: '0 1 200px' }}>
            <select
              value={projectFilter}
              onChange={(e) => handleFilterChange('projectId', e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-main)',
                fontSize: '0.875rem',
              }}
            >
              <option value="ALL">All Project Sites</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ flex: '0 1 200px' }}>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-main)',
                fontSize: '0.875rem',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="Draft">Drafts</option>
              <option value="Submitted">Submitted (Pending Review)</option>
              <option value="Approved">Approved</option>
              <option value="ReturnedForCorrection">Returned for Correction</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Refresh Button */}
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />}
            onClick={fetchData}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* Main Table / State View */}
      {isLoading ? (
        <Card style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <LoadingSpinner label="Querying site material requisitions..." />
        </Card>
      ) : error ? (
        <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-danger-text)', marginBottom: 'var(--space-4)' }}>
            <AlertCircle size={36} style={{ margin: '0 auto var(--space-2)' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Error loading requisitions</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', marginTop: 'var(--space-1)' }}>{error}</p>
          </div>
          <Button variant="primary" size="sm" onClick={fetchData}>
            Retry Request
          </Button>
        </Card>
      ) : requisitions.length === 0 ? (
        <Card style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <EmptyState
            title="No material requisitions found"
            description={
              searchQuery || statusFilter !== 'ALL' || projectFilter !== 'ALL'
                ? 'Try adjusting your search criteria or resetting filters.'
                : 'No requisitions have been drafted for your scoped construction sites yet.'
            }
            action={
              <Button
                variant="primary"
                size="md"
                icon={<Plus size={16} />}
                onClick={() => navigate('/requisitions/new')}
              >
                Create First Requisition
              </Button>
            }
          />
        </Card>
      ) : (
        <Card style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-charcoal-700)',
                    fontWeight: 600,
                  }}
                >
                  <th style={{ padding: '0.75rem 1rem' }}>Requisition #</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Project Site</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Required By</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Items</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Requester</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((req) => {
                  const canEdit =
                    (req.status === 'Draft' || req.status === 'ReturnedForCorrection') &&
                    (req.requesterUserId === user?.id || user?.roles.includes('SuperAdmin'));
                  const canSubmit =
                    (req.status === 'Draft' || req.status === 'ReturnedForCorrection') &&
                    req.items.length > 0 &&
                    (req.requesterUserId === user?.id || user?.roles.includes('SuperAdmin'));
                  const canDelete =
                    (req.status === 'Draft' || req.status === 'ReturnedForCorrection') &&
                    (req.requesterUserId === user?.id || user?.roles.includes('SuperAdmin'));

                  return (
                    <tr
                      key={req.id}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Requisition Number & Purpose */}
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span
                            onClick={() => navigate(`/requisitions/${req.id}`)}
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: 'var(--color-orange-600)',
                              cursor: 'pointer',
                            }}
                          >
                            {req.requisitionNumber}
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--color-charcoal-600)',
                              marginTop: '0.125rem',
                              maxWidth: '260px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={req.purpose}
                          >
                            {req.purpose}
                          </span>
                        </div>
                      </td>

                      {/* Project Site */}
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{req.projectCode}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)' }}>
                            {req.projectName}
                          </span>
                        </div>
                      </td>

                      {/* Required By Date */}
                      <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                          <Calendar size={14} style={{ color: 'var(--color-charcoal-500)' }} />
                          <span>{req.requiredDate}</span>
                        </div>
                      </td>

                      {/* Priority Badge */}
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <Badge variant={getPriorityBadgeVariant(req.priority)}>
                          {req.priority}
                        </Badge>
                      </td>

                      {/* Items Count & Summary */}
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{req.items.length} line{req.items.length === 1 ? '' : 's'}</span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--color-charcoal-500)',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {req.items.map((i) => i.materialName).join(', ')}
                          </span>
                        </div>
                      </td>

                      {/* Requester */}
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 500 }}>{req.requesterName}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>
                            {req.requesterRole}
                          </span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <StatusBadge status={req.status} label={req.status === 'ReturnedForCorrection' ? 'Returned' : req.status} />
                      </td>

                      {/* Row Actions */}
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Eye size={15} />}
                            onClick={() => navigate(`/requisitions/${req.id}`)}
                            title="View Requisition Details"
                          >
                            View
                          </Button>

                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Edit2 size={15} />}
                              onClick={() => navigate(`/requisitions/${req.id}/edit`)}
                              title="Edit Requisition Draft"
                            >
                              Edit
                            </Button>
                          )}

                          {canSubmit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Send size={15} />}
                              onClick={() => setSubmitId(req.id)}
                              title="Submit for Approval"
                              style={{ color: 'var(--color-orange-600)' }}
                            >
                              Submit
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 size={15} />}
                              onClick={() => setDeleteId(req.id)}
                              title="Delete Draft"
                              style={{ color: 'var(--color-danger-text)' }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Confirmation Modals */}
      <ConfirmDialog
        isOpen={!!submitId}
        title="Submit Material Requisition"
        description="Are you sure you want to submit this material requisition for Project Manager review? Once submitted, the requested items cannot be edited unless returned for correction."
        confirmLabel="Submit for Review"
        variant="primary"
        isLoading={isSubmitting}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setSubmitId(null)}
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Requisition Draft"
        description="Are you sure you want to delete this draft material requisition? This action cannot be undone."
        confirmLabel="Delete Draft"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </AppLayout>
  );
};
