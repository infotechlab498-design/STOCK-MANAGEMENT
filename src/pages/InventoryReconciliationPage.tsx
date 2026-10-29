import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Play,
  Layers,
  FileText,
  Boxes,
  Clock,
  Lock,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import {
  inventoryService,
  ReconciliationReport,
  DiscrepancyItem,
} from '../services/api/inventoryService';
import { useAuth } from '../app/useAuth';

export const InventoryReconciliationPage: React.FC = () => {
  const { hasRole } = useAuth();
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReconciliation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await inventoryService.getReconciliation();
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.message || 'Failed to run reconciliation check.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReconciliation();
  }, [fetchReconciliation]);

  const handleRecover = async () => {
    setIsRecovering(true);
    setRecoveryMessage(null);
    try {
      const res = await inventoryService.recoverReconciliation();
      if (res.success && res.data) {
        setRecoveryMessage(res.data.message);
        await fetchReconciliation();
      } else {
        setError(res.message || 'Recovery failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Error running recovery process.');
    } finally {
      setIsRecovering(false);
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'N/A';
    try {
      return new Date(isoStr).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const canRecover = hasRole(['SuperAdmin', 'InventoryManager']);

  return (
    <div className="content-container">
      <PageHeader
        title="Inventory Reconciliation & Recovery"
        description="Audit comparison between posted eligible GRN receipts, authoritative stock ledger entries, and stored location balances"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={15} />}
              onClick={fetchReconciliation}
              isLoading={isLoading}
            >
              Re-run Audit Check
            </Button>
            {canRecover && report && report.totalDiscrepancies > 0 && (
              <Button
                variant="primary"
                size="sm"
                icon={<Play size={15} />}
                onClick={handleRecover}
                isLoading={isRecovering}
              >
                Auto-Recover Receipts
              </Button>
            )}
          </div>
        }
      />

      {/* Recovery Message Alert */}
      {recoveryMessage && (
        <div
          style={{
            backgroundColor: '#C6F6D5',
            color: '#22543D',
            padding: 'var(--space-4)',
            borderRadius: 'var(--border-radius-md)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <CheckCircle size={20} />
          <div style={{ fontWeight: 600 }}>{recoveryMessage}</div>
        </div>
      )}

      {/* Status Banner */}
      {report && (
        <Card
          style={{
            marginBottom: 'var(--space-6)',
            backgroundColor: report.isReconciled ? '#F0FFF4' : '#FFF5F5',
            borderColor: report.isReconciled ? '#38A169' : '#E53E3E',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: report.isReconciled ? '#C6F6D5' : '#FED7D7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: report.isReconciled ? '#22543D' : '#742A2A',
                flexShrink: 0,
              }}
            >
              {report.isReconciled ? <ShieldCheck size={28} /> : <AlertTriangle size={28} />}
            </div>
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  color: report.isReconciled ? '#22543D' : '#742A2A',
                }}
              >
                {report.isReconciled
                  ? 'Authoritative Inventory Ledger 100% Reconciled'
                  : `Discrepancy Detected (${report.totalDiscrepancies} Unreconciled Items)`}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--color-charcoal-700)' }}>
                {report.isReconciled
                  ? 'All posted Goods Received Notes match the stock movement ledger and stored location balances on hand exactly.'
                  : 'Deliberate or unposted receipt transactions detected. Authorized administrators may execute recovery.'}
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--color-charcoal-600)' }}>
              <div><strong>Last Audit Run:</strong></div>
              <div>{formatDate(report.lastReconciledAtUtc)}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Discrepancies List */}
      {isLoading ? (
        <Card>
          <LoadingSpinner label="Running three-way reconciliation cross-check..." />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState
            title="Audit Failed"
            description={error}
            action={
              <Button variant="secondary" size="sm" onClick={fetchReconciliation}>
                Retry Audit
              </Button>
            }
          />
        </Card>
      ) : report?.totalDiscrepancies === 0 ? (
        <Card>
          <EmptyState
            title="Zero Discrepancies Found"
            description="The authoritative stock ledger, posted receipt journals, and inventory balances on hand are completely reconciled and consistent."
            action={
              <Button variant="secondary" size="sm" onClick={() => window.history.back()}>
                Back
              </Button>
            }
          />
        </Card>
      ) : (
        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-3)', color: 'var(--color-charcoal-900)' }}>
            Unreconciled Items & Discrepancies
          </h3>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Source Ref</th>
                    <th>Material Code</th>
                    <th>Location</th>
                    <th>Discrepancy Description</th>
                    <th style={{ textAlign: 'right' }}>Expected</th>
                    <th style={{ textAlign: 'right' }}>Actual</th>
                    <th style={{ textAlign: 'center' }}>Recoverable</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.grnVsLedgerDiscrepancies.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span className="badge badge-warning">Unposted Receipt</span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--color-orange-700)' }}>
                        {d.sourceReference}
                      </td>
                      <td>{d.materialCode}</td>
                      <td>{d.location}</td>
                      <td style={{ fontSize: '0.8125rem' }}>{d.description}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{d.expectedValue}</td>
                      <td style={{ textAlign: 'right', color: '#9B2C2C' }}>{d.actualValue}</td>
                      <td style={{ textAlign: 'center' }}>
                        {d.canAutoRecover ? (
                          <span className="badge badge-success">Yes</span>
                        ) : (
                          <span className="badge badge-danger">Manual</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {report?.ledgerVsBalanceDiscrepancies.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span className="badge badge-danger">Quantity Mismatch</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{d.sourceReference}</td>
                      <td>{d.materialCode}</td>
                      <td>{d.location}</td>
                      <td style={{ fontSize: '0.8125rem' }}>{d.description}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{d.expectedValue}</td>
                      <td style={{ textAlign: 'right', color: '#9B2C2C' }}>{d.actualValue}</td>
                      <td style={{ textAlign: 'center' }}>
                        {d.canAutoRecover ? (
                          <span className="badge badge-success">Yes</span>
                        ) : (
                          <span className="badge badge-danger">Manual</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
