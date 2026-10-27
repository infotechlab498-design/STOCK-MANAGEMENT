import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Edit2,
  Send,
  Trash2,
  Shield,
  Info,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { Badge } from '../components/common/Badge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingSpinner } from '../components/common/EmptyState';
import {
  requisitionService,
  MaterialRequisitionDto,
} from '../services/api/requisitionService';

export const RequisitionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [requisition, setRequisition] = useState<MaterialRequisitionDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog & Modal States
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  // Form Inputs in Decision Modals
  const [decisionComments, setDecisionComments] = useState<string>('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const fetchRequisition = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await requisitionService.getRequisitionById(id);
      setRequisition(data);
    } catch (err: any) {
      console.error('Failed to load requisition details:', err);
      setError(err?.message || 'Unable to retrieve material requisition details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequisition();
  }, [fetchRequisition]);

  if (isLoading) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: 'StructStock', onClick: () => navigate('/dashboard') },
          { label: 'Material Requisitions', onClick: () => navigate('/requisitions') },
          { label: 'Loading...', active: true },
        ]}
        title="Requisition Details"
      >
        <Card style={{ padding: '3.5rem', textAlign: 'center' }}>
          <LoadingSpinner label="Loading requisition detail & audit history..." />
        </Card>
      </AppLayout>
    );
  }

  if (error || !requisition) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: 'StructStock', onClick: () => navigate('/dashboard') },
          { label: 'Material Requisitions', onClick: () => navigate('/requisitions') },
          { label: 'Error', active: true },
        ]}
        title="Requisition Details"
      >
        <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-danger-text)', marginBottom: 'var(--space-4)' }}>
            <AlertCircle size={40} style={{ margin: '0 auto var(--space-2)' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Failed to Load Requisition</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', marginTop: 'var(--space-2)' }}>
              {error || 'Requisition not found or you do not have permission to view it.'}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/requisitions')}
          >
            Back to Requisition Register
          </Button>
        </Card>
      </AppLayout>
    );
  }

  // Authorization checks
  const isRequester = requisition.requesterUserId === user?.id;
  const isSuperAdmin = user?.roles.includes('SuperAdmin');
  const hasApproverRole = hasRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']);
  const canAccessProject =
    isSuperAdmin ||
    user?.roles.includes('InventoryManager') ||
    user?.projectScopes.includes('*') ||
    user?.projectScopes.includes(requisition.projectId);

  // Self-approval restriction
  const isSelfApprovalBlocked = isRequester && !isSuperAdmin;

  const canApproveOrReject =
    requisition.status === 'Submitted' && hasApproverRole && canAccessProject && !isSelfApprovalBlocked;

  const canEditOrSubmit =
    (requisition.status === 'Draft' || requisition.status === 'ReturnedForCorrection') &&
    (isRequester || isSuperAdmin);

  // Decision Handlers
  const handleApprove = async () => {
    setIsProcessing(true);
    setDecisionError(null);
    try {
      await requisitionService.approveRequisition(requisition.id, decisionComments || undefined);
      setShowApproveModal(false);
      setDecisionComments('');
      setActionSuccessMessage('Requisition approved successfully for site issuance & procurement staging.');
      await fetchRequisition();
    } catch (err: any) {
      setDecisionError(err?.message || 'Failed to approve requisition');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!decisionComments || decisionComments.trim().length < 3) {
      setDecisionError('Rejection reason is required. Please explain the cause for the site team.');
      return;
    }
    setIsProcessing(true);
    setDecisionError(null);
    try {
      await requisitionService.rejectRequisition(requisition.id, decisionComments.trim());
      setShowRejectModal(false);
      setDecisionComments('');
      setActionSuccessMessage('Requisition has been marked as Rejected with mandatory reason recorded.');
      await fetchRequisition();
    } catch (err: any) {
      setDecisionError(err?.message || 'Failed to reject requisition');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReturnForCorrection = async () => {
    if (!decisionComments || decisionComments.trim().length < 3) {
      setDecisionError('Correction instructions are required. Please detail the changes required.');
      return;
    }
    setIsProcessing(true);
    setDecisionError(null);
    try {
      await requisitionService.returnForCorrection(requisition.id, decisionComments.trim());
      setShowReturnModal(false);
      setDecisionComments('');
      setActionSuccessMessage('Requisition returned for correction. The requester has been notified to modify line items.');
      await fetchRequisition();
    } catch (err: any) {
      setDecisionError(err?.message || 'Failed to return requisition for correction');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    setDecisionError(null);
    try {
      await requisitionService.submitRequisition(requisition.id, decisionComments || undefined);
      setShowSubmitModal(false);
      setDecisionComments('');
      setActionSuccessMessage('Requisition submitted for Project Manager approval review.');
      await fetchRequisition();
    } catch (err: any) {
      setDecisionError(err?.message || 'Failed to submit requisition');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      await requisitionService.deleteRequisition(requisition.id);
      navigate('/requisitions');
    } catch (err: any) {
      setDecisionError(err?.message || 'Failed to delete requisition');
      setIsProcessing(false);
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

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'Approved':
        return <CheckCircle2 size={16} style={{ color: 'var(--color-success-text)' }} />;
      case 'Rejected':
        return <XCircle size={16} style={{ color: 'var(--color-danger-text)' }} />;
      case 'ReturnedForCorrection':
        return <RotateCcw size={16} style={{ color: 'var(--color-warning-text)' }} />;
      case 'Submitted':
        return <Send size={16} style={{ color: 'var(--color-orange-600)' }} />;
      default:
        return <Clock size={16} style={{ color: 'var(--color-charcoal-500)' }} />;
    }
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'StructStock', onClick: () => navigate('/dashboard') },
        { label: 'Material Requisitions', onClick: () => navigate('/requisitions') },
        { label: requisition.requisitionNumber, active: true },
      ]}
      title={`Requisition ${requisition.requisitionNumber}`}
      description={`Site request for ${requisition.projectName} (${requisition.projectCode})`}
      actions={
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="md"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/requisitions')}
          >
            Requisitions List
          </Button>

          {canEditOrSubmit && (
            <>
              <Button
                variant="secondary"
                size="md"
                icon={<Edit2 size={16} />}
                onClick={() => navigate(`/requisitions/${requisition.id}/edit`)}
              >
                Edit Requisition
              </Button>
              {requisition.items.length > 0 && (
                <Button
                  variant="primary"
                  size="md"
                  icon={<Send size={16} />}
                  onClick={() => setShowSubmitModal(true)}
                >
                  Submit for Approval
                </Button>
              )}
              <Button
                variant="danger"
                size="md"
                icon={<Trash2 size={16} />}
                onClick={() => setShowDeleteModal(true)}
              >
                Delete Draft
              </Button>
            </>
          )}

          {canApproveOrReject && (
            <>
              <Button
                variant="secondary"
                size="md"
                icon={<RotateCcw size={16} />}
                onClick={() => {
                  setDecisionComments('');
                  setDecisionError(null);
                  setShowReturnModal(true);
                }}
              >
                Return for Correction
              </Button>

              <Button
                variant="danger"
                size="md"
                icon={<XCircle size={16} />}
                onClick={() => {
                  setDecisionComments('');
                  setDecisionError(null);
                  setShowRejectModal(true);
                }}
              >
                Reject
              </Button>

              <Button
                variant="primary"
                size="md"
                icon={<CheckCircle2 size={16} />}
                onClick={() => {
                  setDecisionComments('');
                  setDecisionError(null);
                  setShowApproveModal(true);
                }}
              >
                Approve Requisition
              </Button>
            </>
          )}
        </div>
      }
    >
      {/* Success Notification */}
      {actionSuccessMessage && (
        <div
          role="alert"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-success-bg)',
            color: 'var(--color-success-text)',
            border: '1px solid var(--color-success-border)',
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CheckCircle2 size={18} />
            <span>{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 600 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Self-approval Warning Callout */}
      {requisition.status === 'Submitted' && isSelfApprovalBlocked && (
        <div
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-warning-bg)',
            color: 'var(--color-warning-text)',
            border: '1px solid var(--color-warning-border)',
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
            fontSize: '0.875rem',
          }}
        >
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Self-Approval Policy Restriction:</strong> As the original requester of this requisition, internal enterprise controls prevent you from approving your own request. An independent Project Manager or executive must review and sign off.
          </div>
        </div>
      )}

      {/* Status Alert Banners */}
      {requisition.status === 'ReturnedForCorrection' && (
        <div
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-warning-bg)',
            color: 'var(--color-warning-text)',
            border: '1px solid var(--color-warning-border)',
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
            fontSize: '0.875rem',
          }}
        >
          <RotateCcw size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Returned for Correction:</strong> {requisition.correctionNotes || 'Please adjust the line item quantities and resubmit.'}
          </div>
        </div>
      )}

      {requisition.status === 'Rejected' && (
        <div
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-danger-bg)',
            color: 'var(--color-danger-text)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
            fontSize: '0.875rem',
          }}
        >
          <XCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Requisition Rejected:</strong> {requisition.rejectionReason || 'No formal reason recorded.'}
          </div>
        </div>
      )}

      {/* Main Grid: Left Details & Items, Right Audit Trail */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Requisition Header & Line Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Header Metadata Card */}
          <Card>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
                borderBottom: '1px solid var(--color-border-subtle)',
                paddingBottom: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Material Requisition Document
                </span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-charcoal-900)', margin: 'var(--space-1) 0 0' }}>
                  {requisition.requisitionNumber}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <Badge variant={getPriorityBadgeVariant(requisition.priority)}>
                  Priority: {requisition.priority}
                </Badge>
                <StatusBadge status={requisition.status} label={requisition.status === 'ReturnedForCorrection' ? 'Returned for Correction' : requisition.status} />
              </div>
            </div>

            {/* Info Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--space-4)',
                fontSize: '0.875rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--color-charcoal-500)', display: 'block', fontSize: '0.75rem' }}>Project Site</span>
                <strong style={{ color: 'var(--color-charcoal-800)' }}>
                  {requisition.projectCode} &mdash; {requisition.projectName}
                </strong>
              </div>

              <div>
                <span style={{ color: 'var(--color-charcoal-500)', display: 'block', fontSize: '0.75rem' }}>Required By Date</span>
                <strong style={{ color: 'var(--color-charcoal-800)' }}>{requisition.requiredDate}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--color-charcoal-500)', display: 'block', fontSize: '0.75rem' }}>Requested By</span>
                <strong style={{ color: 'var(--color-charcoal-800)' }}>
                  {requisition.requesterName} ({requisition.requesterRole})
                </strong>
              </div>

              <div>
                <span style={{ color: 'var(--color-charcoal-500)', display: 'block', fontSize: '0.75rem' }}>Work Activity / Stage</span>
                <strong style={{ color: 'var(--color-charcoal-800)' }}>
                  {requisition.workActivity || 'General Site Construction'}
                </strong>
              </div>

              {requisition.siteLocationDetail && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--color-charcoal-500)', display: 'block', fontSize: '0.75rem' }}>Site Location / Work Face</span>
                  <span style={{ color: 'var(--color-charcoal-800)' }}>{requisition.siteLocationDetail}</span>
                </div>
              )}

              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--color-charcoal-500)', display: 'block', fontSize: '0.75rem' }}>Purpose & Engineering Justification</span>
                <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-charcoal-800)', lineHeight: 1.5 }}>
                  {requisition.purpose}
                </p>
              </div>

              {requisition.approvedByName && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--border-radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <Shield size={16} style={{ color: 'var(--color-success-text)' }} />
                  <span>
                    Approved by <strong>{requisition.approvedByName}</strong> on{' '}
                    {requisition.approvedAtUtc ? new Date(requisition.approvedAtUtc).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Line Items Card */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--color-bg-surface)',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  Requested Materials ({requisition.items.length})
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>
                  Material specifications and delivery quantities
                </span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--color-bg-subtle)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      color: 'var(--color-charcoal-700)',
                      fontWeight: 600,
                    }}
                  >
                    <th style={{ padding: '0.75rem 1rem' }}>#</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Material & SKU</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Quantity</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Unit</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Stock Availability</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Line Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {requisition.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-charcoal-500)' }}>
                        No material line items added yet.
                      </td>
                    </tr>
                  ) : (
                    requisition.items.map((item, index) => (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--color-charcoal-500)' }}>{index + 1}</td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: 'var(--color-charcoal-800)' }}>{item.materialName}</strong>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-charcoal-600)' }}>
                              {item.materialCode}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--color-charcoal-700)' }}>
                          {item.categoryName}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 700, fontSize: '0.9375rem' }}>
                          {item.requestedQuantity.toLocaleString()}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--color-charcoal-600)' }}>
                          {item.unitCode}
                        </td>
                        {/* Prompt 6 explicit constraint: Stock availability not yet connected */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                            <Badge variant="neutral">
                              Not yet connected
                            </Badge>
                            <span
                              title="Authoritative stock ledger & warehouse balances will connect in subsequent inventory module. Figures are not fabricated."
                              style={{ cursor: 'help', color: 'var(--color-charcoal-500)' }}
                            >
                              <Info size={14} />
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--color-charcoal-600)', fontSize: '0.8125rem' }}>
                          {item.remarks || '&mdash;'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Explanatory callout for stock availability integration */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-bg-surface-hover)',
                borderTop: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: '0.75rem',
                color: 'var(--color-charcoal-600)',
              }}
            >
              <Info size={14} style={{ color: 'var(--color-orange-600)', flexShrink: 0 }} />
              <span>
                <strong>Inventory Ledger Note:</strong> Stock availability is marked as &ldquo;Not yet connected (Future Integration Point)&rdquo;. Real-time warehouse balances, reservations, and goods issue dispatch connect in subsequent modules.
              </span>
            </div>
          </Card>
        </div>

        {/* Right Column: Approval History & Audit Trail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <Card>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--color-border-subtle)',
                paddingBottom: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Clock size={18} style={{ color: 'var(--color-charcoal-700)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Approval Audit Trail</h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>
                {(requisition.approvalHistory || []).length} event{(requisition.approvalHistory || []).length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Timeline View */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {(requisition.approvalHistory || []).map((entry, idx) => (
                <div
                  key={entry.id || idx}
                  style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    position: 'relative',
                    paddingBottom: idx === (requisition.approvalHistory || []).length - 1 ? 0 : 'var(--space-3)',
                    borderLeft:
                      idx === (requisition.approvalHistory || []).length - 1
                        ? '2px solid transparent'
                        : '2px solid var(--color-border-subtle)',
                    marginLeft: 'var(--space-2)',
                    paddingLeft: 'var(--space-3)',
                  }}
                >
                  {/* Timeline Node Dot */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-0.5625rem',
                      top: '0.125rem',
                      backgroundColor: 'var(--color-bg-surface)',
                      borderRadius: '50%',
                      padding: '2px',
                    }}
                  >
                    {getActionIcon(entry.action)}
                  </div>

                  <div style={{ flex: 1, fontSize: '0.8125rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong style={{ color: 'var(--color-charcoal-900)' }}>{entry.action}</strong>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--color-charcoal-500)' }}>
                        {new Date(entry.timestampUtc).toLocaleDateString()} {new Date(entry.timestampUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ color: 'var(--color-charcoal-700)', marginTop: '2px' }}>
                      {entry.actorName} &bull; <span style={{ color: 'var(--color-charcoal-500)' }}>{entry.actorRole}</span>
                    </div>

                    {entry.comments && (
                      <div
                        style={{
                          marginTop: 'var(--space-1)',
                          padding: 'var(--space-2) var(--space-3)',
                          backgroundColor: 'var(--color-bg-subtle)',
                          borderRadius: 'var(--border-radius-sm)',
                          color: 'var(--color-charcoal-800)',
                          fontSize: '0.75rem',
                          fontStyle: 'italic',
                          lineHeight: 1.4,
                        }}
                      >
                        &ldquo;{entry.comments}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Site Execution Guidelines Card */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <Shield size={16} style={{ color: 'var(--color-orange-600)' }} />
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>Workflow Compliance</h4>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.125rem', fontSize: '0.75rem', color: 'var(--color-charcoal-600)', lineHeight: 1.6 }}>
              <li>Requisitions must be reviewed prior to physical staging.</li>
              <li>Rejections and returns require mandatory comments for audit logging.</li>
              <li>Approved requests form the basis for purchase orders and yard material issues.</li>
            </ul>
          </Card>
        </div>
      </div>

      {/* Decision Modal: Approve */}
      {showApproveModal && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Approve Requisition</h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', marginBottom: 'var(--space-3)' }}>
                You are authorizing <strong>{requisition.requisitionNumber}</strong> for {requisition.projectName}.
              </p>

              {decisionError && (
                <div style={{ padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8125rem', marginBottom: 'var(--space-3)' }}>
                  {decisionError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--color-charcoal-700)' }}>
                  Approval Comments (Optional)
                </label>
                <textarea
                  value={decisionComments}
                  onChange={(e) => setDecisionComments(e.target.value)}
                  placeholder="e.g. Verified with site drawings. Approved for issuance."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <Button variant="secondary" size="sm" onClick={() => setShowApproveModal(false)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleApprove} isLoading={isProcessing}>
                Confirm Approval
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Modal: Reject */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--color-danger-text)' }}>
                Reject Requisition
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', marginBottom: 'var(--space-3)' }}>
                A mandatory explanation must be provided to the site team explaining why this requisition cannot proceed.
              </p>

              {decisionError && (
                <div style={{ padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8125rem', marginBottom: 'var(--space-3)' }}>
                  {decisionError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--color-charcoal-700)' }}>
                  Rejection Reason (Mandatory) *
                </label>
                <textarea
                  value={decisionComments}
                  onChange={(e) => setDecisionComments(e.target.value)}
                  placeholder="Detail reason for rejection..."
                  rows={3}
                  required
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <Button variant="secondary" size="sm" onClick={() => setShowRejectModal(false)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleReject}
                isLoading={isProcessing}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Modal: Return for Correction */}
      {showReturnModal && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--color-warning-text)' }}>
                Return for Correction
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', marginBottom: 'var(--space-3)' }}>
                Explain required amendments to the line items or quantities. The requester will be able to edit and resubmit.
              </p>

              {decisionError && (
                <div style={{ padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8125rem', marginBottom: 'var(--space-3)' }}>
                  {decisionError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--color-charcoal-700)' }}>
                  Correction Instructions (Mandatory) *
                </label>
                <textarea
                  value={decisionComments}
                  onChange={(e) => setDecisionComments(e.target.value)}
                  placeholder="e.g. Please reduce rebar quantity to 8 MT for this phase."
                  rows={3}
                  required
                  style={{
                    width: '100%',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <Button variant="secondary" size="sm" onClick={() => setShowReturnModal(false)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleReturnForCorrection}
                isLoading={isProcessing}
              >
                Return to Requester
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSubmitModal}
        title="Submit Requisition for Approval"
        description="Submit this material requisition for Project Manager authorization? Once submitted, requested items are locked against edits unless returned for correction."
        confirmLabel="Submit Requisition"
        variant="primary"
        isLoading={isProcessing}
        onConfirm={handleSubmit}
        onCancel={() => setShowSubmitModal(false)}
      />

      {/* Delete Draft Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteModal}
        title="Delete Requisition Draft"
        description="Are you sure you want to permanently delete this draft requisition? This action cannot be reversed."
        confirmLabel="Delete Draft"
        variant="danger"
        isLoading={isProcessing}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </AppLayout>
  );
};
