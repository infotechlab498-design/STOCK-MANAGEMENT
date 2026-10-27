import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  FileWarning,
  PackageCheck,
  Truck,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState, LoadingSpinner } from '../components/common/EmptyState';
import {
  notificationService,
  NotificationItem,
  NotificationSeverity,
} from '../services/api/notificationService';
import { useAuth } from '../app/AuthContext';

export const NotificationsCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState('ALL');
  const [projectId, setProjectId] = useState('ALL');
  const [warehouseId, setWarehouseId] = useState('ALL');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await notificationService.getNotifications({
        unreadOnly,
        category,
        projectId,
        warehouseId,
        page,
        pageSize: 20,
      });
      setItems(res.items || []);
      setUnreadCount(res.unreadCount || 0);
      setTotalCount(res.totalCount || 0);
      setTotalPages(Math.max(1, res.totalPages || 1));
    } catch (err: any) {
      setError(err?.message || 'Failed to load operational notifications');
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, category, projectId, warehouseId, page]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, user?.id]);

  const handleMarkAsRead = async (n: NotificationItem) => {
    if (n.isRead) return;
    try {
      await notificationService.markAsRead(n.id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, isRead: true, readAtUtc: new Date().toISOString() } : item
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err: any) {
      setError(err?.message || 'Could not mark notification as read');
    }
  };

  const handleOpenSourceDocument = async (n: NotificationItem) => {
    if (!n.isRead) {
      await handleMarkAsRead(n);
    }
    if (n.targetRoute) {
      navigate(n.targetRoute);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setActionBusy(true);
      await notificationService.markAllAsRead({
        projectId: projectId !== 'ALL' ? projectId : undefined,
        warehouseId: warehouseId !== 'ALL' ? warehouseId : undefined,
      });
      await loadNotifications();
    } catch (err: any) {
      setError(err?.message || 'Failed to mark notifications as read');
    } finally {
      setActionBusy(false);
    }
  };

  const getSeverityBadge = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'Critical':
        return <Badge variant="danger">Critical</Badge>;
      case 'Warning':
        return <Badge variant="warning">Warning</Badge>;
      case 'Success':
        return <Badge variant="success">Completed</Badge>;
      default:
        return <Badge variant="transit">Info</Badge>;
    }
  };

  const getCategoryIcon = (severity: NotificationSeverity, cat: string) => {
    if (cat === 'StockTransfer') return <Truck size={18} style={{ color: '#DD6B20' }} />;
    if (severity === 'Critical') return <FileWarning size={18} style={{ color: 'var(--color-danger)' }} />;
    if (severity === 'Warning') return <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />;
    if (severity === 'Success') return <PackageCheck size={18} style={{ color: 'var(--color-success)' }} />;
    return <Bell size={18} style={{ color: 'var(--color-info)' }} />;
  };

  return (
    <div>
      <PageHeader
        title="Notifications & Operational Action Centre"
        description="Real-time workflow alerts for requisitions, GRN inspections, material issues/returns, in-transit transfers, low-stock thresholds, and ledger reconciliation."
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={15} />}
              onClick={loadNotifications}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCheck size={15} />}
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0 || actionBusy}
            >
              Mark All Read ({unreadCount})
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <Card style={{ marginBottom: 'var(--space-5)' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2D3748', fontWeight: 700, fontSize: '0.8125rem' }}>
              <Filter size={15} style={{ color: '#DD6B20' }} />
              Scope & Event Filters:
            </div>

            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '7px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                fontSize: '0.8125rem',
                backgroundColor: '#fff',
              }}
              aria-label="Filter by Notification Category"
            >
              <option value="ALL">All Event Categories</option>
              <option value="Requisition">Material Requisitions</option>
              <option value="GRN">GRNs & QA Inspection</option>
              <option value="MaterialIssue">Material Issues</option>
              <option value="MaterialReturn">Material Returns</option>
              <option value="StockTransfer">Stock Transfers & In-Transit</option>
              <option value="LowStock">Low-Stock & Reorder Alerts</option>
              <option value="Reconciliation">Ledger Reconciliation</option>
            </select>

            <select
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
              aria-label="Filter by Project Site"
            >
              <option value="ALL">All Authorized Projects</option>
              <option value="PRJ-101">PRJ-101 • Metro Rail Line 3 Extension</option>
              <option value="PRJ-102">PRJ-102 • Harbor Commercial Docklands</option>
              <option value="PRJ-103">PRJ-103 • Skyline Corporate Towers</option>
            </select>

            <select
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
              aria-label="Filter by Warehouse"
            >
              <option value="ALL">All Authorized Warehouses</option>
              <option value="WH-01">WH-01 • Metro Central Staging Yard</option>
              <option value="WH-02">WH-02 • North Industrial Depot & Yard</option>
              <option value="WH-03">WH-03 • East Harbor Hub</option>
            </select>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#2D3748',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => {
                  setUnreadOnly(e.target.checked);
                  setPage(1);
                }}
              />
              Unread Only ({unreadCount})
            </label>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Showing <strong>{items.length}</strong> of <strong>{totalCount}</strong> scoped notifications
          </div>
        </div>
      </Card>

      {error && (
        <div
          style={{
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
            backgroundColor: '#FFF5F5',
            border: '1px solid #FEB2B2',
            borderRadius: 'var(--radius-md)',
            color: '#C53030',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <Card>
          <LoadingSpinner label="Loading authorized notifications and workflow events..." />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="No Notifications Found"
            description={
              unreadOnly
                ? 'You have read all notifications in this scope. Uncheck "Unread Only" to view historical events.'
                : 'No system events match your current project/warehouse scope and filter criteria.'
            }
          />
        </Card>
      ) : (
        <Card>
          <div>
            {items.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: 'var(--space-4) var(--space-3)',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: n.isRead ? '#FFFFFF' : '#FFFBEB',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', gap: 'var(--space-3)', flex: 1 }}>
                  <div style={{ marginTop: 3 }}>{getCategoryIcon(n.severity, n.category)}</div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: n.isRead ? 600 : 700,
                          fontSize: '0.9375rem',
                          color: '#2D3748',
                        }}
                      >
                        {n.title}
                      </span>
                      {getSeverityBadge(n.severity)}
                      <Badge variant="neutral">{n.category}</Badge>
                      {!n.isRead && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            color: '#DD6B20',
                            backgroundColor: '#FEEBC8',
                            padding: '1px 6px',
                            borderRadius: 4,
                          }}
                        >
                          UNREAD
                        </span>
                      )}
                    </div>

                    <p
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--color-charcoal-700)',
                        marginBottom: 8,
                        lineHeight: 1.45,
                      }}
                    >
                      {n.message}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 'var(--space-4)',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>
                        <strong>Reference:</strong> {n.sourceDocumentNumber}
                      </span>
                      {n.projectName && (
                        <span>
                          <strong>Project:</strong> {n.projectName}
                        </span>
                      )}
                      {n.warehouseName && (
                        <span>
                          <strong>Warehouse:</strong> {n.warehouseName}
                        </span>
                      )}
                      <span>
                        <strong>Event Time:</strong> {new Date(n.createdAtUtc).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                  {!n.isRead && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<CheckCircle2 size={14} />}
                      onClick={() => handleMarkAsRead(n)}
                    >
                      Mark Read
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<ExternalLink size={14} />}
                    iconPosition="right"
                    onClick={() => handleOpenSourceDocument(n)}
                  >
                    Open Document
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F7FAFC',
                marginTop: 'var(--space-3)',
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Page {page} of {totalPages}
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
