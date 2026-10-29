import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileCheck,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  Edit2,
  Send,
  Building2,
  Calendar,
  X,
  Truck,
  DollarSign,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../app/useAuth';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { Badge } from '../components/common/Badge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import {
  purchaseOrderService,
  PurchaseOrderDto,
  PurchaseOrderStatus,
} from '../services/api/purchaseOrderService';
import { supplierService, SupplierDto } from '../services/api/supplierService';
import { requisitionService, ProjectDto } from '../services/api/requisitionService';

export const PurchaseOrderListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const initialSearch = searchParams.get('search') || '';
  const initialStatus = searchParams.get('status') || 'ALL';
  const initialSupplier = searchParams.get('supplierId') || 'ALL';
  const initialProject = searchParams.get('projectId') || 'ALL';

  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [supplierFilter, setSupplierFilter] = useState<string>(initialSupplier);
  const [projectFilter, setProjectFilter] = useState<string>(initialProject);

  // Quick Action Dialogs
  const [submitId, setSubmitId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [issueId, setIssueId] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canCreatePO = hasRole(['SuperAdmin', 'ProcurementOfficer']);
  const isApprover = hasRole(['SuperAdmin', 'ProjectManager']);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [posData, supsData, projsData] = await Promise.all([
        purchaseOrderService.getPurchaseOrders({
          search: searchQuery || undefined,
          status: statusFilter,
          supplierId: supplierFilter,
          projectId: projectFilter,
        }),
        supplierService.getSuppliers(),
        requisitionService.getProjects(),
      ]);

      setPurchaseOrders(posData.items || []);
      setSuppliers(supsData || []);
      setProjects(projsData || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load purchase orders.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, supplierFilter, projectFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync with searchParams
  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchQuery) params.search = searchQuery;
    if (statusFilter !== 'ALL') params.status = statusFilter;
    if (supplierFilter !== 'ALL') params.supplierId = supplierFilter;
    if (projectFilter !== 'ALL') params.projectId = projectFilter;
    setSearchParams(params, { replace: true });
  }, [searchQuery, statusFilter, supplierFilter, projectFilter, setSearchParams]);

  // Metrics
  const metrics = useMemo(() => {
    const totalCount = purchaseOrders.length;
    const pendingApproval = purchaseOrders.filter((po) => po.status === 'PendingApproval').length;
    const approvedOrIssued = purchaseOrders.filter((po) => po.status === 'Approved' || po.status === 'Issued').length;
    const totalValue = purchaseOrders.reduce(
      (sum, po) => sum + (po.status !== 'Cancelled' ? po.grandTotal : 0),
      0
    );
    return { totalCount, pendingApproval, approvedOrIssued, totalValue };
  }, [purchaseOrders]);

  const handleSubmitPO = async () => {
    if (!submitId) return;
    setIsSubmitting(true);
    try {
      await purchaseOrderService.submitPurchaseOrder(submitId);
      setActionMessage({ type: 'success', text: 'Purchase order submitted for approval review.' });
      setSubmitId(null);
      loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.message || err?.message || 'Failed to submit order.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIssuePO = async () => {
    if (!issueId) return;
    setIsIssuing(true);
    try {
      await purchaseOrderService.issuePurchaseOrder(issueId);
      setActionMessage({ type: 'success', text: 'Purchase order formally issued to supplier.' });
      setIssueId(null);
      loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.response?.data?.message || err?.message || 'Failed to issue order.' });
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <FileCheck size={24} style={{ color: 'var(--color-orange-500)' }} />
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-charcoal-900)', margin: 0 }}>
                Purchase Orders (PO)
              </h1>
            </div>
            <p style={{ color: 'var(--color-charcoal-600)', margin: '4px 0 0', fontSize: '0.875rem' }}>
              Commercial contracts, requisition-linked orders, vendor delivery tracking, and quantity monitoring.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              icon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/purchase-orders/rate-comparison')}
              icon={<FileSpreadsheet size={14} />}
            >
              Rate Comparison
            </Button>
            {canCreatePO && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/purchase-orders/new')}
                icon={<Plus size={16} />}
              >
                Create Purchase Order
              </Button>
            )}
          </div>
        </div>

        {/* Action Notification */}
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

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <StatCard
            label="Total Purchase Orders"
            value={metrics.totalCount}
            meta="Across assigned sites"
            icon={<FileCheck size={20} />}
          />
          <StatCard
            label="Pending Approval"
            value={metrics.pendingApproval}
            meta={metrics.pendingApproval > 0 ? 'Action required' : 'Awaiting PM authorization'}
            icon={<Clock size={20} />}
            accent={metrics.pendingApproval > 0 ? 'orange' : 'charcoal'}
          />
          <StatCard
            label="Approved & Issued"
            value={metrics.approvedOrIssued}
            meta="Contracts active with vendors"
            icon={<Truck size={20} />}
          />
          <StatCard
            label="Committed Value"
            value={`$${metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            meta="Total active commitments"
            icon={<DollarSign size={20} />}
            accent="orange"
          />
        </div>

        {/* Filters Card */}
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Top row: search + selects */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
              <div style={{ position: 'relative' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 'var(--space-3)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-charcoal-400)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search by PO #, vendor, project, material..."
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

              <div>
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.875rem',
                    backgroundColor: 'var(--color-surface)',
                  }}
                >
                  <option value="ALL">All Trade Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.supplierCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.875rem',
                    backgroundColor: 'var(--color-surface)',
                  }}
                >
                  <option value="ALL">All Project Sites</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status tabs */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Status:</span>
              {[
                { key: 'ALL', label: 'All Orders' },
                { key: 'Draft', label: 'Drafts' },
                { key: 'PendingApproval', label: 'Pending Approval' },
                { key: 'Approved', label: 'Approved' },
                { key: 'Issued', label: 'Issued' },
                { key: 'Cancelled', label: 'Cancelled' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStatusFilter(st.key)}
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: statusFilter === st.key ? 'var(--color-orange-500)' : 'var(--color-border)',
                    backgroundColor: statusFilter === st.key ? 'var(--color-orange-50)' : 'var(--color-surface)',
                    color: statusFilter === st.key ? 'var(--color-orange-700)' : 'var(--color-charcoal-700)',
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* PO Table */}
        {isLoading ? (
          <Card>
            <div style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
              <LoadingSpinner label="Loading purchase order registry..." />
            </div>
          </Card>
        ) : error ? (
          <Card>
            <EmptyState
              title="Error Loading Orders"
              description={error}
              action={<Button variant="secondary" onClick={loadData}>Retry</Button>}
            />
          </Card>
        ) : purchaseOrders.length === 0 ? (
          <Card>
            <EmptyState
              title="No Purchase Orders Found"
              description={
                searchQuery || statusFilter !== 'ALL' || supplierFilter !== 'ALL' || projectFilter !== 'ALL'
                  ? 'No purchase orders match your selected filters.'
                  : 'No purchase orders have been created yet. Create a standalone order or convert an approved material requisition.'
              }
              action={
                canCreatePO ? (
                  <Button variant="primary" onClick={() => navigate('/purchase-orders/new')}>
                    Create First Purchase Order
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card>
            <div style={{ overflowX: 'auto', margin: 'calc(-1 * var(--space-4))' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg-page)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      PO Number
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      Supplier
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      Project Site & Staging Yard
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      Dates
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      Lines / Value
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      Status
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} style={{ borderBottom: '1px solid var(--color-border)' }} className="hover-bg-subtle">
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>{po.poNumber}</div>
                        {po.requisitionNumber ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-orange-600)', marginTop: 2 }}>
                            Requisition: {po.requisitionNumber}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', marginTop: 2 }}>
                            Standalone Order
                          </div>
                        )}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>{po.supplierName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', marginTop: 2 }}>
                          {po.paymentTerms}
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ fontWeight: 500, color: 'var(--color-charcoal-800)' }}>{po.projectName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', marginTop: 2 }}>
                          {po.deliveryLocation}
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-charcoal-700)' }}>
                        <div style={{ fontSize: '0.8125rem' }}>Ordered: {po.orderDate}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', marginTop: 2 }}>
                          Due: {po.expectedDeliveryDate}
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>
                          ${po.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', marginTop: 2 }}>
                          {po.items.length} line item{po.items.length === 1 ? '' : 's'}
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <StatusBadge
                          status={po.status}
                          label={
                            po.status === 'PendingApproval'
                              ? 'Pending Approval'
                              : po.status
                          }
                        />
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/purchase-orders/${po.id}`)}
                            title="View Full PO Details & History"
                            icon={<Eye size={14} />}
                          >
                            Details
                          </Button>

                          {po.status === 'Draft' && canCreatePO && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => navigate(`/purchase-orders/${po.id}/edit`)}
                                title="Edit Draft PO"
                                icon={<Edit2 size={14} />}
                              />
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setSubmitId(po.id)}
                                title="Submit PO for Approval"
                                icon={<Send size={14} />}
                              >
                                Submit
                              </Button>
                            </>
                          )}

                          {po.status === 'Approved' && canCreatePO && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setIssueId(po.id)}
                              title="Issue PO Contract to Supplier"
                              icon={<Truck size={14} style={{ color: 'var(--color-orange-500)' }} />}
                            >
                              Issue
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Submit Dialog */}
        {submitId && (
          <ConfirmDialog
            isOpen={true}
            title="Submit Purchase Order for Approval"
            description="Are you sure you want to submit this purchase order for Project Manager approval? Once submitted, line items cannot be changed unless rejected."
            confirmLabel="Submit Order"
            cancelLabel="Cancel"
            isLoading={isSubmitting}
            variant="primary"
            onConfirm={handleSubmitPO}
            onCancel={() => setSubmitId(null)}
          />
        )}

        {/* Issue Dialog */}
        {issueId && (
          <ConfirmDialog
            isOpen={true}
            title="Formally Issue Purchase Order to Supplier"
            description="Are you sure you want to issue this approved purchase order to the vendor? This locks commercial pricing and marks the contract as dispatched."
            confirmLabel="Issue to Vendor"
            cancelLabel="Cancel"
            isLoading={isIssuing}
            variant="primary"
            onConfirm={handleIssuePO}
            onCancel={() => setIssueId(null)}
          />
        )}
      </div>
    </AppLayout>
  );
};
