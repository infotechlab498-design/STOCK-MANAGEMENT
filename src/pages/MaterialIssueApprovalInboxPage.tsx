import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, RefreshCw, Eye, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState, LoadingSpinner } from '../components/common/EmptyState';
import {
  materialIssueService,
  MaterialIssue,
} from '../services/api/materialIssueService';

export const MaterialIssueApprovalInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const [pendingIssues, setPendingIssues] = useState<MaterialIssue[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await materialIssueService.getIssues({ status: 'Submitted' });
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : res.data.items || [];
        setPendingIssues(list);
      } else {
        setError(res.message || 'Failed to load issue approval inbox.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server.');
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

  return (
    <div className="content-container">
      <PageHeader
        title="Material Issue Approval Inbox"
        description="Review pending store dispatch vouchers and authorize site material dispatches"
        actions={
          <Button variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={fetchInbox} isLoading={isLoading}>
            Refresh Inbox
          </Button>
        }
      />

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
            description="There are currently zero pending material issue vouchers awaiting your approval."
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
    </div>
  );
};
