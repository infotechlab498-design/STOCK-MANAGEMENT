import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileCheck,
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Send,
  Truck,
  XCircle,
  Edit2,
  Printer,
  Shield,
  CreditCard,
  MapPin,
  ClipboardList,
  RefreshCw,
  X,
  FileText,
  Info,
} from 'lucide-react';
import { useAuth } from '../app/useAuth';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { Badge } from '../components/common/Badge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import {
  purchaseOrderService,
  PurchaseOrderDto,
} from '../services/api/purchaseOrderService';

export const PurchaseOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [po, setPo] = useState<PurchaseOrderDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog States
  const [isSubmitOpen, setIsSubmitOpen] = useState<boolean>(false);
  const [isApproveOpen, setIsApproveOpen] = useState<boolean>(false);
  const [isIssueOpen, setIsIssueOpen] = useState<boolean>(false);
  const [rejectDialog, setRejectDialog] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [cancelDialog, setCancelDialog] = useState<boolean>(false);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await purchaseOrderService.getPurchaseOrderById(id);
      setPo(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load purchase order details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <AppLayout>
        <Card>
          <div style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
            <LoadingSpinner label="Retrieving purchase order contract and audit trail..." />
          </div>
        </Card>
      </AppLayout>
    );
  }

  if (error || !po) {
    return (
      <AppLayout>
        <Card>
          <EmptyState
            title="Purchase Order Not Found"
            description={error || `No purchase order found matching identifier '${id}'.`}
            action={
              <Button variant="secondary" onClick={() => navigate('/purchase-orders')}>
                Return to Purchase Orders
              </Button>
            }
          />
        </Card>
      </AppLayout>
    );
  }

  // Authorization Permissions
  const isSuperAdmin = hasRole(['SuperAdmin']);
  const isProcurementOfficer = hasRole(['ProcurementOfficer']);
  const isProjectManager = hasRole(['ProjectManager']);

  // SoD: inventory roles do not create/edit/issue POs — procurement (or SA) only
  const canEdit = po.status === 'Draft' && (isSuperAdmin || isProcurementOfficer);
  const canSubmit = po.status === 'Draft' && (isSuperAdmin || isProcurementOfficer);

  // Self-approval: creator cannot approve; SuperAdmin may still be blocked by API if SelfApprovalAllowed=false
  const isCreator = po.createdByUserId === user?.id;
  const isEligibleApprover = isSuperAdmin || isProjectManager;
  const canApprove = po.status === 'PendingApproval' && isEligibleApprover && !isCreator;
  const isSelfApprovalBlocked = po.status === 'PendingApproval' && isEligibleApprover && isCreator;

  const canReject = po.status === 'PendingApproval' && isEligibleApprover;
  const canIssue = po.status === 'Approved' && (isSuperAdmin || isProcurementOfficer);
  const canCancel =
    ['Draft', 'PendingApproval', 'Approved', 'Issued'].includes(po.status) &&
    (isSuperAdmin || isProcurementOfficer);

  // Action Handlers
  const handleAction = async (actionFn: () => Promise<any>, successMsg: string) => {
    setActionInProgress(true);
    setActionMessage(null);
    try {
      await actionFn();
      setActionMessage({ type: 'success', text: successMsg });
      loadData();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Action failed.',
      });
    } finally {
      setActionInProgress(false);
      setIsSubmitOpen(false);
      setIsApproveOpen(false);
      setIsIssueOpen(false);
      setRejectDialog(false);
      setCancelDialog(false);
    }
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Top Header & Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/purchase-orders')}
              icon={<ArrowLeft size={16} />}
            >
              Back to POs
            </Button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-charcoal-900)', margin: 0 }}>
                  {po.poNumber}
                </h1>
                <StatusBadge
                  status={po.status}
                  label={po.status === 'PendingApproval' ? 'Pending Approval' : po.status}
                />
                {po.requisitionNumber && (
                  <Badge variant="neutral">Req: {po.requisitionNumber}</Badge>
                )}
              </div>
              <p style={{ color: 'var(--color-charcoal-600)', margin: '4px 0 0', fontSize: '0.875rem' }}>
                Project: {po.projectName} | Supplier: {po.supplierName} | Created by {po.createdByName} on {new Date(po.createdAtUtc).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPrintModalOpen(true)}
              icon={<Printer size={14} />}
            >
              Print / Preview
            </Button>

            {canEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/purchase-orders/${po.id}/edit`)}
                icon={<Edit2 size={14} />}
              >
                Edit Draft
              </Button>
            )}

            {canSubmit && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsSubmitOpen(true)}
                icon={<Send size={14} />}
              >
                Submit for Approval
              </Button>
            )}

            {canApprove && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsApproveOpen(true)}
                icon={<CheckCircle2 size={14} />}
              >
                Approve PO
              </Button>
            )}

            {canReject && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRejectionReason('');
                  setRejectDialog(true);
                }}
                style={{ color: '#C53030', borderColor: '#FEB2B2' }}
                icon={<XCircle size={14} />}
              >
                Reject PO
              </Button>
            )}

            {canIssue && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsIssueOpen(true)}
                icon={<Truck size={14} />}
              >
                Issue to Supplier
              </Button>
            )}

            {(po.status === 'Issued' || po.status === 'PartiallyReceived') && hasRole(['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProcurementOfficer']) && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/grns/new?poId=${po.id}`)}
                icon={<Truck size={14} />}
                style={{ backgroundColor: '#DD6B20', borderColor: '#DD6B20' }}
              >
                Receive Goods (GRN)
              </Button>
            )}

            {canCancel && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCancellationReason('');
                  setCancelDialog(true);
                }}
                style={{ color: '#C53030', borderColor: '#FEB2B2' }}
                icon={<XCircle size={14} />}
              >
                Cancel PO
              </Button>
            )}
          </div>
        </div>

        {/* Self-approval Policy Notice if creator is viewing their own pending PO */}
        {isSelfApprovalBlocked && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#FEFCBF',
              border: '1px solid #FAF089',
              color: '#744210',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: '0.875rem',
            }}
          >
            <Shield size={16} />
            <span>
              <strong>Dual-Control Policy:</strong> You drafted/submitted this purchase order. Internal governance prevents creators from approving their own orders. Independent Project Manager or Super Admin approval is required.
            </span>
          </div>
        )}

        {/* Notification Banner */}
        {actionMessage && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: actionMessage.type === 'success' ? '#F0FFF4' : '#FFF5F5',
              border: `1px solid ${actionMessage.type === 'success' ? '#9AE6B4' : '#FEB2B2'}`,
              color: actionMessage.type === 'success' ? '#22543D' : '#742A2A',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {actionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Rejection / Cancellation explanation banner if applicable */}
        {po.status === 'Rejected' && po.rejectionReason && (
          <div
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#FFF5F5',
              border: '1px solid #FEB2B2',
              color: '#9B2C2C',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 600 }}>
              <XCircle size={18} />
              Rejection Reason:
            </div>
            <div style={{ marginTop: 4, fontSize: '0.875rem' }}>{po.rejectionReason}</div>
          </div>
        )}

        {po.status === 'Cancelled' && po.cancellationReason && (
          <div
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#FFF5F5',
              border: '1px solid #FEB2B2',
              color: '#9B2C2C',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 600 }}>
              <XCircle size={18} />
              Cancellation Reason:
            </div>
            <div style={{ marginTop: 4, fontSize: '0.875rem' }}>{po.cancellationReason}</div>
          </div>
        )}

        {/* Goods Receiving Notice Box */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#EDF2F7',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            color: 'var(--color-charcoal-700)',
            fontSize: '0.875rem',
          }}
        >
          <Info size={20} style={{ color: 'var(--color-orange-500)', flexShrink: 0 }} />
          <div>
            <strong>Goods Receiving Note (GRN) Integration:</strong> Physical site receiving is scheduled for Prompt 8. Received quantities on this contract remain at zero and outstanding quantities match ordered quantities until warehouse receipts are formally posted.
          </div>
        </div>

        {/* 3 Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
          {/* Supplier Info */}
          <Card title="Vendor Information">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Building2 size={16} style={{ color: 'var(--color-orange-500)' }} />
                <span style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>{po.supplierName}</span>
                <Badge variant="neutral">{po.supplierCode}</Badge>
              </div>
              <div style={{ color: 'var(--color-charcoal-700)' }}>
                <strong>Contact / Rep:</strong> {po.supplierContact}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-charcoal-700)' }}>
                <CreditCard size={14} style={{ color: 'var(--color-orange-500)' }} />
                <span><strong>Payment Terms:</strong> {po.paymentTerms}</span>
              </div>
            </div>
          </Card>

          {/* Delivery & Schedule */}
          <Card title="Project Site & Delivery Details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.875rem' }}>
              <div>
                <strong>Project:</strong> {po.projectName} ({po.projectCode})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <MapPin size={14} style={{ color: 'var(--color-orange-500)' }} />
                <span><strong>Delivery Location:</strong> {po.deliveryLocation}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Calendar size={14} style={{ color: 'var(--color-charcoal-500)' }} />
                <span><strong>Order Date:</strong> {po.orderDate}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Clock size={14} style={{ color: 'var(--color-orange-500)' }} />
                <span><strong>Expected Delivery:</strong> {po.expectedDeliveryDate}</span>
              </div>
            </div>
          </Card>

          {/* Requisition & Order Notes */}
          <Card title="Origin & Justification">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.875rem' }}>
              <div>
                <strong>Procurement Source:</strong>{' '}
                {po.requisitionId ? (
                  <button
                    onClick={() => navigate(`/requisitions/${po.requisitionId}`)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-orange-600)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Requisition #{po.requisitionNumber}
                  </button>
                ) : (
                  <Badge variant="neutral">Standalone Operational Order</Badge>
                )}
              </div>
              {po.notes && (
                <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', backgroundColor: 'var(--color-bg-page)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-600)' }}>Notes:</div>
                  <div style={{ color: 'var(--color-charcoal-800)', fontSize: '0.8125rem' }}>{po.notes}</div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Line Items Table with Ordered, Received, and Outstanding Quantities */}
        <Card title={`Purchase Order Line Items (${po.items.length})`}>
          <div style={{ overflowX: 'auto', margin: 'calc(-1 * var(--space-4))' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-page)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>#</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Material Description</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>UOM</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Ordered</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Received</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Outstanding</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Unit Rate</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Disc ($)</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Tax %</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }} className="hover-bg-subtle">
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-charcoal-500)' }}>{idx + 1}</td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>{item.materialName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', display: 'flex', gap: 6, marginTop: 2 }}>
                        <Badge variant="neutral">{item.materialCode}</Badge>
                        {item.specification && <span>{item.specification}</span>}
                      </div>
                      {item.notes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-orange-700)', marginTop: 2 }}>
                          Note: {item.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-charcoal-700)' }}>
                      {item.unitCode}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600 }}>
                      {item.orderedQuantity.toLocaleString()}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                      <span
                        style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: (item.receivedQuantity ?? 0) >= item.orderedQuantity ? '#C6F6D5' : (item.receivedQuantity ?? 0) > 0 ? '#FEFCBF' : '#EDF2F7',
                          color: (item.receivedQuantity ?? 0) >= item.orderedQuantity ? '#22543D' : (item.receivedQuantity ?? 0) > 0 ? '#744210' : 'var(--color-charcoal-600)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {item.receivedQuantity ?? 0} {(item.receivedQuantity ?? 0) >= item.orderedQuantity ? '(Complete)' : (item.receivedQuantity ?? 0) > 0 ? '(Partial)' : '(Pending)'}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 700, color: 'var(--color-orange-600)' }}>
                      {item.outstandingQuantity.toLocaleString()}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                      ${item.unitRate.toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', color: item.lineDiscount > 0 ? '#C53030' : undefined }}>
                      {item.lineDiscount > 0 ? `-$${item.lineDiscount.toFixed(2)}` : '$0.00'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                      {item.taxRate}%
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 700, color: 'var(--color-charcoal-900)' }}>
                      ${item.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Financial Totals Breakdown & Audit History */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {/* Audit History Timeline */}
          <Card title="Chronological Approval & Transition Audit Trail">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {po.approvalHistory.map((entry, idx) => (
                <div
                  key={entry.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-3)',
                    paddingBottom: 'var(--space-3)',
                    borderBottom: idx === po.approvalHistory.length - 1 ? 'none' : '1px dashed var(--color-border)',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-orange-100)',
                      color: 'var(--color-orange-600)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <CheckCircle2 size={16} />
                  </div>
                  <div style={{ flex: 1, fontSize: '0.8125rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>{entry.action}</span>
                      <span style={{ color: 'var(--color-charcoal-500)', fontSize: '0.75rem' }}>
                        {new Date(entry.timestampUtc).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: 'var(--color-charcoal-600)', marginTop: 2 }}>
                      By: <strong>{entry.actorName}</strong> ({entry.actorRole})
                    </div>
                    {entry.comments && (
                      <div style={{ marginTop: 4, color: 'var(--color-charcoal-800)', fontStyle: 'italic' }}>
                        &ldquo;{entry.comments}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Financial Totals Summary */}
          <Card title="Commercial Totals Breakdown">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-charcoal-700)' }}>
                <span>Material Lines Subtotal:</span>
                <span>${po.subtotal.toFixed(2)}</span>
              </div>

              {po.itemsDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#C53030' }}>
                  <span>Line Level Discounts:</span>
                  <span>-${po.itemsDiscount.toFixed(2)}</span>
                </div>
              )}

              {po.headerDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#C53030' }}>
                  <span>Additional Header Discount:</span>
                  <span>-${po.headerDiscount.toFixed(2)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-charcoal-700)' }}>
                <span>Total Taxes (VAT / GST):</span>
                <span>${po.taxAmount.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-charcoal-700)' }}>
                <span>Site Haulage & Freight:</span>
                <span>${po.freight.toFixed(2)}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  color: 'var(--color-charcoal-900)',
                  borderTop: '2px solid var(--color-border)',
                  paddingTop: 'var(--space-3)',
                  marginTop: 'var(--space-2)',
                }}
              >
                <span>Grand Total:</span>
                <span style={{ color: 'var(--color-orange-600)' }}>
                  ${po.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>USD</span>
                </span>
              </div>

              <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-page)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--color-charcoal-600)' }}>
                <div>• Subtotal: sum(line quantities × rates)</div>
                <div>• Tax: calculated per line on net taxable amount</div>
                <div>• Grand Total: Subtotal - Discounts + Tax + Freight</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Dialog: Submit PO */}
        {isSubmitOpen && (
          <ConfirmDialog
            isOpen={true}
            title="Submit Purchase Order for Approval"
            description={`Are you sure you want to submit PO ${po.poNumber} for Project Manager approval? The contract will enter PendingApproval status.`}
            confirmLabel="Submit"
            cancelLabel="Cancel"
            variant="primary"
            isLoading={actionInProgress}
            onConfirm={() =>
              handleAction(
                () => purchaseOrderService.submitPurchaseOrder(po.id, 'Submitted for formal review.'),
                'Purchase order successfully submitted for approval.'
              )
            }
            onCancel={() => setIsSubmitOpen(false)}
          />
        )}

        {/* Dialog: Approve PO */}
        {isApproveOpen && (
          <ConfirmDialog
            isOpen={true}
            title="Authorize Purchase Order"
            description={`Are you sure you want to approve PO ${po.poNumber} for $${po.grandTotal.toFixed(2)}? This confirms procurement budget authorization.`}
            confirmLabel="Approve Order"
            cancelLabel="Cancel"
            variant="primary"
            isLoading={actionInProgress}
            onConfirm={() =>
              handleAction(
                () => purchaseOrderService.approvePurchaseOrder(po.id, 'Commercial contract approved.'),
                'Purchase order approved successfully.'
              )
            }
            onCancel={() => setIsApproveOpen(false)}
          />
        )}

        {/* Dialog: Issue to Supplier */}
        {isIssueOpen && (
          <ConfirmDialog
            isOpen={true}
            title="Issue Purchase Order to Supplier"
            description={`Issue PO ${po.poNumber} to ${po.supplierName}? This locks contract pricing and marks the order as dispatched to the vendor.`}
            confirmLabel="Issue PO"
            cancelLabel="Cancel"
            variant="primary"
            isLoading={actionInProgress}
            onConfirm={() =>
              handleAction(
                () => purchaseOrderService.issuePurchaseOrder(po.id, 'Contract dispatched to vendor.'),
                `Purchase order ${po.poNumber} issued to supplier.`
              )
            }
            onCancel={() => setIsIssueOpen(false)}
          />
        )}

        {/* Dialog: Reject PO */}
        {rejectDialog && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 'var(--space-4)',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                maxWidth: '500px',
                width: '100%',
                padding: 'var(--space-6)',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 var(--space-2)' }}>
                Reject Purchase Order
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', margin: '0 0 var(--space-4)' }}>
                Provide a clear justification for rejecting this purchase order. The rejection reason is mandatory and will be recorded in the permanent audit trail.
              </p>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection (e.g., exceeds budget line, price discrepancy with quote)..."
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  marginBottom: 'var(--space-4)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <Button variant="secondary" onClick={() => setRejectDialog(false)} disabled={actionInProgress}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={actionInProgress || rejectionReason.trim().length < 3}
                  onClick={() =>
                    handleAction(
                      () => purchaseOrderService.rejectPurchaseOrder(po.id, rejectionReason.trim()),
                      'Purchase order rejected.'
                    )
                  }
                  style={{ backgroundColor: '#C53030' }}
                >
                  Reject Order
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Dialog: Cancel PO */}
        {cancelDialog && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 'var(--space-4)',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                maxWidth: '500px',
                width: '100%',
                padding: 'var(--space-6)',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 var(--space-2)' }}>
                Cancel Purchase Order
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', margin: '0 0 var(--space-4)' }}>
                Are you sure you want to cancel this purchase order? Cancellation is permanent and frees any reserved requisition quantities. A cancellation reason is mandatory.
              </p>
              <textarea
                rows={3}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Reason for cancellation (e.g., supplier unable to fulfill lead time, design change)..."
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  marginBottom: 'var(--space-4)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <Button variant="secondary" onClick={() => setCancelDialog(false)} disabled={actionInProgress}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  disabled={actionInProgress || cancellationReason.trim().length < 3}
                  onClick={() =>
                    handleAction(
                      () => purchaseOrderService.cancelPurchaseOrder(po.id, cancellationReason.trim()),
                      'Purchase order cancelled.'
                    )
                  }
                  style={{ backgroundColor: '#C53030' }}
                >
                  Confirm Cancellation
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Printable Preview Modal */}
        {printModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 'var(--space-4)',
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: 'var(--radius-lg)',
                maxWidth: '800px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: 'var(--space-8)',
                color: '#1A202C',
                fontFamily: 'sans-serif',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #2D3748', paddingBottom: 'var(--space-4)' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#2D3748' }}>CONSTRUCTCORP INC.</h1>
                  <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#718096' }}>Civil Engineering & Construction Materials</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#DD6B20' }}>PURCHASE ORDER</h2>
                  <div style={{ fontWeight: 600, fontSize: '1rem', marginTop: 4 }}>{po.poNumber}</div>
                  <div style={{ fontSize: '0.8125rem', color: '#718096' }}>Status: {po.status}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginTop: 'var(--space-6)', fontSize: '0.875rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: '#718096', margin: '0 0 6px' }}>Vendor</h3>
                  <div style={{ fontWeight: 700 }}>{po.supplierName}</div>
                  <div>Attn: {po.supplierContact}</div>
                  <div>Payment Terms: {po.paymentTerms}</div>
                </div>
                <div>
                  <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: '#718096', margin: '0 0 6px' }}>Ship To / Delivery</h3>
                  <div style={{ fontWeight: 700 }}>{po.projectName}</div>
                  <div>Location: {po.deliveryLocation}</div>
                  <div>Expected Date: {po.expectedDeliveryDate}</div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 'var(--space-6)', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F7FAFC', borderBottom: '2px solid #E2E8F0' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Item / Description</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>UOM</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '8px' }}>
                        <div style={{ fontWeight: 600 }}>{it.materialName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>{it.materialCode}</div>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{it.orderedQuantity}</td>
                      <td style={{ padding: '8px' }}>{it.unitCode}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>${it.unitRate.toFixed(2)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>${it.lineTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
                <div style={{ width: '250px', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Subtotal:</span>
                    <span>${po.subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Discount:</span>
                    <span>-${po.totalDiscount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Tax:</span>
                    <span>${po.taxAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Freight:</span>
                    <span>${po.freight.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '2px solid #2D3748', fontWeight: 700, fontSize: '1.125rem' }}>
                    <span>Total (USD):</span>
                    <span style={{ color: '#DD6B20' }}>${po.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-8)' }}>
                <Button variant="secondary" onClick={() => setPrintModalOpen(false)}>
                  Close
                </Button>
                <Button variant="primary" onClick={() => window.print()}>
                  Print Contract
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};
