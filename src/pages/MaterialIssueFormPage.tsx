import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Save,
  Send,
  ArrowLeft,
  AlertTriangle,
  Boxes,
  Warehouse,
  Building2,
  User,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import {
  requisitionService,
  MaterialRequisitionDto,
} from '../services/api/requisitionService';
import {
  inventoryService,
  InventoryBalance,
} from '../services/api/inventoryService';
import { materialIssueService } from '../services/api/materialIssueService';

interface IssueLineInput {
  requisitionItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  requestedQuantity: number;
  previouslyFulfilledQuantity: number;
  outstandingQuantity: number;
  quantityToIssue: number;
  availableStock: number;
  storageLocation: string;
  remarks: string;
}

export const MaterialIssueFormPage: React.FC = () => {
  const navigate = useNavigate();

  const [approvedRequisitions, setApprovedRequisitions] = useState<MaterialRequisitionDto[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string>('');
  const [selectedReqDoc, setSelectedReqDoc] = useState<MaterialRequisitionDto | null>(null);

  const [warehouseId, setWarehouseId] = useState<string>('WH-02');
  const [purpose, setPurpose] = useState<string>('');
  const [workActivity, setWorkActivity] = useState<string>('');
  const [receivedByPerson, setReceivedByPerson] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [generalRemarks, setGeneralRemarks] = useState<string>('');

  const [lines, setLines] = useState<IssueLineInput[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);

  const [isLoadingReqs, setIsLoadingReqs] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch eligible Approved / PartiallyFulfilled Requisitions
  useEffect(() => {
    async function loadReqs() {
      setIsLoadingReqs(true);
      try {
        const approvedRes = await requisitionService.getRequisitions({ status: 'Approved', pageSize: 100 });
        const partialRes = await requisitionService.getRequisitions({ status: 'PartiallyFulfilled', pageSize: 100 });
        const combined = [...(approvedRes.items || []), ...(partialRes.items || [])];
        setApprovedRequisitions(combined);
      } catch (err: any) {
        setFormError('Failed to load approved site requisitions.');
      } finally {
        setIsLoadingReqs(false);
      }
    }
    loadReqs();
  }, []);

  // Fetch available stock balances for selected warehouse & project
  useEffect(() => {
    async function loadBalances() {
      if (!selectedReqDoc || !warehouseId) return;
      try {
        const res = await inventoryService.getBalances({
          warehouseId,
          projectId: selectedReqDoc.projectId,
        });
        if (res.success && res.data) {
          const items = Array.isArray(res.data) ? res.data : res.data.items || [];
          setBalances(items);
        }
      } catch (err) {
        console.error('Error fetching inventory balances:', err);
      }
    }
    loadBalances();
  }, [selectedReqDoc, warehouseId]);

  // When requisition is selected, populate form line items
  const handleSelectRequisition = async (reqId: string) => {
    setSelectedReqId(reqId);
    setFormError(null);
    if (!reqId) {
      setSelectedReqDoc(null);
      setLines([]);
      return;
    }

    try {
      const fullReq = await requisitionService.getRequisitionById(reqId);
      setSelectedReqDoc(fullReq);
      setPurpose(fullReq.purpose || '');
      setWorkActivity(fullReq.workActivity || '');

      // Get fulfillment details
      let fulfillmentInfo: any = null;
      try {
        fulfillmentInfo = await requisitionService.getFulfillmentDetails(fullReq.id);
      } catch {}

      const newLines: IssueLineInput[] = fullReq.items.map((item) => {
        const lineBreak = fulfillmentInfo?.lineBreakdown?.find((lb: any) => lb.requisitionItemId === item.id || lb.materialId === item.materialId);
        const prevFulfilled = lineBreak?.issuedQuantity || (item as any).issuedQuantity || 0;
        const outstanding = Math.max(0, item.requestedQuantity - prevFulfilled);

        // Match balance
        const matchedBal = balances.find((b) => b.materialId === item.materialId);
        const availStock = matchedBal ? matchedBal.quantityAvailable : 0;

        return {
          requisitionItemId: item.id,
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          unitCode: item.unitCode,
          requestedQuantity: item.requestedQuantity,
          previouslyFulfilledQuantity: prevFulfilled,
          outstandingQuantity: outstanding,
          quantityToIssue: Math.min(outstanding, availStock),
          availableStock: availStock,
          storageLocation: 'Site Yard',
          remarks: '',
        };
      });

      setLines(newLines);
    } catch (err: any) {
      setFormError('Failed to fetch selected requisition details.');
    }
  };

  // Update line quantity to issue
  const handleLineQtyChange = (index: number, value: string) => {
    const num = parseFloat(value);
    setLines((prev) => {
      const copy = [...prev];
      copy[index].quantityToIssue = isNaN(num) ? 0 : num;
      return copy;
    });
  };

  const handleSaveIssue = async (submitImmediately: boolean) => {
    setFormError(null);

    if (!selectedReqId || !selectedReqDoc) {
      setFormError('Please select an eligible approved site requisition.');
      return;
    }

    if (!purpose.trim()) {
      setFormError('Please describe the site activity / issue purpose.');
      return;
    }

    if (!receivedByPerson.trim()) {
      setFormError('Please specify the receiving supervisor or contractor name.');
      return;
    }

    if (lines.length === 0) {
      setFormError('Material issue must contain at least one material line item.');
      return;
    }

    // Validate quantities
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      if (line.quantityToIssue <= 0) {
        setFormError(`Line #${idx + 1} (${line.materialName}): Issue quantity must be greater than 0.`);
        return;
      }
      if (line.quantityToIssue > line.outstandingQuantity) {
        setFormError(`Line #${idx + 1} (${line.materialName}): Issue quantity (${line.quantityToIssue}) exceeds approved outstanding quantity (${line.outstandingQuantity}).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        requisitionId: selectedReqDoc.id,
        warehouseId,
        purpose,
        workActivity,
        receivedByPerson,
        issueDate,
        items: lines.map((l) => ({
          requisitionItemId: l.requisitionItemId,
          materialId: l.materialId,
          quantityToIssue: l.quantityToIssue,
          storageLocation: l.storageLocation,
          remarks: l.remarks,
        })),
        remarks: generalRemarks,
        submitImmediately,
      };

      const res = await materialIssueService.createIssue(payload);
      if (res.success && res.data) {
        navigate(`/material-issues/${res.data.id}`);
      } else {
        setFormError(res.message || 'Failed to create material issue voucher.');
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
        title="New Material Issue Voucher"
        description="Issue store inventory against an approved site material requisition"
        actions={
          <Button variant="secondary" size="sm" icon={<ArrowLeft size={15} />} onClick={() => navigate('/material-issues')}>
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

      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-4)', color: 'var(--color-charcoal-900)' }}>
          1. Select Approved Source Requisition
        </h3>

        {isLoadingReqs ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-600)' }}>Loading approved requisitions...</p>
        ) : approvedRequisitions.length === 0 ? (
          <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-charcoal-50)', borderRadius: 'var(--border-radius-md)' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-charcoal-700)' }}>
              No approved site requisitions available to issue against. Create and approve a site requisition first.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                Approved Requisition Number
              </label>
              <select
                value={selectedReqId}
                onChange={(e) => handleSelectRequisition(e.target.value)}
                style={{ width: '100%', height: '38px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem' }}
              >
                <option value="">-- Select Requisition --</option>
                {approvedRequisitions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.requisitionNumber} - {r.projectName} ({r.purpose})
                  </option>
                ))}
              </select>
            </div>

            {selectedReqDoc && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                    Project Site
                  </label>
                  <div style={{ height: '38px', padding: '8px 12px', backgroundColor: 'var(--color-charcoal-50)', borderRadius: 'var(--border-radius-md)', fontSize: '0.875rem', fontWeight: 600 }}>
                    {selectedReqDoc.projectName}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                    Requester
                  </label>
                  <div style={{ height: '38px', padding: '8px 12px', backgroundColor: 'var(--color-charcoal-50)', borderRadius: 'var(--border-radius-md)', fontSize: '0.875rem' }}>
                    {selectedReqDoc.requesterName} ({selectedReqDoc.requesterRole})
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {selectedReqDoc && (
        <>
          {/* Header Details */}
          <Card style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-4)', color: 'var(--color-charcoal-900)' }}>
              2. Store Dispatch Details
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                  Issuing Warehouse / Yard *
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  style={{ width: '100%', height: '38px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem' }}
                >
                  <option value="WH-01">WH-01: Metro Central Yard</option>
                  <option value="WH-02">WH-02: North Industrial Depot</option>
                  <option value="WH-03">WH-03: East Harbor Hub</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                  Issue Date *
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  style={{ width: '100%', height: '38px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                  Receiving Person / Contractor *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Site Engineer Marcus Vance"
                  value={receivedByPerson}
                  onChange={(e) => setReceivedByPerson(e.target.value)}
                  style={{ width: '100%', height: '38px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: '4px' }}>
                  Activity / Purpose *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deck slab concrete pour Section B"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  style={{ width: '100%', height: '38px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-charcoal-300)', padding: '0 10px', fontSize: '0.875rem' }}
                />
              </div>
            </div>
          </Card>

          {/* Line Items Table */}
          <Card style={{ marginBottom: 'var(--space-6)', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-charcoal-200)', backgroundColor: 'var(--color-charcoal-50)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-charcoal-900)' }}>
                3. Material Quantities to Issue
              </h3>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th style={{ textAlign: 'right' }}>Requested</th>
                    <th style={{ textAlign: 'right' }}>Prev Fulfilled</th>
                    <th style={{ textAlign: 'right' }}>Outstanding</th>
                    <th style={{ textAlign: 'right' }}>Available Stock</th>
                    <th style={{ textAlign: 'right', width: '150px' }}>Quantity to Issue *</th>
                    <th>Bin Location</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={line.requisitionItemId}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{line.materialCode}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)' }}>{line.materialName}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{line.requestedQuantity} {line.unitCode}</td>
                      <td style={{ textAlign: 'right' }}>{line.previouslyFulfilledQuantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-orange-700)' }}>
                        {line.outstandingQuantity} {line.unitCode}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: line.availableStock > 0 ? '#22543D' : '#9B2C2C' }}>
                        {line.availableStock} {line.unitCode}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={line.outstandingQuantity}
                          value={line.quantityToIssue}
                          onChange={(e) => handleLineQtyChange(idx, e.target.value)}
                          style={{
                            width: '120px',
                            height: '34px',
                            textAlign: 'right',
                            fontWeight: 700,
                            borderRadius: 'var(--border-radius-md)',
                            border: line.quantityToIssue > line.availableStock ? '2px solid #E53E3E' : '1px solid var(--color-charcoal-300)',
                            padding: '0 8px',
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={line.storageLocation}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLines((prev) => {
                              const copy = [...prev];
                              copy[idx].storageLocation = val;
                              return copy;
                            });
                          }}
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
            <Button variant="secondary" size="md" onClick={() => navigate('/material-issues')}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<Save size={16} />}
              isLoading={isSubmitting}
              onClick={() => handleSaveIssue(false)}
            >
              Save Draft
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<Send size={16} />}
              isLoading={isSubmitting}
              onClick={() => handleSaveIssue(true)}
            >
              Submit Issue Voucher
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
