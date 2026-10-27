import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Truck,
  ArrowLeft,
  Save,
  Send,
  AlertTriangle,
  Building2,
  Warehouse,
  CheckCircle2,
  FileCheck,
  Calendar,
} from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/EmptyState';
import { useAuth } from '../app/AuthContext';
import { purchaseOrderService, PurchaseOrderDto, PurchaseOrderItemDto } from '../services/api/purchaseOrderService';
import { grnService, CreateGrnPayload } from '../services/api/grnService';

interface LineItemFormState {
  purchaseOrderItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unitCode: string;
  orderedQuantity: number;
  previouslyReceivedQuantity: number;
  outstandingQuantity: number;
  unitRate: number;
  deliveredQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  damagedQuantity: number;
  shortQuantity: number;
  storageLocation: string;
  remarks: string;
}

export const CreateGrnPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPoId = searchParams.get('poId');
  const { user } = useAuth();

  const [eligiblePos, setEligiblePos] = useState<PurchaseOrderDto[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>(preselectedPoId || '');
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderDto | null>(null);

  // Delivery Metadata
  const [deliveryChallanNumber, setDeliveryChallanNumber] = useState<string>('');
  const [deliveryChallanDate, setDeliveryChallanDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [deliveredBy, setDeliveredBy] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [storageLocation, setStorageLocation] = useState<string>('');
  const [generalRemarks, setGeneralRemarks] = useState<string>('');

  // Items State
  const [lineItems, setLineItems] = useState<LineItemFormState[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load eligible POs
  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const poRes = await purchaseOrderService.getPurchaseOrders({ status: 'ALL' });
        const eligible = (poRes.items || []).filter(
          (p) => p.status === 'Issued' || p.status === 'PartiallyReceived'
        );
        setEligiblePos(eligible);

        const initialPoId = preselectedPoId || (eligible.length > 0 ? eligible[0].id : '');
        if (initialPoId) {
          setSelectedPoId(initialPoId);
          const found = eligible.find((p) => p.id === initialPoId);
          if (found) {
            setupPoData(found);
          }
        }
      } catch (err: any) {
        console.error('Failed to load purchase orders for GRN:', err);
        setErrorMessage(err?.message || 'Failed to load purchase orders');
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, [preselectedPoId]);

  const setupPoData = (po: PurchaseOrderDto) => {
    setSelectedPo(po);
    setWarehouseId(user?.warehouseScopes?.[0] || 'WH-01');
    setStorageLocation(po.deliveryLocation || 'Bay 1 Staging Yard');

    // Populate lines with outstanding quantity
    const items: LineItemFormState[] = po.items.map((pi) => {
      const outstanding = pi.outstandingQuantity ?? Math.max(0, pi.orderedQuantity - (pi.receivedQuantity ?? 0));
      return {
        purchaseOrderItemId: pi.id,
        materialId: pi.materialId,
        materialCode: pi.materialCode,
        materialName: pi.materialName,
        unitCode: pi.unitCode,
        orderedQuantity: pi.orderedQuantity,
        previouslyReceivedQuantity: pi.receivedQuantity ?? 0,
        outstandingQuantity: outstanding,
        unitRate: pi.unitRate,
        deliveredQuantity: outstanding, // default to receiving the full remaining balance
        acceptedQuantity: outstanding,
        rejectedQuantity: 0,
        damagedQuantity: 0,
        shortQuantity: 0,
        storageLocation: po.deliveryLocation || 'Main Receiving Bay',
        remarks: '',
      };
    });

    setLineItems(items);
  };

  const handlePoChange = (poId: string) => {
    setSelectedPoId(poId);
    const found = eligiblePos.find((p) => p.id === poId);
    if (found) {
      setupPoData(found);
    }
  };

  const handleLineQuantityChange = (
    index: number,
    field: 'deliveredQuantity' | 'acceptedQuantity' | 'rejectedQuantity' | 'damagedQuantity' | 'shortQuantity',
    value: string
  ) => {
    const num = Math.max(0, parseFloat(value) || 0);
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === 'deliveredQuantity') {
        item.deliveredQuantity = num;
        // Keep accepted + rejected = delivered
        item.acceptedQuantity = Math.min(num, item.outstandingQuantity);
        item.rejectedQuantity = Math.max(0, num - item.acceptedQuantity);
      } else if (field === 'acceptedQuantity') {
        item.acceptedQuantity = num;
        item.rejectedQuantity = Math.max(0, item.deliveredQuantity - num);
      } else if (field === 'rejectedQuantity') {
        item.rejectedQuantity = num;
        item.acceptedQuantity = Math.max(0, item.deliveredQuantity - num);
      } else if (field === 'damagedQuantity') {
        item.damagedQuantity = num;
      } else if (field === 'shortQuantity') {
        item.shortQuantity = num;
      }

      updated[index] = item;
      return updated;
    });
  };

  const handleLineTextChange = (
    index: number,
    field: 'storageLocation' | 'remarks',
    value: string
  ) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Validation
  const validateForm = (): string | null => {
    if (!selectedPo) return 'Please select an eligible Purchase Order.';
    if (!deliveryChallanNumber.trim()) return 'Supplier Delivery Challan Number is required.';
    if (!vehicleNumber.trim()) return 'Vehicle registration / carrier reference is required.';
    if (lineItems.length === 0) return 'At least one line item must be included.';

    const totalDelivered = lineItems.reduce((sum, item) => sum + item.deliveredQuantity, 0);
    if (totalDelivered <= 0) return 'Total delivered physical quantity must be greater than zero.';

    for (const item of lineItems) {
      if (Math.abs(item.deliveredQuantity - (item.acceptedQuantity + item.rejectedQuantity)) > 0.01) {
        return `Quantity error on ${item.materialCode}: Delivered (${item.deliveredQuantity}) must equal Accepted (${item.acceptedQuantity}) + Rejected (${item.rejectedQuantity}).`;
      }
      if (item.acceptedQuantity > item.outstandingQuantity) {
        return `Over-receipt violation on ${item.materialCode}: Accepted quantity (${item.acceptedQuantity}) exceeds Purchase Order outstanding balance (${item.outstandingQuantity}).`;
      }
    }

    return null;
  };

  const handleSubmit = async (shouldSubmitForInspection: boolean) => {
    const error = validateForm();
    if (error) {
      setErrorMessage(error);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: CreateGrnPayload = {
        purchaseOrderId: selectedPo!.id,
        warehouseId: warehouseId || 'WH-01',
        warehouseName: user?.warehouseScopes?.[0] === 'WH-02' ? 'Metro North Site Store' : 'Metro Central Staging Yard',
        storageLocation: storageLocation || selectedPo!.deliveryLocation,
        deliveryChallanNumber: deliveryChallanNumber.trim(),
        deliveryChallanDate,
        vehicleNumber: vehicleNumber.trim(),
        deliveredBy: deliveredBy.trim() || 'Carrier Representative',
        generalRemarks: generalRemarks.trim() || undefined,
        items: lineItems.map((item) => ({
          purchaseOrderItemId: item.purchaseOrderItemId,
          materialId: item.materialId,
          deliveredQuantity: item.deliveredQuantity,
          acceptedQuantity: item.acceptedQuantity,
          rejectedQuantity: item.rejectedQuantity,
          damagedQuantity: item.damagedQuantity,
          shortQuantity: item.shortQuantity,
          storageLocation: item.storageLocation,
          remarks: item.remarks || undefined,
        })),
      };

      const createdGrn = await grnService.createGrn(payload);

      if (shouldSubmitForInspection) {
        await grnService.submitGrn(createdGrn.id, 'Physical delivery received and submitted for QA inspection.');
      }

      navigate(`/grns/${createdGrn.id}`);
    } catch (err: any) {
      console.error('Failed to create Goods Received Note:', err);
      setErrorMessage(err?.message || 'Failed to save Goods Received Note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Create Goods Received Note">
        <div className="py-20 flex justify-center">
          <LoadingSpinner label="Loading purchase order specifications..." />
        </div>
      </AppLayout>
    );
  }

  const totalDelivered = lineItems.reduce((s, i) => s + i.deliveredQuantity, 0);
  const totalAccepted = lineItems.reduce((s, i) => s + i.acceptedQuantity, 0);
  const totalRejected = lineItems.reduce((s, i) => s + i.rejectedQuantity, 0);
  const totalDamaged = lineItems.reduce((s, i) => s + i.damagedQuantity, 0);
  const totalAcceptedValue = lineItems.reduce((s, i) => s + i.acceptedQuantity * i.unitRate, 0);

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Dashboard', onClick: () => navigate('/dashboard') },
        { label: 'Goods Receiving', onClick: () => navigate('/grns') },
        { label: 'New Goods Receipt' },
      ]}
      title="Create Goods Received Note (GRN)"
      description="Record physical site delivery intake against an issued Purchase Order per Standard Operating Procedure SCM-F-01."
      actions={
        <Button
          variant="secondary"
          onClick={() => navigate('/grns')}
          icon={<ArrowLeft size={16} />}
        >
          Back to List
        </Button>
      }
    >
      {/* Error View */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-300 text-red-900 text-sm flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* PO Selector Card */}
      <Card title="1. Select Purchase Order for Receipt" className="mb-6">
        {eligiblePos.length === 0 ? (
          <div className="p-4 bg-yellow-50 border border-yellow-300 text-yellow-900 text-sm">
            There are currently no issued purchase orders with open balances awaiting delivery.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Purchase Order Contract <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedPoId}
                onChange={(e) => handlePoChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-[#DD6B20] bg-white font-medium"
              >
                {eligiblePos.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} — {po.supplierName} ({po.status})
                  </option>
                ))}
              </select>
            </div>

            {selectedPo && (
              <div className="bg-gray-50 border border-gray-200 p-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-500 block">Supplier:</span>
                    <strong className="text-gray-900">{selectedPo.supplierName}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Project / Site:</span>
                    <strong className="text-gray-900">{selectedPo.projectName}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Delivery Site:</span>
                    <span className="text-gray-800">{selectedPo.deliveryLocation || 'Main Yard'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">PO Grand Total:</span>
                    <span className="text-gray-800 font-bold">${selectedPo.grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Delivery Challan & Logistics Metadata */}
      {selectedPo && (
        <>
          <Card title="2. Delivery Logistics & Carrier Documents" className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Delivery Challan / Waybill # <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. DC-2026-9901"
                  value={deliveryChallanNumber}
                  onChange={(e) => setDeliveryChallanNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-[#DD6B20] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Challan Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={deliveryChallanDate}
                  onChange={(e) => setDeliveryChallanDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-[#DD6B20]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Vehicle Registration # <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. TRK-8842-NY"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-[#DD6B20]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Driver / Delivered By
                </label>
                <input
                  type="text"
                  placeholder="e.g. Michael Rossi"
                  value={deliveredBy}
                  onChange={(e) => setDeliveredBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-[#DD6B20]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Storage Location / Receiving Bay
                </label>
                <input
                  type="text"
                  placeholder="e.g. Staging Yard Bay 4 / Heavy Rebar Rack"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-[#DD6B20]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  General Intake Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Delivered on flatbed trailer, bundled with mill tags."
                  value={generalRemarks}
                  onChange={(e) => setGeneralRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-[#DD6B20]"
                />
              </div>
            </div>
          </Card>

          {/* Line Items Table */}
          <Card title="3. Physical Tally Verification & Quantity Breakdown" className="mb-6 p-0 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
              Rule: <strong>Delivered Quantity = Accepted + Rejected</strong>. Accepted quantity cannot exceed the Purchase Order outstanding balance.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#2D3748] text-white uppercase font-semibold">
                    <th className="py-2.5 px-3">Material Description</th>
                    <th className="py-2.5 px-3 text-center">UoM</th>
                    <th className="py-2.5 px-3 text-right">PO Ordered</th>
                    <th className="py-2.5 px-3 text-right">PO Outst.</th>
                    <th className="py-2.5 px-3 text-right bg-blue-900/40 w-24">Delivered</th>
                    <th className="py-2.5 px-3 text-right bg-green-900/40 w-24">Accepted</th>
                    <th className="py-2.5 px-3 text-right bg-red-900/40 w-24">Rejected</th>
                    <th className="py-2.5 px-3 text-right w-20">Damaged</th>
                    <th className="py-2.5 px-3 text-right w-20">Short</th>
                    <th className="py-2.5 px-3">Location / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {lineItems.map((item, index) => {
                    const isOverReceipt = item.acceptedQuantity > item.outstandingQuantity;
                    const isMathMismatch = Math.abs(item.deliveredQuantity - (item.acceptedQuantity + item.rejectedQuantity)) > 0.01;

                    return (
                      <tr key={item.purchaseOrderItemId} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-gray-900">{item.materialCode}</div>
                          <div className="text-gray-600">{item.materialName}</div>
                          {isOverReceipt && (
                            <div className="text-[11px] text-red-600 font-bold mt-0.5">
                              ⚠️ Exceeds outstanding ({item.outstandingQuantity})
                            </div>
                          )}
                          {isMathMismatch && (
                            <div className="text-[11px] text-red-600 font-bold mt-0.5">
                              ⚠️ Delivered ≠ Accepted + Rejected
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center font-medium">{item.unitCode}</td>
                        <td className="py-2.5 px-3 text-right text-gray-600">{item.orderedQuantity}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-gray-800">{item.outstandingQuantity}</td>

                        <td className="py-2.5 px-3 text-right bg-blue-50/50">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.deliveredQuantity}
                            onChange={(e) => handleLineQuantityChange(index, 'deliveredQuantity', e.target.value)}
                            className="w-full text-right px-2 py-1 border border-gray-300 rounded-none font-bold focus:border-[#DD6B20]"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-right bg-green-50/50">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.acceptedQuantity}
                            onChange={(e) => handleLineQuantityChange(index, 'acceptedQuantity', e.target.value)}
                            className={`w-full text-right px-2 py-1 border rounded-none font-bold text-green-700 ${
                              isOverReceipt ? 'border-red-500 bg-red-50' : 'border-gray-300'
                            }`}
                          />
                        </td>

                        <td className="py-2.5 px-3 text-right bg-red-50/50">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rejectedQuantity}
                            onChange={(e) => handleLineQuantityChange(index, 'rejectedQuantity', e.target.value)}
                            className="w-full text-right px-2 py-1 border border-gray-300 rounded-none font-bold text-red-600"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.damagedQuantity}
                            onChange={(e) => handleLineQuantityChange(index, 'damagedQuantity', e.target.value)}
                            className="w-full text-right px-2 py-1 border border-gray-300 rounded-none text-yellow-700"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.shortQuantity}
                            onChange={(e) => handleLineQuantityChange(index, 'shortQuantity', e.target.value)}
                            className="w-full text-right px-2 py-1 border border-gray-300 rounded-none text-orange-700"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="Storage location / bin"
                            value={item.storageLocation}
                            onChange={(e) => handleLineTextChange(index, 'storageLocation', e.target.value)}
                            className="w-full text-xs px-2 py-1 border border-gray-300 rounded-none mb-1"
                          />
                          <input
                            type="text"
                            placeholder="Discrepancy remarks"
                            value={item.remarks}
                            onChange={(e) => handleLineTextChange(index, 'remarks', e.target.value)}
                            className="w-full text-[11px] px-2 py-1 border border-gray-300 rounded-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-400 text-xs">
                    <td colSpan={4} className="py-3 px-3 text-right uppercase">
                      Tally Totals:
                    </td>
                    <td className="py-3 px-3 text-right text-blue-900">{totalDelivered}</td>
                    <td className="py-3 px-3 text-right text-green-800">{totalAccepted}</td>
                    <td className="py-3 px-3 text-right text-red-700">{totalRejected}</td>
                    <td className="py-3 px-3 text-right text-yellow-700">{totalDamaged}</td>
                    <td colSpan={2} className="py-3 px-3 text-right text-gray-900">
                      Accepted Stock Value: <span className="text-[#DD6B20] text-sm">${totalAcceptedValue.toFixed(2)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-between bg-white border border-gray-300 p-4">
            <Button
              variant="secondary"
              onClick={() => navigate('/grns')}
            >
              Cancel
            </Button>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                icon={<Save size={16} />}
              >
                Save as Draft
              </Button>

              <Button
                variant="primary"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                icon={<Send size={16} />}
                style={{ backgroundColor: 'var(--color-primary, #DD6B20)', borderColor: '#DD6B20' }}
              >
                {isSubmitting ? 'Submitting...' : 'Save & Submit for QA Inspection'}
              </Button>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
};
