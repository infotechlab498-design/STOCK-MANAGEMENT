import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Boxes,
  ArrowLeft,
  AlertTriangle,
  Building2,
  Send,
  RotateCcw,
  CheckCircle,
  Clock,
  PieChart,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { requisitionService } from '../services/api/requisitionService';

export const RequisitionFulfillmentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [fulfillmentData, setFulfillmentData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFulfillment() {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await requisitionService.getFulfillmentDetails(id);
        setFulfillmentData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch requisition fulfillment details.');
      } finally {
        setIsLoading(false);
      }
    }
    loadFulfillment();
  }, [id]);

  if (isLoading) {
    return (
      <div className="content-container">
        <p style={{ color: 'var(--color-charcoal-600)' }}>Loading requisition fulfillment analysis...</p>
      </div>
    );
  }

  if (error || !fulfillmentData) {
    return (
      <div className="content-container">
        <PageHeader title="Requisition Fulfillment Tracker" />
        <Card style={{ backgroundColor: '#FFF5F5', borderColor: '#E53E3E' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: '#742A2A' }}>
            <AlertTriangle size={20} />
            <div style={{ fontWeight: 600 }}>{error || 'Requisition fulfillment details unavailable.'}</div>
          </div>
          <Button variant="secondary" size="sm" style={{ marginTop: 'var(--space-4)' }} onClick={() => navigate('/requisitions')}>
            Return to Requisitions
          </Button>
        </Card>
      </div>
    );
  }

  const { requisition, summary, lineBreakdown, linkedVouchers } = fulfillmentData;

  return (
    <div className="content-container">
      <PageHeader
        title={`Fulfillment Tracker: ${requisition.requisitionNumber}`}
        description={`Project Site: ${requisition.projectName} | Purpose: ${requisition.purpose}`}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="secondary" size="sm" icon={<ArrowLeft size={15} />} onClick={() => navigate(`/requisitions/${requisition.id}`)}>
              Back to Requisition
            </Button>
            {requisition.status === 'Approved' || requisition.status === 'PartiallyFulfilled' ? (
              <Button variant="primary" size="sm" icon={<Send size={15} />} onClick={() => navigate('/material-issues/new')}>
                Issue Material
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Header Overview Card */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>{requisition.requisitionNumber}</h2>
              <StatusBadge status={requisition.status} />
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)' }}>
              Requester: <strong>{requisition.requesterName}</strong> | Required Date: <strong>{requisition.requiredDate || 'N/A'}</strong>
            </div>
          </div>

          <div style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-charcoal-600)' }}>
            <div>Project: <strong>{requisition.projectName}</strong></div>
            <div>Work Activity: <strong>{requisition.workActivity || 'General Site Work'}</strong></div>
          </div>
        </div>

        {/* Progress Summary Bar */}
        <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-charcoal-200)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-charcoal-800)' }}>
              Overall Site Fulfillment Rate
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-orange-700)' }}>
              {(summary?.fulfillmentRate || 0).toFixed(1)}%
            </span>
          </div>

          <div style={{ width: '100%', height: '12px', backgroundColor: 'var(--color-charcoal-200)', borderRadius: '6px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, summary?.fulfillmentRate || 0)}%`,
                backgroundColor: (summary?.fulfillmentRate || 0) >= 100 ? '#38A169' : '#DD6B20',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </Card>

      {/* Metric Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatCard
          label="Total Requested Qty"
          value={summary?.totalRequested || 0}
          icon={<Boxes size={20} />}
        />
        <StatCard
          label="Total Issued to Site"
          value={summary?.totalIssued || 0}
          icon={<Send size={20} />}
        />
        <StatCard
          label="Total Returned to Yard"
          value={summary?.totalReturned || 0}
          icon={<RotateCcw size={20} />}
        />
        <StatCard
          label="Net Site Consumption"
          value={summary?.netConsumed || 0}
          icon={<PieChart size={20} />}
        />
        <StatCard
          label="Outstanding Approved Qty"
          value={summary?.totalOutstanding || 0}
          icon={<Clock size={20} />}
        />
      </div>

      {/* Line-by-Line Fulfillment Breakdown */}
      <Card style={{ marginBottom: 'var(--space-6)', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-charcoal-200)', backgroundColor: 'var(--color-charcoal-50)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-charcoal-900)' }}>
            Material Line-Level Fulfillment Breakdown
          </h3>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Material Code & Name</th>
                <th style={{ textAlign: 'right' }}>Requested</th>
                <th style={{ textAlign: 'right' }}>Issued</th>
                <th style={{ textAlign: 'right' }}>Returned</th>
                <th style={{ textAlign: 'right' }}>Net Consumed</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th style={{ width: '160px' }}>Fulfillment %</th>
              </tr>
            </thead>
            <tbody>
              {lineBreakdown.map((lb: any) => (
                <tr key={lb.materialId}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{lb.materialCode}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)' }}>{lb.materialName}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>{lb.requestedQuantity} {lb.unitCode}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-900)' }}>
                    {lb.issuedQuantity}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-charcoal-600)' }}>
                    {lb.returnedQuantity}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#2B6CB0' }}>
                    {lb.netConsumedQuantity}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: lb.outstandingQuantity > 0 ? 'var(--color-orange-700)' : '#22543D' }}>
                    {lb.outstandingQuantity}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--color-charcoal-200)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, lb.fulfillmentPercentage || 0)}%`,
                            backgroundColor: (lb.fulfillmentPercentage || 0) >= 100 ? '#38A169' : '#DD6B20',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                        {(lb.fulfillmentPercentage || 0).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Linked Vouchers History */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Linked Material Issues */}
        <Card style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--color-charcoal-900)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Send size={18} style={{ color: 'var(--color-orange-600)' }} /> Linked Store Issues ({linkedVouchers?.issues?.length || 0})
          </h3>

          {linkedVouchers?.issues?.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)' }}>No material issue vouchers created for this requisition yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {linkedVouchers.issues.map((issue: any) => (
                <div
                  key={issue.id}
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-charcoal-50)',
                    borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--color-charcoal-200)',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/material-issues/${issue.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-orange-700)' }}>
                      {issue.issueNumber}
                    </span>
                    <StatusBadge status={issue.status} />
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-600)' }}>
                    Yard: {issue.warehouseName} | Date: {issue.issueDate}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Linked Material Returns */}
        <Card style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--color-charcoal-900)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw size={18} style={{ color: 'var(--color-charcoal-700)' }} /> Linked Site Returns ({linkedVouchers?.returns?.length || 0})
          </h3>

          {linkedVouchers?.returns?.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)' }}>No material return notes recorded for this requisition.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {linkedVouchers.returns.map((ret: any) => (
                <div
                  key={ret.id}
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-charcoal-50)',
                    borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--color-charcoal-200)',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/material-returns/${ret.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-charcoal-900)' }}>
                      {ret.returnNumber}
                    </span>
                    <StatusBadge status={ret.status} />
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-600)' }}>
                    Issue Ref: {ret.materialIssueNumber} | Date: {ret.returnDate}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
