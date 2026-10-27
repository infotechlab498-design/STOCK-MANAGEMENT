import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  CheckCircle,
  FileCheck,
  ArrowLeft,
  AlertTriangle,
  Building2,
  Warehouse,
  User,
  Calendar,
  Clock,
  ShieldCheck,
  Search,
  PackageCheck,
  MessageSquare,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  materialReturnService,
  MaterialReturn,
} from '../services/api/materialReturnService';
import { useAuth } from '../app/AuthContext';

export const MaterialReturnDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [returnDoc, setReturnDoc] = useState<MaterialReturn | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Inspection modal / toggle state
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectionItems, setInspectionItems] = useState<
    {
      id: string;
      materialId: string;
      materialName: string;
      condition: 'ReusableGood' | 'Damaged' | 'UnusableScrap';
      disposition: 'ReturnToUsableStock' | 'QuarantineScrap' | 'SupplierRTV';
      inspectionNotes: string;
    }[]
  >([]);
  const [inspectionComments, setInspectionComments] = useState<string>('');

  // Approval comments
  const [approvalComments, setApprovalComments] = useState<string>('');

  const loadReturn = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await materialReturnService.getReturnById(id);
      if (res.success && res.data) {
        setReturnDoc(res.data);
        setInspectionItems(
          res.data.items.map((item) => ({
            id: item.id,
            materialId: item.materialId,
            materialName: item.materialName,
            condition: item.condition,
            disposition: item.disposition,
            inspectionNotes: item.inspectionNotes || '',
          }))
        );
      } else {
        setError(res.message || 'Failed to fetch material return details.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch material return details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReturn();
  }, [id]);

  if (isLoading) {
    return (
      <div className="content-container">
        <p style={{ color: 'var(--color-charcoal-600)' }}>Loading material return details...</p>
      </div>
    );
  }

  if (error || !returnDoc) {
    return (
      <div className="content-container">
        <PageHeader title="Material Return Note Details" />
        <Card style={{ backgroundColor: '#FFF5F5', borderColor: '#E53E3E' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: '#742A2A' }}>
            <AlertTriangle size={20} />
            <div style={{ fontWeight: 600 }}>{error || 'Material return note not found.'}</div>
          </div>
          <Button variant="secondary" size="sm" style={{ marginTop: 'var(--space-4)' }} onClick={() => navigate('/material-returns')}>
            Return to Directory
          </Button>
        </Card>
      </div>
    );
  }

  const isCreator = user && returnDoc.createdByUserId === user.id;

  const handleInspect = async () => {
    setIsProcessing(true);
    setError(null);
    setActionSuccess(null);
    try {
      await materialReturnService.inspectReturn(returnDoc.id, inspectionItems, inspectionComments);
      setActionSuccess('QA inspection recorded successfully.');
      setIsInspecting(false);
      await loadReturn();
    } catch (err: any) {
      setError(err.message || 'QA inspection failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    setError(null);
    setActionSuccess(null);
    try {
      await materialReturnService.approveReturn(returnDoc.id, approvalComments);
      setActionSuccess('Material return approved successfully.');
      await loadReturn();
    } catch (err: any) {
      setError(err.message || 'Approval failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePost = async () => {
    setIsProcessing(true);
    setError(null);
    setActionSuccess(null);
    try {
      await materialReturnService.postReturn(returnDoc.id);
      setActionSuccess('Material return posted to Stock Ledger & Inventory Balances updated successfully!');
      await loadReturn();
    } catch (err: any) {
      setError(err.message || 'Posting to stock ledger failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="content-container">
      <PageHeader
        title={returnDoc.returnNumber}
        description={`Source Issue: ${returnDoc.materialIssueNumber} | Site: ${returnDoc.projectName}`}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="secondary" size="sm" icon={<ArrowLeft size={15} />} onClick={() => navigate('/material-returns')}>
              Back to Directory
            </Button>

            {returnDoc.status === 'Submitted' && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Search size={15} />}
                onClick={() => setIsInspecting(!isInspecting)}
              >
                {isInspecting ? 'Cancel QA Mode' : 'QA Quality Inspection'}
              </Button>
            )}

            {(returnDoc.status === 'Submitted' || returnDoc.status === 'Inspected') && (
              <Button
                variant="secondary"
                size="sm"
                icon={<CheckCircle size={15} />}
                isLoading={isProcessing}
                onClick={handleApprove}
              >
                Approve Return
              </Button>
            )}

            {returnDoc.status === 'Approved' && (
              <Button
                variant="primary"
                size="sm"
                icon={<PackageCheck size={15} />}
                isLoading={isProcessing}
                onClick={handlePost}
              >
                Post Stock Return
              </Button>
            )}
          </div>
        }
      />

      {actionSuccess && (
        <Card style={{ backgroundColor: '#F0FFF4', borderColor: '#38A169', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: '#22543D' }}>
            <CheckCircle size={20} />
            <div style={{ fontWeight: 600 }}>{actionSuccess}</div>
          </div>
        </Card>
      )}

      {error && (
        <Card style={{ backgroundColor: '#FFF5F5', borderColor: '#E53E3E', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: '#742A2A' }}>
            <AlertTriangle size={20} />
            <div style={{ fontWeight: 600 }}>{error}</div>
          </div>
        </Card>
      )}

      {/* Header Info Banner */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>{returnDoc.returnNumber}</h2>
              <StatusBadge status={returnDoc.status} />
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)' }}>
              Source Issue Voucher: <strong>{returnDoc.materialIssueNumber}</strong> | Site Requisition: <strong>{returnDoc.requisitionNumber}</strong>
            </div>
          </div>

          <div style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-charcoal-600)' }}>
            <div>Created by: <strong>{returnDoc.createdByName}</strong></div>
            <div>Date: <strong>{returnDoc.returnDate}</strong></div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--color-charcoal-200)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Project Site
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-charcoal-900)' }}>
              {returnDoc.projectName}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Receiving Yard / Store
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-charcoal-900)' }}>
              {returnDoc.warehouseName}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Returned By Person
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-charcoal-900)' }}>
              {returnDoc.returnedByPerson}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Reason for Return
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-charcoal-900)' }}>
              {returnDoc.reason}
            </div>
          </div>
        </div>
      </Card>

      {/* QA Inspection Panel (when QA Mode active) */}
      {isInspecting && (
        <Card style={{ marginBottom: 'var(--space-6)', borderColor: 'var(--color-orange-500)', backgroundColor: '#FFFAF0' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--color-orange-900)', marginBottom: 'var(--space-3)' }}>
            QA Storekeeper Quality Inspection Assessment
          </h3>

          <div style={{ display: 'grid', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            {inspectionItems.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 'var(--border-radius-md)',
                  border: '1px solid var(--color-charcoal-200)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 'var(--space-3)',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.materialName}</div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Physical Condition</label>
                  <select
                    value={item.condition}
                    onChange={(e) => {
                      const cond = e.target.value as any;
                      setInspectionItems((prev) => {
                        const copy = [...prev];
                        copy[idx].condition = cond;
                        if (cond === 'ReusableGood') copy[idx].disposition = 'ReturnToUsableStock';
                        else if (cond === 'Damaged') copy[idx].disposition = 'SupplierRTV';
                        else copy[idx].disposition = 'QuarantineScrap';
                        return copy;
                      });
                    }}
                    style={{ width: '100%', height: '32px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--color-charcoal-300)', fontSize: '0.8125rem' }}
                  >
                    <option value="ReusableGood">Reusable Good</option>
                    <option value="Damaged">Damaged</option>
                    <option value="UnusableScrap">Unusable Scrap</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Disposition</label>
                  <select
                    value={item.disposition}
                    onChange={(e) => {
                      const disp = e.target.value as any;
                      setInspectionItems((prev) => {
                        const copy = [...prev];
                        copy[idx].disposition = disp;
                        return copy;
                      });
                    }}
                    style={{ width: '100%', height: '32px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--color-charcoal-300)', fontSize: '0.8125rem' }}
                  >
                    <option value="ReturnToUsableStock">Return to Usable Stock</option>
                    <option value="QuarantineScrap">Quarantine Scrap</option>
                    <option value="SupplierRTV">Supplier RTV</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>QA Notes</label>
                  <input
                    type="text"
                    value={item.inspectionNotes}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInspectionItems((prev) => {
                        const copy = [...prev];
                        copy[idx].inspectionNotes = val;
                        return copy;
                      });
                    }}
                    style={{ width: '100%', height: '32px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--color-charcoal-300)', fontSize: '0.8125rem', padding: '0 6px' }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>General QA Remarks</label>
            <input
              type="text"
              placeholder="e.g. Verified structural integrity and seal status"
              value={inspectionComments}
              onChange={(e) => setInspectionComments(e.target.value)}
              style={{ width: '100%', height: '36px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem', marginBottom: 'var(--space-3)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button variant="secondary" size="sm" onClick={() => setIsInspecting(false)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={isProcessing} onClick={handleInspect}>Save QA Assessment</Button>
          </div>
        </Card>
      )}

      {/* Material Return Lines Table */}
      <Card style={{ marginBottom: 'var(--space-6)', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-charcoal-200)', backgroundColor: 'var(--color-charcoal-50)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-charcoal-900)' }}>
            Returned Material Line Items
          </h3>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Material</th>
                <th style={{ textAlign: 'right' }}>Returned Qty</th>
                <th>Condition</th>
                <th>Disposition</th>
                <th style={{ textAlign: 'right' }}>Unit WAC Cost</th>
                <th style={{ textAlign: 'right' }}>Total Value</th>
                <th>Inspection Notes</th>
              </tr>
            </thead>
            <tbody>
              {returnDoc.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.materialCode}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)' }}>{item.materialName}</div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {item.returnedQuantity} {item.unitCode}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor:
                          item.condition === 'ReusableGood'
                            ? '#C6F6D5'
                            : item.condition === 'Damaged'
                            ? '#FEEBC8'
                            : '#FED7D7',
                        color:
                          item.condition === 'ReusableGood'
                            ? '#22543D'
                            : item.condition === 'Damaged'
                            ? '#742A2A'
                            : '#9B2C2C',
                      }}
                    >
                      {item.condition}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-charcoal-800)' }}>
                      {item.disposition}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>${(item.unitCost || 0).toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-900)' }}>
                    ${(item.totalReturnAmount || 0).toFixed(2)}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-600)' }}>
                    {item.inspectionNotes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Audit Trail */}
      <Card style={{ padding: 'var(--space-4)' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--color-charcoal-900)', marginBottom: 'var(--space-4)' }}>
          Audit Trail & Workflow History
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {returnDoc.auditTrail.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-charcoal-50)',
                borderRadius: 'var(--border-radius-md)',
              }}
            >
              <Clock size={16} style={{ color: 'var(--color-charcoal-500)', marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{entry.action}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>
                    {new Date(entry.timestampUtc).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-700)' }}>
                  {entry.actorName} ({entry.actorRole})
                </div>
                {entry.comments && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-600)', marginTop: '4px', fontStyle: 'italic' }}>
                    "{entry.comments}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
