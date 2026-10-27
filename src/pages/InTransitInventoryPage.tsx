import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/StateViews';
import {
  stockTransferService,
  InTransitItemSummary,
} from '../services/api/stockTransferService';

export const InTransitInventoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState<InTransitItemSummary[]>([]);
  const [metrics, setMetrics] = useState({
    activeTransferCount: 0,
    totalInTransitQuantity: 0,
    totalInTransitValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sourceWh, setSourceWh] = useState('ALL');
  const [destWh, setDestWh] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');

  const fetchInTransit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await stockTransferService.getInTransit();
      if (res.success && res.data) {
        setItems(res.data.items || []);
        setMetrics(
          res.data.metrics || {
            activeTransferCount: 0,
            totalInTransitQuantity: 0,
            totalInTransitValue: 0,
          }
        );
      } else {
        setError('Failed to load in-transit inventory.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to in-transit inventory endpoint.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInTransit();
  }, [fetchInTransit]);

  const filteredItems = items.filter((item) => {
    if (sourceWh !== 'ALL' && item.sourceWarehouseId !== sourceWh) return false;
    if (destWh !== 'ALL' && item.destinationWarehouseId !== destWh) return false;
    if (
      projectFilter !== 'ALL' &&
      item.sourceProjectId !== projectFilter &&
      item.destinationProjectId !== projectFilter
    ) {
      return false;
    }
    if (search.trim()) {
      const term = search.trim().toUpperCase();
      return (
        item.transferNumber.toUpperCase().includes(term) ||
        item.materialCode.toUpperCase().includes(term) ||
        item.materialName.toUpperCase().includes(term) ||
        item.sourceWarehouseName.toUpperCase().includes(term) ||
        item.destinationWarehouseName.toUpperCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="In-Transit Inventory & Active Shipments"
        description="Real-time visibility of dispatched materials currently in transit between warehouses and project sites. In-transit stock is deducted from source and excluded from destination usable stock until verified receipt."
        actions={
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Button variant="secondary" onClick={() => navigate('/stock-transfers')}>
              ← All Stock Transfers
            </Button>
            <Button variant="secondary" onClick={() => navigate('/inventory/balances')}>
              Warehouse Stock Balances
            </Button>
            <Button variant="primary" onClick={fetchInTransit}>
              Refresh In-Transit
            </Button>
          </div>
        }
      />

      {/* Accounting Separation Notice */}
      <div
        style={{
          padding: '0.8rem 1rem',
          marginBottom: '1.25rem',
          backgroundColor: '#EBF8FF',
          borderLeft: '4px solid #3182CE',
          color: '#2A4365',
          borderRadius: '4px',
          fontSize: '0.84rem',
        }}
      >
        <strong>Inventory Valuation & Availability Policy:</strong> Dispatched quantities shown below have already been deducted from the source warehouse via <code>TransferOut</code> ledger entries. They are tracked in the <strong>In-Transit</strong> bucket at the destination and are <strong>not counted as available stock</strong> at either location until destination receipt inspection is posted.
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <Card>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase' }}>
            Active In-Transit Transfers
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#2B6CB0', marginTop: '0.35rem' }}>
            {metrics.activeTransferCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.2rem' }}>
            Dispatched or Partially Received documents
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase' }}>
            Total Remaining In-Transit Units
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#DD6B20', marginTop: '0.35rem' }}>
            {metrics.totalInTransitQuantity.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.2rem' }}>
            Across {items.length} active material line(s)
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase' }}>
            Total In-Transit Valuation (at Source WAC)
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#2D3748', marginTop: '0.35rem' }}>
            ${metrics.totalInTransitValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.2rem' }}>
            Held in transit suspense until destination receipt
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Search Transfer # or Material
            </label>
            <input
              type="text"
              placeholder="Search STN #, material code, or warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #CBD5E0', fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Source Warehouse
            </label>
            <select
              value={sourceWh}
              onChange={(e) => setSourceWh(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #CBD5E0', fontSize: '0.875rem', backgroundColor: '#FFFFFF' }}
            >
              <option value="ALL">All Source Locations</option>
              <option value="WH-01">WH-01: Metro Central Staging Yard</option>
              <option value="WH-02">WH-02: North Industrial Depot</option>
              <option value="WH-03">WH-03: East Harbor Hub</option>
            </select>
          </div>

          <div style={{ minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Destination Warehouse
            </label>
            <select
              value={destWh}
              onChange={(e) => setDestWh(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #CBD5E0', fontSize: '0.875rem', backgroundColor: '#FFFFFF' }}
            >
              <option value="ALL">All Destination Locations</option>
              <option value="WH-01">WH-01: Metro Central Staging Yard</option>
              <option value="WH-02">WH-02: North Industrial Depot</option>
              <option value="WH-03">WH-03: East Harbor Hub</option>
            </select>
          </div>

          <div style={{ minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Project Site
            </label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #CBD5E0', fontSize: '0.875rem', backgroundColor: '#FFFFFF' }}
            >
              <option value="ALL">All Projects</option>
              <option value="PRJ-101">PRJ-101: Metro Rail Line 3</option>
              <option value="PRJ-102">PRJ-102: Harbor Commercial Docklands</option>
              <option value="PRJ-103">PRJ-103: Skyline Corporate Towers</option>
            </select>
          </div>
        </div>
      </Card>

      {/* In-Transit Table */}
      <Card>
        {loading ? (
          <LoadingSpinner label="Loading in-transit inventory..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchInTransit} />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            title="No Active In-Transit Inventory"
            description="All dispatched stock transfers have been received and reconciled at their destinations."
            action={
              <Button variant="secondary" onClick={() => navigate('/stock-transfers')}>
                View All Stock Transfers
              </Button>
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#EDF2F7', borderBottom: '2px solid #CBD5E0', textAlign: 'left' }}>
                  <th style={{ padding: '0.7rem' }}>Transfer #</th>
                  <th style={{ padding: '0.7rem' }}>Material</th>
                  <th style={{ padding: '0.7rem' }}>From Source</th>
                  <th style={{ padding: '0.7rem' }}>To Destination</th>
                  <th style={{ padding: '0.7rem' }}>Dispatch / ETA</th>
                  <th style={{ padding: '0.7rem', textAlign: 'right' }}>Dispatched</th>
                  <th style={{ padding: '0.7rem', textAlign: 'right' }}>Rec. So Far</th>
                  <th style={{ padding: '0.7rem', textAlign: 'right' }}>In Transit</th>
                  <th style={{ padding: '0.7rem', textAlign: 'right' }}>In-Transit Value</th>
                  <th style={{ padding: '0.7rem' }}>Status</th>
                  <th style={{ padding: '0.7rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id || `${item.stockTransferId}-${item.materialId}`} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '0.7rem', fontWeight: 700 }}>
                      <span
                        onClick={() => navigate(`/stock-transfers/${item.stockTransferId}`)}
                        style={{ color: '#DD6B20', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {item.transferNumber}
                      </span>
                    </td>
                    <td style={{ padding: '0.7rem' }}>
                      <div style={{ fontWeight: 700, color: '#2D3748' }}>{item.materialCode}</div>
                      <div style={{ color: '#4A5568', fontSize: '0.78rem' }}>
                        {item.materialName} ({item.unitCode})
                      </div>
                    </td>
                    <td style={{ padding: '0.7rem' }}>
                      <div style={{ fontWeight: 600 }}>{item.sourceWarehouseName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#718096' }}>{item.sourceProjectName}</div>
                    </td>
                    <td style={{ padding: '0.7rem' }}>
                      <div style={{ fontWeight: 600 }}>{item.destinationWarehouseName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#718096' }}>{item.destinationProjectName}</div>
                    </td>
                    <td style={{ padding: '0.7rem', fontSize: '0.78rem' }}>
                      <div>Disp: {item.actualDispatchDate || '—'}</div>
                      <div style={{ color: '#718096' }}>ETA: {item.expectedArrivalDate || '—'}</div>
                    </td>
                    <td style={{ padding: '0.7rem', textAlign: 'right', fontWeight: 600 }}>
                      {item.dispatchedQuantity} {item.unitCode}
                    </td>
                    <td style={{ padding: '0.7rem', textAlign: 'right', color: '#2F855A', fontWeight: 600 }}>
                      {item.receivedGoodQuantity} {item.unitCode}
                    </td>
                    <td style={{ padding: '0.7rem', textAlign: 'right', fontWeight: 700, color: '#2B6CB0' }}>
                      {item.remainingInTransitQuantity} {item.unitCode}
                    </td>
                    <td style={{ padding: '0.7rem', textAlign: 'right', fontWeight: 700, color: '#2D3748' }}>
                      ${(item.totalInTransitValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <div style={{ fontSize: '0.7rem', color: '#718096', fontWeight: 400 }}>
                        @${(item.unitCostAtDispatch || 0).toFixed(2)}/{item.unitCode}
                      </div>
                    </td>
                    <td style={{ padding: '0.7rem' }}>
                      <StatusBadge
                        status="in_transit"
                        label={item.status === 'PartiallyReceived' ? 'Partially Received' : 'In Transit'}
                      />
                    </td>
                    <td style={{ padding: '0.7rem', textAlign: 'right' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/stock-transfers/${item.stockTransferId}`)}
                      >
                        Receive / Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
