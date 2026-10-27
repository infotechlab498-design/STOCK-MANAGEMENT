import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/EmptyState';
import { stockTransferService } from '../services/api/stockTransferService';
import { materialService, Material } from '../services/api/materialService';
import { inventoryService, InventoryBalance } from '../services/api/inventoryService';

interface TransferFormLine {
  id?: string;
  materialId: string;
  requestedQuantity: string;
}

export const StockTransferFormPage: React.FC<{ editTransferId?: string }> = ({ editTransferId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string }>();

  const resolvedTransferId =
    editTransferId ||
    params.id ||
    (() => {
      const m = location.pathname.match(/^\/stock-transfers\/([^/]+)\/edit/);
      return m ? decodeURIComponent(m[1]) : '';
    })();
  const isEditMode = Boolean(resolvedTransferId);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [transferNumber, setTransferNumber] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [sourceWarehouseId, setSourceWarehouseId] = useState('WH-01');
  const [sourceProjectId, setSourceProjectId] = useState('PRJ-101');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('WH-02');
  const [destinationProjectId, setDestinationProjectId] = useState('PRJ-101');

  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [plannedDispatchDate, setPlannedDispatchDate] = useState('');
  const [expectedArrivalDate, setExpectedArrivalDate] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [purpose, setPurpose] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [remarks, setRemarks] = useState('');

  const [lines, setLines] = useState<TransferFormLine[]>([
    { materialId: '', requestedQuantity: '10' },
  ]);

  useEffect(() => {
    const loadMasterData = async () => {
      setLoadingInitial(true);
      setErrorMsg(null);
      try {
        const [matRes, balRes] = await Promise.all([
          materialService.getMaterials(undefined, undefined, 'ACTIVE'),
          inventoryService.getBalances(),
        ]);

        if (matRes.success && matRes.data) {
          setMaterials(matRes.data);
        }
        if (balRes.success && balRes.data) {
          const list = Array.isArray(balRes.data) ? balRes.data : (balRes.data as any).items || [];
          setBalances(list);
        }

        if (isEditMode && resolvedTransferId) {
          const trfRes = await stockTransferService.getById(resolvedTransferId);
          if (trfRes.success && trfRes.data) {
            const t = trfRes.data;
            setTransferNumber(t.transferNumber);
            setCorrectionNotes(t.correctionNotes || '');
            setSourceWarehouseId(t.sourceWarehouseId);
            setSourceProjectId(t.sourceProjectId);
            setDestinationWarehouseId(t.destinationWarehouseId);
            setDestinationProjectId(t.destinationProjectId);
            setRequestDate(t.requestDate || new Date().toISOString().split('T')[0]);
            setPlannedDispatchDate(t.plannedDispatchDate || '');
            setExpectedArrivalDate(t.expectedArrivalDate || '');
            setPriority(t.priority || 'Medium');
            setPurpose(t.purpose || '');
            setTransferReason(t.transferReason || '');
            setReferenceNumber(t.referenceNumber || '');
            setRemarks(t.remarks || '');
            if (Array.isArray(t.items) && t.items.length > 0) {
              setLines(
                t.items.map((it) => ({
                  id: it.id,
                  materialId: it.materialId,
                  requestedQuantity: String(it.requestedQuantity),
                }))
              );
            }
          }
        } else if (matRes.success && matRes.data && matRes.data.length > 0) {
          setLines([{ materialId: matRes.data[0].id, requestedQuantity: '10' }]);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load materials or stock balances.');
      } finally {
        setLoadingInitial(false);
      }
    };

    loadMasterData();
  }, [isEditMode, resolvedTransferId]);

  const getSourceBalance = (materialId: string): InventoryBalance | undefined => {
    const mat = materials.find((m) => m.id === materialId);
    return (
      balances.find(
        (b) =>
          (b.materialId === materialId || (mat && b.materialCode === mat.itemCode)) &&
          b.warehouseId === sourceWarehouseId &&
          b.projectId === sourceProjectId
      ) ||
      balances.find(
        (b) =>
          (b.materialId === materialId || (mat && b.materialCode === mat.itemCode)) &&
          b.warehouseId === sourceWarehouseId
      )
    );
  };

  const getDestinationBalance = (materialId: string): InventoryBalance | undefined => {
    const mat = materials.find((m) => m.id === materialId);
    return balances.find(
      (b) =>
        (b.materialId === materialId || (mat && b.materialCode === mat.itemCode)) &&
        b.warehouseId === destinationWarehouseId &&
        b.projectId === destinationProjectId
    );
  };

  const handleAddLine = () => {
    setLines((prev) => [...prev, { materialId: materials[0]?.id || '', requestedQuantity: '1' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof TransferFormLine, value: string) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const isSameLocation =
    sourceWarehouseId === destinationWarehouseId && sourceProjectId === destinationProjectId;
  const isCrossProject = sourceProjectId !== destinationProjectId;

  const handleSave = async (submitImmediately: boolean) => {
    setErrorMsg(null);

    if (isSameLocation) {
      setErrorMsg('Source and Destination stock locations cannot be identical.');
      return;
    }

    if (!purpose.trim()) {
      setErrorMsg('Transfer purpose / site justification is required.');
      return;
    }

    const parsedItems: Array<{ id?: string; materialId: string; requestedQuantity: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.materialId) {
        setErrorMsg(`Line #${i + 1}: Please select a valid material.`);
        return;
      }
      const qty = parseFloat(l.requestedQuantity);
      if (isNaN(qty) || qty <= 0) {
        setErrorMsg(`Line #${i + 1}: Requested quantity must be greater than zero.`);
        return;
      }
      parsedItems.push({
        id: l.id,
        materialId: l.materialId,
        requestedQuantity: qty,
      });
    }

    setSubmitting(true);
    try {
      if (isEditMode && resolvedTransferId) {
        const updateRes = await stockTransferService.update(resolvedTransferId, {
          sourceWarehouseId,
          sourceProjectId,
          destinationWarehouseId,
          destinationProjectId,
          purpose: purpose.trim(),
          transferReason: transferReason.trim() || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          priority,
          plannedDispatchDate: plannedDispatchDate || undefined,
          expectedArrivalDate: expectedArrivalDate || undefined,
          remarks: remarks.trim() || undefined,
          items: parsedItems,
        });

        if (updateRes.success && updateRes.data) {
          if (submitImmediately) {
            await stockTransferService.submit(updateRes.data.id);
          }
          navigate(`/stock-transfers/${updateRes.data.id}`);
        }
      } else {
        const createRes = await stockTransferService.create({
          sourceWarehouseId,
          sourceProjectId,
          destinationWarehouseId,
          destinationProjectId,
          purpose: purpose.trim(),
          transferReason: transferReason.trim() || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          priority,
          requestDate,
          plannedDispatchDate: plannedDispatchDate || undefined,
          expectedArrivalDate: expectedArrivalDate || undefined,
          remarks: remarks.trim() || undefined,
          submitImmediately,
          items: parsedItems,
        });

        if (createRes.success && createRes.data) {
          navigate(`/stock-transfers/${createRes.data.id}`);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save stock transfer request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return <LoadingSpinner label="Loading stock transfer form..." />;
  }

  return (
    <div>
      <PageHeader
        title={
          isEditMode
            ? `Edit Stock Transfer Request ${transferNumber}`
            : 'Create Stock Transfer Request (STN)'
        }
        description="Request controlled material movement from a source warehouse or store to a destination store or project site."
        actions={
          <Button variant="secondary" onClick={() => navigate('/stock-transfers')}>
            ← Back to Stock Transfers
          </Button>
        }
      />

      {correctionNotes && (
        <div
          style={{
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            backgroundColor: '#FEFCBF',
            borderLeft: '4px solid #D69E2E',
            color: '#744210',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        >
          <strong>Returned for Correction Notes:</strong> {correctionNotes}
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            backgroundColor: '#FFF5F5',
            borderLeft: '4px solid #E53E3E',
            color: '#9B2C2C',
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {errorMsg}
        </div>
      )}

      {isSameLocation && (
        <div
          style={{
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            backgroundColor: '#FFF5F5',
            borderLeft: '4px solid #E53E3E',
            color: '#9B2C2C',
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          Invalid Location Selection: Source and Destination warehouse/project combinations must be different.
        </div>
      )}

      {isCrossProject && !isSameLocation && (
        <div
          style={{
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
            backgroundColor: '#EBF8FF',
            borderLeft: '4px solid #3182CE',
            color: '#2A4365',
            borderRadius: '4px',
            fontSize: '0.85rem',
          }}
        >
          <strong>Cross-Project Stock Transfer Notice:</strong> Moving materials between{' '}
          <strong>{sourceProjectId}</strong> and <strong>{destinationProjectId}</strong> requires cross-project scope authorization and transfers inventory valuation at the source location's moving weighted-average cost (WAC) upon receipt.
        </div>
      )}

      {/* Source & Destination Locations */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1.25rem',
          marginBottom: '1.25rem',
        }}
      >
        <Card title="1. Source Stock Location (Outbound)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
                Source Warehouse / Yard *
              </label>
              <select
                value={sourceWarehouseId}
                onChange={(e) => setSourceWarehouseId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #CBD5E0',
                  fontSize: '0.875rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="WH-01">WH-01 — Metro Central Staging Yard</option>
                <option value="WH-02">WH-02 — North Industrial Depot & Yard</option>
                <option value="WH-03">WH-03 — East Harbor Hub</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
                Source Project Site *
              </label>
              <select
                value={sourceProjectId}
                onChange={(e) => setSourceProjectId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #CBD5E0',
                  fontSize: '0.875rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="PRJ-101">PRJ-101 — Metro Rail Line 3 Extension</option>
                <option value="PRJ-102">PRJ-102 — Harbor Commercial Docklands</option>
                <option value="PRJ-103">PRJ-103 — Skyline Corporate Towers</option>
              </select>
            </div>
          </div>
        </Card>

        <Card title="2. Destination Stock Location (Inbound)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
                Destination Warehouse / Store *
              </label>
              <select
                value={destinationWarehouseId}
                onChange={(e) => setDestinationWarehouseId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #CBD5E0',
                  fontSize: '0.875rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="WH-01">WH-01 — Metro Central Staging Yard</option>
                <option value="WH-02">WH-02 — North Industrial Depot & Yard</option>
                <option value="WH-03">WH-03 — East Harbor Hub</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
                Destination Project Site *
              </label>
              <select
                value={destinationProjectId}
                onChange={(e) => setDestinationProjectId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #CBD5E0',
                  fontSize: '0.875rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="PRJ-101">PRJ-101 — Metro Rail Line 3 Extension</option>
                <option value="PRJ-102">PRJ-102 — Harbor Commercial Docklands</option>
                <option value="PRJ-103">PRJ-103 — Skyline Corporate Towers</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      {/* Header Metadata */}
      <Card title="3. Transfer Schedule, Priority & Justification" style={{ marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Request Date *
            </label>
            <input
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E0',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Planned Dispatch Date
            </label>
            <input
              type="date"
              value={plannedDispatchDate}
              onChange={(e) => setPlannedDispatchDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E0',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Expected Arrival Date
            </label>
            <input
              type="date"
              value={expectedArrivalDate}
              onChange={(e) => setExpectedArrivalDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E0',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Urgency / Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E0',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Transfer Purpose / Site Justification *
            </label>
            <input
              type="text"
              placeholder="e.g., Replenish North Depot rebar and cement buffer for Pier 4 pour"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E0',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              Transfer Reason / Requisition Reference
            </label>
            <input
              type="text"
              placeholder="e.g., Stock Rebalancing / REQ-2026-004"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E0',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
              External Reference / Work Order #
            </label>
            <input
              type="text"
              placeholder="e.g., WO-NORTH-882"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #CBD5E0',
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.35rem' }}>
            Logistics / Handling Remarks
          </label>
          <textarea
            rows={2}
            placeholder="Special loading, tarpaulin weather protection, or crane unloading instructions..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              borderRadius: '4px',
              border: '1px solid #CBD5E0',
              fontSize: '0.875rem',
            }}
          />
        </div>
      </Card>

      {/* Transfer Line Items */}
      <Card
        title="4. Transfer Material Line Items & Source Availability"
        style={{ marginBottom: '1.5rem' }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#EDF2F7', borderBottom: '2px solid #CBD5E0', textAlign: 'left' }}>
                <th style={{ padding: '0.65rem' }}>#</th>
                <th style={{ padding: '0.65rem', minWidth: '280px' }}>Material</th>
                <th style={{ padding: '0.65rem' }}>UOM</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Source On Hand</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Source WAC</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Dest On Hand</th>
                <th style={{ padding: '0.65rem', width: '160px' }}>Requested Qty *</th>
                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Est. Transfer Value</th>
                <th style={{ padding: '0.65rem', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const mat = materials.find((m) => m.id === line.materialId);
                const srcBal = getSourceBalance(line.materialId);
                const dstBal = getDestinationBalance(line.materialId);
                const srcOnHand = srcBal ? srcBal.quantityOnHand : 0;
                const srcWac = srcBal ? srcBal.weightedAverageCost : 0;
                const dstOnHand = dstBal ? dstBal.quantityOnHand : 0;
                const reqQty = parseFloat(line.requestedQuantity) || 0;
                const estVal = reqQty * srcWac;
                const exceedsSource = reqQty > srcOnHand;

                return (
                  <tr key={index} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '0.65rem', fontWeight: 600 }}>{index + 1}</td>
                    <td style={{ padding: '0.65rem' }}>
                      <select
                        value={line.materialId}
                        onChange={(e) => handleLineChange(index, 'materialId', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.6rem',
                          borderRadius: '4px',
                          border: '1px solid #CBD5E0',
                          fontSize: '0.85rem',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <option value="">-- Select Material --</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.itemCode} — {m.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.65rem', color: '#4A5568', fontWeight: 600 }}>
                      {mat?.baseUnitName || 'Unit'}
                    </td>
                    <td
                      style={{
                        padding: '0.65rem',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: srcOnHand > 0 ? '#2F855A' : '#C53030',
                      }}
                    >
                      {srcOnHand.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.65rem', textAlign: 'right', color: '#4A5568' }}>
                      ${srcWac.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.65rem', textAlign: 'right', color: '#4A5568' }}>
                      {dstOnHand.toLocaleString()}
                    </td>
                    <td style={{ padding: '0.65rem' }}>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={line.requestedQuantity}
                        onChange={(e) => handleLineChange(index, 'requestedQuantity', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.6rem',
                          borderRadius: '4px',
                          border: exceedsSource ? '2px solid #DD6B20' : '1px solid #CBD5E0',
                          fontSize: '0.85rem',
                          textAlign: 'right',
                          fontWeight: 600,
                        }}
                      />
                      {exceedsSource && (
                        <div style={{ fontSize: '0.68rem', color: '#C05621', marginTop: '0.2rem' }}>
                          Exceeds current source stock ({srcOnHand})
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 600, color: '#2D3748' }}>
                      ${estVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={lines.length <= 1}
                        onClick={() => handleRemoveLine(index)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button variant="secondary" size="sm" onClick={handleAddLine}>
            + Add Material Line
          </Button>
          <div style={{ fontSize: '0.82rem', color: '#718096' }}>
            Note: Source stock is not deducted until physical dispatch is posted by an authorized Storekeeper/Inventory Manager.
          </div>
        </div>
      </Card>

      {/* Form Footer Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <Button variant="secondary" onClick={() => navigate('/stock-transfers')} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleSave(false)}
          disabled={submitting || isSameLocation}
        >
          {submitting ? 'Saving...' : 'Save as Draft'}
        </Button>
        <Button
          variant="primary"
          onClick={() => handleSave(true)}
          disabled={submitting || isSameLocation}
        >
          {submitting ? 'Submitting...' : 'Save & Submit for Approval'}
        </Button>
      </div>
    </div>
  );
};
