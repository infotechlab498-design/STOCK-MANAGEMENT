import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/StateViews';
import { useAuth } from '../app/useAuth';
import { stockTransferService, StockTransfer } from '../services/api/stockTransferService';

export const StockTransferListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceWhFilter, setSourceWhFilter] = useState('ALL');
  const [destWhFilter, setDestWhFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState(false);

  const canCreate = user?.roles?.some((r) =>
    ['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager'].includes(r)
  );

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await stockTransferService.getAll({
        search: search || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        sourceWarehouseId: sourceWhFilter !== 'ALL' ? sourceWhFilter : undefined,
        destinationWarehouseId: destWhFilter !== 'ALL' ? destWhFilter : undefined,
        projectId: projectFilter !== 'ALL' ? projectFilter : undefined,
        hasDiscrepancy: onlyDiscrepancies || undefined,
      });

      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).items || [];
        setTransfers(list);
      } else {
        setError('Failed to load stock transfers.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to stock transfer service.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sourceWhFilter, destWhFilter, projectFilter, onlyDiscrepancies]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

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

  const pendingApprovalCount = transfers.filter((t) => t.status === 'Submitted').length;
  const inTransitCount = transfers.filter(
    (t) => t.status === 'Dispatched' || t.status === 'PartiallyReceived'
  ).length;
  const discrepancyCount = transfers.filter(
    (t) =>
      t.discrepancyStatus === 'PendingReview' ||
      t.items.some((it) => it.resolutionStatus === 'Pending')
  ).length;
  const totalDispatchedValue = transfers.reduce(
    (sum, t) =>
      sum + t.items.reduce((s, it) => s + (it.totalDispatchedAmount || 0), 0),
    0
  );

  return (
    <div>
      <PageHeader
        title="Inter-Warehouse & Site Stock Transfers"
        description="Auditable stock movement between central staging warehouses, regional stores, and authorized project sites with in-transit tracking and receipt reconciliation."
        actions={
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => navigate('/stock-transfers/in-transit')}>
              In-Transit Inventory ({inTransitCount})
            </Button>
            <Button variant="secondary" onClick={() => navigate('/stock-transfers/discrepancies')}>
              Discrepancy Queue ({discrepancyCount})
            </Button>
            {canCreate && (
              <Button variant="primary" onClick={() => navigate('/stock-transfers/new')}>
                + New Stock Transfer
              </Button>
            )}
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <Card>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase' }}>
            Total Transfer Documents
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#2D3748', marginTop: '0.35rem' }}>
            {transfers.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#4A5568', marginTop: '0.2rem' }}>
            Dispatched Valuation: ${totalDispatchedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D69E2E', textTransform: 'uppercase' }}>
            Pending Supervisory Approval
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#B7791F', marginTop: '0.35rem' }}>
            {pendingApprovalCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.2rem' }}>
            Dual-control authorization required
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3182CE', textTransform: 'uppercase' }}>
            Active In-Transit Shipments
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#2B6CB0', marginTop: '0.35rem' }}>
            {inTransitCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.2rem' }}>
            Source deducted, awaiting destination receipt
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E53E3E', textTransform: 'uppercase' }}>
            Open Receipt Discrepancies
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#C53030', marginTop: '0.35rem' }}>
            {discrepancyCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.2rem' }}>
            Shortages, damages & disputed quantities
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Search Transfer #, Warehouse, Purpose, or Material
            </label>
            <input
              type="text"
              placeholder="e.g., STN-2026-0001, Cement, Rebar, Harbor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E0',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ minWidth: '170px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Workflow Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E0',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Dispatched">Dispatched / In Transit</option>
              <option value="PartiallyReceived">Partially Received</option>
              <option value="Received">Received (Pending Reconciliation)</option>
              <option value="Completed">Completed</option>
              <option value="ReturnedForCorrection">Returned for Correction</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div style={{ minWidth: '170px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Source Warehouse
            </label>
            <select
              value={sourceWhFilter}
              onChange={(e) => setSourceWhFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E0',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="ALL">All Source Warehouses</option>
              <option value="WH-01">WH-01: Metro Central Staging Yard</option>
              <option value="WH-02">WH-02: North Industrial Depot</option>
              <option value="WH-03">WH-03: East Harbor Hub</option>
            </select>
          </div>

          <div style={{ minWidth: '170px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Destination Warehouse
            </label>
            <select
              value={destWhFilter}
              onChange={(e) => setDestWhFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E0',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="ALL">All Destination Warehouses</option>
              <option value="WH-01">WH-01: Metro Central Staging Yard</option>
              <option value="WH-02">WH-02: North Industrial Depot</option>
              <option value="WH-03">WH-03: East Harbor Hub</option>
            </select>
          </div>

          <div style={{ minWidth: '170px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Project Site
            </label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E0',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="ALL">All Projects</option>
              <option value="PRJ-101">PRJ-101: Metro Rail Line 3</option>
              <option value="PRJ-102">PRJ-102: Harbor Commercial Docklands</option>
              <option value="PRJ-103">PRJ-103: Skyline Corporate Towers</option>
            </select>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#4A5568',
              paddingBottom: '0.45rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={onlyDiscrepancies}
              onChange={(e) => setOnlyDiscrepancies(e.target.checked)}
            />
            Has Discrepancy
          </label>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearch('');
              setStatusFilter('ALL');
              setSourceWhFilter('ALL');
              setDestWhFilter('ALL');
              setProjectFilter('ALL');
              setOnlyDiscrepancies(false);
            }}
          >
            Reset
          </Button>
        </div>
      </Card>

      {/* Main Table */}
      <Card>
        {loading ? (
          <LoadingSpinner label="Loading stock transfers..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchTransfers} />
        ) : transfers.length === 0 ? (
          <EmptyState
            title="No Stock Transfers Found"
            description="No inter-warehouse or site stock transfers match the current filter criteria."
            action={
              canCreate ? (
                <Button variant="primary" onClick={() => navigate('/stock-transfers/new')}>
                  + Create First Transfer Request
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#EDF2F7', borderBottom: '2px solid #CBD5E0', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>Transfer #</th>
                  <th style={{ padding: '0.75rem' }}>Request Date</th>
                  <th style={{ padding: '0.75rem' }}>Source Location</th>
                  <th style={{ padding: '0.75rem' }}>Destination Location</th>
                  <th style={{ padding: '0.75rem' }}>Purpose & Priority</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Lines / Qty</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Dispatched / Good</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((trf) => {
                  const badge = mapStatusBadge(trf.status);
                  const totalReqQty = trf.items.reduce((s, i) => s + (i.requestedQuantity || 0), 0);
                  const totalDispQty = trf.items.reduce((s, i) => s + (i.dispatchedQuantity || 0), 0);
                  const totalGoodQty = trf.items.reduce((s, i) => s + (i.receivedGoodQuantity || 0), 0);
                  const totalInTransit = trf.items.reduce((s, i) => s + (i.remainingInTransitQuantity || 0), 0);
                  const isCrossPrj = trf.sourceProjectId !== trf.destinationProjectId;

                  return (
                    <tr key={trf.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 700, color: '#2D3748' }}>
                        <span
                          onClick={() => navigate(`/stock-transfers/${trf.id}`)}
                          style={{ color: '#DD6B20', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          {trf.transferNumber}
                        </span>
                        {isCrossPrj && (
                          <div
                            style={{
                              display: 'inline-block',
                              marginLeft: '0.4rem',
                              padding: '0.1rem 0.35rem',
                              fontSize: '0.65rem',
                              backgroundColor: '#FEFCBF',
                              color: '#975A16',
                              border: '1px solid #F6E05E',
                              borderRadius: '3px',
                              fontWeight: 700,
                            }}
                          >
                            CROSS-PROJECT
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#4A5568' }}>
                        <div>{trf.requestDate}</div>
                        <div style={{ fontSize: '0.72rem', color: '#718096' }}>By: {trf.createdByName}</div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 600, color: '#2D3748' }}>{trf.sourceWarehouseName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                          {trf.sourceWarehouseId} • {trf.sourceProjectName}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 600, color: '#2D3748' }}>{trf.destinationWarehouseName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                          {trf.destinationWarehouseId} • {trf.destinationProjectName}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', color: '#4A5568', maxWidth: '220px' }}>
                        <div style={{ fontWeight: 500, color: '#2D3748' }}>{trf.purpose}</div>
                        <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '0.15rem' }}>
                          Priority:{' '}
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                trf.priority === 'Urgent'
                                  ? '#C53030'
                                  : trf.priority === 'High'
                                  ? '#DD6B20'
                                  : '#4A5568',
                            }}
                          >
                            {trf.priority}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                        <div>{trf.items.length} item(s)</div>
                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>Req: {totalReqQty}</div>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, color: '#2D3748' }}>
                          Disp: {totalDispQty} / Rec: {totalGoodQty}
                        </div>
                        {totalInTransit > 0 && (
                          <div style={{ fontSize: '0.73rem', color: '#2B6CB0', fontWeight: 700 }}>
                            In Transit: {totalInTransit}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <StatusBadge status={badge.status} label={badge.label} />
                        {trf.discrepancyStatus === 'PendingReview' && (
                          <div style={{ marginTop: '0.25rem' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                backgroundColor: '#FED7D7',
                                color: '#9B2C2C',
                                padding: '0.12rem 0.4rem',
                                borderRadius: '3px',
                              }}
                            >
                              DISCREPANCY OPEN
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          {(trf.status === 'Draft' || trf.status === 'ReturnedForCorrection') && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => navigate(`/stock-transfers/${trf.id}/edit`)}
                            >
                              Edit
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/stock-transfers/${trf.id}`)}
                          >
                            {trf.status === 'Approved'
                              ? 'Dispatch'
                              : trf.status === 'Dispatched' || trf.status === 'PartiallyReceived'
                              ? 'Receive'
                              : 'Manage'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
