import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  AlertTriangle,
  Truck,
  ClipboardList,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Plus,
  Building2,
  RefreshCw,
  Filter,
  ShieldAlert,
  FilePieChart,
  Printer,
  BarChart3,
  Table as TableIcon,
  History,
  Bell,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { DataTable, ColumnDef } from '../components/common/DataTable';
import { EmptyState, LoadingSpinner } from '../components/common/EmptyState';
import {
  dashboardReportService,
  DashboardSummaryData,
  DashboardLowStockItem,
  DashboardLocationSummary,
  DashboardMovementItem,
} from '../services/api/dashboardReportService';
import { ApiClientException } from '../services/api/apiClient';
import { useAuth } from '../app/AuthContext';

export const DashboardOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projectId, setProjectId] = useState<string>('ALL');
  const [warehouseId, setWarehouseId] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [valuationViewMode, setValuationViewMode] = useState<'chart' | 'table'>('chart');

  const [data, setData] = useState<DashboardSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false);
      const summary = await dashboardReportService.getDashboardSummary({
        projectId: projectId !== 'ALL' ? projectId : undefined,
        warehouseId: warehouseId !== 'ALL' ? warehouseId : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setData(summary);
    } catch (err: any) {
      if (err instanceof ApiClientException && err.status === 403) {
        setAccessDenied(true);
        setError(err.message || 'Access Denied: You do not have permission for the selected scope.');
      } else {
        setError(err?.message || 'Failed to load management dashboard metrics.');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, warehouseId, fromDate, toDate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, user?.id]);

  const handleClearFilters = () => {
    setProjectId('ALL');
    setWarehouseId('ALL');
    setFromDate('');
    setToDate('');
  };

  const formatCurrency = (val: number) =>
    `$${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const movementColumns: ColumnDef<DashboardMovementItem>[] = [
    {
      key: 'referenceNumber',
      header: 'Ledger Ref',
      width: '130px',
      render: (item) => (
        <div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--color-charcoal-900)',
              fontSize: '0.8125rem',
            }}
          >
            {item.referenceNumber}
          </span>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {item.sourceDocumentNumber}
          </div>
        </div>
      ),
    },
    {
      key: 'transactionType',
      header: 'Type',
      width: '130px',
      render: (item) => {
        const isIn = item.quantityIn > 0;
        const isTransfer = item.transactionType.includes('Transfer');
        return (
          <Badge variant={isTransfer ? 'transit' : isIn ? 'success' : 'warning'}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {isTransfer ? (
                <ArrowLeftRight size={11} />
              ) : isIn ? (
                <ArrowDownLeft size={11} />
              ) : (
                <ArrowUpRight size={11} />
              )}
              {item.transactionType}
            </span>
          </Badge>
        );
      },
    },
    {
      key: 'materialName',
      header: 'Material & Code',
      render: (item) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)', fontSize: '0.8125rem' }}>
            {item.materialName}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {item.materialCode}
          </div>
        </div>
      ),
    },
    {
      key: 'signedQuantity',
      header: 'Signed Qty',
      align: 'right',
      render: (item) => (
        <span
          style={{
            fontWeight: 700,
            color: item.signedQuantity >= 0 ? 'var(--color-success)' : 'var(--color-charcoal-800)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {item.signedQuantity >= 0 ? `+${item.signedQuantity}` : item.signedQuantity} {item.unitCode}
        </span>
      ),
    },
    {
      key: 'transactionValue',
      header: 'Valuation ($)',
      align: 'right',
      render: (item) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {formatCurrency(Math.abs(item.transactionValue))}
        </span>
      ),
    },
    {
      key: 'warehouseName',
      header: 'Warehouse / Project Site',
      render: (item) => (
        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-800)' }}>
            {item.warehouseName}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.projectName}</div>
        </div>
      ),
    },
    {
      key: 'transactionDate',
      header: 'Date / Actor',
      align: 'right',
      render: (item) => (
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-800)' }}>
            {item.transactionDate}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{item.createdByName}</div>
        </div>
      ),
    },
  ];

  const locationColumns: ColumnDef<DashboardLocationSummary>[] = [
    {
      key: 'warehouseName',
      header: 'Warehouse / Store & Project Site',
      render: (loc) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Building2 size={16} style={{ color: '#DD6B20', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)', fontSize: '0.8125rem' }}>
              {loc.warehouseId} • {loc.warehouseName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {loc.projectId} • {loc.projectName}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'distinctMaterials',
      header: 'Active SKUs',
      align: 'center',
      render: (loc) => <span style={{ fontWeight: 600 }}>{loc.distinctMaterials}</span>,
    },
    {
      key: 'quantityOnHand',
      header: 'Usable On Hand',
      align: 'right',
      render: (loc) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          {loc.quantityOnHand.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'quantityInTransit',
      header: 'In-Transit (Non-Usable)',
      align: 'right',
      render: (loc) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: loc.quantityInTransit > 0 ? '#DD6B20' : 'var(--text-muted)',
          }}
        >
          {loc.quantityInTransit.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'inventoryValue',
      header: 'Usable Valuation (WAC)',
      align: 'right',
      render: (loc) => (
        <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#2D3748' }}>
          {formatCurrency(loc.inventoryValue)}
        </span>
      ),
    },
    {
      key: 'lowStockCount',
      header: 'Alerts & Queues',
      align: 'right',
      render: (loc) => (
        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {loc.lowStockCount > 0 ? (
            <Badge variant="danger">{loc.lowStockCount} Low Stock</Badge>
          ) : (
            <Badge variant="success">Stock Healthy</Badge>
          )}
          {loc.pendingGrnCount > 0 && <Badge variant="warning">{loc.pendingGrnCount} GRN</Badge>}
          {loc.openTransferCount > 0 && <Badge variant="transit">{loc.openTransferCount} Transfer</Badge>}
        </div>
      ),
    },
  ];

  const kpis = data?.kpis;

  const renderKpiBox = (props: {
    label: string;
    value: string;
    subtext: string;
    footer: string;
    icon: React.ReactNode;
    accentColor?: string;
    onClick: () => void;
  }) => (
    <div
      onClick={props.onClick}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--border-color)',
        borderTop: `3px solid ${props.accentColor || '#2D3748'}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4) var(--space-5)',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            letterSpacing: '0.03em',
          }}
        >
          {props.label}
        </span>
        <span style={{ color: props.accentColor || '#DD6B20' }}>{props.icon}</span>
      </div>
      <div
        style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: '#2D3748',
          fontFamily: 'var(--font-mono)',
          marginTop: 8,
        }}
      >
        {props.value}
      </div>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#2D3748', marginTop: 6 }}>
        {props.subtext}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
        {props.footer}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Executive Operations & Inventory Control Dashboard"
        description={`Authorized real-time stock valuation (Moving WAC), low-stock thresholds, workflow queues, and ledger activity${
          data?.asOfTimestampUtc ? ` • As of ${new Date(data.asOfTimestampUtc).toLocaleTimeString()}` : ''
        }`}
        actions={
          <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={15} />}
              onClick={loadDashboard}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer size={15} />}
              onClick={() => window.print()}
            >
              Print / PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<FilePieChart size={15} />}
              onClick={() =>
                navigate(
                  `/reports?projectId=${projectId}&warehouseId=${warehouseId}${
                    fromDate ? `&fromDate=${fromDate}` : ''
                  }${toDate ? `&toDate=${toDate}` : ''}`
                )
              }
            >
              Reports & CSV Export
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => navigate('/requisitions/new')}
            >
              New Requisition
            </Button>
          </div>
        }
      />

      {/* Server-Backed Scope & Date Filter Bar */}
      <Card style={{ marginBottom: 'var(--space-5)' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            <div>
              <label
                htmlFor="dash-project-filter"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#2D3748',
                  marginBottom: 4,
                }}
              >
                Project / Site Scope
              </label>
              <select
                id="dash-project-filter"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#fff',
                  minWidth: 220,
                }}
              >
                <option value="ALL">All Authorized Projects</option>
                {(data?.accessibleScopes?.projects || [
                  { id: 'PRJ-101', code: 'PRJ-METRO', name: 'Metro Rail Line 3 Extension' },
                  { id: 'PRJ-102', code: 'PRJ-HARBOR', name: 'Harbor Commercial Docklands' },
                  { id: 'PRJ-103', code: 'PRJ-TOWER', name: 'Skyline Corporate Towers' },
                ]).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} • {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="dash-warehouse-filter"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#2D3748',
                  marginBottom: 4,
                }}
              >
                Warehouse / Store
              </label>
              <select
                id="dash-warehouse-filter"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#fff',
                  minWidth: 220,
                }}
              >
                <option value="ALL">All Authorized Warehouses</option>
                {(data?.accessibleScopes?.warehouses || [
                  { id: 'WH-01', name: 'Metro Central Staging Yard' },
                  { id: 'WH-02', name: 'North Industrial Depot & Yard' },
                  { id: 'WH-03', name: 'East Harbor Hub' },
                ]).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.id} • {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="dash-from-date"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#2D3748',
                  marginBottom: 4,
                }}
              >
                Activity From Date
              </label>
              <input
                id="dash-from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8125rem',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="dash-to-date"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#2D3748',
                  marginBottom: 4,
                }}
              >
                Activity To Date
              </label>
              <input
                id="dash-to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8125rem',
                }}
              />
            </div>

            {(projectId !== 'ALL' || warehouseId !== 'ALL' || fromDate || toDate) && (
              <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                Reset Filters
              </Button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.75rem',
              color: 'var(--color-charcoal-600)',
              backgroundColor: '#F7FAFC',
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <Filter size={13} style={{ color: '#DD6B20' }} />
            <span>
              In-transit stock is strictly excluded from usable on-hand quantities and WAC valuation.
            </span>
          </div>
        </div>
      </Card>

      {/* Access Denied or Error State */}
      {accessDenied ? (
        <Card>
          <EmptyState
            icon={<ShieldAlert size={36} style={{ color: 'var(--color-danger)' }} />}
            title="Access Denied for Selected Scope"
            description={
              error ||
              'Your role and location scope permissions do not grant access to the requested project or warehouse.'
            }
            action={
              <Button variant="primary" size="sm" onClick={handleClearFilters}>
                Reset to Authorized Scope
              </Button>
            }
          />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState
            icon={<AlertTriangle size={36} style={{ color: 'var(--color-warning)' }} />}
            title="Dashboard Data Unavailable"
            description={error}
            action={
              <Button variant="primary" size="sm" onClick={loadDashboard}>
                Retry
              </Button>
            }
          />
        </Card>
      ) : loading && !data ? (
        <Card>
          <LoadingSpinner label="Calculating authoritative ledger balances, WAC valuations, and workflow queues..." />
        </Card>
      ) : kpis ? (
        <>
          {/* 6 Clickable Executive KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-6)',
            }}
          >
            {renderKpiBox({
              label: 'Usable Inventory Value (WAC)',
              value: formatCurrency(kpis.totalInventoryValue),
              subtext: `${kpis.totalQuantityOnHand.toLocaleString()} usable units on hand`,
              footer: `Across ${kpis.distinctMaterialsCount} SKUs • Excludes in-transit`,
              icon: <DollarSign size={20} />,
              accentColor: '#2D3748',
              onClick: () =>
                navigate(
                  `/reports?type=inventory-valuation&projectId=${projectId}&warehouseId=${warehouseId}`
                ),
            })}

            {renderKpiBox({
              label: 'Low-Stock & Reorder Alerts',
              value: String(kpis.lowStockCount),
              subtext: `${kpis.criticalStockCount} critical / below safety minimum`,
              footer: 'Click to open Low-Stock Reorder Report',
              icon: <AlertTriangle size={20} />,
              accentColor: kpis.lowStockCount > 0 ? '#E53E3E' : '#38A169',
              onClick: () =>
                navigate(
                  `/reports?type=low-stock-reorder&projectId=${projectId}&warehouseId=${warehouseId}`
                ),
            })}

            {renderKpiBox({
              label: 'Pending Requisition Approvals',
              value: String(kpis.pendingRequisitionApprovals),
              subtext: `${kpis.outstandingMaterialIssues} open material issues`,
              footer: `${kpis.pendingPoApprovalsCount} POs awaiting approval`,
              icon: <ClipboardList size={20} />,
              accentColor: '#3182CE',
              onClick: () => navigate('/requisitions'),
            })}

            {renderKpiBox({
              label: 'Pending GRNs & QA Inspection',
              value: String(kpis.pendingGrnsInspection),
              subtext: `${kpis.grnDiscrepanciesCount} GRNs with discrepancies`,
              footer: 'Click to inspect & post receipts',
              icon: <Truck size={20} />,
              accentColor: '#DD6B20',
              onClick: () => navigate('/grns'),
            })}

            {renderKpiBox({
              label: 'Open Transfers & In-Transit',
              value: `${kpis.inTransitTransfersCount} In Transit`,
              subtext: `${kpis.totalInTransitQuantity.toLocaleString()} units (${formatCurrency(
                kpis.totalInTransitValue
              )})`,
              footer: `${kpis.openTransfersCount} total open transfers`,
              icon: <ArrowLeftRight size={20} />,
              accentColor: '#DD6B20',
              onClick: () => navigate('/stock-transfers/in-transit'),
            })}

            {renderKpiBox({
              label: 'Unresolved Discrepancies',
              value: String(kpis.unresolvedDiscrepanciesCount),
              subtext: `${kpis.transferDiscrepanciesCount} transfer • ${kpis.grnDiscrepanciesCount} GRN`,
              footer: `${kpis.returnDiscrepanciesCount} damaged returns awaiting action`,
              icon: <Boxes size={20} />,
              accentColor: kpis.unresolvedDiscrepanciesCount > 0 ? '#E53E3E' : '#38A169',
              onClick: () => navigate('/stock-transfers/discrepancies'),
            })}
          </div>

          {/* Middle Section: Category Valuation Visual Breakdown + Low-Stock Threshold Watchlist */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: 'var(--space-6)',
              marginBottom: 'var(--space-6)',
            }}
          >
            {/* Category Valuation Distribution (Chart + Accessible Table Toggle) */}
            <Card
              title="Valuation Distribution by Material Category"
              subtitle="Authoritative Moving WAC valuation breakdown across active material categories"
              actions={
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button
                    variant={valuationViewMode === 'chart' ? 'primary' : 'secondary'}
                    size="sm"
                    icon={<BarChart3 size={13} />}
                    onClick={() => setValuationViewMode('chart')}
                  >
                    Visual
                  </Button>
                  <Button
                    variant={valuationViewMode === 'table' ? 'primary' : 'secondary'}
                    size="sm"
                    icon={<TableIcon size={13} />}
                    onClick={() => setValuationViewMode('table')}
                  >
                    Table
                  </Button>
                </div>
              }
            >
              {!data?.categoryValuation || data.categoryValuation.length === 0 ? (
                <EmptyState
                  title="No Inventory Valuation Data"
                  description="No on-hand inventory balances match the current filter scope."
                />
              ) : valuationViewMode === 'chart' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {data.categoryValuation.map((cat) => (
                    <div key={cat.categoryName}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8125rem',
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#2D3748' }}>
                          {cat.categoryName}{' '}
                          <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                            ({cat.totalQuantity.toLocaleString()} units)
                          </span>
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#2D3748' }}>
                          {formatCurrency(cat.totalValue)} ({cat.sharePercent}%)
                        </span>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: 10,
                          backgroundColor: '#EDF2F7',
                          borderRadius: 999,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(2, cat.sharePercent))}%`,
                            height: '100%',
                            backgroundColor: '#DD6B20',
                            borderRadius: 999,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Category</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Total Qty</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Valuation (WAC)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Share %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.categoryValuation.map((cat) => (
                        <tr key={cat.categoryName} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px', fontWeight: 600 }}>{cat.categoryName}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {cat.totalQuantity.toLocaleString()}
                          </td>
                          <td
                            style={{
                              padding: '8px',
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                            }}
                          >
                            {formatCurrency(cat.totalValue)}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{cat.sharePercent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Low-Stock Materials Watchlist */}
            <Card
              title="Low-Stock & Reorder Threshold Watchlist"
              subtitle="Configured minimum safety and reorder thresholds evaluated per location"
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/reports?type=low-stock-reorder&projectId=${projectId}&warehouseId=${warehouseId}`
                    )
                  }
                >
                  Full Reorder Report
                </Button>
              }
            >
              {!data?.lowStockItems || data.lowStockItems.length === 0 ? (
                <EmptyState
                  title="All Stock Levels Above Reorder Thresholds"
                  description="Every material balance in the selected scope currently exceeds its configured reorder level."
                />
              ) : (
                <div>
                  {data.lowStockItems.slice(0, 6).map((item: DashboardLowStockItem) => (
                    <div
                      key={item.balanceId}
                      style={{
                        padding: 'var(--space-3) 0',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#2D3748' }}>
                            {item.materialName}
                          </span>
                          <Badge
                            variant={
                              item.severity === 'OutOfStock' || item.severity === 'Critical'
                                ? 'danger'
                                : 'warning'
                            }
                          >
                            {item.severity === 'OutOfStock'
                              ? 'Out of Stock'
                              : item.severity === 'Critical'
                              ? 'Below Min Safety'
                              : 'Below Reorder'}
                          </Badge>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {item.materialCode}
                          </span>{' '}
                          • {item.warehouseName} ({item.projectName})
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-700)', marginTop: 4 }}>
                          On Hand:{' '}
                          <strong style={{ color: 'var(--color-danger)' }}>
                            {item.quantityOnHand} {item.unitCode}
                          </strong>{' '}
                          | Min: <strong>{item.minimumStockLevel}</strong> | Reorder:{' '}
                          <strong>{item.reorderLevel}</strong> | Shortfall:{' '}
                          <strong>
                            {item.shortfallQuantity} {item.unitCode}
                          </strong>
                          {item.quantityInTransit > 0 && (
                            <span style={{ color: '#DD6B20', marginLeft: 6 }}>
                              (+{item.quantityInTransit} {item.unitCode} in transit)
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/requisitions/new?projectId=${item.projectId}`)}
                      >
                        Requisition
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Warehouse & Site Stock Distribution Rollup */}
          <Card
            title="Warehouse & Project Site Inventory Rollup"
            subtitle="Authoritative usable stock, separated in-transit quantities, and active operational queues by location"
            style={{ marginBottom: 'var(--space-6)' }}
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/stock')}>
                Open Stock Balances
              </Button>
            }
          >
            <DataTable
              columns={locationColumns}
              data={data?.locationSummaries || []}
              keyExtractor={(item) => `${item.warehouseId}_${item.projectId}`}
              emptyTitle="No Location Balances in Scope"
              emptyDescription="No warehouse or project site inventory records match your current filter selection."
            />
          </Card>

          {/* Bottom Grid: Recent Stock Ledger Movements + Recent Audit Activity */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
              gap: 'var(--space-6)',
            }}
          >
            <Card
              title="Recent Stock Ledger Movements"
              subtitle="Latest immutable transactions posted to the stock ledger"
              actions={
                <Button variant="ghost" size="sm" onClick={() => navigate('/stock-ledger')}>
                  Full Stock Ledger
                </Button>
              }
            >
              <DataTable
                columns={movementColumns}
                data={data?.recentMovements || []}
                keyExtractor={(item) => item.id}
                emptyTitle="No Ledger Movements in Date Range"
                emptyDescription="No stock ledger transactions match the selected date range and location filters."
              />
            </Card>

            <Card
              title="Audit-Relevant Workflow Activity"
              subtitle="Recent approvals, inspections, dispatches, and postings across modules"
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Bell size={14} />}
                  onClick={() => navigate('/notifications')}
                >
                  Action Centre
                </Button>
              }
            >
              {!data?.recentAuditActivity || data.recentAuditActivity.length === 0 ? (
                <EmptyState
                  title="No Workflow Activity in Range"
                  description="No audit trail events match the selected date range and project/warehouse scope."
                />
              ) : (
                <div>
                  {data.recentAuditActivity.map((act) => (
                    <div
                      key={act.id}
                      onClick={() => navigate(act.targetRoute)}
                      style={{
                        padding: 'var(--space-3) 0',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10 }}>
                        <History size={16} style={{ color: '#DD6B20', marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#2D3748' }}>
                            [{act.module}] {act.documentNumber} — {act.action}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)', marginTop: 2 }}>
                            {act.summary}
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            Actor: <strong>{act.actorName}</strong> ({act.actorRole}) • Project: {act.projectId}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {new Date(act.timestampUtc).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};
