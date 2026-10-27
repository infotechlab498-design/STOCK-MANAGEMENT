import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  Save,
  ArrowLeft,
  AlertTriangle,
  Building2,
  Warehouse,
  User,
  Calendar,
  ClipboardCheck,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import {
  materialIssueService,
  MaterialIssue,
} from '../services/api/materialIssueService';
import { materialReturnService } from '../services/api/materialReturnService';

interface ReturnLineInput {
  materialIssueItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  issuedQuantity: number;
  previouslyReturnedQuantity: number;
  maxReturnableQuantity: number;
  returnedQuantity: number;
  condition: 'ReusableGood' | 'Damaged' | 'UnusableScrap';
  disposition: 'ReturnToUsableStock' | 'QuarantineScrap' | 'SupplierRTV';
  inspectionNotes: string;
}

export const MaterialReturnFormPage: React.FC = () => {
  const navigate = useNavigate();

  const [postedIssues, setPostedIssues] = useState<MaterialIssue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string>('');
  const [selectedIssueDoc, setSelectedIssueDoc] = useState<MaterialIssue | null>(null);

  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [returnedByPerson, setReturnedByPerson] = useState<string>('');
  const [reason, setReason] = useState<string>('Excess Site Inventory / Project Surplus');
  const [generalRemarks, setGeneralRemarks] = useState<string>('');

  const [lines, setLines] = useState<ReturnLineInput[]>([]);

  const [isLoadingIssues, setIsLoadingIssues] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load posted issues
  useEffect(() => {
    async function loadPostedIssues() {
      setIsLoadingIssues(true);
      try {
        const res = await materialIssueService.getIssues({ status: 'Posted', pageSize: 100 });
        if (res.success && res.data) {
          const items = Array.isArray(res.data) ? res.data : (res.data as any).items || [];
          setPostedIssues(items);
        }
      } catch (err: any) {
        setFormError('Failed to load posted material issues.');
      } finally {
        setIsLoadingIssues(false);
      }
    }
    loadPostedIssues();
  }, []);

  // When posted issue is selected
  const handleSelectIssue = async (issueId: string) => {
    setSelectedIssueId(issueId);
    setFormError(null);

    if (!issueId) {
      setSelectedIssueDoc(null);
      setLines([]);
      return;
    }

    try {
      const res = await materialIssueService.getIssueById(issueId);
      if (res.success && res.data) {
        const issueDoc = res.data;
        setSelectedIssueDoc(issueDoc);

        const newLines: ReturnLineInput[] = issueDoc.items.map((item) => {
          const issuedQty = item.actualIssuedQuantity || item.quantityToIssue || 0;
          const prevReturned = item.previouslyReturnedQuantity || 0;
          const maxReturnable = Math.max(0, issuedQty - prevReturned);

          return {
            materialIssueItemId: item.id,
            materialId: item.materialId,
            materialCode: item.materialCode,
            materialName: item.materialName,
            unitCode: item.unitCode,
            issuedQuantity: issuedQty,
            previouslyReturnedQuantity: prevReturned,
            maxReturnableQuantity: maxReturnable,
            returnedQuantity: maxReturnable, // default to remaining
            condition: 'ReusableGood',
            disposition: 'ReturnToUsableStock',
            inspectionNotes: 'Site surplus returned in original good condition',
          };
        });

        setLines(newLines);
      } else {
        setFormError(res.message || 'Failed to fetch selected material issue voucher.');
      }
    } catch (err: any) {
      setFormError('Failed to fetch selected material issue voucher.');
    }
  };

  const handleLineChange = (index: number, field: keyof ReturnLineInput, value: any) => {
    setLines((prev) => {
      const copy = [...prev];
      if (field === 'returnedQuantity') {
        const num = parseFloat(value);
        copy[index].returnedQuantity = isNaN(num) ? 0 : num;
      } else if (field === 'condition') {
        const cond = value as 'ReusableGood' | 'Damaged' | 'UnusableScrap';
        copy[index].condition = cond;
        // Auto-assign logical disposition based on condition
        if (cond === 'ReusableGood') {
          copy[index].disposition = 'ReturnToUsableStock';
        } else if (cond === 'Damaged') {
          copy[index].disposition = 'SupplierRTV';
        } else {
          copy[index].disposition = 'QuarantineScrap';
        }
      } else {
        (copy[index] as any)[field] = value;
      }
      return copy;
    });
  };

  const handleSaveReturn = async () => {
    setFormError(null);

    if (!selectedIssueId || !selectedIssueDoc) {
      setFormError('Please select a posted material issue voucher.');
      return;
    }

    if (!returnedByPerson.trim()) {
      setFormError('Please specify the site representative / engineer returning materials.');
      return;
    }

    if (!reason.trim()) {
      setFormError('Please specify the reason for material return.');
      return;
    }

    const activeLines = lines.filter((l) => l.returnedQuantity > 0);
    if (activeLines.length === 0) {
      setFormError('At least one line item must have a return quantity greater than 0.');
      return;
    }

    // Validate quantities
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.returnedQuantity < 0) {
        setFormError(`Line #${i + 1} (${line.materialName}): Return quantity cannot be negative.`);
        return;
      }
      if (line.returnedQuantity > line.maxReturnableQuantity) {
        setFormError(`Line #${i + 1} (${line.materialName}): Return quantity (${line.returnedQuantity}) exceeds maximum returnable quantity (${line.maxReturnableQuantity}).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        materialIssueId: selectedIssueDoc.id,
        returnDate,
        returnedByPerson,
        reason,
        items: activeLines.map((l) => ({
          materialIssueItemId: l.materialIssueItemId,
          materialId: l.materialId,
          returnedQuantity: l.returnedQuantity,
          condition: l.condition,
          disposition: l.disposition,
          inspectionNotes: l.inspectionNotes,
        })),
        remarks: generalRemarks,
      };

      const res = await materialReturnService.createReturn(payload);
      if (res.success && res.data) {
        navigate(`/material-returns/${res.data.id}`);
      } else {
        setFormError(res.message || 'Failed to create material return note.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error connecting to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="content-container">
      <PageHeader
        title="New Material Return Note (MRN)"
        description="Record site material returns back to central warehouse / storage yard"
        actions={
          <Button variant="secondary" size="sm" icon={<ArrowLeft size={15} />} onClick={() => navigate('/material-returns')}>
            Back to Directory
          </Button>
        }
      />

      {formError && (
        <Card style={{ backgroundColor: '#FFF5F5', borderColor: '#E53E3E', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: '#742A2A' }}>
            <AlertTriangle size={20} />
            <div style={{ fontWeight: 600 }}>{formError}</div>
          </div>
        </Card>
      )}

      {/* Step 1: Select Posted Issue */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-4)', color: 'var(--color-charcoal-900)' }}>
          1. Select Source Posted Material Issue Voucher
        </h3>

        {isLoadingIssues ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)' }}>Loading posted issues...</p>
        ) : postedIssues.length === 0 ? (
          <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-charcoal-50)', borderRadius: 'var(--border-radius-md)' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-charcoal-700)' }}>
              No posted material issue vouchers available. You can only create material returns against posted issue vouchers.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                Posted Issue Voucher
              </label>
              <select
                value={selectedIssueId}
                onChange={(e) => handleSelectIssue(e.target.value)}
                style={{ width: '100%', height: '38px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem' }}
              >
                <option value="">-- Select Issue Voucher --</option>
                {postedIssues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.issueNumber} - {issue.projectName} ({issue.purpose})
                  </option>
                ))}
              </select>
            </div>

            {selectedIssueDoc && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                    Project Site
                  </label>
                  <div style={{ height: '38px', padding: '8px 12px', backgroundColor: 'var(--color-charcoal-50)', borderRadius: 'var(--border-radius-md)', fontSize: '0.875rem', fontWeight: 600 }}>
                    {selectedIssueDoc.projectName}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                    Receiving Yard / Store
                  </label>
                  <div style={{ height: '38px', padding: '8px 12px', backgroundColor: 'var(--color-charcoal-50)', borderRadius: 'var(--border-radius-md)', fontSize: '0.875rem' }}>
                    {selectedIssueDoc.warehouseName}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {selectedIssueDoc && (
        <>
          {/* Step 2: Return Metadata */}
          <Card style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-4)', color: 'var(--color-charcoal-900)' }}>
              2. Return Details & Representative
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                  Return Date *
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  style={{ width: '100%', height: '38px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                  Returned By Person (Site Engineer/Foreman) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Site Engineer Alex Vance"
                  value={returnedByPerson}
                  onChange={(e) => setReturnedByPerson(e.target.value)}
                  style={{ width: '100%', height: '38px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                  Reason for Return *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Excess Site Inventory / Completed Pour"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ width: '100%', height: '38px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem' }}
                />
              </div>
            </div>
          </Card>

          {/* Step 3: Material Lines */}
          <Card style={{ marginBottom: 'var(--space-6)', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-charcoal-200)', backgroundColor: 'var(--color-charcoal-50)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-charcoal-900)' }}>
                3. Materials to Return & Condition Assessment
              </h3>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th style={{ textAlign: 'right' }}>Originally Issued</th>
                    <th style={{ textAlign: 'right' }}>Prev Returned</th>
                    <th style={{ textAlign: 'right' }}>Max Returnable</th>
                    <th style={{ textAlign: 'right', width: '140px' }}>Quantity Returned *</th>
                    <th style={{ width: '150px' }}>Condition *</th>
                    <th style={{ width: '180px' }}>Disposition *</th>
                    <th>Inspection Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={line.materialIssueItemId}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{line.materialCode}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)' }}>{line.materialName}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{line.issuedQuantity} {line.unitCode}</td>
                      <td style={{ textAlign: 'right' }}>{line.previouslyReturnedQuantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-orange-700)' }}>
                        {line.maxReturnableQuantity} {line.unitCode}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={line.maxReturnableQuantity}
                          value={line.returnedQuantity}
                          onChange={(e) => handleLineChange(idx, 'returnedQuantity', e.target.value)}
                          style={{
                            width: '110px',
                            height: '34px',
                            textAlign: 'right',
                            fontWeight: 700,
                            borderRadius: 'var(--border-radius-md)',
                            border: line.returnedQuantity > line.maxReturnableQuantity ? '2px solid #E53E3E' : '1px solid var(--color-charcoal-300)',
                            padding: '0 8px',
                          }}
                        />
                      </td>
                      <td>
                        <select
                          value={line.condition}
                          onChange={(e) => handleLineChange(idx, 'condition', e.target.value)}
                          style={{ width: '100%', height: '34px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 6px', fontSize: '0.8125rem' }}
                        >
                          <option value="ReusableGood">Reusable Good</option>
                          <option value="Damaged">Damaged</option>
                          <option value="UnusableScrap">Unusable Scrap</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={line.disposition}
                          onChange={(e) => handleLineChange(idx, 'disposition', e.target.value)}
                          style={{ width: '100%', height: '34px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 6px', fontSize: '0.8125rem' }}
                        >
                          <option value="ReturnToUsableStock">Return to Usable Stock</option>
                          <option value="QuarantineScrap">Quarantine Scrap</option>
                          <option value="SupplierRTV">Supplier RTV</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={line.inspectionNotes}
                          onChange={(e) => handleLineChange(idx, 'inspectionNotes', e.target.value)}
                          style={{ width: '100%', height: '34px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 8px', fontSize: '0.8125rem' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <Button variant="secondary" size="md" onClick={() => navigate('/material-returns')}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<RotateCcw size={16} />}
              isLoading={isSubmitting}
              onClick={handleSaveReturn}
            >
              Create Material Return Note
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
