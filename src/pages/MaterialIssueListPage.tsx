import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState, LoadingSpinner } from '../components/common/EmptyState';
import {
  materialIssueService,
  MaterialIssue,
} from '../services/api/materialIssueService';
import { useAuth } from '../app/AuthContext';

export const MaterialIssueListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasRole } = useAuth();

  const [issues, setIssues] = useState<MaterialIssue[]>([]);
  const [pageIndex, setPageIndex] = useState<number>(1);
  const [pageSize] = useState<number>(15);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('search') || '');
  const [selectedStatus, setSelectedStatus] = useState<string>(searchParams.get('status') || 'ALL');
  const [selectedProject, setSelectedProject] = useState<string>(searchParams.get('projectId') || 'ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(searchParams.get('warehouseId') || 'ALL');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await materialIssueService.getIssues({
        search: searchTerm,
        status: selectedStatus,
        projectId: selectedProject,
        warehouseId: selectedWarehouse,
        page: pageIndex,
        pageSize,
      });

      if (res.success && res.data) {
        if (Array.isArray(res.data)) {
          setIssues(res.data);
          setTotalCount(res.data.length);
          setTotalPages(1);
        } else {
          setIssues(res.data.items || []);
          setTotalCount(res.data.totalCount || 0);
          setTotalPages(res.data.totalPages || 1);
        }
      } else {
        setError(res.message || 'Failed to fetch material issues');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedStatus, selectedProject, selectedWarehouse, pageIndex, pageSize]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPageIndex(1);
    fetchIssues();
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return 'N/A';
    try {
      return new Date(isoStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const canCreate = hasRole(['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']);

  return (
    <div className="content-container">
      <PageHeader
        title="Material Issues & Site Dispatches"
        description="Auditable store dispatch vouchers issuing materials against approved site requisitions"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={15} />}
              onClick={fetchIssues}
              isLoading={isLoading}
            >
              Refresh
            </Button>
            {hasRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']) && (
              <Button
                variant="secondary"
                size="sm"
                icon={<CheckCircle size={15} />}
                onClick={() => navigate('/material-issues/approval-inbox')}
              >
                Approval Inbox
              </Button>
            )}
            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={15} />}
                onClick={() => navigate('/material-issues/new')}
              >
                New Material Issue
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
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
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                Search Issue Number / Requisition / Material
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-charcoal-400)' }} />
                <input
                  type="text"
                  placeholder="MIV-2026-..., MR-2026-..., contractor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '36px',
                    height: '38px',
                    borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--color-charcoal-300)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPageIndex(1);
                }}
                style={{ width: '100%', height: '38px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted (Pending Approval)</option>
                <option value="Approved">Approved (Ready to Post)</option>
                <option value="Posted">Posted (Dispatched)</option>
                <option value="ReturnedForCorrection">Returned For Correction</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                Project Site
              </label>
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  setPageIndex(1);
                }}
                style={{ width: '100%', height: '38px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem' }}
              >
                <option value="ALL">All Project Sites</option>
                <option value="PRJ-101">PRJ-101: Metro Rail Line 3</option>
                <option value="PRJ-102">PRJ-102: Harbor Docklands</option>
                <option value="PRJ-103">PRJ-103: Skyline Towers</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                Warehouse / Yard
              </label>
              <select
                value={selectedWarehouse}
                onChange={(e) => {
                  setSelectedWarehouse(e.target.value);
                  setPageIndex(1);
                }}
                style={{ width: '100%', height: '38px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem' }}
              >
                <option value="ALL">All Warehouses & Yards</option>
                <option value="WH-01">WH-01: Metro Central Yard</option>
                <option value="WH-02">WH-02: North Industrial Depot</option>
                <option value="WH-03">WH-03: East Harbor Hub</option>
              </select>
            </div>

            <Button type="submit" variant="primary" size="md" icon={<Filter size={15} />}>
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {/* Directory Table */}
      {isLoading ? (
        <Card>
          <LoadingSpinner label="Fetching material issue vouchers..." />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState
            title="Error Loading Issues"
            description={error}
            action={
              <Button variant="secondary" size="sm" onClick={fetchIssues}>
                Retry Request
              </Button>
            }
          />
        </Card>
      ) : issues.length === 0 ? (
        <Card>
          <EmptyState
            title="No Material Issues Found"
            description="No store material issue vouchers match your search criteria or filters."
            action={
              canCreate ? (
                <Button variant="primary" size="sm" onClick={() => navigate('/material-issues/new')}>
                  Create New Material Issue
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Issue Voucher #</th>
                  <th>Source Requisition</th>
                  <th>Project Site & Warehouse</th>
                  <th>Activity / Purpose</th>
                  <th>Receiver</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Items</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((iss) => (
                  <tr key={iss.id}>
                    <td>
                      <div
                        style={{ fontWeight: 600, color: 'var(--color-orange-700)', fontFamily: 'monospace', cursor: 'pointer' }}
                        onClick={() => navigate(`/material-issues/${iss.id}`)}
                      >
                        {iss.issueNumber}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>
                        By {iss.createdByName}
                      </div>
                    </td>
                    <td>
                      <div
                        style={{ fontWeight: 600, color: 'var(--color-charcoal-900)', cursor: 'pointer' }}
                        onClick={() => navigate(`/requisitions/${iss.requisitionId}`)}
                      >
                        {iss.requisitionNumber}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{iss.projectName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>{iss.warehouseName}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{iss.purpose}</div>
                      {iss.workActivity && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>{iss.workActivity}</div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{iss.receivedByPerson}</span>
                    </td>
                    <td>{formatDate(iss.issueDate)}</td>
                    <td>
                      <StatusBadge status={iss.status} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-secondary">{iss.items.length} Lines</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Eye size={14} />}
                        onClick={() => navigate(`/material-issues/${iss.id}`)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
                Showing {(pageIndex - 1) * pageSize + 1} to {Math.min(pageIndex * pageSize, totalCount)} of {totalCount} vouchers
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
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '0.8125rem', fontWeight: 600 }}>
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
    </div>
  );
};
