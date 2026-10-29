import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/StateViews';
import { useAuth } from '../app/useAuth';
import {
  stockTransferService,
  TransferDiscrepancyItem,
} from '../services/api/stockTransferService';

export const TransferDiscrepancyQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [discrepancies, setDiscrepancies] = useState<TransferDiscrepancyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [search, setSearch] = useState('');

  // Resolution Modal State
  const [selectedItem, setSelectedItem] = useState<TransferDiscrepancyItem | null>(null);
  const [resolutionAction, setResolutionAction] = useState('WriteOffApproved');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const canResolve = user?.roles?.some((r) =>
    ['SuperAdmin', 'InventoryManager', 'ProjectManager'].includes(r)
  );

  const fetchDiscrepancies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await stockTransferService.getDiscrepancies(includeResolved);
      if (res.success && res.data) {
        setDiscrepancies(res.data);
      } else {
        setError('Failed to load transfer discrepancy queue.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to discrepancy service.');
    } finally {
      setLoading(false);
    }
  }, [includeResolved]);

  useEffect(() => {
    fetchDiscrepancies();
  }, [fetchDiscrepancies]);

  const handleResolveSubmit = async () => {
    if (!selectedItem || !resolutionNotes.trim()) return;
    setResolving(true);
    setActionFeedback(null);
    try {
      const res = await stockTransferService.resolveDiscrepancy(
        selectedItem.stockTransferId,
        selectedItem.lineId || selectedItem.materialId,
        {
          resolutionAction,
          resolutionNotes: resolutionNotes.trim(),
        }
      );
      if (res.success) {
        setActionFeedback(
          `Discrepancy for ${selectedItem.materialName} (${selectedItem.transferNumber}) resolved and audited.`
        );
        setSelectedItem(null);
        setResolutionNotes('');
        await fetchDiscrepancies();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resolve discrepancy.');
    } finally {
      setResolving(false);
    }
  };

  const filtered = discrepancies.filter((d) => {
    if (!search.trim()) return true;
    const term = search.trim().toUpperCase();
    return (
      d.transferNumber.toUpperCase().includes(term) ||
      d.materialCode.toUpperCase().includes(term) ||
      d.materialName.toUpperCase().includes(term) ||
      d.sourceLocation.toUpperCase().includes(term) ||
      d.destinationLocation.toUpperCase().includes(term) ||
      (d.discrepancyReason && d.discrepancyReason.toUpperCase().includes(term))
    );
  });

  const pendingCount = discrepancies.filter((d) => d.resolutionStatus === 'Pending').length;
  const totalDamagedUnits = discrepancies.reduce((s, d) => s + (d.damagedQuantity || 0), 0);
  const totalShortUnits = discrepancies.reduce((s, d) => s + (d.shortQuantity || 0), 0);
  const totalDisputedUnits = discrepancies.reduce((s, d) => s + (d.disputedQuantity || 0), 0);
  const totalVarianceValue = discrepancies.reduce((s, d) => s + (d.varianceValue || 0), 0);

  return (
    <div>
      <PageHeader
        title="Transfer Discrepancy & Reconciliation Queue"
        description="Audit and resolve transit shortages, damaged materials, and disputed receipt quantities across inter-warehouse and site transfers."
        actions={
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Button variant="secondary" onClick={() => navigate('/stock-transfers')}>
              ← All Stock Transfers
            </Button>
            <Button variant="secondary" onClick={() => navigate('/stock-transfers/in-transit')}>
              In-Transit Inventory
            </Button>
            <Button variant="primary" onClick={fetchDiscrepancies}>
              Refresh Queue
            </Button>
          </div>
        }
      />

      {actionFeedback && (
        <div
          style={{
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            backgroundColor: '#F0FFF4',
            borderLeft: '4px solid #38A169',
            color: '#22543D',
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {actionFeedback}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <Card>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E53E3E', textTransform: 'uppercase' }}>
            Pending Review Cases
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#C53030', marginTop: '0.35rem' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.2rem' }}>
            Awaiting managerial resolution
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#C05621', textTransform: 'uppercase' }}>
            Damaged / Short / Disputed Units
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2D3748', marginTop: '0.35rem' }}>
            {totalDamagedUnits} Dmg • {totalShortUnits} Short • {totalDisputedUnits} Disp
          </div>
          <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.2rem' }}>
            Excluded from destination usable stock
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase' }}>
            Total Variance Exposure (at Dispatch WAC)
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#2D3748', marginTop: '0.35rem' }}>
            ${totalVarianceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: '0.2rem' }}>
            Requires write-off or carrier claim
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px' }}>
            <input
              type="text"
              placeholder="Search by Transfer #, Material Code, Warehouse, or Discrepancy Reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #CBD5E0', fontSize: '0.875rem' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: '#4A5568', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(e) => setIncludeResolved(e.target.checked)}
            />
            Include Resolved Discrepancies
          </label>
        </div>
      </Card>

      {/* Active Resolution Modal */}
      {selectedItem && (
        <Card
          title={`Resolve Discrepancy: ${selectedItem.transferNumber} — ${selectedItem.materialCode} (${selectedItem.materialName})`}
          style={{ marginBottom: '1.25rem', border: '2px solid #DD6B20' }}
        >
          <div style={{ marginBottom: '0.85rem', fontSize: '0.84rem', color: '#4A5568' }}>
            <strong>Route:</strong> {selectedItem.sourceLocation} → {selectedItem.destinationLocation} |{' '}
            <strong>Dispatched:</strong> {selectedItem.dispatchedQuantity} {selectedItem.unitCode} |{' '}
            <strong>Received Good:</strong> {selectedItem.receivedGoodQuantity} {selectedItem.unitCode} |{' '}
            <strong style={{ color: '#C53030' }}>
              Damaged: {selectedItem.damagedQuantity}, Short: {selectedItem.shortQuantity}, Disputed: {selectedItem.disputedQuantity}
            </strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Resolution Disposition *
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
                Audit Investigation & Resolution Notes *
              </label>
              <input
                type="text"
                placeholder="Enter detailed resolution notes for the immutable audit trail..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #CBD5E0' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setSelectedItem(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleResolveSubmit}
              disabled={resolving || !resolutionNotes.trim()}
            >
              {resolving ? 'Resolving...' : 'Confirm & Close Discrepancy'}
            </Button>
          </div>
        </Card>
      )}

      {/* Discrepancy Queue Table */}
      <Card>
        {loading ? (
          <LoadingSpinner label="Loading transfer discrepancy queue..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchDiscrepancies} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Zero Unresolved Transfer Discrepancies"
            description="All inter-warehouse and project site receipts are balanced with zero open shortages, damages, or disputes."
            action={
              <Button variant="secondary" onClick={() => navigate('/stock-transfers')}>
                Back to Stock Transfers
              </Button>
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#EDF2F7', borderBottom: '2px solid #CBD5E0', textAlign: 'left' }}>
                  <th style={{ padding: '0.7rem' }}>Transfer #</th>
                  <th style={{ padding: '0.7rem' }}>Material</th>
                  <th style={{ padding: '0.7rem' }}>Source → Destination</th>
                  <th style={{ padding: '0.7rem', textAlign: 'right' }}>Disp / Good</th>
                  <th style={{ padding: '0.7rem', textAlign: 'right' }}>Dmg / Short / Disp</th>
                  <th style={{ padding: '0.7rem', textAlign: 'right' }}>Variance Value</th>
                  <th style={{ padding: '0.7rem' }}>Reported Reason & Notes</th>
                  <th style={{ padding: '0.7rem' }}>Status</th>
                  <th style={{ padding: '0.7rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '0.7rem', fontWeight: 700 }}>
                      <span
                        onClick={() => navigate(`/stock-transfers/${d.stockTransferId}`)}
                        style={{ color: '#DD6B20', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {d.transferNumber}
                      </span>
                    </td>
                    <td style={{ padding: '0.7rem' }}>
                      <div style={{ fontWeight: 700, color: '#2D3748' }}>{d.materialCode}</div>
                      <div style={{ fontSize: '0.78rem', color: '#4A5568' }}>
                        {d.materialName} ({d.unitCode})
                      </div>
                    </td>
                    <td style={{ padding: '0.7rem', fontSize: '0.78rem' }}>
                      <div>From: <strong>{d.sourceLocation}</strong></div>
                      <div>To: <strong>{d.destinationLocation}</strong></div>
                    </td>
                    <td style={{ padding: '0.7rem', textAlign: 'right', fontWeight: 600 }}>
                      <div>Disp: {d.dispatchedQuantity}</div>
                      <div style={{ color: '#2F855A' }}>Good: {d.receivedGoodQuantity}</div>
                    </td>
                    <td style={{ padding: '0.7rem', textAlign: 'right', fontWeight: 700, color: '#C53030' }}>
                      {d.damagedQuantity > 0 && <div>Dmg: {d.damagedQuantity}</div>}
                      {d.shortQuantity > 0 && <div>Short: {d.shortQuantity}</div>}
                      {d.disputedQuantity > 0 && <div>Disp: {d.disputedQuantity}</div>}
                    </td>
                    <td style={{ padding: '0.7rem', textAlign: 'right', fontWeight: 700 }}>
                      ${(d.varianceValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.7rem', maxWidth: '250px' }}>
                      <div style={{ fontWeight: 600, color: '#2D3748' }}>{d.discrepancyReason}</div>
                      {d.inspectionNotes && (
                        <div style={{ fontSize: '0.75rem', color: '#718096' }}>QA: {d.inspectionNotes}</div>
                      )}
                      {d.resolutionNotes && (
                        <div style={{ fontSize: '0.75rem', color: '#2F855A', marginTop: '0.2rem', fontWeight: 600 }}>
                          Resolved ({d.resolutionAction}): {d.resolutionNotes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.7rem' }}>
                      <StatusBadge
                        status={d.resolutionStatus === 'Resolved' ? 'completed' : 'warning'}
                        label={d.resolutionStatus === 'Resolved' ? 'Resolved' : 'Pending Review'}
                      />
                    </td>
                    <td style={{ padding: '0.7rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/stock-transfers/${d.stockTransferId}`)}
                        >
                          View Transfer
                        </Button>
                        {d.resolutionStatus === 'Pending' && canResolve && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedItem(d);
                              setResolutionNotes('');
                            }}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
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
