import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Filter,
  ShieldAlert,
  AlertTriangle,
  Layers,
  DollarSign,
  History,
  Truck,
  Flame,
  ArrowLeftRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState, LoadingSpinner } from '../components/common/EmptyState';
import {
  dashboardReportService,
  ReportTypeKey,
  ScopedReportResponse,
} from '../services/api/dashboardReportService';
import { ApiClientException } from '../services/api/apiClient';
import { useAuth } from '../app/AuthContext';

interface ReportTabItem {
  key: ReportTypeKey;
  label: string;
  shortDesc: string;
  icon: React.ReactNode;
}

const REPORT_TABS: ReportTabItem[] = [
  {
    key: 'stock-balances',
    label: '1. Stock Balances',
    shortDesc: 'Usable on-hand, reserved & in-transit by location',
    icon: <Layers size={15} />,
  },
  {
    key: 'inventory-valuation',
    label: '2. WAC Valuation',
    shortDesc: 'Moving weighted-average costing statement',
    icon: <DollarSign size={15} />,
  },
  {
    key: 'stock-ledger',
    label: '3. Stock Ledger',
    shortDesc: 'Chronological movement & running balance audit',
    icon: <History size={15} />,
  },
  {
    key: 'grn-po-summary',
    label: '4. GRN & PO Backlog',
    shortDesc: 'Receipts, QA rejections & open vendor quantities',
    icon: <Truck size={15} />,
  },
  {
    key: 'consumption-issues-returns',
    label: '5. Site Consumption',
    shortDesc: 'Issues less reusable returns by project site',
    icon: <Flame size={15} />,
  },
  {
    key: 'transfers-in-transit',
    label: '6. Transfers & Transit',
    shortDesc: 'Inter-site transfers, in-transit & discrepancies',
    icon: <ArrowLeftRight size={15} />,
  },
  {
    key: 'requisition-turnaround',
    label: '7. Requisition Turnaround',
    shortDesc: 'Approval cycle hours & issue fulfillment %',
    icon: <Clock size={15} />,
  },
  {
    key: 'low-stock-reorder',
    label: '8. Low-Stock & Reorder',
    shortDesc: 'Threshold shortfalls & replenishment cost',
    icon: <AlertTriangle size={15} />,
  },
];

