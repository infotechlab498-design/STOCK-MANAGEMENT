import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Eye } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { EmptyState, LoadingSpinner } from '../components/common/EmptyState';
import { AppLayout } from '../layouts/AppLayout';
import { useAuth } from '../app/useAuth';
import {
  materialIssueService,
  MaterialIssue,
} from '../services/api/materialIssueService';

export const MaterialIssueApprovalInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [pendingIssues, setPendingIssues] = useState<MaterialIssue[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Inbox is Submitted-only; already Approved/Posted vouchers belong in the directory.
      const res = await materialIssueService.getIssues({
        status: 'Submitted',
        page: 1,
        pageSize: 100,
      });
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : res.data.items || [];
        setPendingIssues(list);
      } else {
        setError(res.message || 'Failed to load issue approval inbox.');
        setPendingIssues([]);
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server.');
      setPendingIssues([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

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

  const scopeHint =
    hasRole(['ProjectManager']) && !hasRole(['SuperAdmin', 'InventoryManager'])
      ? ` Scoped to your assigned projects only (${user?.projectScopes?.join(', ') || 'project scope'}). Vouchers on other projects will not appear here.`
      : '';

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Dashboard', onClick: () => navigate('/dashboard') },
        { label: 'Material Issues', onClick: () => navigate('/material-issues') },
        { label: 'Approval Inbox', active: true },
      ]}
      title="Material Issue Approval Inbox"
      description="Review pending store dispatch vouchers and authorize site material dispatches"
      actions={
        <Button variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={fetchInbox} isLoading={isLoading}>
          Refresh Inbox
        </Button>
      }
    >
      {isLoading ? (
        <Card>
          <LoadingSpinner label="Fetching submitted material issues..." />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState title="Error Loading Inbox" description={error} action={<Button variant="secondary" size="sm" onClick={fetchInbox}>Retry</Button>} />
        </Card>
      ) : pendingIssues.length === 0 ? (
        <Card>
          <EmptyState
            title="Inbox Empty"
            description={`No Submitted vouchers await your approval right now.${scopeHint} If a voucher was already Approved, open the Issue Directory instead.`}
            action={<Button variant="secondary" size="sm" onClick={() => navigate('/material-issues')}>View Issue Directory</Button>}
          />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Voucher #</th>
                  <th>Requisition #</th>
                  <th>Project Site</th>
                  <th>Issuing Yard</th>
                  <th>Purpose / Activity</th>
                  <th>Receiver</th>
                  <th>Submitted At</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingIssues.map((iss) => (
                  <tr key={iss.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-orange-700)', fontFamily: 'monospace' }}>
                      {iss.issueNumber}
                    </td>
                    <td style={{ fontWeight: 600 }}>{iss.requisitionNumber}</td>
                    <td>{iss.projectName}</td>
                    <td>{iss.warehouseName}</td>
                    <td>{iss.purpose}</td>
                    <td>{iss.receivedByPerson}</td>
                    <td>{formatDate(iss.submittedAtUtc || iss.createdAtUtc)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Eye size={14} />}
                        onClick={() => navigate(`/material-issues/${iss.id}`)}
                      >
                        Review Voucher
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppLayout>
  );
};
