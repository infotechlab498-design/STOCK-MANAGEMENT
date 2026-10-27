import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Eye,
  RefreshCw,
  Search,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import {
  requisitionService,
  MaterialRequisitionDto,
  ProjectDto,
} from '../services/api/requisitionService';

export const ApprovalInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pendingRequisitions, setPendingRequisitions] = useState<MaterialRequisitionDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Requisition for Modal Decision
  const [activeReq, setActiveReq] = useState<MaterialRequisitionDto | null>(null);
  const [modalType, setModalType] = useState<'Approve' | 'Reject' | 'Return' | null>(null);
  const [decisionComments, setDecisionComments] = useState<string>('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projList, reqList] = await Promise.all([
        requisitionService.getProjects(),
        requisitionService.getApprovalInbox(),
      ]);
      setProjects(projList);
      setPendingRequisitions(reqList);
    } catch (err: any) {
      console.error('Failed to load approval inbox:', err);
      setError(err?.message || 'Failed to fetch pending approval queue');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const filteredRequisitions = pendingRequisitions.filter((r) => {
    if (selectedProject !== 'ALL' && r.projectId !== selectedProject) return false;
    if (searchQuery) {
      const term = searchQuery.trim().toUpperCase();
      return (
        r.requisitionNumber.toUpperCase().includes(term) ||
        r.projectName.toUpperCase().includes(term) ||
        r.requesterName.toUpperCase().includes(term) ||
        r.purpose.toUpperCase().includes(term) ||
        r.items.some((i) => i.materialName.toUpperCase().includes(term))
      );
    }
    return true;
  });

  // Decision submit handler
  const handleExecuteDecision = async () => {
    if (!activeReq || !modalType) return;

    if ((modalType === 'Reject' || modalType === 'Return') && (!decisionComments || decisionComments.trim().length < 3)) {
      setDecisionError(`A mandatory explanation (minimum 3 characters) is required to ${modalType === 'Reject' ? 'reject' : 'return'} this requisition.`);
      return;
    }

    setIsProcessing(true);
    setDecisionError(null);

    try {
      if (modalType === 'Approve') {
        await requisitionService.approveRequisition(activeReq.id, decisionComments || undefined);
        setActionSuccessMessage(`Requisition ${activeReq.requisitionNumber} approved.`);
      } else if (modalType === 'Reject') {
        await requisitionService.rejectRequisition(activeReq.id, decisionComments.trim());
        setActionSuccessMessage(`Requisition ${activeReq.requisitionNumber} rejected.`);
      } else if (modalType === 'Return') {
        await requisitionService.returnForCorrection(activeReq.id, decisionComments.trim());
        setActionSuccessMessage(`Requisition ${activeReq.requisitionNumber} returned to requester for correction.`);
      }

      setModalType(null);
      setActiveReq(null);
      setDecisionComments('');
      await fetchInbox();
    } catch (err: any) {
      setDecisionError(err?.message || 'Decision failed to record');
    } finally {
      setIsProcessing(false);
    }
  };

  const openDecisionModal = (req: MaterialRequisitionDto, type: 'Approve' | 'Reject' | 'Return') => {
    setActiveReq(req);
    setModalType(type);
    setDecisionComments('');
    setDecisionError(null);
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
        { label: 'Material Requisitions', onClick: () => navigate('/requisitions') },
        { label: 'Approval Inbox', active: true },
      ]}
      title="Material Requisition Approval Inbox"
      description="Review, authorize, or return site material requests awaiting project management sign-off."
      actions={
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <Button variant="secondary" size="md" onClick={() => navigate('/requisitions')}>
            All Requisitions
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<RefreshCw size={15} className={isLoading ? 'spin-animation' : ''} />}
            onClick={fetchInbox}
            disabled={isLoading}
          >
            Refresh Queue
          </Button>
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

      {/* Filter and Search Bar */}
      <Card style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between' }}>
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
              placeholder="Filter pending by MR#, requester, material or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          <div style={{ flex: '0 1 240px' }}>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
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
              <option value="ALL">All Authorized Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} &mdash; {p.name}
                </option>
              ))}
            </select>
          </div>

          <Badge variant="orange">
            {pendingRequisitions.length} Pending Decision{pendingRequisitions.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <Card style={{ padding: '3.5rem', textAlign: 'center' }}>
          <LoadingSpinner label="Checking project authorization queue..." />
        </Card>
      ) : error ? (
        <Card style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-danger-text)', marginBottom: 'var(--space-4)' }}>
            <AlertCircle size={36} style={{ margin: '0 auto var(--space-2)' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Failed to Load Inbox</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', marginTop: 'var(--space-1)' }}>{error}</p>
          </div>
          <Button variant="primary" size="sm" onClick={fetchInbox}>
            Retry
          </Button>
        </Card>
      ) : filteredRequisitions.length === 0 ? (
        <Card style={{ padding: '3.5rem', textAlign: 'center' }}>
          <EmptyState
            title="All caught up!"
            description={
              searchQuery || selectedProject !== 'ALL'
                ? 'No pending requisitions match your filter criteria.'
                : 'There are currently no site material requisitions awaiting your review.'
            }
            action={
              <Button variant="secondary" size="md" onClick={() => navigate('/requisitions')}>
                Browse Requisition Register
              </Button>
            }
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {filteredRequisitions.map((req) => {
            const isRequester = req.requesterUserId === user?.id;
            const isSuperAdmin = user?.roles.includes('SuperAdmin');
            const isSelfApprovalBlocked = isRequester && !isSuperAdmin;

            return (
              <Card key={req.id} style={{ padding: 'var(--space-4)' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <span
                        onClick={() => navigate(`/requisitions/${req.id}`)}
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '1.125rem',
                          fontWeight: 700,
                          color: 'var(--color-orange-600)',
                          cursor: 'pointer',
                        }}
                      >
                        {req.requisitionNumber}
                      </span>
                      <Badge variant={getPriorityBadgeVariant(req.priority)}>
                        {req.priority} Priority
                      </Badge>
                      <Badge variant="warning">
                        Pending PM Review
                      </Badge>
                    </div>

                    <div style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-700)', marginTop: '2px' }}>
                      <strong>{req.projectCode}</strong> &mdash; {req.projectName}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Eye size={15} />}
                      onClick={() => navigate(`/requisitions/${req.id}`)}
                    >
                      Full Details
                    </Button>

                    {!isSelfApprovalBlocked ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<RotateCcw size={15} />}
                          onClick={() => openDecisionModal(req, 'Return')}
                        >
                          Return
                        </Button>

                        <Button
                          variant="danger"
                          size="sm"
                          icon={<XCircle size={15} />}
                          onClick={() => openDecisionModal(req, 'Reject')}
                        >
                          Reject
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          icon={<CheckCircle2 size={15} />}
                          onClick={() => openDecisionModal(req, 'Approve')}
                        >
                          Approve
                        </Button>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', fontStyle: 'italic' }}>
                        Self-approval blocked (created by you)
                      </span>
                    )}
                  </div>
                </div>

                {/* Purpose & Meta */}
                <p style={{ margin: '0 0 var(--space-3)', fontSize: '0.875rem', color: 'var(--color-charcoal-800)', lineHeight: 1.5 }}>
                  {req.purpose}
                </p>

                {/* Summary Items Table */}
                <div
                  style={{
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--border-radius-sm)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ color: 'var(--color-charcoal-500)' }}>Requester: </span>
                      <strong>{req.requesterName}</strong> ({req.requesterRole})
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-charcoal-500)' }}>Required By: </span>
                      <strong>{req.requiredDate}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-charcoal-500)' }}>Items: </span>
                      <strong>{req.items.length} line{req.items.length === 1 ? '' : 's'}</strong>
                    </div>
                  </div>

                  <div style={{ color: 'var(--color-charcoal-600)', fontSize: '0.75rem' }}>
                    Stock Availability: <em>Not yet connected (Future Integration Point)</em>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Decision Execution Modal */}
      {modalType && activeReq && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3
                className="modal-title"
                style={{
                  color:
                    modalType === 'Approve'
                      ? 'var(--color-success-text)'
                      : modalType === 'Reject'
                      ? 'var(--color-danger-text)'
                      : 'var(--color-warning-text)',
                }}
              >
                {modalType === 'Approve' && 'Authorize Material Requisition'}
                {modalType === 'Reject' && 'Reject Material Requisition'}
                {modalType === 'Return' && 'Return Requisition for Correction'}
              </h3>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', marginBottom: 'var(--space-3)' }}>
                Requisition <strong>{activeReq.requisitionNumber}</strong> for {activeReq.projectName}.
              </p>

              {decisionError && (
                <div
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    backgroundColor: 'var(--color-danger-bg)',
                    color: 'var(--color-danger-text)',
                    borderRadius: 'var(--border-radius-sm)',
                    fontSize: '0.8125rem',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  {decisionError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--color-charcoal-700)' }}>
                  {modalType === 'Approve' ? 'Approval Comments (Optional)' : 'Reviewer Feedback Notes (Mandatory) *'}
                </label>
                <textarea
                  value={decisionComments}
                  onChange={(e) => setDecisionComments(e.target.value)}
                  placeholder={
                    modalType === 'Approve'
                      ? 'Add any staging or procurement instructions...'
                      : 'Specify reason or required adjustments for the site requester...'
                  }
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
              <Button variant="secondary" size="sm" onClick={() => setModalType(null)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button
                variant={modalType === 'Reject' ? 'danger' : 'primary'}
                size="sm"
                onClick={handleExecuteDecision}
                isLoading={isProcessing}
              >
                Confirm {modalType}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};
