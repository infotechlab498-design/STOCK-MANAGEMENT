import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Layers,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
  Warehouse,
  Building2,
  FileText,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  X,
  Lock,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { EmptyState, LoadingSpinner } from '../components/common/EmptyState';
import {
  inventoryService,
  StockLedgerEntry,
} from '../services/api/inventoryService';

export const StockLedgerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>([]);
  const [pageIndex, setPageIndex] = useState<number>(
    parseInt(searchParams.get('page') || '1', 10)
  );
  const [pageSize] = useState<number>(15);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>(
    searchParams.get('search') || ''
  );
  const [selectedMaterial, setSelectedMaterial] = useState<string>(
    searchParams.get('materialId') || 'ALL'
  );
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(
    searchParams.get('warehouseId') || 'ALL'
  );
  const [selectedProject, setSelectedProject] = useState<string>(
    searchParams.get('projectId') || 'ALL'
  );
  const [transactionType, setTransactionType] = useState<string>(
    searchParams.get('transactionType') || 'ALL'
  );
  const [startDate, setStartDate] = useState<string>(
    searchParams.get('startDate') || ''
  );
  const [endDate, setEndDate] = useState<string>(
    searchParams.get('endDate') || ''
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal
  const [selectedEntry, setSelectedEntry] = useState<StockLedgerEntry | null>(null);

  const fetchLedger = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await inventoryService.getLedger({
        materialId: selectedMaterial,
        warehouseId: selectedWarehouse,
        projectId: selectedProject,
        transactionType,
        search: searchTerm,
        startDate,
        endDate,
        page: pageIndex,
        pageSize,
      });

      if (res.success && res.data) {
        setLedgerEntries(res.data.items || []);
        setTotalCount(res.data.totalCount);
        setTotalPages(res.data.totalPages);
      } else {
        setError(res.message || 'Failed to load stock ledger transactions.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server.');
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedMaterial,
    selectedWarehouse,
    selectedProject,
    transactionType,
    searchTerm,
    startDate,
    endDate,
    pageIndex,
    pageSize,
  ]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPageIndex(1);
    fetchLedger();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const formatCost = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
    }).format(val || 0);
  };

  const formatDate = (isoStr: string) => {
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

  return (
    <div className="content-container">
      <PageHeader
        title="Authoritative Stock Ledger"
        description="Immutable, append-only historical audit ledger of every physical inventory movement"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={15} />}
              onClick={fetchLedger}
              isLoading={isLoading}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<ShieldCheck size={15} />}
              onClick={() => navigate('/inventory/reconciliation')}
            >
              Audit Reconciliation
            </Button>
          </div>
        }
      />

      {/* Ledger Immutability Policy Banner */}
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
          <strong>Immutable Ledger Policy:</strong> Posted inventory transactions are permanently
          recorded with cryptographic idempotency verification. Direct editing or deletion is
          prohibited (HTTP 405).
        </div>
      </div>

      {/* Search & Filter Controls */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <form onSubmit={handleSearchSubmit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 'var(--space-3)',
              alignItems: 'end',
            }}
          >
            {/* Search Input */}
            <div style={{ gridColumn: 'span 2' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-charcoal-700)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Search Reference / Document
              </label>
              <div style={{ position: 'relative' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-charcoal-400)',
                  }}
                />
                <input
                  type="text"
                  placeholder="STK- reference, GRN- number, material code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '36px',
                    paddingRight: '12px',
                    height: '38px',
                    borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--color-charcoal-300)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            {/* Transaction Type Filter */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-charcoal-700)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Transaction Type
              </label>
              <select
                value={transactionType}
                onChange={(e) => {
                  setTransactionType(e.target.value);
                  setPageIndex(1);
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: 'var(--border-radius-md)',
                  border: '1px solid var(--color-charcoal-300)',
                  padding: '0 10px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="ALL">All Transaction Types</option>
                <option value="GoodsReceivedNote">Goods Receipt (GRN Inbound)</option>
                <option value="OpeningBalance">Opening Balance</option>
                <option value="MaterialIssue">Material Issue (Outbound)</option>
                <option value="SiteReturn">Site Return (Inbound)</option>
                <option value="TransferIn">Transfer In</option>
                <option value="TransferOut">Transfer Out</option>
              </select>
            </div>

            {/* Warehouse Filter */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-charcoal-700)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Warehouse / Yard
              </label>
              <select
                value={selectedWarehouse}
                onChange={(e) => {
                  setSelectedWarehouse(e.target.value);
                  setPageIndex(1);
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: 'var(--border-radius-md)',
                  border: '1px solid var(--color-charcoal-300)',
                  padding: '0 10px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="ALL">All Warehouses & Yards</option>
                <option value="WH-01">WH-01: Metro Central Yard</option>
                <option value="WH-02">WH-02: North Industrial Depot</option>
                <option value="WH-03">WH-03: East Harbor Hub</option>
              </select>
            </div>

            {/* Project Filter */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-charcoal-700)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Project Site
              </label>
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  setPageIndex(1);
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: 'var(--border-radius-md)',
                  border: '1px solid var(--color-charcoal-300)',
                  padding: '0 10px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="ALL">All Project Sites</option>
                <option value="PRJ-101">PRJ-101: Metro Rail Line 3</option>
                <option value="PRJ-102">PRJ-102: Harbor Docklands</option>
                <option value="PRJ-103">PRJ-103: Skyline Towers</option>
              </select>
            </div>

            <Button type="submit" variant="primary" size="md" icon={<Filter size={15} />}>
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {/* Main Ledger Table */}
      {isLoading ? (
        <Card>
          <LoadingSpinner label="Fetching authoritative stock ledger movements..." />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState
            title="Error Loading Stock Ledger"
            description={error}
            action={
              <Button variant="secondary" size="sm" onClick={fetchLedger}>
                Retry Request
              </Button>
            }
          />
        </Card>
      ) : ledgerEntries.length === 0 ? (
        <Card>
          <EmptyState
            title="No Ledger Transactions Found"
            description="No inventory movement records match your search query or filters. Post an approved Goods Received Note (GRN) to populate the ledger."
            action={
              <Button variant="primary" size="sm" onClick={() => navigate('/grns')}>
                View Goods Receipts
              </Button>
            }
          />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Posting Date & Ref #</th>
                  <th>Source Document</th>
                  <th>Material</th>
                  <th>Location (Yard / Project)</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Qty In</th>
                  <th style={{ textAlign: 'right' }}>Qty Out</th>
                  <th style={{ textAlign: 'right' }}>Unit Cost ($)</th>
                  <th style={{ textAlign: 'right' }}>Txn Value ($)</th>
                  <th style={{ textAlign: 'right' }}>Balance Qty</th>
                  <th style={{ textAlign: 'right' }}>WAC After ($)</th>
                  <th style={{ textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--color-charcoal-900)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {e.referenceNumber}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>
                        {formatDate(e.timestampUtc)}
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--color-orange-700)',
                          cursor: 'pointer',
                        }}
                        onClick={() => navigate(`/grns/${e.sourceDocumentId}`)}
                      >
                        {e.sourceDocumentNumber}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>
                        Line: {e.sourceLineId}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{e.materialCode}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)' }}>
                        {e.materialName}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem' }}>{e.warehouseName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>
                        {e.projectName}
                      </div>
                    </td>
                    <td>
                      {e.quantityIn > 0 ? (
                        <span
                          className="badge"
                          style={{
                            backgroundColor: '#C6F6D5',
                            color: '#22543D',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <ArrowDownLeft size={12} /> GRN Inbound
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            backgroundColor: '#FED7D7',
                            color: '#742A2A',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <ArrowUpRight size={12} /> Issue Out
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: e.quantityIn > 0 ? '#276749' : 'inherit',
                      }}
                    >
                      {e.quantityIn > 0 ? `+${e.quantityIn}` : '-'}
                    </td>
                    <td style={{ textAlign: 'right', color: '#9B2C2C' }}>
                      {e.quantityOut > 0 ? `-${e.quantityOut}` : '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCost(e.unitCost)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                      {formatCurrency(e.transactionValue)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {e.balanceQuantityAfter}{' '}
                      <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>{e.unitCode}</span>
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        color: 'var(--color-orange-700)',
                      }}
                    >
                      {formatCost(e.weightedAverageCostAfter)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye size={13} />}
                        onClick={() => setSelectedEntry(e)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3) var(--space-4)',
                borderTop: '1px solid var(--color-charcoal-200)',
                backgroundColor: 'var(--color-charcoal-50)',
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-600)' }}>
                Showing {(pageIndex - 1) * pageSize + 1} to{' '}
                {Math.min(pageIndex * pageSize, totalCount)} of {totalCount} transactions
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pageIndex <= 1}
                  onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                  }}
                >
                  Page {pageIndex} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pageIndex >= totalPages}
                  onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Transaction Detail Inspector Modal */}
      {selectedEntry && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
          onClick={() => setSelectedEntry(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--border-radius-lg)',
              maxWidth: '650px',
              width: '100%',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-4)',
                paddingBottom: 'var(--space-3)',
                borderBottom: '1px solid var(--color-charcoal-200)',
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.125rem',
                    color: 'var(--color-charcoal-900)',
                  }}
                >
                  Stock Ledger Transaction Details
                </h3>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-charcoal-600)',
                    fontFamily: 'monospace',
                  }}
                >
                  Ref: {selectedEntry.referenceNumber} | Key: {selectedEntry.idempotencyKey}
                </span>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-charcoal-500)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-3)',
                fontSize: '0.875rem',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div>
                <strong>Material:</strong> {selectedEntry.materialCode} ({selectedEntry.materialName})
              </div>
              <div>
                <strong>Transaction Type:</strong> {selectedEntry.transactionType}
              </div>
              <div>
                <strong>Source Document:</strong> {selectedEntry.sourceDocumentNumber}
              </div>
              <div>
                <strong>Posting Date:</strong> {selectedEntry.transactionDate}
              </div>
              <div>
                <strong>Warehouse / Yard:</strong> {selectedEntry.warehouseName}
              </div>
              <div>
                <strong>Project Site:</strong> {selectedEntry.projectName}
              </div>
              <div>
                <strong>Quantity In:</strong> +{selectedEntry.quantityIn} {selectedEntry.unitCode}
              </div>
              <div>
                <strong>Unit Valuation Rate:</strong> {formatCost(selectedEntry.unitCost)}
              </div>
              <div>
                <strong>Transaction Total Value:</strong> {formatCurrency(selectedEntry.transactionValue)}
              </div>
              <div>
                <strong>Balance Quantity After:</strong> {selectedEntry.balanceQuantityAfter}{' '}
                {selectedEntry.unitCode}
              </div>
              <div>
                <strong>Moving WAC After:</strong> {formatCost(selectedEntry.weightedAverageCostAfter)}
              </div>
              <div>
                <strong>Total Location Valuation:</strong>{' '}
                {formatCurrency(selectedEntry.totalValuationAfter)}
              </div>
              <div>
                <strong>Posted By:</strong> {selectedEntry.createdByName || 'System'}
              </div>
              <div>
                <strong>Batch / Test Cert:</strong> {selectedEntry.batchNumber || 'N/A'}
              </div>
            </div>

            {selectedEntry.remarks && (
              <div
                style={{
                  backgroundColor: 'var(--color-charcoal-50)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--border-radius-md)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-charcoal-700)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <strong>Audit Notes:</strong> {selectedEntry.remarks}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={<FileText size={15} />}
                onClick={() => {
                  setSelectedEntry(null);
                  navigate(`/grns/${selectedEntry.sourceDocumentId}`);
                }}
              >
                Open Source Document ({selectedEntry.sourceDocumentNumber})
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedEntry(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