export const ReportsCenterPage: React.FC<{ defaultReportType?: ReportTypeKey }> = ({
  defaultReportType,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();

  const initialType = ((): ReportTypeKey => {
    const paramType = searchParams.get('type') as ReportTypeKey | null;
    if (paramType && REPORT_TABS.some((t) => t.key === paramType)) {
      return paramType;
    }
    if (defaultReportType) return defaultReportType;
    if (location.pathname.includes('/consumption')) return 'consumption-issues-returns';
    return 'stock-balances';
  })();

  const [activeReport, setActiveReport] = useState<ReportTypeKey>(initialType);
  const [projectId, setProjectId] = useState<string>(searchParams.get('projectId') || 'ALL');
  const [warehouseId, setWarehouseId] = useState<string>(searchParams.get('warehouseId') || 'ALL');
  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [fromDate, setFromDate] = useState<string>(searchParams.get('fromDate') || '');
  const [toDate, setToDate] = useState<string>(searchParams.get('toDate') || '');
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);

  const [reportData, setReportData] = useState<ScopedReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false);
      const res = await dashboardReportService.getReport(activeReport, {
        projectId: projectId !== 'ALL' ? projectId : undefined,
        warehouseId: warehouseId !== 'ALL' ? warehouseId : undefined,
        search: search.trim() || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        pageSize,
      });
      setReportData(res);
    } catch (err: any) {
      if (err instanceof ApiClientException && err.status === 403) {
        setAccessDenied(true);
        setError(err.message || 'Access Denied: You do not have permission for the requested scope.');
      } else {
        setError(err?.message || 'Failed to load report data.');
      }
    } finally {
      setLoading(false);
    }
  }, [activeReport, projectId, warehouseId, search, fromDate, toDate, page, pageSize]);

  useEffect(() => {
    loadReport();
  }, [loadReport, user?.id]);

  const handleSelectTab = (key: ReportTypeKey) => {
    setActiveReport(key);
    setPage(1);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('type', key);
    setSearchParams(nextParams, { replace: true });
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      setError(null);
      await dashboardReportService.downloadReportCsv(activeReport, {
        projectId: projectId !== 'ALL' ? projectId : undefined,
        warehouseId: warehouseId !== 'ALL' ? warehouseId : undefined,
        search: search.trim() || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
    } catch (err: any) {
      setError(err?.message || 'CSV export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleResetFilters = () => {
    setProjectId('ALL');
    setWarehouseId('ALL');
    setSearch('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const formatSummaryLabel = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  const formatSummaryValue = (key: string, val: any): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'number') {
      const lower = key.toLowerCase();
      if (lower.includes('value') || lower.includes('cost') || lower.includes('amount')) {
        return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (lower.includes('percent')) {
        return `${val}%`;
      }
      if (lower.includes('hours')) {
        return `${val} hrs`;
      }
      return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    return String(val);
  };

  const formatCellValue = (colKey: string, val: any): React.ReactNode => {
    if (val === null || val === undefined || val === '') return '—';
    const lower = colKey.toLowerCase();
    if (typeof val === 'number') {
      if (
        lower.includes('value') ||
        lower.includes('cost') ||
        lower.includes('rate') ||
        lower.includes('amount')
      ) {
        return (
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
      if (lower.includes('percent')) {
        return <span style={{ fontFamily: 'var(--font-mono)' }}>{val}%</span>;
      }
      return <span style={{ fontFamily: 'var(--font-mono)' }}>{val.toLocaleString()}</span>;
    }
    if (
      colKey === 'status' ||
      colKey === 'poStatus' ||
      colKey === 'stockStatus' ||
      colKey === 'severity' ||
      colKey === 'discrepancyStatus'
    ) {
      const s = String(val);
      const variant =
        s === 'Posted' || s === 'Approved' || s === 'Completed' || s === 'Healthy' || s === 'Resolved'
          ? 'success'
          : s === 'Rejected' || s === 'OutOfStock' || s === 'Critical' || s === 'Open'
          ? 'danger'
          : s === 'Dispatched' || s === 'PartiallyReceived' || s === 'LowStock' || s === 'Reorder'
          ? 'warning'
          : 'neutral';
      return <Badge variant={variant}>{s}</Badge>;
    }
    return String(val);
  };

  return (
    <div>
      <PageHeader
        title="Enterprise Inventory Reports, Analytics & Export Centre"
        description="Server-scoped financial and operational statements reconciled directly against the authoritative stock ledger and WAC balance engine."
        actions={
          <div className="no-print" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={15} />}
              onClick={loadReport}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer size={15} />}
              onClick={() => window.print()}
              title="Print report or save as PDF via browser print dialog"
            >
              Print / Save PDF
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<FileSpreadsheet size={15} />}
              onClick={handleExportCsv}
              disabled={exporting || accessDenied}
            >
              {exporting ? 'Generating CSV...' : 'Export CSV (RFC 4180)'}
            </Button>
          </div>
        }
      />

      {/* Report Type Selector Tabs */}
      <div
        className="no-print"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-5)',
        }}
      >
        {REPORT_TABS.map((tab) => {
          const isSelected = activeReport === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleSelectTab(tab.key)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: isSelected ? '2px solid #DD6B20' : '1px solid var(--border-color)',
                backgroundColor: isSelected ? '#2D3748' : '#FFFFFF',
                color: isSelected ? '#FFFFFF' : '#2D3748',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.8125rem' }}>
                <span style={{ color: '#DD6B20' }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
              <div
                style={{
                  fontSize: '0.6875rem',
                  color: isSelected ? '#E2E8F0' : 'var(--text-muted)',
                  marginTop: 3,
                }}
              >
                {tab.shortDesc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Server-Backed Filter Bar */}
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
                htmlFor="rep-search"
                style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#2D3748', marginBottom: 4 }}
              >
                Keyword Search
              </label>
              <input
                id="rep-search"
                type="text"
                placeholder="Material, code, voucher, supplier..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8125rem',
                  minWidth: 220,
                }}
              />
            </div>

            <div>
              <label
                htmlFor="rep-project"
                style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#2D3748', marginBottom: 4 }}
              >
                Project Site Scope
              </label>
              <select
                id="rep-project"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#fff',
                }}
              >
                <option value="ALL">All Authorized Projects</option>
                <option value="PRJ-101">PRJ-101 • Metro Rail Line 3 Extension</option>
                <option value="PRJ-102">PRJ-102 • Harbor Commercial Docklands</option>
                <option value="PRJ-103">PRJ-103 • Skyline Corporate Towers</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="rep-warehouse"
                style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#2D3748', marginBottom: 4 }}
              >
                Warehouse / Store
              </label>
              <select
                id="rep-warehouse"
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#fff',
                }}
              >
                <option value="ALL">All Authorized Warehouses</option>
                <option value="WH-01">WH-01 • Metro Central Staging Yard</option>
                <option value="WH-02">WH-02 • North Industrial Depot & Yard</option>
                <option value="WH-03">WH-03 • East Harbor Hub</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="rep-from"
                style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#2D3748', marginBottom: 4 }}
              >
                From Date
              </label>
              <input
                id="rep-from"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
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
                htmlFor="rep-to"
                style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#2D3748', marginBottom: 4 }}
              >
                To Date
              </label>
              <input
                id="rep-to"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8125rem',
                }}
              />
            </div>

            {(projectId !== 'ALL' || warehouseId !== 'ALL' || search || fromDate || toDate) && (
              <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {accessDenied ? (
        <Card>
          <EmptyState
            icon={<ShieldAlert size={36} style={{ color: 'var(--color-danger)' }} />}
            title="Access Denied to Requested Report Scope"
            description={
              error ||
              'You do not have permission to generate or export reports for the selected project or warehouse.'
            }
            action={
              <Button variant="primary" size="sm" onClick={handleResetFilters}>
                Reset to Authorized Scope
              </Button>
            }
          />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState
            icon={<AlertTriangle size={36} style={{ color: 'var(--color-warning)' }} />}
            title="Report Generation Error"
            description={error}
            action={
              <Button variant="primary" size="sm" onClick={loadReport}>
                Retry
              </Button>
            }
          />
        </Card>
      ) : loading && !reportData ? (
        <Card>
          <LoadingSpinner label="Generating scoped report and reconciling totals with stock ledger..." />
        </Card>
      ) : reportData ? (
        <>
          {/* Report Header & Summary Reconciliation Banner */}
          <Card style={{ marginBottom: 'var(--space-5)', backgroundColor: '#F7FAFC' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 'var(--space-4)',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: 'var(--space-3)',
                marginBottom: 'var(--space-3)',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2D3748', margin: 0 }}>
                  {reportData.title}
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-600)', marginTop: 4 }}>
                  {reportData.subtitle}
                </p>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-success)', fontWeight: 700 }}>
                  <CheckCircle2 size={13} />
                  Reconciled with Authoritative Ledger
                </div>
                <div>Generated (UTC): {new Date(reportData.asOfTimestampUtc).toLocaleString()}</div>
                <div>
                  Scope: Project={reportData.filtersApplied.projectId} | Warehouse={reportData.filtersApplied.warehouseId}
                </div>
              </div>
            </div>

            {/* Summary Totals Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              {Object.entries(reportData.summary || {}).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    {formatSummaryLabel(k)}
                  </div>
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: 800,
                      color: '#2D3748',
                      fontFamily: 'var(--font-mono)',
                      marginTop: 4,
                    }}
                  >
                    {formatSummaryValue(k, v)}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Report Data Table */}
          <Card>
            {reportData.items.length === 0 ? (
              <EmptyState
                icon={<Filter size={32} />}
                title="No Records Match Report Criteria"
                description="No rows were returned for the selected date range, search query, and location scope."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#2D3748',
                        color: '#FFFFFF',
                        textAlign: 'left',
                      }}
                    >
                      {reportData.columns.map((col) => (
                        <th
                          key={col.key}
                          style={{
                            padding: '10px 14px',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            textAlign: col.align || 'left',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.items.map((row, idx) => (
                      <tr
                        key={row.id || idx}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F7FAFC',
                        }}
                      >
                        {reportData.columns.map((col) => (
                          <td
                            key={col.key}
                            style={{
                              padding: '10px 14px',
                              textAlign: col.align || 'left',
                              color: '#2D3748',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatCellValue(col.key, row[col.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            <div
              className="no-print"
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: '#F7FAFC',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-3)',
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Showing <strong>{reportData.items.length}</strong> of <strong>{reportData.totalCount}</strong> total records (Page{' '}
                {reportData.pageIndex} of {Math.max(1, reportData.totalPages)})
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous Page
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= reportData.totalPages}
                  onClick={() => setPage((p) => Math.min(reportData.totalPages, p + 1))}
                >
                  Next Page
                </Button>
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
};
