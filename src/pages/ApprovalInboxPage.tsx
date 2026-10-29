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
  ClipboardList,
  FileCheck,
  Building2,
  Clock,
  DollarSign,
  Shield,
  Truck,
  X,
} from 'lucide-react';
import { useAuth } from '../app/useAuth';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import {
  requisitionService,
  MaterialRequisitionDto,
  ProjectDto,
} from '../services/api/requisitionService';
import {
  purchaseOrderService,
  PurchaseOrderDto,
} from '../services/api/purchaseOrderService';
import {
  grnService,
  GoodsReceivedNoteDto,
} from '../services/api/grnService';

export const ApprovalInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [activeTab, setActiveTab] = useState<'REQUISITIONS' | 'PURCHASE_ORDERS' | 'GOODS_RECEIPTS'>('REQUISITIONS');

  const [pendingRequisitions, setPendingRequisitions] = useState<MaterialRequisitionDto[]>([]);
  const [pendingPurchaseOrders, setPendingPurchaseOrders] = useState<PurchaseOrderDto[]>([]);
  const [pendingGrns, setPendingGrns] = useState<GoodsReceivedNoteDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Requisition for Modal Decision
  const [activeReq, setActiveReq] = useState<MaterialRequisitionDto | null>(null);
  const [reqModalType, setReqModalType] = useState<'Approve' | 'Reject' | 'Return' | null>(null);
  const [reqDecisionComments, setReqDecisionComments] = useState<string>('');

  // Active PO for Modal Decision
  const [activePo, setActivePo] = useState<PurchaseOrderDto | null>(null);
  const [poModalType, setPoModalType] = useState<'Approve' | 'Reject' | null>(null);
  const [poDecisionComments, setPoDecisionComments] = useState<string>('');

  // Active GRN for Modal Decision
  const [activeGrn, setActiveGrn] = useState<GoodsReceivedNoteDto | null>(null);
  const [grnModalType, setGrnModalType] = useState<'Approve' | 'Reject' | 'Return' | null>(null);
  const [grnDecisionComments, setGrnDecisionComments] = useState<string>('');

  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const isSuperAdmin = hasRole(['SuperAdmin']);

  const fetchInbox = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projList, reqList, poListResult, grnListResult] = await Promise.all([
        requisitionService.getProjects(),
        requisitionService.getApprovalInbox(),
        purchaseOrderService.getPurchaseOrders({ status: 'PendingApproval' }),
        grnService.getGrns({ status: 'Inspected' }),
      ]);
      setProjects(projList);
      setPendingRequisitions(reqList || []);
      setPendingPurchaseOrders(poListResult.items || []);
      setPendingGrns(grnListResult.items || []);
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

  const filteredPurchaseOrders = pendingPurchaseOrders.filter((po) => {
    if (selectedProject !== 'ALL' && po.projectId !== selectedProject) return false;
    if (searchQuery) {
      const term = searchQuery.trim().toUpperCase();
      return (
        po.poNumber.toUpperCase().includes(term) ||
        po.projectName.toUpperCase().includes(term) ||
        po.supplierName.toUpperCase().includes(term) ||
        (po.requisitionNumber && po.requisitionNumber.toUpperCase().includes(term)) ||
        po.items.some((i) => i.materialName.toUpperCase().includes(term))
      );
    }
    return true;
  });

  // Requisition Decision execution
  const handleExecuteReqDecision = async () => {
    if (!activeReq || !reqModalType) return;

    if ((reqModalType === 'Reject' || reqModalType === 'Return') && (!reqDecisionComments || reqDecisionComments.trim().length < 3)) {
      setDecisionError(`A mandatory explanation (minimum 3 characters) is required to ${reqModalType === 'Reject' ? 'reject' : 'return'} this requisition.`);
      return;
    }

    setIsProcessing(true);
    setDecisionError(null);

    try {
      if (reqModalType === 'Approve') {
        await requisitionService.approveRequisition(activeReq.id, reqDecisionComments || undefined);
        setActionSuccessMessage(`Requisition ${activeReq.requisitionNumber} approved.`);
      } else if (reqModalType === 'Reject') {
        await requisitionService.rejectRequisition(activeReq.id, reqDecisionComments.trim());
        setActionSuccessMessage(`Requisition ${activeReq.requisitionNumber} rejected.`);
      } else if (reqModalType === 'Return') {
        await requisitionService.returnForCorrection(activeReq.id, reqDecisionComments.trim());
        setActionSuccessMessage(`Requisition ${activeReq.requisitionNumber} returned to requester for correction.`);
      }

      setReqModalType(null);
      setActiveReq(null);
      setReqDecisionComments('');
      await fetchInbox();
    } catch (err: any) {
      setDecisionError(err?.response?.data?.message || err?.message || 'Decision failed to record');
    } finally {
      setIsProcessing(false);
    }
  };

  // PO Decision execution
  const handleExecutePoDecision = async () => {
    if (!activePo || !poModalType) return;

    if (poModalType === 'Reject' && (!poDecisionComments || poDecisionComments.trim().length < 3)) {
      setDecisionError('A mandatory rejection reason (minimum 3 characters) is required.');
      return;
    }

    setIsProcessing(true);
    setDecisionError(null);

    try {
      if (poModalType === 'Approve') {
        await purchaseOrderService.approvePurchaseOrder(activePo.id, poDecisionComments || undefined);
        setActionSuccessMessage(`Purchase order ${activePo.poNumber} approved.`);
      } else if (poModalType === 'Reject') {
        await purchaseOrderService.rejectPurchaseOrder(activePo.id, poDecisionComments.trim());
        setActionSuccessMessage(`Purchase order ${activePo.poNumber} rejected.`);
      }

      setPoModalType(null);
      setActivePo(null);
      setPoDecisionComments('');
      await fetchInbox();
    } catch (err: any) {
      setDecisionError(err?.response?.data?.message || err?.message || 'Action failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // GRN Decision execution
  const handleExecuteGrnDecision = async () => {
    if (!activeGrn || !grnModalType) return;

    if ((grnModalType === 'Reject' || grnModalType === 'Return') && (!grnDecisionComments || grnDecisionComments.trim().length < 3)) {
      setDecisionError(`A mandatory explanation (minimum 3 characters) is required to ${grnModalType === 'Reject' ? 'reject' : 'return'} this Goods Received Note.`);
      return;
    }

    setIsProcessing(true);
    setDecisionError(null);

    try {
      if (grnModalType === 'Approve') {
        await grnService.approveGrn(activeGrn.id, grnDecisionComments || undefined);
        setActionSuccessMessage(`Goods Received Note ${activeGrn.grnNumber} approved.`);
      } else if (grnModalType === 'Reject') {
        await grnService.rejectGrn(activeGrn.id, grnDecisionComments.trim());
        setActionSuccessMessage(`Goods Received Note ${activeGrn.grnNumber} rejected.`);
      } else if (grnModalType === 'Return') {
        await grnService.returnGrnForCorrection(activeGrn.id, grnDecisionComments.trim());
        setActionSuccessMessage(`Goods Received Note ${activeGrn.grnNumber} returned for correction.`);
      }

      setGrnModalType(null);
      setActiveGrn(null);
      setGrnDecisionComments('');
      await fetchInbox();
    } catch (err: any) {
      setDecisionError(err?.response?.data?.message || err?.message || 'Decision failed to record');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-charcoal-900)', margin: 0 }}>
              Authorized Approval Inbox
            </h1>
            <p style={{ color: 'var(--color-charcoal-600)', margin: '4px 0 0', fontSize: '0.875rem' }}>
              Pending site requisitions, commercial purchase orders, and inspected Goods Received Notes requiring supervisory dual-control review and sign-off.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchInbox}
            disabled={isLoading}
            icon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
        </div>

        {/* Action Message Banner */}
        {actionSuccessMessage && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#F0FFF4',
              border: '1px solid #9AE6B4',
              color: '#22543D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.875rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <CheckCircle2 size={16} />
              <span>{actionSuccessMessage}</span>
            </div>
            <button
              onClick={() => setActionSuccessMessage(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '2px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('REQUISITIONS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === 'REQUISITIONS' ? 'var(--color-orange-50)' : 'transparent',
              color: activeTab === 'REQUISITIONS' ? 'var(--color-orange-700)' : 'var(--color-charcoal-700)',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            <ClipboardList size={16} />
            Material Requisitions
            <Badge variant={activeTab === 'REQUISITIONS' ? 'orange' : 'neutral'}>
              {pendingRequisitions.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PURCHASE_ORDERS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === 'PURCHASE_ORDERS' ? 'var(--color-orange-50)' : 'transparent',
              color: activeTab === 'PURCHASE_ORDERS' ? 'var(--color-orange-700)' : 'var(--color-charcoal-700)',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            <FileCheck size={16} />
            Purchase Orders
            <Badge variant={activeTab === 'PURCHASE_ORDERS' ? 'orange' : 'neutral'}>
              {pendingPurchaseOrders.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('GOODS_RECEIPTS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === 'GOODS_RECEIPTS' ? 'var(--color-orange-50)' : 'transparent',
              color: activeTab === 'GOODS_RECEIPTS' ? 'var(--color-orange-700)' : 'var(--color-charcoal-700)',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            <Truck size={16} />
            Goods Received Notes (GRN)
            <Badge variant={activeTab === 'GOODS_RECEIPTS' ? 'orange' : 'neutral'}>
              {pendingGrns.length}
            </Badge>
          </button>
        </div>

        {/* Filters */}
        <Card>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', flex: '1 1 300px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 'var(--space-3)',
                  top: '50%',
                  transform: 'translateY(-50)',
                  color: 'var(--color-charcoal-400)',
                }}
              />
              <input
                type="text"
                placeholder="Filter queue by number, project, material, or requester..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3) var(--space-2) 2.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--color-surface)',
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
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--color-surface)',
                }}
              >
                <option value="ALL">All Authorized Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Content Section */}
        {isLoading ? (
          <Card>
            <div style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
              <LoadingSpinner label="Querying supervisory approval inbox..." />
            </div>
          </Card>
        ) : error ? (
          <Card>
            <EmptyState
              title="Error Loading Queue"
              description={error}
              action={<Button variant="secondary" onClick={fetchInbox}>Retry</Button>}
            />
          </Card>
        ) : activeTab === 'REQUISITIONS' ? (
          /* REQUISITIONS TAB */
          filteredRequisitions.length === 0 ? (
            <Card>
              <EmptyState
                title="All Requisitions Cleared"
                description="There are currently no site material requisitions waiting for your approval sign-off."
                action={<Button variant="secondary" onClick={() => navigate('/requisitions')}>View All Requisitions</Button>}
              />
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {filteredRequisitions.map((req) => (
                <Card key={req.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-charcoal-900)' }}>
                          {req.requisitionNumber}
                        </span>
                        <Badge variant="orange">{req.priority} Priority</Badge>
                        <Badge variant="neutral">{req.projectCode}</Badge>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', marginTop: 4 }}>
                        Project: <strong>{req.projectName}</strong> | Requester: <strong>{req.requesterName}</strong> ({req.requesterRole})
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-700)', marginTop: 6 }}>
                        <strong>Purpose:</strong> {req.purpose}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/requisitions/${req.id}`)}
                        icon={<Eye size={14} />}
                      >
                        Details
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setActiveReq(req);
                          setReqModalType('Return');
                          setReqDecisionComments('');
                        }}
                        icon={<RotateCcw size={14} />}
                      >
                        Return
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setActiveReq(req);
                          setReqModalType('Reject');
                          setReqDecisionComments('');
                        }}
                        style={{ color: '#C53030', borderColor: '#FEB2B2' }}
                        icon={<XCircle size={14} />}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setActiveReq(req);
                          setReqModalType('Approve');
                          setReqDecisionComments('');
                        }}
                        icon={<CheckCircle2 size={14} />}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>

                  <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-600)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Requested Materials ({req.items.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {req.items.map((it) => (
                        <span
                          key={it.id}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: 'var(--color-bg-page)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8125rem',
                            color: 'var(--color-charcoal-800)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <strong>{it.requestedQuantity} {it.unitCode}</strong> &times; {it.materialName}
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : (
          /* PURCHASE ORDERS TAB */
          filteredPurchaseOrders.length === 0 ? (
            <Card>
              <EmptyState
                title="All Purchase Orders Cleared"
                description="There are currently no purchase order contracts waiting for your authorization sign-off."
                action={<Button variant="secondary" onClick={() => navigate('/purchase-orders')}>View All Purchase Orders</Button>}
              />
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {filteredPurchaseOrders.map((po) => {
                const isCreator = po.createdByUserId === user?.id;
                const selfApprovalRestricted = isCreator && !isSuperAdmin;

                return (
                  <Card key={po.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-charcoal-900)' }}>
                            {po.poNumber}
                          </span>
                          <Badge variant="orange">{po.supplierCode}</Badge>
                          <Badge variant="neutral">{po.projectCode}</Badge>
                          {po.requisitionNumber && (
                            <Badge variant="orange">Req: {po.requisitionNumber}</Badge>
                          )}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', marginTop: 4 }}>
                          Vendor: <strong>{po.supplierName}</strong> | Project: <strong>{po.projectName}</strong>
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-700)', marginTop: 4, display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                          <span><strong>Delivery Due:</strong> {po.expectedDeliveryDate}</span>
                          <span><strong>Payment Terms:</strong> {po.paymentTerms}</span>
                          <span><strong>Created By:</strong> {po.createdByName}</span>
                          <span style={{ fontWeight: 700, color: 'var(--color-orange-600)' }}>
                            Grand Total: ${po.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                          icon={<Eye size={14} />}
                        >
                          View PO
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setActivePo(po);
                            setPoModalType('Reject');
                            setPoDecisionComments('');
                          }}
                          style={{ color: '#C53030', borderColor: '#FEB2B2' }}
                          icon={<XCircle size={14} />}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={selfApprovalRestricted}
                          title={selfApprovalRestricted ? 'Dual-control policy blocks creators from self-approving orders.' : undefined}
                          onClick={() => {
                            setActivePo(po);
                            setPoModalType('Approve');
                            setPoDecisionComments('');
                          }}
                          icon={<CheckCircle2 size={14} />}
                        >
                          Approve PO
                        </Button>
                      </div>
                    </div>

                    {selfApprovalRestricted && (
                      <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', backgroundColor: '#FEFCBF', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: '#744210', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Shield size={14} /> Dual-Control Policy: You drafted this PO. Another Project Manager or Super Admin must provide independent approval.
                      </div>
                    )}

                    <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-600)', textTransform: 'uppercase', marginBottom: 6 }}>
                        Contract Lines ({po.items.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        {po.items.map((it) => (
                          <span
                            key={it.id}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: 'var(--color-bg-page)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8125rem',
                              color: 'var(--color-charcoal-800)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            <strong>{it.orderedQuantity} {it.unitCode}</strong> &times; {it.materialName} (${it.unitRate.toFixed(2)}/unit)
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'GOODS_RECEIPTS' && (
          pendingGrns.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Truck size={40} className="text-gray-400" />}
                title="No Inspected Goods Receipts Awaiting Approval"
                description="All physical deliveries have been certified or no inspected Goods Received Notes are currently pending supervisor review."
              />
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {pendingGrns.map((grn) => {
                const selfApprovalRestricted = grn.receivedByUserId === user?.id && !isSuperAdmin;
                return (
                  <Card key={grn.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#DD6B20' }}>
                            {grn.grnNumber}
                          </span>
                          <StatusBadge status={grn.status} />
                          {grn.inspectionChecklist?.discrepancyIdentified && (
                            <span style={{ fontSize: '0.75rem', padding: '2px 6px', backgroundColor: '#FFF5F5', color: '#C53030', border: '1px solid #FEB2B2', fontWeight: 700 }}>
                              DISCREPANCY LOGGED
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', marginTop: 4 }}>
                          PO: <strong>{grn.purchaseOrderNumber}</strong> &bull; Supplier: <strong>{grn.supplierName}</strong> &bull; Challan: <span style={{ fontFamily: 'monospace' }}>{grn.deliveryChallanNumber}</span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-500)', marginTop: 2 }}>
                          Yard: <strong>{grn.warehouseName}</strong> &bull; Inspected By: <strong>{grn.inspectedByName || 'QA Inspector'}</strong> &bull; Date: {grn.grnDate}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/grns/${grn.id}`)}
                          icon={<Eye size={14} />}
                        >
                          View Details
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setActiveGrn(grn);
                            setGrnModalType('Return');
                            setGrnDecisionComments('');
                            setDecisionError(null);
                          }}
                          icon={<RotateCcw size={14} />}
                        >
                          Return
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setActiveGrn(grn);
                            setGrnModalType('Reject');
                            setGrnDecisionComments('');
                            setDecisionError(null);
                          }}
                          style={{ color: '#C53030' }}
                          icon={<XCircle size={14} />}
                        >
                          Reject
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          disabled={selfApprovalRestricted}
                          onClick={() => {
                            setActiveGrn(grn);
                            setGrnModalType('Approve');
                            setGrnDecisionComments('');
                            setDecisionError(null);
                          }}
                          style={selfApprovalRestricted ? { backgroundColor: '#A0AEC0' } : { backgroundColor: '#38A169' }}
                          icon={<CheckCircle2 size={14} />}
                        >
                          Approve GRN
                        </Button>
                      </div>
                    </div>

                    {selfApprovalRestricted && (
                      <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', backgroundColor: '#FEFCBF', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: '#744210', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Shield size={14} /> Dual-Control Policy: You received this delivery intake. An independent Project Manager or Inventory Manager must approve.
                      </div>
                    )}

                    <div style={{ marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-600)', textTransform: 'uppercase', marginBottom: 6 }}>
                        Accepted Items & Physical Tally (Value: ${grn.totalAcceptedValue.toFixed(2)} USD)
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        {grn.items.map((it) => (
                          <span
                            key={it.id}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: 'var(--color-bg-page)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8125rem',
                              color: 'var(--color-charcoal-800)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            <strong>{it.acceptedQuantity} / {it.deliveredQuantity} {it.unitCode}</strong> &times; {it.materialName} (${it.totalAcceptedAmount.toFixed(2)})
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {/* Modal: Requisition Decision */}
        {reqModalType && activeReq && (
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
                {reqModalType} Requisition: {activeReq.requisitionNumber}
              </h2>

              {decisionError && (
                <div style={{ padding: 'var(--space-3)', backgroundColor: '#FFF5F5', color: '#C53030', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', fontSize: '0.875rem' }}>
                  {decisionError}
                </div>
              )}

              <textarea
                rows={3}
                value={reqDecisionComments}
                onChange={(e) => setReqDecisionComments(e.target.value)}
                placeholder={
                  reqModalType === 'Approve'
                    ? 'Optional approval comments...'
                    : 'Mandatory explanation for requester...'
                }
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
                <Button variant="secondary" onClick={() => setReqModalType(null)} disabled={isProcessing}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={isProcessing}
                  onClick={handleExecuteReqDecision}
                  style={reqModalType === 'Reject' ? { backgroundColor: '#C53030' } : undefined}
                >
                  {isProcessing ? 'Processing...' : `Confirm ${reqModalType}`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: PO Decision */}
        {poModalType && activePo && (
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
                {poModalType} Purchase Order: {activePo.poNumber}
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', margin: '0 0 var(--space-3)' }}>
                Total Contract Value: <strong>${activePo.grandTotal.toFixed(2)} USD</strong> ({activePo.supplierName})
              </p>

              {decisionError && (
                <div style={{ padding: 'var(--space-3)', backgroundColor: '#FFF5F5', color: '#C53030', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', fontSize: '0.875rem' }}>
                  {decisionError}
                </div>
              )}

              <textarea
                rows={3}
                value={poDecisionComments}
                onChange={(e) => setPoDecisionComments(e.target.value)}
                placeholder={
                  poModalType === 'Approve'
                    ? 'Optional approval comments...'
                    : 'Mandatory rejection justification...'
                }
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
                <Button variant="secondary" onClick={() => setPoModalType(null)} disabled={isProcessing}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={isProcessing}
                  onClick={handleExecutePoDecision}
                  style={poModalType === 'Reject' ? { backgroundColor: '#C53030' } : undefined}
                >
                  {isProcessing ? 'Processing...' : `Confirm ${poModalType}`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: GRN Decision */}
        {grnModalType && activeGrn && (
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
                {grnModalType} Goods Received Note: {activeGrn.grnNumber}
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)', margin: '0 0 var(--space-3)' }}>
                PO: <strong>{activeGrn.purchaseOrderNumber}</strong> &bull; Total Accepted Value: <strong>${activeGrn.totalAcceptedValue.toFixed(2)} USD</strong>
              </p>

              {decisionError && (
                <div style={{ padding: 'var(--space-3)', backgroundColor: '#FFF5F5', color: '#C53030', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', fontSize: '0.875rem' }}>
                  {decisionError}
                </div>
              )}

              <textarea
                rows={3}
                value={grnDecisionComments}
                onChange={(e) => setGrnDecisionComments(e.target.value)}
                placeholder={
                  grnModalType === 'Approve'
                    ? 'Optional supervisory approval remarks...'
                    : grnModalType === 'Reject'
                    ? 'Mandatory rejection reason...'
                    : 'Mandatory correction notes for storekeeper...'
                }
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
                <Button variant="secondary" onClick={() => setGrnModalType(null)} disabled={isProcessing}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={isProcessing}
                  onClick={handleExecuteGrnDecision}
                  style={
                    grnModalType === 'Reject'
                      ? { backgroundColor: '#C53030' }
                      : grnModalType === 'Approve'
                      ? { backgroundColor: '#38A169' }
                      : undefined
                  }
                >
                  {isProcessing ? 'Processing...' : `Confirm ${grnModalType}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};
