import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, Truck, ClipboardList, Check } from 'lucide-react';

interface NotificationItemData {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'warning' | 'transit' | 'approval';
  read: boolean;
}

const initialNotifications: NotificationItemData[] = [
  {
    id: 'notif-1',
    title: 'Low Safety Stock Alert',
    description: 'Ordinary Portland Cement (CEM I 42.5N) is at 80 bags (threshold: 200).',
    time: '25m ago',
    type: 'warning',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'Transfer Dispatched (In-Transit)',
    description: 'TRF-2026-0041 PVC Pipe 110mm awaiting Pier Depot confirmation.',
    time: '2h ago',
    type: 'transit',
    read: false,
  },
  {
    id: 'notif-3',
    title: 'Requisition Awaiting Approval',
    description: 'REQ-2026-0089 for High-Tensile Rebar 16mm requires Project Manager sign-off.',
    time: '4h ago',
    type: 'approval',
    read: false,
  },
];

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItemData[]>(initialNotifications);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const getIcon = (type: NotificationItemData['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle size={14} style={{ color: 'var(--color-warning-text)' }} />;
      case 'transit':
        return <Truck size={14} style={{ color: 'var(--color-transit-text)' }} />;
      case 'approval':
      default:
        return <ClipboardList size={14} style={{ color: 'var(--color-orange-600)' }} />;
    }
  };

  const getIconBg = (type: NotificationItemData['type']) => {
    switch (type) {
      case 'warning':
        return 'var(--color-warning-bg)';
      case 'transit':
        return 'var(--color-transit-bg)';
      case 'approval':
      default:
        return 'var(--color-orange-100)';
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        type="button"
        className="btn btn-ghost btn-icon-only"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`View alerts and notifications (${unreadCount} unread)`}
        title="Operational Stock Alerts & Approvals"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 5,
              right: 5,
              minWidth: 16,
              height: 16,
              backgroundColor: 'var(--color-orange-500)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.625rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              border: '2px solid var(--color-bg-surface)',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="dropdown-menu" role="menu" style={{ width: 320 }}>
          <div className="dropdown-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--color-charcoal-900)' }}>
              Stock Alerts & Approvals
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '0.6875rem',
                  color: 'var(--color-orange-600)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Check size={12} />
                <span>Mark read</span>
              </button>
            )}
          </div>

          <div className="dropdown-body">
            {notifications.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)' }}>
                No active operational alerts
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className="notification-item"
                  style={{ opacity: item.read ? 0.75 : 1 }}
                >
                  <div
                    className="notification-icon-box"
                    style={{ backgroundColor: getIconBg(item.type) }}
                  >
                    {getIcon(item.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{item.title}</div>
                    <div className="notification-desc">{item.description}</div>
                    <div className="notification-time">{item.time}</div>
                  </div>
                  {!item.read && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-orange-500)',
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
