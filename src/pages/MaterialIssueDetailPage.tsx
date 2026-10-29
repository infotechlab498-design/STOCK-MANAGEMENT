import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Send,
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowLeft,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Warehouse,
  Building2,
  User,
  Boxes,
  Lock,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import {
  materialIssueService,
  MaterialIssue,
} from '../services/api/materialIssueService';
import { useAuth } from '../app/useAuth';

export const MaterialIssueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [issue, setIssue] = useState<MaterialIssue | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Action states
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [modalReason, setModalReason] = useState<string>('');

  const fetchIssue = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await materialIssueService.getIssueById(id);
      if (res.success && res.data) {
        setIssue(res.data);
      } else {
        setError(res.message || 'Material issue not found');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  const handleAction = async (actionFn: () => Promise<any>, successMsg: string) => {
    setIsProcessing(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await actionFn();
      if (res.success && res.data) {
        setIssue(res.data);
        setActionMessage(successMsg);
      } else {
        setActionError(res.message || 'Action failed');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error executing action');
    } finally {
      setIsProcessing(false);
      setShowRejectModal(false);
      setShowReturnModal(false);
      setModalReason('');
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'N/A';
    try {
      return new Date(isoStr).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const formatCost = (val?: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
    }).format(val || 0);
  };

  if (isLoading) {
    return (
      <div className="content-container">
        <Card>
          <LoadingSpinner label="Fetching material issue voucher details..." />
        </Card>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="content-container">
        <Card>
          <EmptyState
            title="Material Issue Not Found"
            description={error || 'Specified issue voucher does not exist'}
            action={
              <Button variant="secondary" size="sm" onClick={() => navigate('/material-issues')}>
                Back to Directory
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  // Permission checks
  const isCreator = user?.id === issue.createdByUserId;
  const canSubmit = (issue.status === 'Draft' || issue.status === 'ReturnedForCorrection') && isCreator;
  const canApprove =
    issue.status === 'Submitted' &&
    hasRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']) &&
    !isCreator;
  const canPost = issue.status === 'Approved' && hasRole(['SuperAdmin', 'InventoryManager', 'Storekeeper']);
  const canCreateReturn =
    issue.status === 'Posted' && hasRole(['SuperAdmin', 'InventoryManager', 'Storekeeper']);

  return (
    <div className="content-container">
      <PageHeader
        title={`Material Issue: ${issue.issueNumber}`}
        description={`Store dispatch voucher against requisition ${issue.requisitionNumber}`}
        badge={<StatusBadge status={issue.status} />}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="secondary" size="sm" icon={<ArrowLeft size={15} />} onClick={() => navigate('/material-issues')}>
              Back
            </Button>
            <Button variant="secondary" size="sm" icon={<Printer size={15} />} onClick={() => window.print()}>
              Print Voucher
            </Button>

            {canSubmit && (
              <Button
                variant="primary"
                size="sm"
                icon={<Send size={15} />}
                isLoading={isProcessing}
                onClick={() => handleAction(() => materialIssueService.submitIssue(issue.id), 'Issue voucher submitted for approval')}
              >
                Submit Issue
              </Button>
            )}

            {canApprove && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RotateCcw size={15} />}
                  onClick={() => setShowReturnModal(true)}
                >
                  Return for Correction
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<XCircle size={15} />}
                  onClick={() => setShowRejectModal(true)}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<CheckCircle size={15} />}
                  isLoading={isProcessing}
                  onClick={() => handleAction(() => materialIssueService.approveIssue(issue.id), 'Material issue approved')}
                >
                  Approve Issue
                </Button>
              </>
            )}

            {canPost && (
              <Button
                variant="primary"
                size="sm"
                icon={<ShieldCheck size={15} />}
                isLoading={isProcessing}
                onClick={() => handleAction(() => materialIssueService.postIssue(issue.id), 'Material issue posted to stock ledger and inventory balances updated')}
              >
                Post to Stock Ledger
              </Button>
            )}

            {canCreateReturn && (
              <Button
                variant="secondary"
                size="sm"
                icon={<RotateCcw size={15} />}
                onClick={() => navigate(`/material-returns/new?materialIssueId=${issue.id}`)}
              >
                Create Return
              </Button>
            )}
          </div>
        }
      />

      {/* Action Messages */}
      {actionMessage && (
        <Card style={{ backgroundColor: '#F0FFF4', borderColor: '#38A169', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: '#22543D' }}>
            <CheckCircle size={20} />
            <div style={{ fontWeight: 600 }}>{actionMessage}</div>
          </div>
        </Card>
      )}

      {actionError && (
        <Card style={{ backgroundColor: '#FFF5F5', borderColor: '#E53E3E', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: '#742A2A' }}>
            <AlertTriangle size={20} />
            <div style={{ fontWeight: 600 }}>{actionError}</div>
          </div>
        </Card>
      )}

      {/* Immutability Banner */}
      {issue.status === 'Posted' && (
        <div
          style={{
            backgroundColor: 'var(--color-charcoal-800)',
            color: 'var(--color-charcoal-100)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--border-radius-md)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            fontSize: '0.8125rem',
          }}
        >
          <Lock size={18} style={{ color: 'var(--color-orange-400)', flexShrink: 0 }} />
          <div>
            <strong>Posted Dispatch Voucher:</strong> Material issue has been permanently posted to the authoritative stock ledger. Stock balances have been reduced. Direct editing or deletion is prohibited.
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <Card>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-4)', color: 'var(--color-charcoal-900)' }}>
            Header Summary
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: '0.875rem' }}>
            <div><strong>Source Requisition:</strong> <span style={{ color: 'var(--color-orange-700)', fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate(`/requisitions/${issue.requisitionId}`)}>{issue.requisitionNumber}</span></div>
            <div><strong>Issue Date:</strong> {issue.issueDate}</div>
            <div><strong>Project Site:</strong> {issue.projectName}</div>
            <div><strong>Issuing Yard:</strong> {issue.warehouseName}</div>
            <div><strong>Activity / Purpose:</strong> {issue.purpose}</div>
            <div><strong>Receiving Person:</strong> {issue.receivedByPerson}</div>
            <div><strong>Created By:</strong> {issue.createdByName} ({formatDate(issue.createdAtUtc)})</div>
            {issue.postedByName && <div><strong>Posted By:</strong> {issue.postedByName} ({formatDate(issue.postedAtUtc)})</div>}
          </div>

          {issue.remarks && (
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: 'var(--color-charcoal-50)', borderRadius: 'var(--border-radius-md)', fontSize: '0.8125rem' }}>
              <strong>Notes:</strong> {issue.remarks}
            </div>
          )}
        </Card>

        <Card>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-4)', color: 'var(--color-charcoal-900)' }}>
            Fulfillment Linkage
          </h3>
          <Button
            variant="secondary"
            size="md"
            style={{ width: '100%' }}
            onClick={() => navigate(`/requisitions/${issue.requisitionId}/fulfillment`)}
          >
            View Requisition Fulfillment Matrix
          </Button>
        </Card>
      </div>

      {/* Dispatched Line Items Table */}
      <Card style={{ marginBottom: 'var(--space-6)', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-charcoal-200)', backgroundColor: 'var(--color-charcoal-50)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-charcoal-900)' }}>
            Dispatched Material Line Items
          </h3>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Material Code & Name</th>
                <th style={{ textAlign: 'right' }}>Requested</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th style={{ textAlign: 'right' }}>Qty to Issue</th>
                <th style={{ textAlign: 'right' }}>Actual Issued</th>
                <th style={{ textAlign: 'right' }}>Unit Cost ($)</th>
                <th style={{ textAlign: 'right' }}>Total Issued ($)</th>
                <th>Storage Location</th>
                <th>Ledger Ref</th>
              </tr>
            </thead>
            <tbody>
              {issue.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.materialCode}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)' }}>{item.materialName}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>{item.requestedQuantity} {item.unitCode}</td>
                  <td style={{ textAlign: 'right' }}>{item.outstandingQuantity} {item.unitCode}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.quantityToIssue} {item.unitCode}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-orange-700)' }}>
                    {item.actualIssuedQuantity ?? item.quantityToIssue} {item.unitCode}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                    {item.unitCost ? formatCost(item.unitCost) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                    {item.totalIssuedAmount ? formatCurrency(item.totalIssuedAmount) : '-'}
                  </td>
                  <td>{item.storageLocation || 'Site Yard'}</td>
                  <td>
                    {item.stockLedgerEntryId ? (
                      <span className="badge badge-success" style={{ fontFamily: 'monospace' }}>
                        Linked ({item.stockLedgerEntryId.slice(0, 12)})
                      </span>
                    ) : (
                      <span className="badge badge-secondary">Pending Post</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Audit Trail */}
      <Card>
        <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-4)', color: 'var(--color-charcoal-900)' }}>
          Audit History & Governance Log
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {issue.auditTrail.map((entry) => (
            <div
              key={entry.id}
              style={{
                padding: 'var(--space-3)',
                borderLeft: '3px solid var(--color-orange-500)',
                backgroundColor: 'var(--color-charcoal-50)',
                borderRadius: '0 var(--border-radius-md) var(--border-radius-md) 0',
                fontSize: '0.8125rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <strong>{entry.actorName} ({entry.actorRole})</strong>
                <span style={{ color: 'var(--color-charcoal-500)' }}>{formatDate(entry.timestampUtc)}</span>
              </div>
              <div>Action: <span style={{ fontWeight: 600 }}>{entry.action}</span></div>
              {entry.comments && <div style={{ marginTop: '4px', color: 'var(--color-charcoal-700)' }}>{entry.comments}</div>}
            </div>
          ))}
        </div>
      </Card>

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 'var(--border-radius-lg)', maxWidth: '500px', width: '100%', padding: 'var(--space-6)' }}>
            <h3 style={{ marginTop: 0 }}>Reject Material Issue</h3>
            <p style={{ fontSize: '0.875rem' }}>Please provide a mandatory explanation for rejecting this issue voucher.</p>
            <textarea
              rows={3}
              value={modalReason}
              onChange={(e) => setModalReason(e.target.value)}
              placeholder="Enter rejection reason..."
              style={{ width: '100%', padding: '8px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', marginBottom: 'var(--space-4)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="secondary" size="sm" onClick={() => setShowRejectModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isProcessing}
                onClick={() => handleAction(() => materialIssueService.rejectIssue(issue.id, modalReason), 'Issue rejected')}
              >
                Confirm Reject
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Return for Correction Modal */}
      {showReturnModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 'var(--border-radius-lg)', maxWidth: '500px', width: '100%', padding: 'var(--space-6)' }}>
            <h3 style={{ marginTop: 0 }}>Return Issue For Correction</h3>
            <p style={{ fontSize: '0.875rem' }}>Please specify correction feedback instructions for the storekeeper.</p>
            <textarea
              rows={3}
              value={modalReason}
              onChange={(e) => setModalReason(e.target.value)}
              placeholder="Enter correction notes..."
              style={{ width: '100%', padding: '8px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', marginBottom: 'var(--space-4)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="secondary" size="sm" onClick={() => setShowReturnModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isProcessing}
                onClick={() => handleAction(() => materialIssueService.returnForCorrection(issue.id, modalReason), 'Issue returned for correction')}
              >
                Send Return Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
