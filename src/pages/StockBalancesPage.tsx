import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Boxes,
  Warehouse,
  Building2,
  DollarSign,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Layers,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { EmptyState, LoadingSpinner } from '../components/common/EmptyState';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import {
  inventoryService,
  InventoryBalance,
  InventoryBalancesResponse,
} from '../services/api/inventoryService';

export const StockBalancesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [metrics, setMetrics] = useState<InventoryBalancesResponse['metrics']>({
    totalMaterials: 0,
    totalLocations: 0,
    totalInventoryValue: 0,
    totalQuantityOnHand: 0,
    lowStockCount: 0,
  });

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
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(
    searchParams.get('warehouseId') || 'ALL'
  );
  const [selectedProject, setSelectedProject] = useState<string>(
    searchParams.get('projectId') || 'ALL'
  );
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  >((searchParams.get('status') as any) || 'ALL');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Material Detail Modal
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [materialLocations, setMaterialLocations] = useState<InventoryBalance[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState<boolean>(false);

  const fetchBalances = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await inventoryService.getBalances({
        search: searchTerm,
        warehouseId: selectedWarehouse,
        projectId: selectedProject,
        status: statusFilter,
        page: pageIndex,
        pageSize,
      });

      if (res.success && res.data) {
        setBalances(res.data.items || []);
        setMetrics(res.data.metrics);
        setTotalCount(res.data.totalCount);
        setTotalPages(res.data.totalPages);
      } else {
        setError(res.message || 'Failed to load stock balances.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedWarehouse, selectedProject, statusFilter, pageIndex, pageSize]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Handle Search Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPageIndex(1);
    fetchBalances();
  };

  // Open Material Location Breakdown Modal
  const handleViewLocations = async (materialId: string) => {
    setSelectedMaterial(materialId);
    setIsLoadingLocations(true);
    try {
      const res = await inventoryService.getBalanceByMaterial(materialId);
      if (res.success && res.data) {
        setMaterialLocations(res.data);
      }
    } catch {
      setMaterialLocations([]);
    } finally {
      setIsLoadingLocations(false);
    }
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

  return (
    <div className="content-container">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', onClick: () => navigate('/dashboard') },
          { label: 'Inventory & Stock' },
          { label: 'Stock Balances' },
        ]}
      />
      <PageHeader
        title="Stock Balances & Inventory Levels"
        description="Real-time on-hand, reserved, and available quantities by warehouse and site location with moving WAC"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={15} />}
              onClick={fetchBalances}
              isLoading={isLoading}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Layers size={15} />}
              onClick={() => navigate('/stock-ledger')}
            >
              Authoritative Ledger
            </Button>
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard
          label="Total Inventory Value"
          value={formatCurrency(metrics.totalInventoryValue)}
          icon={<DollarSign size={20} />}
          accent="orange"
          meta="Continuous Moving WAC Valuation"
        />
        <StatCard
          label="Total On-Hand Quantity"
          value={metrics.totalQuantityOnHand.toLocaleString('en-US')}
          icon={<Boxes size={20} />}
          accent="charcoal"
          meta={`${metrics.totalMaterials} Distinct Materials`}
        />
        <StatCard
          label="Active Locations"
          value={metrics.totalLocations}
          icon={<Warehouse size={20} />}
          accent="charcoal"
          meta="Warehouses & Site Storage Yards"
        />
        <StatCard
          label="Low Stock Alerts"
          value={metrics.lowStockCount}
          icon={<AlertTriangle size={20} />}
          accent={metrics.lowStockCount > 0 ? 'orange' : 'success'}
          meta="Below Global Master Thresholds"
        />
      </div>

      {/* Filter & Search Bar */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <form onSubmit={handleSearchSubmit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
                Search Material / Location
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
                  placeholder="Material code, name, category, or yard..."
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
                <option value="WH-01">WH-01: Metro Central Staging Yard</option>
                <option value="WH-02">WH-02: North Industrial Depot & Yard</option>
                <option value="WH-03">WH-03: East Harbor Transit Hub</option>
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
                <option value="PRJ-101">PRJ-101: Metro Rail Line 3 Extension</option>
                <option value="PRJ-102">PRJ-102: Harbor Commercial Docklands</option>
                <option value="PRJ-103">PRJ-103: Skyline Corporate Towers</option>
              </select>
            </div>

            {/* Stock Status Filter */}
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
                Stock Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
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
                <option value="ALL">All Stock Levels</option>
                <option value="IN_STOCK">In Stock (&gt; 0)</option>
                <option value="LOW_STOCK">Low Stock (&le; Minimum)</option>
                <option value="OUT_OF_STOCK">Out of Stock (&le; 0)</option>
              </select>
            </div>

            <Button type="submit" variant="primary" size="md" icon={<Filter size={15} />}>
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {/* Main Stock Table */}
      {isLoading ? (
        <Card>
          <LoadingSpinner label="Querying location balances and moving WAC valuations..." />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState
            title="Error Loading Balances"
            description={error}
            action={<Button variant="primary" size="sm" onClick={fetchBalances}>Retry Query</Button>}
          />
        </Card>
      ) : balances.length === 0 ? (
        <Card>
          <EmptyState
            title="No Stock Balances Found"
            description="No inventory records match your selected filters. Post an approved Goods Received Note (GRN) to register stock."
            action={<Button variant="primary" size="sm" onClick={() => navigate('/grns')}>View Goods Received Notes</Button>}
          />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material Code & Name</th>
                  <th>Category</th>
                  <th>Warehouse / Yard</th>
                  <th>Project Site</th>
                  <th style={{ textAlign: 'right' }}>On Hand</th>
                  <th style={{ textAlign: 'right' }}>Available</th>
                  <th>UoM</th>
                  <th style={{ textAlign: 'right' }}>Moving WAC ($)</th>
                  <th style={{ textAlign: 'right' }}>Total Valuation ($)</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>
                        {b.materialCode}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-600)' }}>
                        {b.materialName}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          backgroundColor: 'var(--color-charcoal-100)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          color: 'var(--color-charcoal-700)',
                        }}
                      >
                        {b.categoryName || 'General'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Warehouse size={14} style={{ color: 'var(--color-charcoal-500)' }} />
                        <span style={{ fontSize: '0.8125rem' }}>{b.warehouseName}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={14} style={{ color: 'var(--color-orange-600)' }} />
                        <span style={{ fontSize: '0.8125rem' }}>{b.projectName}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {b.quantityOnHand.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-charcoal-700)' }}>
                      {b.quantityAvailable.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <span className="badge badge-secondary">{b.unitCode}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCost(b.weightedAverageCost)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: 'var(--color-orange-700)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {formatCurrency(b.inventoryValue)}
                    </td>
                    <td>
                      {b.quantityOnHand <= 0 ? (
                        <span className="badge badge-danger">Out of Stock</span>
                      ) : b.isLowStock ? (
                        <span
                          className="badge badge-warning"
                          title={`On hand (${b.quantityOnHand}) <= Master Min Threshold (${b.globalMinimumStockLevel})`}
                        >
                          Low Stock
                        </span>
                      ) : (
                        <span className="badge badge-success">In Stock</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye size={13} />}
                          onClick={() => handleViewLocations(b.materialId)}
                          title="View location breakdown across all warehouses"
                        >
                          Locations
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Layers size={13} />}
                          onClick={() =>
                            navigate(
                              `/stock-ledger?materialId=${b.materialId}&warehouseId=${b.warehouseId}&projectId=${b.projectId}`
                            )
                          }
                          title="View authoritative ledger movement history"
                        >
                          Ledger
                        </Button>
                      </div>
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
                {Math.min(pageIndex * pageSize, totalCount)} of {totalCount} records
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

      {/* Material Location Breakdown Modal */}
      {selectedMaterial && (
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
          onClick={() => setSelectedMaterial(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--border-radius-lg)',
              maxWidth: '800px',
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
                  Material Location Breakdown
                </h3>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-charcoal-600)',
                  }}
                >
                  Balances across authorized warehouses and project yards
                </span>
              </div>
              <button
                onClick={() => setSelectedMaterial(null)}
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

            {isLoadingLocations ? (
              <LoadingSpinner label="Loading location balances..." />
            ) : materialLocations.length === 0 ? (
              <p
                style={{
                  textAlign: 'center',
                  padding: 'var(--space-6)',
                  color: 'var(--color-charcoal-500)',
                }}
              >
                No stock balance records found for this material.
              </p>
            ) : (
              <div>
                <div style={{ marginBottom: 'var(--space-3)', fontSize: '0.875rem' }}>
                  <strong>Material:</strong> {materialLocations[0]?.materialCode} -{' '}
                  {materialLocations[0]?.materialName}
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Warehouse / Yard</th>
                      <th>Project Site</th>
                      <th style={{ textAlign: 'right' }}>On Hand Qty</th>
                      <th>UoM</th>
                      <th style={{ textAlign: 'right' }}>Moving WAC ($)</th>
                      <th style={{ textAlign: 'right' }}>Valuation ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialLocations.map((loc) => (
                      <tr key={loc.id}>
                        <td>{loc.warehouseName}</td>
                        <td>{loc.projectName}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {loc.quantityOnHand}
                        </td>
                        <td>{loc.unitCode}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {formatCost(loc.weightedAverageCost)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: 'var(--color-orange-700)',
                            fontFamily: 'monospace',
                          }}
                        >
                          {formatCurrency(loc.inventoryValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div
              style={{
                marginTop: 'var(--space-6)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <Button variant="secondary" size="sm" onClick={() => setSelectedMaterial(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
