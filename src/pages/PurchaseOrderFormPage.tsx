import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FileCheck,
  ArrowLeft,
  Plus,
  Trash2,
  Building2,
  Calendar,
  Truck,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ClipboardList,
  Layers,
  HelpCircle,
  CreditCard,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/EmptyState';
import {
  purchaseOrderService,
  CreatePurchaseOrderPayload,
  ApprovedRequisitionForPoDto,
} from '../services/api/purchaseOrderService';
import { supplierService, SupplierDto } from '../services/api/supplierService';
import { requisitionService, ProjectDto } from '../services/api/requisitionService';
import { materialService, Material } from '../services/api/materialService';

interface LineItemFormState {
  id?: string;
  materialId: string;
  requisitionItemId?: string | null;
  materialCode: string;
  materialName: string;
  unitCode: string;
  orderedQuantity: number | string;
  unitRate: number | string;
  lineDiscount: number | string;
  taxRate: number | string;
  notes?: string;
  maxAvailableQuantity?: number;
}

export const PurchaseOrderFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(id);

  const { user } = useAuth();

  // Data References
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [approvedRequisitions, setApprovedRequisitions] = useState<ApprovedRequisitionForPoDto[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Header State
  const [orderSource, setOrderSource] = useState<'REQUISITION' | 'STANDALONE'>('REQUISITION');
  const [selectedRequisitionId, setSelectedRequisitionId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(searchParams.get('supplierId') || '');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [deliveryLocation, setDeliveryLocation] = useState<string>('Site Central Staging Yard');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().substring(0, 10));

  const twoWeeksLater = new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>(twoWeeksLater);
  const [paymentTerms, setPaymentTerms] = useState<string>('Net 30 Days');
  const [notes, setNotes] = useState<string>('');
  const [freight, setFreight] = useState<number | string>(0);
  const [headerDiscount, setHeaderDiscount] = useState<number | string>(0);

  // Form Line Items
  const [lines, setLines] = useState<LineItemFormState[]>([]);

  // Selected Supplier Details Snapshot
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId),
    [suppliers, selectedSupplierId]
  );

  // Selected Requisition Details Snapshot
  const selectedRequisition = useMemo(
    () => approvedRequisitions.find((r) => r.id === selectedRequisitionId),
    [approvedRequisitions, selectedRequisitionId]
  );

  // Load master reference data
  const loadReferences = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [sups, projs, matsRes, approvedReqs] = await Promise.all([
        supplierService.getSuppliers({ status: 'ACTIVE' }),
        requisitionService.getProjects(),
        materialService.getMaterials(undefined, undefined, 'ACTIVE'),
        purchaseOrderService.getApprovedRequisitionsForPo(),
      ]);

      setSuppliers(sups || []);
      setProjects(projs || []);
      setMaterials(matsRes.data || []);
      setApprovedRequisitions(approvedReqs || []);

      if (isEditing && id) {
        const po = await purchaseOrderService.getPurchaseOrderById(id);
        if (po.status !== 'Draft') {
          setErrorMessage(`Cannot edit Purchase Order in '${po.status}' state. Only 'Draft' orders are editable.`);
          return;
        }

        setSelectedSupplierId(po.supplierId);
        setSelectedProjectId(po.projectId);
        setDeliveryLocation(po.deliveryLocation || '');
        setOrderDate(po.orderDate);
        setExpectedDeliveryDate(po.expectedDeliveryDate);
        setPaymentTerms(po.paymentTerms || 'Net 30 Days');
        setNotes(po.notes || '');
        setFreight(po.freight || 0);
        setHeaderDiscount(po.headerDiscount || 0);

        if (po.requisitionId) {
          setOrderSource('REQUISITION');
          setSelectedRequisitionId(po.requisitionId);
        } else {
          setOrderSource('STANDALONE');
        }

        const mappedLines: LineItemFormState[] = po.items.map((it) => ({
          id: it.id,
          materialId: it.materialId,
          requisitionItemId: it.requisitionItemId,
          materialCode: it.materialCode,
          materialName: it.materialName,
          unitCode: it.unitCode,
          orderedQuantity: it.orderedQuantity,
          unitRate: it.unitRate,
          lineDiscount: it.lineDiscount || 0,
          taxRate: it.taxRate || 0,
          notes: it.notes || '',
        }));
        setLines(mappedLines);
      } else {
        // Defaults for new PO
        if (projs.length > 0) {
          setSelectedProjectId(projs[0].id);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to initialize procurement data.');
    } finally {
      setIsLoading(false);
    }
  }, [isEditing, id]);

  useEffect(() => {
    loadReferences();
  }, [loadReferences]);

  // When supplier changes, auto-fill default payment terms
  useEffect(() => {
    if (selectedSupplier && selectedSupplier.paymentTerms && !isEditing) {
      setPaymentTerms(selectedSupplier.paymentTerms);
    }
  }, [selectedSupplier, isEditing]);

  // When requisition is selected, auto-fill project and clear old lines
  const handleSelectRequisition = (reqId: string) => {
    setSelectedRequisitionId(reqId);
    const req = approvedRequisitions.find((r) => r.id === reqId);
    if (req) {
      setSelectedProjectId(req.projectId);
      setDeliveryLocation(`${req.projectName} - Staging Yard`);
      // Preload unallocated requisition lines
      const initialLines: LineItemFormState[] = req.items
        .filter((ri) => ri.unallocatedQuantity > 0)
        .map((ri) => ({
          materialId: ri.materialId,
          requisitionItemId: ri.id,
          materialCode: ri.materialCode,
          materialName: ri.materialName,
          unitCode: ri.unitCode,
          orderedQuantity: ri.unallocatedQuantity,
          unitRate: 0,
          lineDiscount: 0,
          taxRate: 5,
          maxAvailableQuantity: ri.unallocatedQuantity,
        }));
      setLines(initialLines);
    } else {
      setLines([]);
    }
  };

  // Add line item manually
  const handleAddManualLine = () => {
    if (materials.length === 0) return;
    const defaultMat = materials[0];
    setLines([
      ...lines,
      {
        materialId: defaultMat.id,
        requisitionItemId: null,
        materialCode: defaultMat.itemCode,
        materialName: defaultMat.name,
        unitCode: defaultMat.baseUnitName,
        orderedQuantity: 1,
        unitRate: 0,
        lineDiscount: 0,
        taxRate: 5,
      },
    ]);
  };

  const handleUpdateLine = (index: number, updates: Partial<LineItemFormState>) => {
    setLines((prev) => {
      const next = [...prev];
      const line = { ...next[index], ...updates };

      // If material changed, update snapshots
      if (updates.materialId) {
        const mat = materials.find((m) => m.id === updates.materialId);
        if (mat) {
          line.materialCode = mat.itemCode;
          line.materialName = mat.name;
          line.unitCode = mat.baseUnitName;
        }
      }
      next[index] = line;
      return next;
    });
  };

  const handleRemoveLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate live financial summary
  const summary = useMemo(() => {
    let subtotal = 0;
    let itemsDiscount = 0;
    let taxAmount = 0;

    for (const line of lines) {
      const qty = parseFloat(String(line.orderedQuantity)) || 0;
      const rate = parseFloat(String(line.unitRate)) || 0;
      const disc = parseFloat(String(line.lineDiscount)) || 0;
      const taxR = parseFloat(String(line.taxRate)) || 0;

      const lineSubtotal = qty * rate;
      const taxable = Math.max(0, lineSubtotal - disc);
      const lineTax = taxable * (taxR / 100);

      subtotal += lineSubtotal;
      itemsDiscount += disc;
      taxAmount += lineTax;
    }

    const headerDisc = parseFloat(String(headerDiscount)) || 0;
    const totalDiscount = itemsDiscount + headerDisc;
    const freightAmount = parseFloat(String(freight)) || 0;
    const grandTotal = Math.max(0, subtotal - totalDiscount + taxAmount + freightAmount);

    return {
      subtotal,
      itemsDiscount,
      headerDiscount: headerDisc,
      totalDiscount,
      taxAmount,
      freight: freightAmount,
      grandTotal,
    };
  }, [lines, headerDiscount, freight]);

  // Form submission handler
  const handleSave = async (submitImmediately: boolean) => {
    setErrorMessage(null);

    if (!selectedSupplierId) {
      setErrorMessage('Please select a trade supplier.');
      return;
    }

    if (!selectedProjectId) {
      setErrorMessage('Please select a project site.');
      return;
    }

    if (!expectedDeliveryDate) {
      setErrorMessage('Please enter an expected delivery date.');
      return;
    }

    if (orderSource === 'STANDALONE') {
      if (!notes || notes.trim().length < 5) {
        setErrorMessage(
          'Policy Requirement: Standalone purchase orders without an approved requisition require procurement justification / order notes (minimum 5 characters).'
        );
        return;
      }
    } else {
      if (!selectedRequisitionId) {
        setErrorMessage('Please select an approved material requisition.');
        return;
      }
    }

    if (lines.length === 0) {
      setErrorMessage('Purchase order must contain at least one material line item.');
      return;
    }

    // Validate quantities and rates
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const qty = parseFloat(String(l.orderedQuantity));
      const rate = parseFloat(String(l.unitRate));

      if (isNaN(qty) || qty <= 0) {
        setErrorMessage(`Line #${i + 1} (${l.materialName}): Ordered quantity must be greater than 0.`);
        return;
      }

      if (isNaN(rate) || rate < 0) {
        setErrorMessage(`Line #${i + 1} (${l.materialName}): Unit rate must be non-negative.`);
        return;
      }

      if (l.maxAvailableQuantity && qty > l.maxAvailableQuantity) {
        setErrorMessage(
          `Line #${i + 1} (${l.materialName}): Cannot order ${qty} ${l.unitCode}. Only ${l.maxAvailableQuantity} remains unallocated on the approved requisition.`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: CreatePurchaseOrderPayload = {
        supplierId: selectedSupplierId,
        projectId: selectedProjectId,
        deliveryLocation,
        orderDate,
        expectedDeliveryDate,
        paymentTerms,
        notes: notes || undefined,
        requisitionId: orderSource === 'REQUISITION' ? selectedRequisitionId : null,
        items: lines.map((l) => ({
          materialId: l.materialId,
          requisitionItemId: l.requisitionItemId || null,
          orderedQuantity: parseFloat(String(l.orderedQuantity)),
          unitRate: parseFloat(String(l.unitRate)),
          lineDiscount: parseFloat(String(l.lineDiscount)) || 0,
          taxRate: parseFloat(String(l.taxRate)) || 0,
          notes: l.notes || undefined,
        })),
        freight: parseFloat(String(freight)) || 0,
        headerDiscount: parseFloat(String(headerDiscount)) || 0,
        submitImmediately,
      };

      if (isEditing && id) {
        await purchaseOrderService.updatePurchaseOrder(id, payload);
        if (submitImmediately) {
          await purchaseOrderService.submitPurchaseOrder(id, 'Submitted from edit screen.');
        }
        navigate(`/purchase-orders/${id}`);
      } else {
        const created = await purchaseOrderService.createPurchaseOrder(payload);
        navigate(`/purchase-orders/${created.id}`);
      }
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to save purchase order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <Card>
          <div style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
            <LoadingSpinner label="Preparing purchase order drafting workspace..." />
          </div>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/purchase-orders')}
              icon={<ArrowLeft size={16} />}
            >
              Back
            </Button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-charcoal-900)', margin: 0 }}>
                {isEditing ? `Edit Purchase Order Draft: ${id}` : 'Create Commercial Purchase Order'}
              </h1>
              <p style={{ color: 'var(--color-charcoal-600)', margin: '4px 0 0', fontSize: '0.875rem' }}>
                Contract generation with server-side decimal calculations and requisition allocation tracking.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
            >
              Save as Draft
            </Button>
            <Button
              variant="primary"
              disabled={isSubmitting}
              onClick={() => handleSave(true)}
              icon={isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : undefined}
            >
              {isSubmitting ? 'Processing...' : 'Submit for Approval'}
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#FFF5F5',
              border: '1px solid #FEB2B2',
              color: '#C53030',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)',
            }}
          >
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600 }}>Validation or Policy Error</div>
              <div style={{ fontSize: '0.875rem', marginTop: 2 }}>{errorMessage}</div>
            </div>
          </div>
        )}

        {/* Source Mode Toggle Card */}
        <Card title="1. Procurement Workflow Origin">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <label
                style={{
                  flex: '1 1 250px',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${orderSource === 'REQUISITION' ? 'var(--color-orange-500)' : 'var(--color-border)'}`,
                  backgroundColor: orderSource === 'REQUISITION' ? 'var(--color-orange-50)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                }}
              >
                <input
                  type="radio"
                  name="orderSource"
                  checked={orderSource === 'REQUISITION'}
                  onChange={() => {
                    setOrderSource('REQUISITION');
                    if (approvedRequisitions.length > 0 && !selectedRequisitionId) {
                      handleSelectRequisition(approvedRequisitions[0].id);
                    }
                  }}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)', fontSize: '0.9375rem' }}>
                    Generate from Approved Requisition (Standard)
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-600)', marginTop: 4 }}>
                    Pulls pre-authorized material lines, enforces strict unallocated quantity caps, and preserves requisition audit trail.
                  </div>
                </div>
              </label>

              <label
                style={{
                  flex: '1 1 250px',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${orderSource === 'STANDALONE' ? 'var(--color-orange-500)' : 'var(--color-border)'}`,
                  backgroundColor: orderSource === 'STANDALONE' ? 'var(--color-orange-50)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                }}
              >
                <input
                  type="radio"
                  name="orderSource"
                  checked={orderSource === 'STANDALONE'}
                  onChange={() => {
                    setOrderSource('STANDALONE');
                    setSelectedRequisitionId('');
                  }}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)', fontSize: '0.9375rem' }}>
                    Standalone Purchase Order (Operational / Yard)
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-600)', marginTop: 4 }}>
                    Direct procurement for general site consumables or depot buffer stock. Requires mandatory business justification notes.
                  </div>
                </div>
              </label>
            </div>

            {/* Approved Requisition Selector */}
            {orderSource === 'REQUISITION' && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 6 }}>
                  Select Approved Requisition *
                </label>
                {approvedRequisitions.length === 0 ? (
                  <div
                    style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-bg-page)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      color: 'var(--color-charcoal-600)',
                    }}
                  >
                    No approved requisitions with available unallocated quantities are currently available. You can either approve a submitted requisition or draft a standalone purchase order.
                  </div>
                ) : (
                  <select
                    value={selectedRequisitionId}
                    onChange={(e) => handleSelectRequisition(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.875rem',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-charcoal-900)',
                    }}
                  >
                    <option value="">-- Choose an approved requisition --</option>
                    {approvedRequisitions.map((req) => (
                      <option key={req.id} value={req.id}>
                        {req.requisitionNumber} - {req.projectName} (Req: {req.requiredDate} | Approved by {req.approvedByName})
                      </option>
                    ))}
                  </select>
                )}

                {selectedRequisition && (
                  <div
                    style={{
                      marginTop: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-bg-page)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--space-4)',
                      fontSize: '0.8125rem',
                      color: 'var(--color-charcoal-700)',
                    }}
                  >
                    <div>
                      <strong>Project:</strong> {selectedRequisition.projectName}
                    </div>
                    <div>
                      <strong>Required By:</strong> {selectedRequisition.requiredDate}
                    </div>
                    <div>
                      <strong>Approved By:</strong> {selectedRequisition.approvedByName || 'PM'}
                    </div>
                    <div>
                      <strong>Purpose:</strong> {selectedRequisition.purpose}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Vendor & Delivery Header Details */}
        <Card title="2. Supplier & Delivery Schedule">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                Trade Supplier *
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--color-surface)',
                }}
              >
                <option value="">-- Select approved supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.supplierCode}) - {s.paymentTerms || 'Net 30'}
                  </option>
                ))}
              </select>
              {selectedSupplier && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', marginTop: 4 }}>
                  Contact: {selectedSupplier.contactPerson} | {selectedSupplier.email}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                Project Site *
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={orderSource === 'REQUISITION'}
                required
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  backgroundColor: orderSource === 'REQUISITION' ? 'var(--color-bg-page)' : 'var(--color-surface)',
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                Delivery Staging Yard / Shed *
              </label>
              <input
                type="text"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                required
                placeholder="e.g. WH-01 Metro Central Yard"
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                Expected Delivery Date *
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                Payment Terms
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30 Days"
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                Order Notes / Justification {orderSource === 'STANDALONE' ? '*' : '(Optional)'}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  orderSource === 'STANDALONE'
                    ? 'Mandatory: Explain business rationale for standalone procurement without requisition...'
                    : 'Optional delivery instructions, gate access requirements, or dispatch references...'
                }
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
        </Card>

        {/* Dynamic Line Items Card */}
        <Card
          title={`3. Material Line Items (${lines.length})`}
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddManualLine}
              icon={<Plus size={14} />}
            >
              Add Material Line
            </Button>
          }
        >
          {lines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--color-charcoal-500)' }}>
              No line items added yet. Click &quot;Add Material Line&quot; or select an approved requisition above.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: '750px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg-page)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', width: '35%', textAlign: 'left' }}>
                      Material / Specification
                    </th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', width: '12%', textAlign: 'right' }}>
                      Quantity
                    </th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', width: '15%', textAlign: 'right' }}>
                      Unit Rate ($)
                    </th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', width: '12%', textAlign: 'right' }}>
                      Line Disc ($)
                    </th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', width: '10%', textAlign: 'right' }}>
                      Tax %
                    </th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', width: '12%', textAlign: 'right' }}>
                      Line Total
                    </th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', width: '4%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const qty = parseFloat(String(line.orderedQuantity)) || 0;
                    const rate = parseFloat(String(line.unitRate)) || 0;
                    const disc = parseFloat(String(line.lineDiscount)) || 0;
                    const tax = parseFloat(String(line.taxRate)) || 0;
                    const taxable = Math.max(0, qty * rate - disc);
                    const lineTot = taxable + taxable * (tax / 100);

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                          {line.requisitionItemId ? (
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>
                                {line.materialName}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', display: 'flex', gap: 6, marginTop: 2 }}>
                                <Badge variant="neutral">{line.materialCode}</Badge>
                                <span>UOM: {line.unitCode}</span>
                                {line.maxAvailableQuantity && (
                                  <span style={{ color: 'var(--color-orange-600)' }}>
                                    (Max Unallocated: {line.maxAvailableQuantity})
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <select
                                value={line.materialId}
                                onChange={(e) => handleUpdateLine(idx, { materialId: e.target.value })}
                                style={{
                                  width: '100%',
                                  padding: 'var(--space-1) var(--space-2)',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--color-border)',
                                  fontSize: '0.8125rem',
                                  backgroundColor: 'var(--color-surface)',
                                }}
                              >
                                {materials.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} ({m.itemCode})
                                  </option>
                                ))}
                              </select>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', marginTop: 2 }}>
                                Base UOM: {line.unitCode}
                              </div>
                            </div>
                          )}
                        </td>

                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={line.orderedQuantity}
                            onChange={(e) => handleUpdateLine(idx, { orderedQuantity: e.target.value })}
                            style={{
                              width: '90px',
                              textAlign: 'right',
                              padding: 'var(--space-1) var(--space-2)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border)',
                              fontSize: '0.8125rem',
                            }}
                          />
                        </td>

                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitRate}
                            onChange={(e) => handleUpdateLine(idx, { unitRate: e.target.value })}
                            placeholder="0.00"
                            style={{
                              width: '100px',
                              textAlign: 'right',
                              padding: 'var(--space-1) var(--space-2)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border)',
                              fontSize: '0.8125rem',
                            }}
                          />
                        </td>

                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.lineDiscount}
                            onChange={(e) => handleUpdateLine(idx, { lineDiscount: e.target.value })}
                            placeholder="0.00"
                            style={{
                              width: '80px',
                              textAlign: 'right',
                              padding: 'var(--space-1) var(--space-2)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border)',
                              fontSize: '0.8125rem',
                            }}
                          />
                        </td>

                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={line.taxRate}
                            onChange={(e) => handleUpdateLine(idx, { taxRate: e.target.value })}
                            style={{
                              width: '65px',
                              textAlign: 'right',
                              padding: 'var(--space-1) var(--space-2)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border)',
                              fontSize: '0.8125rem',
                            }}
                          />
                        </td>

                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontWeight: 600 }}>
                          ${lineTot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#C53030',
                              cursor: 'pointer',
                            }}
                            title="Remove Line"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Financial Summary & Delivery Freight */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          <Card title="Freight & Additional Discount">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                  Estimated Freight / Site Haulage ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={freight}
                  onChange={(e) => setFreight(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                  Additional Header Trade Discount ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={headerDiscount}
                  onChange={(e) => setHeaderDiscount(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', lineHeight: 1.4 }}>
                * All mathematical computations (subtotals, discounts, taxes, freight, and grand total) are validated strictly server-side using 2-decimal precision.
              </div>
            </div>
          </Card>

          <Card title="Order Financial Summary">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-charcoal-700)' }}>
                <span>Material Subtotal:</span>
                <span>${summary.subtotal.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-charcoal-700)' }}>
                <span>Total Discounts:</span>
                <span style={{ color: '#C53030' }}>-${summary.totalDiscount.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-charcoal-700)' }}>
                <span>Estimated Sales Tax:</span>
                <span>${summary.taxAmount.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-charcoal-700)' }}>
                <span>Freight & Delivery:</span>
                <span>${summary.freight.toFixed(2)}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '1.125rem',
                  color: 'var(--color-charcoal-900)',
                  borderTop: '2px solid var(--color-border)',
                  paddingTop: 'var(--space-3)',
                  marginTop: 'var(--space-2)',
                }}
              >
                <span>Grand Total (USD):</span>
                <span style={{ color: 'var(--color-orange-600)' }}>${summary.grandTotal.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                <Button
                  variant="secondary"
                  disabled={isSubmitting}
                  onClick={() => handleSave(false)}
                >
                  Save as Draft
                </Button>
                <Button
                  variant="primary"
                  disabled={isSubmitting}
                  onClick={() => handleSave(true)}
                  icon={isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : undefined}
                >
                  Submit Order
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};
