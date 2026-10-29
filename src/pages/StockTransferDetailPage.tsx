import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/StateViews';
import { useAuth } from '../app/useAuth';
import {
  stockTransferService,
  StockTransfer,
  TransferReconciliationResponse,
} from '../services/api/stockTransferService';

export const StockTransferDetailPage: React.FC<{ transferId?: string }> = ({ transferId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const { user } = useAuth();

  const resolvedId =
    transferId ||
    params.id ||
    (() => {
      const m = location.pathname.match(/^\/stock-transfers\/([^/]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    })();

  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [reconciliation, setReconciliation] = useState<TransferReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Modals / Panels state
  const [activeModal, setActiveModal] = useState<
    | null
    | 'approve'
    | 'reject'
    | 'return'
    | 'cancel'
    | 'dispatch'
    | 'receive'
    | 'inspect'
    | 'resolveDiscrepancy'
  >(null);

  // Approval state
  const [approvalQtyMap, setApprovalQtyMap] = useState<Record<string, string>>({});
  const [approvalComments, setApprovalComments] = useState('');

  // Reject / Return / Cancel state
  const [reasonText, setReasonText] = useState('');

  // Dispatch state
  const [dispatchQtyMap, setDispatchQtyMap] = useState<Record<string, string>>({});
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedArrivalDate, setExpectedArrivalDate] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [dispatchReference, setDispatchReference] = useState('');
  const [dispatchRemarks, setDispatchRemarks] = useState('');

  // Receive & Inspect state
  const [receiveLines, setReceiveLines] = useState<
    Record<
      string,
      {
        good: string;
        damaged: string;
        short: string;
        disputed: string;
        discrepancyReason: string;
        inspectionNotes: string;
      }
    >
  >({});
  const [actualReceiptDate, setActualReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiveRemarks, setReceiveRemarks] = useState('');
  const [isIncrementalReceipt, setIsIncrementalReceipt] = useState(false);

  // Discrepancy Resolution state
  const [selectedDiscrepancyLineId, setSelectedDiscrepancyLineId] = useState<string>('');
  const [resolutionAction, setResolutionAction] = useState<string>('WriteOffApproved');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  const loadTransferDetails = useCallback(async () => {
    if (!resolvedId) return;
    setLoading(true);
    setError(null);
    try {
      const [trfRes, recRes] = await Promise.all([
        stockTransferService.getById(resolvedId),
        stockTransferService.getReconciliation(resolvedId),
      ]);

      if (trfRes.success && trfRes.data) {
        const t = trfRes.data;
        setTransfer(t);

        const appMap: Record<string, string> = {};
        const dispMap: Record<string, string> = {};
        const recMap: Record<
          string,
          {
            good: string;
            damaged: string;
            short: string;
            disputed: string;
            discrepancyReason: string;
            inspectionNotes: string;
          }
        > = {};

        const isPartial = t.status === 'PartiallyReceived';
        setIsIncrementalReceipt(isPartial);

        t.items.forEach((it) => {
          appMap[it.id] = String(it.approvedQuantity ?? it.requestedQuantity);
          dispMap[it.id] = String(it.dispatchedQuantity > 0 ? it.dispatchedQuantity : it.approvedQuantity || it.requestedQuantity);
          const defaultRecGood = isPartial
            ? String(it.remainingInTransitQuantity || 0)
            : String(it.dispatchedQuantity || it.approvedQuantity || 0);
          recMap[it.id] = {
            good: defaultRecGood,
            damaged: '0',
            short: '0',
            disputed: '0',
            discrepancyReason: it.discrepancyReason || '',
            inspectionNotes: it.inspectionNotes || '',
          };
        });

        setApprovalQtyMap(appMap);
        setDispatchQtyMap(dispMap);
        setReceiveLines(recMap);
        setExpectedArrivalDate(t.expectedArrivalDate || '');
      } else {
        setError('Transfer document could not be loaded.');
      }

      if (recRes.success && recRes.data) {
        setReconciliation(recRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading stock transfer details.');
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    loadTransferDetails();
  }, [loadTransferDetails]);

  const canApprove = user?.roles?.some((r) =>
    ['SuperAdmin', 'InventoryManager', 'ProjectManager'].includes(r)
  );
  const canDispatchOrReceive = user?.roles?.some((r) =>
    ['SuperAdmin', 'InventoryManager', 'Storekeeper'].includes(r)
  );

  const mapStatusBadge = (status: string): { status: string; label: string } => {
    switch (status) {
      case 'Completed':
        return { status: 'completed', label: 'Completed' };
      case 'Received':
        return { status: 'warning', label: 'Received (Pending Reconciliation)' };
      case 'PartiallyReceived':
        return { status: 'in_transit', label: 'Partially Received' };
      case 'Dispatched':
        return { status: 'in_transit', label: 'Dispatched / In Transit' };
      case 'Approved':
        return { status: 'approved', label: 'Approved for Dispatch' };
      case 'Submitted':
        return { status: 'pending', label: 'Pending Approval' };
      case 'ReturnedForCorrection':
        return { status: 'warning', label: 'Returned for Correction' };
      case 'Rejected':
        return { status: 'rejected', label: 'Rejected' };
      case 'Cancelled':
        return { status: 'rejected', label: 'Cancelled' };
      default:
        return { status: 'draft', label: 'Draft' };
    }
  };

  const handleSubmitDraft = async () => {
    if (!transfer) return;
    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await stockTransferService.submit(transfer.id);
      if (res.success) {
        setActionSuccess('Transfer request submitted for managerial approval.');
        await loadTransferDetails();
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit transfer.');
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!transfer) return;
    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const items = transfer.items.map((it) => ({
        id: it.id,
        materialId: it.materialId,
        approvedQuantity: parseFloat(approvalQtyMap[it.id] ?? String(it.approvedQuantity)) || 0,
      }));
      const res = await stockTransferService.approve(transfer.id, {
        items,
        comments: approvalComments || undefined,
      });
      if (res.success) {
        setActiveModal(null);
        setActionSuccess('Stock transfer approved for dispatch.');
        await loadTransferDetails();
      }
    } catch (err: any) {
      setActionError(err.message || 'Approval failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!transfer) return;
    setProcessing(true);
    setActionError(null);
    try {
      const res = await stockTransferService.reject(transfer.id, reasonText);
      if (res.success) {
        setActiveModal(null);
        setReasonText('');
        setActionSuccess('Stock transfer rejected.');
        await loadTransferDetails();
      }
    } catch (err: any) {
      setActionError(err.message || 'Rejection failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReturnForCorrection = async () => {
    if (!transfer) return;
    setProcessing(true);
    setActionError(null);
    try {
      const res = await stockTransferService.returnForCorrection(transfer.id, reasonText);
      if (res.success) {
        setActiveModal(null);
        setReasonText('');
        setActionSuccess('Transfer returned to requester for correction.');
        await loadTransferDetails();
      }
    } catch (err: any) {
      setActionError(err.message || 'Return for correction failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelBeforeDispatch = async () => {
    if (!transfer) return;
    setProcessing(true);
    setActionError(null);
    try {
      const res = await stockTransferService.cancel(
        transfer.id,
        reasonText || 'Cancelled before dispatch.'
      );
      if (res.success) {
        setActiveModal(null);
        setReasonText('');
        setActionSuccess('Stock transfer cancelled prior to dispatch.');
        await loadTransferDetails();
      }
    } catch (err: any) {
      setActionError(err.message || 'Cancellation failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDispatch = async () => {
    if (!transfer) return;
    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const items = transfer.items.map((it) => ({
        id: it.id,
        materialId: it.materialId,
        dispatchedQuantity: parseFloat(dispatchQtyMap[it.id] ?? String(it.approvedQuantity)) || 0,
      }));
      const res = await stockTransferService.dispatch(transfer.id, {
        items,
        dispatchDate,
        expectedArrivalDate: expectedArrivalDate || undefined,
        vehicleNumber: vehicleNumber || undefined,
        driverName: driverName || undefined,
        dispatchReference: dispatchReference || undefined,
        remarks: dispatchRemarks || undefined,
      });
      if (res.success) {
        setActiveModal(null);
        setActionSuccess(
          'Outbound dispatch posted to Stock Ledger. Source stock reduced and in-transit tracking activated.'
        );
        await loadTransferDetails();
      }
    } catch (err: any) {
      setActionError(err.message || 'Dispatch failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReceive = async () => {
    if (!transfer) return;
    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const items = transfer.items.map((it) => {
        const row = receiveLines[it.id] || {
          good: '0',
          damaged: '0',
          short: '0',
          disputed: '0',
          discrepancyReason: '',
          inspectionNotes: '',
        };
        return {
          id: it.id,
          materialId: it.materialId,
          receivedGoodQuantity: parseFloat(row.good) || 0,
          damagedQuantity: parseFloat(row.damaged) || 0,
          shortQuantity: parseFloat(row.short) || 0,
          disputedQuantity: parseFloat(row.disputed) || 0,
          discrepancyReason: row.discrepancyReason || undefined,
          inspectionNotes: row.inspectionNotes || undefined,
          isIncremental: isIncrementalReceipt,
          isCumulative: !isIncrementalReceipt,
        };
      });

      const res = await stockTransferService.receive(transfer.id, {
        items,
        actualReceiptDate,
        remarks: receiveRemarks || undefined,
        isIncremental: isIncrementalReceipt,
      });
      if (res.success) {
        setActiveModal(null);
        setActionSuccess(
          'Destination receipt posted to Stock Ledger. Accepted good quantities added to destination usable stock at source WAC.'
        );
        await loadTransferDetails();
      }
    } catch (err: any) {
      setActionError(err.message || 'Receipt posting failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleResolveDiscrepancy = async () => {
    if (!transfer || !selectedDiscrepancyLineId) return;
    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await stockTransferService.resolveDiscrepancy(
        transfer.id,
        selectedDiscrepancyLineId,
        {
          resolutionAction,
          resolutionNotes: resolutionNotes || 'Discrepancy investigated and reconciled.',
        }
      );
      if (res.success) {
        setActiveModal(null);
        setResolutionNotes('');
        setActionSuccess('Transfer line discrepancy resolved and audited.');
        await loadTransferDetails();
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to resolve discrepancy.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteTransfer = async () => {
    if (!transfer) return;
    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await stockTransferService.complete(
        transfer.id,
        'Transfer reconciled and closed.'
      );
      if (res.success) {
        setActionSuccess('Stock transfer marked as Completed.');
        await loadTransferDetails();
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to complete transfer.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading stock transfer document..." />;
  }

  if (error || !transfer) {
    return (
      <ErrorState
        message={error || 'Transfer not found.'}
        onRetry={loadTransferDetails}
      />
    );
  }

  const badge = mapStatusBadge(transfer.status);
  const isCrossProject = transfer.sourceProjectId !== transfer.destinationProjectId;
  const totalDispatchedVal = transfer.items.reduce(
    (s, it) => s + (it.totalDispatchedAmount || 0),
    0
  );

  return (
    <div>
      <PageHeader
        title={`Stock Transfer Note: ${transfer.transferNumber}`}
        description={`${transfer.sourceWarehouseName} (${transfer.sourceProjectName}) → ${transfer.destinationWarehouseName} (${transfer.destinationProjectName})`}
        actions={
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => navigate('/stock-transfers')}>
              ← Directory
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print Transfer Note
            </Button>
            {(transfer.status === 'Draft' || transfer.status === 'ReturnedForCorrection') && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/stock-transfers/${transfer.id}/edit`)}
                >
                  Edit Draft
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setReasonText('');
                    setActiveModal('cancel');
                  }}
                >
                  Cancel Transfer
                </Button>
                <Button variant="primary" onClick={handleSubmitDraft} disabled={processing}>
                  Submit for Approval
                </Button>
              </>
            )}
            {transfer.status === 'Submitted' && canApprove && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setReasonText('');
                    setActiveModal('return');
                  }}
                >
                  Return for Correction
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setReasonText('');
                    setActiveModal('reject');
                  }}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setActiveModal('approve')}
                >
                  Review & Approve
                </Button>
              </>
            )}
            {transfer.status === 'Approved' && (
              <>
                <Button
                  variant="danger"
                  onClick={() => {
                    setReasonText('');
                    setActiveModal('cancel');
                  }}
                >
                  Cancel Before Dispatch
                </Button>
                {canDispatchOrReceive && (
                  <Button
                    variant="primary"
                    onClick={() => setActiveModal('dispatch')}
                  >
                    Post Outbound Dispatch
                  </Button>
                )}
              </>
            )}
            {(transfer.status === 'Dispatched' || transfer.status === 'PartiallyReceived') &&
              canDispatchOrReceive && (
                <Button
                  variant="primary"
                  onClick={() => setActiveModal('receive')}
                >
                  {transfer.status === 'PartiallyReceived'
                    ? 'Record Next Partial Receipt'
                    : 'Receive & Inspect at Destination'}
                </Button>
              )}
            {transfer.status === 'Received' &&
              canApprove &&
              transfer.items.every((it) => it.resolutionStatus !== 'Pending') && (
                <Button variant="primary" onClick={handleCompleteTransfer} disabled={processing}>
                  Complete & Close Transfer
                </Button>
              )}
          </div>
        }
      />

      {actionError && (
        <div
          style={{
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            backgroundColor: '#FFF5F5',
            borderLeft: '4px solid #E53E3E',
            color: '#9B2C2C',
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div
          style={{
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            backgroundColor: '#F0FFF4',
            borderLeft: '4px solid #38A169',
            color: '#22543D',
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {actionSuccess}
        </div>
      )}

      {/* Workflow Stage Progress Bar */}
      <Card style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          {[
            { key: 'Draft', label: '1. Draft Request' },
            { key: 'Submitted', label: '2. Pending Approval' },
            { key: 'Approved', label: '3. Approved' },
            { key: 'Dispatched', label: '4. Dispatched / In Transit' },
            { key: 'PartiallyReceived', label: '5. Receipt & Inspection' },
            { key: 'Completed', label: '6. Reconciled & Completed' },
          ].map((step, idx) => {
            const order = ['Draft', 'Submitted', 'Approved', 'Dispatched', 'PartiallyReceived', 'Received', 'Completed'];
            const currentIdx = order.indexOf(transfer.status);
            const stepIdx = order.indexOf(step.key);
            const isDone = currentIdx > stepIdx || transfer.status === 'Completed';
            const isCurrent =
              transfer.status === step.key ||
              (step.key === 'PartiallyReceived' && transfer.status === 'Received');

            return (
              <div
                key={step.key}
                style={{
                  flex: '1 1 140px',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '4px',
                  backgroundColor: isCurrent ? '#DD6B20' : isDone ? '#E6FFFA' : '#EDF2F7',
                  color: isCurrent ? '#FFFFFF' : isDone ? '#234E52' : '#718096',
                  fontWeight: isCurrent || isDone ? 700 : 500,
                  fontSize: '0.78rem',
                  textAlign: 'center',
                  border: isCurrent ? '1px solid #C05621' : isDone ? '1px solid #81E6D9' : '1px solid #CBD5E0',
                }}
              >
                {step.label}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Header Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
          marginBottom: '1.25rem',
        }}
      >
        <Card title="Transfer Document Summary">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div>
              <div style={{ color: '#718096', fontSize: '0.75rem' }}>Transfer Number</div>
              <div style={{ fontWeight: 700, color: '#2D3748' }}>{transfer.transferNumber}</div>
            </div>
            <div>
              <div style={{ color: '#718096', fontSize: '0.75rem' }}>Current Status</div>
              <div style={{ marginTop: '0.15rem' }}>
                <StatusBadge status={badge.status} label={badge.label} />
              </div>
            </div>
            <div>
              <div style={{ color: '#718096', fontSize: '0.75rem' }}>Priority</div>
              <div style={{ fontWeight: 700, color: transfer.priority === 'Urgent' ? '#C53030' : '#2D3748' }}>
                {transfer.priority}
              </div>
            </div>
            <div>
              <div style={{ color: '#718096', fontSize: '0.75rem' }}>Discrepancy Status</div>
              <div
                style={{
                  fontWeight: 700,
                  color:
                    transfer.discrepancyStatus === 'PendingReview'
                      ? '#C53030'
                      : transfer.discrepancyStatus === 'Resolved'
                      ? '#2F855A'
                      : '#4A5568',
                }}
              >
                {transfer.discrepancyStatus}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ color: '#718096', fontSize: '0.75rem' }}>Purpose / Site Justification</div>
              <div style={{ fontWeight: 600, color: '#2D3748' }}>{transfer.purpose}</div>
            </div>
            {transfer.transferReason && (
              <div>
                <div style={{ color: '#718096', fontSize: '0.75rem' }}>Transfer Reason</div>
                <div style={{ color: '#2D3748' }}>{transfer.transferReason}</div>
              </div>
            )}
            {transfer.referenceNumber && (
              <div>
                <div style={{ color: '#718096', fontSize: '0.75rem' }}>Reference #</div>
                <div style={{ color: '#2D3748' }}>{transfer.referenceNumber}</div>
              </div>
            )}
          </div>
        </Card>

        <Card title="Source & Destination Stock Locations">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
            <div style={{ padding: '0.65rem', backgroundColor: '#F7FAFC', borderRadius: '4px', borderLeft: '4px solid #DD6B20' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase' }}>
                Outbound Source Location
              </div>
              <div style={{ fontWeight: 700, color: '#2D3748', fontSize: '0.92rem' }}>
                {transfer.sourceWarehouseName} ({transfer.sourceWarehouseId})
              </div>
              <div style={{ color: '#4A5568', fontSize: '0.8rem' }}>
                Project: {transfer.sourceProjectName} ({transfer.sourceProjectId})
              </div>
            </div>

            <div style={{ padding: '0.65rem', backgroundColor: '#F7FAFC', borderRadius: '4px', borderLeft: '4px solid #3182CE' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase' }}>
                Inbound Destination Location
              </div>
              <div style={{ fontWeight: 700, color: '#2D3748', fontSize: '0.92rem' }}>
                {transfer.destinationWarehouseName} ({transfer.destinationWarehouseId})
              </div>
              <div style={{ color: '#4A5568', fontSize: '0.8rem' }}>
                Project: {transfer.destinationProjectName} ({transfer.destinationProjectId})
              </div>
            </div>

            {isCrossProject && (
              <div style={{ fontSize: '0.78rem', color: '#975A16', backgroundColor: '#FEFCBF', padding: '0.45rem 0.65rem', borderRadius: '4px', fontWeight: 600 }}>
                Cross-Project Movement: Valuation transfers at source Weighted-Average Cost (WAC).
              </div>
            )}
          </div>
        </Card>

        <Card title="Chain of Custody & Logistics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.82rem' }}>
            <div>
              <div style={{ color: '#718096', fontSize: '0.72rem' }}>Requested By</div>
              <div style={{ fontWeight: 600 }}>{transfer.createdByName}</div>
              <div style={{ color: '#718096', fontSize: '0.72rem' }}>{transfer.requestDate}</div>
            </div>
            <div>
              <div style={{ color: '#718096', fontSize: '0.72rem' }}>Approved By</div>
              <div style={{ fontWeight: 600 }}>{transfer.approvedByName || '—'}</div>
              <div style={{ color: '#718096', fontSize: '0.72rem' }}>
                {transfer.approvedAtUtc ? transfer.approvedAtUtc.split('T')[0] : '—'}
              </div>
            </div>
            <div>
              <div style={{ color: '#718096', fontSize: '0.72rem' }}>Dispatched By</div>
              <div style={{ fontWeight: 600 }}>{transfer.dispatchedByName || '—'}</div>
              <div style={{ color: '#718096', fontSize: '0.72rem' }}>{transfer.actualDispatchDate || '—'}</div>
            </div>
            <div>
              <div style={{ color: '#718096', fontSize: '0.72rem' }}>Received By</div>
              <div style={{ fontWeight: 600 }}>{transfer.receivedByName || '—'}</div>
              <div style={{ color: '#718096', fontSize: '0.72rem' }}>{transfer.actualReceiptDate || '—'}</div>
            </div>
            <div>
              <div style={{ color: '#718096', fontSize: '0.72rem' }}>Dispatched Valuation</div>
              <div style={{ fontWeight: 700, color: '#2D3748' }}>
                ${totalDispatchedVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div style={{ color: '#718096', fontSize: '0.72rem' }}>Vehicle / Driver</div>
              <div style={{ fontWeight: 600 }}>
                {transfer.vehicleNumber || '—'} {transfer.driverName ? `(${transfer.driverName})` : ''}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Line Items & Quantity Reconciliation Table */}
      <Card
        title="Transfer Line Items & Quantity Reconciliation (Dispatched = Good + Damaged + Short + Disputed + In Transit)"
        style={{ marginBottom: '1.25rem' }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#EDF2F7', borderBottom: '2px solid #CBD5E0', textAlign: 'left' }}>
                <th style={{ padding: '0.65rem' }}>Material</th>
                <th style={{ padding: '0.65rem' }}>UOM</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Requested</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Approved</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Dispatched</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Rec. Good</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Damaged</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Short</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Disputed</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>In Transit</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Dispatch WAC</th>
                <th style={{ padding: '0.65rem' }}>Ledger Trace / Discrepancy</th>
              </tr>
            </thead>
            <tbody>
              {transfer.items.map((item) => {
                const hasDisc =
                  (item.damagedQuantity || 0) > 0 ||
                  (item.shortQuantity || 0) > 0 ||
                  (item.disputedQuantity || 0) > 0;

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '0.65rem' }}>
                      <div style={{ fontWeight: 700, color: '#2D3748' }}>{item.materialCode}</div>
                      <div style={{ color: '#4A5568', fontSize: '0.78rem' }}>{item.materialName}</div>
                    </td>
                    <td style={{ padding: '0.65rem', fontWeight: 600 }}>{item.unitCode}</td>
                    <td style={{ padding: '0.65rem', textAlign: 'right' }}>{item.requestedQuantity}</td>
                    <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 600 }}>{item.approvedQuantity}</td>
                    <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 700, color: '#2B6CB0' }}>
                      {item.dispatchedQuantity}
                    </td>
                    <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 700, color: '#2F855A' }}>
                      {item.receivedGoodQuantity}
                    </td>
                    <td
                      style={{
                        padding: '0.65rem',
                        textAlign: 'right',
                        fontWeight: item.damagedQuantity > 0 ? 700 : 400,
                        color: item.damagedQuantity > 0 ? '#C53030' : '#718096',
                      }}
                    >
                      {item.damagedQuantity}
                    </td>
                    <td
                      style={{
                        padding: '0.65rem',
                        textAlign: 'right',
                        fontWeight: item.shortQuantity > 0 ? 700 : 400,
                        color: item.shortQuantity > 0 ? '#C05621' : '#718096',
                      }}
                    >
                      {item.shortQuantity}
                    </td>
                    <td
                      style={{
                        padding: '0.65rem',
                        textAlign: 'right',
                        fontWeight: item.disputedQuantity > 0 ? 700 : 400,
                        color: item.disputedQuantity > 0 ? '#9B2C2C' : '#718096',
                      }}
                    >
                      {item.disputedQuantity}
                    </td>
                    <td
                      style={{
                        padding: '0.65rem',
                        textAlign: 'right',
                        fontWeight: item.remainingInTransitQuantity > 0 ? 700 : 400,
                        color: item.remainingInTransitQuantity > 0 ? '#2B6CB0' : '#718096',
                      }}
                    >
                      {item.remainingInTransitQuantity}
                    </td>
                    <td style={{ padding: '0.65rem', textAlign: 'right' }}>
                      ${(item.unitCostAtDispatch || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.65rem', fontSize: '0.74rem' }}>
                      {item.sourceStockLedgerEntryId && (
                        <div style={{ color: '#C05621' }}>Out: {item.sourceStockLedgerEntryId}</div>
                      )}
                      {item.destinationStockLedgerEntryId && (
                        <div style={{ color: '#2F855A' }}>In: {item.destinationStockLedgerEntryId}</div>
                      )}
                      {hasDisc && (
                        <div style={{ marginTop: '0.25rem' }}>
                          <span
                            style={{
                              padding: '0.1rem 0.35rem',
                              borderRadius: '3px',
                              fontWeight: 700,
                              backgroundColor:
                                item.resolutionStatus === 'Resolved' ? '#C6F6D5' : '#FED7D7',
                              color:
                                item.resolutionStatus === 'Resolved' ? '#22543D' : '#9B2C2C',
                            }}
                          >
                            {item.resolutionStatus === 'Resolved'
                              ? `Resolved (${item.resolutionAction || 'OK'})`
                              : 'Discrepancy Pending'}
                          </span>
                          {item.discrepancyReason && (
                            <div style={{ color: '#718096', marginTop: '0.15rem' }}>
                              Reason: {item.discrepancyReason}
                            </div>
                          )}
                          {item.resolutionNotes && (
                            <div style={{ color: '#2F855A', marginTop: '0.15rem' }}>
                              Resolution: {item.resolutionNotes}
                            </div>
                          )}
                          {item.resolutionStatus === 'Pending' && canApprove && (
                            <div style={{ marginTop: '0.3rem' }}>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedDiscrepancyLineId(item.id);
                                  setResolutionNotes('');
                                  setActiveModal('resolveDiscrepancy');
                                }}
                              >
                                Resolve Discrepancy
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {reconciliation && (
          <div
            style={{
              marginTop: '0.85rem',
              padding: '0.65rem 0.85rem',
              backgroundColor: reconciliation.isFullyReconciled ? '#F0FFF4' : '#FFF5F5',
              borderRadius: '4px',
              fontSize: '0.8rem',
              color: reconciliation.isFullyReconciled ? '#22543D' : '#9B2C2C',
              fontWeight: 600,
            }}
          >
            Reconciliation Check:{' '}
            {reconciliation.isFullyReconciled
              ? 'All dispatched line quantities are mathematically balanced (Dispatched = Good + Damaged + Short + Disputed + In Transit).'
              : 'Variance detected in transfer quantity equation.'}
          </div>
        )}
      </Card>

      {/* Action Modal / Drawer Section */}
      {activeModal === 'approve' && (
        <Card title="Supervisory Dual-Control Transfer Approval" style={{ marginBottom: '1.25rem', border: '2px solid #DD6B20' }}>
          <div style={{ marginBottom: '0.85rem', fontSize: '0.85rem', color: '#4A5568' }}>
            Verify and adjust approved transfer quantities per line item. Self-approval by the requesting user is prohibited under dual-control security policy.
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#EDF2F7', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Material</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Requested Qty</th>
                <th style={{ padding: '0.5rem', width: '180px' }}>Approved Qty</th>
              </tr>
            </thead>
            <tbody>
              {transfer.items.map((it) => (
                <tr key={it.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '0.5rem' }}>
                    {it.materialCode} — {it.materialName} ({it.unitCode})
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                    {it.requestedQuantity}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input
                      type="number"
                      min="0"
                      max={it.requestedQuantity}
                      step="any"
                      value={approvalQtyMap[it.id] ?? String(it.approvedQuantity)}
                      onChange={(e) =>
                        setApprovalQtyMap((prev) => ({ ...prev, [it.id]: e.target.value }))
                      }
                      style={{
                        width: '100%',
                        padding: '0.4rem',
                        borderRadius: '4px',
                        border: '1px solid #CBD5E0',
                        textAlign: 'right',
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Approval Remarks
            </label>
            <input
              type="text"
              placeholder="Approved for inter-warehouse dispatch..."
              value={approvalComments}
              onChange={(e) => setApprovalComments(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #CBD5E0' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleApprove} disabled={processing}>
              {processing ? 'Approving...' : 'Confirm Approval'}
            </Button>
          </div>
        </Card>
      )}

      {(activeModal === 'reject' || activeModal === 'return' || activeModal === 'cancel') && (
        <Card
          title={
            activeModal === 'reject'
              ? 'Reject Stock Transfer Request'
              : activeModal === 'return'
              ? 'Return Transfer Request for Correction'
              : 'Cancel Stock Transfer Before Dispatch'
          }
          style={{ marginBottom: '1.25rem', border: '2px solid #E53E3E' }}
        >
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Reason / Notes (Required) *
            </label>
            <textarea
              rows={3}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Provide mandatory audit reason (minimum 5 characters)..."
              style={{ width: '100%', padding: '0.55rem', borderRadius: '4px', border: '1px solid #CBD5E0' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setActiveModal(null)}>
              Close
            </Button>
            <Button
              variant="danger"
              disabled={processing || reasonText.trim().length < 5}
              onClick={
                activeModal === 'reject'
                  ? handleReject
                  : activeModal === 'return'
                  ? handleReturnForCorrection
                  : handleCancelBeforeDispatch
              }
            >
              {processing ? 'Processing...' : 'Confirm Action'}
            </Button>
          </div>
        </Card>
      )}

      {activeModal === 'dispatch' && (
        <Card title="Post Outbound Stock Transfer Dispatch" style={{ marginBottom: '1.25rem', border: '2px solid #DD6B20' }}>
          <div style={{ marginBottom: '0.85rem', fontSize: '0.85rem', color: '#4A5568' }}>
            Posting dispatch immediately deducts stock on hand at <strong>{transfer.sourceWarehouseName}</strong> via an immutable <code>TransferOut</code> stock ledger entry and places the materials into <strong>In-Transit Inventory</strong>.
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Actual Dispatch Date *
              </label>
              <input
                type="date"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #CBD5E0' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Expected Arrival Date
              </label>
              <input
                type="date"
                value={expectedArrivalDate}
                onChange={(e) => setExpectedArrivalDate(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #CBD5E0' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Vehicle / Truck #
              </label>
              <input
                type="text"
                placeholder="e.g., TRK-4082"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #CBD5E0' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Driver / Carrier Name
              </label>
              <input
                type="text"
                placeholder="e.g., R. Morales"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #CBD5E0' }}
              />
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#EDF2F7', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Material</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Approved Qty</th>
                <th style={{ padding: '0.5rem', width: '180px' }}>Actual Dispatched Qty *</th>
              </tr>
            </thead>
            <tbody>
              {transfer.items.map((it) => (
                <tr key={it.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '0.5rem' }}>
                    {it.materialCode} — {it.materialName} ({it.unitCode})
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                    {it.approvedQuantity}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input
                      type="number"
                      min="0"
                      max={it.approvedQuantity}
                      step="any"
                      value={dispatchQtyMap[it.id] ?? String(it.approvedQuantity)}
                      onChange={(e) =>
                        setDispatchQtyMap((prev) => ({ ...prev, [it.id]: e.target.value }))
                      }
                      style={{
                        width: '100%',
                        padding: '0.4rem',
                        borderRadius: '4px',
                        border: '1px solid #CBD5E0',
                        textAlign: 'right',
                        fontWeight: 700,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleDispatch} disabled={processing}>
              {processing ? 'Posting Dispatch...' : 'Confirm & Post Dispatch'}
            </Button>
          </div>
        </Card>
      )}

      {activeModal === 'receive' && (
        <Card
          title="Destination Receipt Verification & Inspection"
          style={{ marginBottom: '1.25rem', border: '2px solid #3182CE' }}
        >
          <div style={{ marginBottom: '0.85rem', fontSize: '0.85rem', color: '#4A5568' }}>
            Only <strong>Accepted Good Quantity</strong> increases usable stock on hand at{' '}
            <strong>{transfer.destinationWarehouseName}</strong> (valued at source dispatch WAC). Damaged, short, and disputed quantities are excluded from usable inventory and routed to the Discrepancy Queue.
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Actual Receipt Date *
              </label>
              <input
                type="date"
                value={actualReceiptDate}
                onChange={(e) => setActualReceiptDate(e.target.value)}
                style={{ padding: '0.45rem', borderRadius: '4px', border: '1px solid #CBD5E0' }}
              />
            </div>

            {transfer.status === 'PartiallyReceived' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.83rem', fontWeight: 600, color: '#2B6CB0', marginTop: '1.1rem' }}>
                <input
                  type="checkbox"
                  checked={isIncrementalReceipt}
                  onChange={(e) => setIsIncrementalReceipt(e.target.checked)}
                />
                Incremental Partial Receipt Mode (add to previously received quantities)
              </label>
            )}
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#EDF2F7', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Material</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Dispatched</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Prev. Accounted</th>
                  <th style={{ padding: '0.5rem', width: '110px' }}>Good Qty</th>
                  <th style={{ padding: '0.5rem', width: '100px' }}>Damaged</th>
                  <th style={{ padding: '0.5rem', width: '100px' }}>Short</th>
                  <th style={{ padding: '0.5rem', width: '100px' }}>Disputed</th>
                  <th style={{ padding: '0.5rem' }}>Discrepancy Reason & Inspection Notes</th>
                </tr>
              </thead>
              <tbody>
                {transfer.items.map((it) => {
                  const row = receiveLines[it.id] || {
                    good: '0',
                    damaged: '0',
                    short: '0',
                    disputed: '0',
                    discrepancyReason: '',
                    inspectionNotes: '',
                  };
                  const prevAcc =
                    (it.receivedGoodQuantity || 0) +
                    (it.damagedQuantity || 0) +
                    (it.shortQuantity || 0) +
                    (it.disputedQuantity || 0);

                  return (
                    <tr key={it.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 600 }}>
                        {it.materialCode} — {it.materialName} ({it.unitCode})
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>
                        {it.dispatchedQuantity}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', color: '#718096' }}>
                        {prevAcc} (Rem: {it.remainingInTransitQuantity})
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.good}
                          onChange={(e) =>
                            setReceiveLines((prev) => ({
                              ...prev,
                              [it.id]: { ...row, good: e.target.value },
                            }))
                          }
                          style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #CBD5E0', textAlign: 'right', fontWeight: 700 }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.damaged}
                          onChange={(e) =>
                            setReceiveLines((prev) => ({
                              ...prev,
                              [it.id]: { ...row, damaged: e.target.value },
                            }))
                          }
                          style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #CBD5E0', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.short}
                          onChange={(e) =>
                            setReceiveLines((prev) => ({
                              ...prev,
                              [it.id]: { ...row, short: e.target.value },
                            }))
                          }
                          style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #CBD5E0', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.disputed}
                          onChange={(e) =>
                            setReceiveLines((prev) => ({
                              ...prev,
                              [it.id]: { ...row, disputed: e.target.value },
                            }))
                          }
                          style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #CBD5E0', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="Discrepancy reason / QA notes..."
                          value={row.discrepancyReason}
                          onChange={(e) =>
                            setReceiveLines((prev) => ({
                              ...prev,
                              [it.id]: { ...row, discrepancyReason: e.target.value },
                            }))
                          }
                          style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #CBD5E0' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleReceive} disabled={processing}>
              {processing ? 'Posting Receipt...' : 'Verify & Post Destination Receipt'}
            </Button>
          </div>
        </Card>
      )}

      {activeModal === 'resolveDiscrepancy' && (
        <Card title="Resolve Transfer Line Discrepancy" style={{ marginBottom: '1.25rem', border: '2px solid #D69E2E' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Resolution Action *
              </label>
              <select
                value={resolutionAction}
                onChange={(e) => setResolutionAction(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #CBD5E0', backgroundColor: '#FFFFFF' }}
              >
                <option value="WriteOffApproved">Approve Transit Damage / Loss Write-Off</option>
                <option value="CarrierClaimInitiated">Initiate Logistics / Carrier Claim</option>
                <option value="SourceCountAdjusted">Source Dispatch Count Variance Reconciled</option>
                <option value="QuarantineInspect">Quarantined for Engineering Inspection</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Resolution & Audit Notes *
              </label>
              <input
                type="text"
                placeholder="Explain investigation findings and accounting treatment..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #CBD5E0' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleResolveDiscrepancy}
              disabled={processing || !resolutionNotes.trim()}
            >
              {processing ? 'Resolving...' : 'Confirm Discrepancy Resolution'}
            </Button>
          </div>
        </Card>
      )}

      {/* Audit History Trail */}
      <Card title="Immutable Transfer Audit History">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {(transfer.auditTrail || []).map((entry) => (
            <div
              key={entry.id}
              style={{
                padding: '0.65rem 0.85rem',
                backgroundColor: '#F7FAFC',
                borderRadius: '4px',
                borderLeft: '3px solid #4A5568',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '0.5rem',
                fontSize: '0.82rem',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, color: '#2D3748' }}>{entry.action}</span> —{' '}
                <span style={{ color: '#4A5568' }}>{entry.comments}</span>
                <div style={{ fontSize: '0.74rem', color: '#718096', marginTop: '0.15rem' }}>
                  Actor: <strong>{entry.actorName}</strong> ({entry.actorRole})
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                {new Date(entry.timestampUtc).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
