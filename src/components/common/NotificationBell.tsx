import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  PackageCheck,
  FileWarning,
  Truck,
  ArrowRight,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  notificationService,
  NotificationItem,
  NotificationSeverity,
} from '../../services/api/notificationService';
import { useAuth } from '../../app/useAuth';
import { useRealtime } from '../../app/useRealtime';

export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { connected, subscribe } = useRealtime();

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await notificationService.getNotifications({ page: 1, pageSize: 8 });
      setItems(res.items || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err: any) {
      setError(err?.message || 'Unable to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Keep polling as a fallback when the SignalR socket is down.
    const interval = setInterval(fetchNotifications, connected ? 120000 : 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications, user?.id, connected]);

  useEffect(() => {
    return subscribe('notification.created', () => {
      void fetchNotifications();
    });
  }, [subscribe, fetchNotifications]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore transient error
    }
  };

  const handleClickNotification = async (n: NotificationItem) => {
    try {
      if (!n.isRead) {
        await notificationService.markAsRead(n.id);
        setItems((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)));
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // ignore error and still navigate
    }
    setOpen(false);
    if (n.targetRoute) {
      navigate(n.targetRoute);
    }
  };

  const getIcon = (severity: NotificationSeverity, category: string) => {
    if (category === 'StockTransfer') {
      return <Truck size={16} style={{ color: '#DD6B20' }} />;
    }
    switch (severity) {
      case 'Warning':
        return <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />;
      case 'Critical':
        return <FileWarning size={16} style={{ color: 'var(--color-danger)' }} />;
      case 'Success':
        return <PackageCheck size={16} style={{ color: 'var(--color-success)' }} />;
      default:
        return <Bell size={16} style={{ color: 'var(--color-info)' }} />;
    }
  };

  const formatTimestamp = (iso: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso.slice(0, 16).replace('T', ' ');
    }
  };

  return (
    <div className="dropdown-wrapper" ref={menuRef}>
      <button
        type="button"
        className="topbar-icon-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notifications (${unreadCount} unread)`}
        title="Operational Alerts & Action Centre"
      >
        <Bell size={19} />
        {unreadCount > 0 && <span className="notification-dot" />}
      </button>

      {open && (
        <div
          className="dropdown-panel"
          style={{ width: '380px', right: 0 }}
          role="dialog"
          aria-label="Notifications Panel"
        >
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--color-gray-50)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-charcoal-900)' }}>
                Action & Notification Centre
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'var(--color-orange-500)',
                    color: '#fff',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '999px',
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={fetchNotifications}
                title="Refresh notifications"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-charcoal-600)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <RefreshCw size={13} />
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-orange-600)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {loading && items.length === 0 ? (
              <div
                style={{
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.8125rem',
                }}
              >
                Synchronizing operational alerts...
              </div>
            ) : error ? (
              <div
                style={{
                  padding: 'var(--space-4)',
                  textAlign: 'center',
                  color: 'var(--color-danger)',
                  fontSize: '0.8125rem',
                }}
              >
                {error}
              </div>
            ) : items.length === 0 ? (
              <div
                style={{
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.8125rem',
                }}
              >
                No operational alerts in your authorized scope.
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: n.isRead ? 'var(--bg-surface)' : '#FFFBEB',
                    display: 'flex',
                    gap: 'var(--space-3)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <div style={{ marginTop: '2px', flexShrink: 0 }}>{getIcon(n.severity, n.category)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: n.isRead ? 600 : 700,
                          color: 'var(--color-charcoal-900)',
                        }}
                      >
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            backgroundColor: '#DD6B20',
                            flexShrink: 0,
                            marginTop: 5,
                          }}
                        />
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-charcoal-600)',
                        marginTop: '3px',
                        lineHeight: 1.4,
                      }}
                    >
                      {n.message}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '6px',
                        fontSize: '0.6875rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>
                        {n.sourceDocumentNumber} • {formatTimestamp(n.createdAtUtc)}
                      </span>
                      <span
                        style={{
                          color: '#DD6B20',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        Open <ExternalLink size={10} />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--color-gray-50)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#2D3748',
              }}
            >
              View Full Notification & Action Centre
              <ArrowRight size={14} style={{ color: '#DD6B20' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
