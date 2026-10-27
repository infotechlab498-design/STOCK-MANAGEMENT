import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Truck,
  ArrowLeft,
  Printer,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldCheck,
  Layers,
  Send,
  AlertTriangle,
  Building2,
  Warehouse,
  Calendar,
  Clock,
  User,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/EmptyState';
import { useAuth } from '../app/AuthContext';
import {
  grnService,
  GoodsReceivedNoteDto,
  InspectionChecklistDto,
} from '../services/api/grnService';
import { GrnPrintView } from '../components/grn/GrnPrintView';

export const GrnDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [grn, setGrn] = useState<GoodsReceivedNoteDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Print Mode Toggle
  const [showPrintView, setShowPrintView] = useState<boolean>(false);

  // Inspection Checklist Form State
  const [isEditingInspection, setIsEditingInspection] = useState<boolean>(false);
  const [checklist, setChecklist] = useState<InspectionChecklistDto>({
    challanMatchesPO: true,
    vehicleUnloadedSafely: true,
    physicallyCounted: true,
    packagingIntact: true,
    batchTestCertsProvided: false,
    testCertificateNumber: '',
    materialsMeetSpecs: true,
    binTagsAttached: true,
    inspectionRemarks: '',
    discrepancyIdentified: false,
    debitNoteRequired: false,
    debitNoteReason: '',
  });

  // Action Modals & Processing
  const [modalType, setModalType] = useState<'Approve' | 'Reject' | 'Return' | 'Post' | null>(null);
  const [modalComments, setModalComments] = useState<string>('');
  const [isActionProcessing, setIsActionProcessing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isSuperAdmin = hasRole(['SuperAdmin']);
  const isManager = hasRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']);
  const canPost = hasRole(['SuperAdmin', 'InventoryManager', 'Storekeeper']);
  const canInspect = hasRole(['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProcurementOfficer']);

  const loadGrn = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await grnService.getGrnById(id);
      setGrn(data);
      if (data.inspectionChecklist) {
        setChecklist({
          challanMatchesPO: data.inspectionChecklist.challanMatchesPO ?? true,
          vehicleUnloadedSafely: data.inspectionChecklist.vehicleUnloadedSafely ?? true,
          physicallyCounted: data.inspectionChecklist.physicallyCounted ?? true,
          packagingIntact: data.inspectionChecklist.packagingIntact ?? true,
          batchTestCertsProvided: data.inspectionChecklist.batchTestCertsProvided ?? false,
          testCertificateNumber: data.inspectionChecklist.testCertificateNumber ?? '',
          materialsMeetSpecs: data.inspectionChecklist.materialsMeetSpecs ?? true,
          binTagsAttached: data.inspectionChecklist.binTagsAttached ?? true,
          inspectionRemarks: data.inspectionChecklist.inspectionRemarks ?? '',
          discrepancyIdentified: data.inspectionChecklist.discrepancyIdentified ?? false,
          debitNoteRequired: data.inspectionChecklist.debitNoteRequired ?? false,
          debitNoteReason: data.inspectionChecklist.debitNoteReason ?? '',
        });
      }
    } catch (err: any) {
      console.error('Failed to load Goods Received Note:', err);
      setError(err?.message || 'Failed to retrieve Goods Received Note details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadGrn();
  }, [loadGrn]);

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grn) return;

    if (checklist.debitNoteRequired && (!checklist.debitNoteReason || !checklist.debitNoteReason.trim())) {
      setActionError('Debit note reason is required when a debit note is recommended.');
      return;
    }

    setIsActionProcessing(true);
    setActionError(null);
    try {
      const updated = await grnService.inspectGrn(grn.id, {
        checklist,
        comments: checklist.inspectionRemarks || 'Quality inspection performed per SCM-F-01 Rev 1.0',
      });
      setGrn(updated);
      setIsEditingInspection(false);
      setSuccessMessage('QA Inspection recorded successfully. Ready for supervisory approval.');
    } catch (err: any) {
      console.error('Failed to save inspection:', err);
      setActionError(err?.message || 'Failed to record inspection checklist');
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handleActionConfirm = async () => {
    if (!grn || !modalType) return;

    setIsActionProcessing(true);
    setActionError(null);
    try {
      if (modalType === 'Approve') {
        const updated = await grnService.approveGrn(grn.id, modalComments);
        setGrn(updated);
        setSuccessMessage(`GRN ${grn.grnNumber} approved successfully.`);
      } else if (modalType === 'Reject') {
        if (!modalComments.trim()) {
          setActionError('Rejection reason is required.');
          setIsActionProcessing(false);
          return;
        }
        const updated = await grnService.rejectGrn(grn.id, modalComments);
        setGrn(updated);
        setSuccessMessage(`GRN ${grn.grnNumber} has been rejected.`);
      } else if (modalType === 'Return') {
        if (!modalComments.trim()) {
          setActionError('Correction notes are required.');
          setIsActionProcessing(false);
          return;
        }
        const updated = await grnService.returnGrnForCorrection(grn.id, modalComments);
        setGrn(updated);
        setSuccessMessage(`GRN ${grn.grnNumber} returned for correction.`);
      } else if (modalType === 'Post') {
        const res = await grnService.postGrn(grn.id);
        setGrn(res.data);
        setSuccessMessage(`GRN ${grn.grnNumber} successfully posted to durable receipt ledger. Purchase Order updated.`);
      }

      setModalType(null);
      setModalComments('');
    } catch (err: any) {
      console.error(`Action ${modalType} failed:`, err);
      setActionError(err?.message || `Failed to execute action ${modalType}`);
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handleDirectSubmitForInspection = async () => {
    if (!grn) return;
    setIsActionProcessing(true);
    try {
      const updated = await grnService.submitGrn(grn.id, 'Submitted for formal quality inspection.');
      setGrn(updated);
      setSuccessMessage('GRN submitted for QA inspection.');
    } catch (err: any) {
      console.error('Submit failed:', err);
      setError(err?.message || 'Failed to submit GRN for inspection.');
    } finally {
      setIsActionProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Goods Received Note Details">
        <div className="py-24 flex justify-center">
          <LoadingSpinner label="Retrieving Goods Received Note..." />
        </div>
      </AppLayout>
    );
  }

  if (error || !grn) {
    return (
      <AppLayout title="Goods Received Note">
        <div className="p-6 bg-red-50 border border-red-300 text-red-900">
          <h3 className="font-bold text-lg mb-1">Error Loading Goods Received Note</h3>
          <p className="text-sm">{error || 'Record was not found.'}</p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/grns')}>
            Back to Goods Receiving
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Print View Modal
  if (showPrintView) {
    return <GrnPrintView grn={grn} onClose={() => setShowPrintView(false)} />;
  }

  const isSelfReceived = grn.receivedByUserId === user?.id;
  const isSelfApprovalBlocked = isSelfReceived && !isSuperAdmin;

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Dashboard', onClick: () => navigate('/dashboard') },
        { label: 'Goods Receiving', onClick: () => navigate('/grns') },
        { label: grn.grnNumber },
      ]}
      title={
        <div className="flex items-center gap-3">
          <span>{grn.grnNumber}</span>
          <StatusBadge status={grn.status} />
          {grn.inspectionChecklist?.discrepancyIdentified && (
            <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-300 text-xs font-bold uppercase">
              Discrepancy Logged
            </span>
          )}
        </div>
      }
      description={`Delivery intake for Purchase Order ${grn.purchaseOrderNumber} from ${grn.supplierName}.`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate('/grns')}
            icon={<ArrowLeft size={16} />}
          >
            Back
          </Button>

          <Button
            variant="secondary"
            onClick={() => setShowPrintView(true)}
            icon={<Printer size={16} />}
          >
            Print Note (SCM-F-01)
          </Button>

          {/* Workflow Action Buttons */}
          {(grn.status === 'Draft' || grn.status === 'ReturnedForCorrection') && (
            <Button
              variant="primary"
              onClick={handleDirectSubmitForInspection}
              disabled={isActionProcessing}
              icon={<Send size={16} />}
              style={{ backgroundColor: 'var(--color-primary, #DD6B20)', borderColor: '#DD6B20' }}
            >
              Submit for QA Inspection
            </Button>
          )}

          {grn.status === 'SubmittedForInspection' && canInspect && !isEditingInspection && (
            <Button
              variant="primary"
              onClick={() => setIsEditingInspection(true)}
              icon={<ShieldCheck size={16} />}
              style={{ backgroundColor: 'var(--color-primary, #DD6B20)', borderColor: '#DD6B20' }}
            >
              Complete QA Inspection
            </Button>
          )}

          {grn.status === 'Inspected' && isManager && (
            <Button
              variant="primary"
              onClick={() => setModalType('Approve')}
              disabled={isSelfApprovalBlocked}
              icon={<CheckCircle2 size={16} />}
              style={{ backgroundColor: isSelfApprovalBlocked ? '#A0AEC0' : '#38A169', borderColor: isSelfApprovalBlocked ? '#A0AEC0' : '#38A169' }}
            >
              Approve GRN
            </Button>
          )}

          {grn.status === 'Approved' && canPost && (
            <Button
              variant="primary"
              onClick={() => setModalType('Post')}
              disabled={isActionProcessing}
              icon={<Layers size={16} />}
              style={{ backgroundColor: 'var(--color-primary, #DD6B20)', borderColor: '#DD6B20' }}
            >
              Post to Receipt Ledger
            </Button>
          )}

          {(grn.status === 'SubmittedForInspection' || grn.status === 'Inspected') && isManager && (
            <>
              <Button
                variant="secondary"
                onClick={() => setModalType('Return')}
                icon={<RotateCcw size={15} />}
              >
                Return
              </Button>
              <Button
                variant="danger"
                onClick={() => setModalType('Reject')}
                icon={<XCircle size={15} />}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      }
    >
      {/* Success Notification */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-300 text-green-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-green-800 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dual Control Self-Approval Warning */}
      {grn.status === 'Inspected' && isSelfApprovalBlocked && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 text-yellow-900 text-sm flex items-center gap-2">
          <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0" />
          <span>
            <strong>Dual-Control Policy:</strong> You recorded this physical delivery intake ({grn.receivedByName}). An independent Project Manager or Inventory Manager must review and approve this GRN.
          </span>
        </div>
      )}

      {/* Posted Banner */}
      {grn.status === 'Posted' && (
        <div className="mb-6 p-4 bg-green-100 border border-green-300 text-green-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-green-700" />
            <div>
              <div className="font-bold">Durable Stock Receipt Ledger Entry Finalized</div>
              <div className="text-xs text-green-800">
                Posted by <strong>{grn.postedByName}</strong> on {grn.postedAtUtc ? new Date(grn.postedAtUtc).toLocaleString() : 'N/A'}. Purchase Order line item received balances have been incremented.
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/purchase-orders/${grn.purchaseOrderId}`)}
            icon={<ExternalLink size={13} />}
            iconPosition="right"
          >
            View Updated PO
          </Button>
        </div>
      )}

      {/* Metadata Overview Card */}
      <Card title="Commercial & Physical Delivery Summary" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-gray-500 block">Purchase Order</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <strong className="text-sm text-gray-900">{grn.purchaseOrderNumber}</strong>
              <button
                onClick={() => navigate(`/purchase-orders/${grn.purchaseOrderId}`)}
                className="text-[#DD6B20] hover:underline"
                title="Open Purchase Order Details"
              >
                <ExternalLink size={13} />
              </button>
            </div>
            <div className="text-gray-500">{grn.projectName}</div>
          </div>

          <div>
            <span className="text-gray-500 block">Supplier</span>
            <strong className="text-sm text-gray-900 mt-0.5 block">{grn.supplierName}</strong>
            <div className="text-gray-500">Code: {grn.supplierCode}</div>
          </div>

          <div>
            <span className="text-gray-500 block">Delivery Challan & Date</span>
            <strong className="text-sm text-gray-900 mt-0.5 block font-mono">{grn.deliveryChallanNumber}</strong>
            <div className="text-gray-500">Date: {grn.deliveryChallanDate || grn.grnDate}</div>
          </div>

          <div>
            <span className="text-gray-500 block">Carrier & Yard</span>
            <strong className="text-sm text-gray-900 mt-0.5 block">{grn.warehouseName}</strong>
            <div className="text-gray-500">Vehicle: {grn.vehicleNumber} ({grn.deliveredBy})</div>
          </div>
        </div>

        {grn.generalRemarks && (
          <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-600">
            <strong>Intake Notes:</strong> {grn.generalRemarks}
          </div>
        )}
      </Card>

      {/* Line Items Table */}
      <Card title="Physical Intake & Inspection Quantities" className="mb-6 p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#2D3748] text-white uppercase font-semibold">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Material Specification</th>
                <th className="py-2.5 px-3 text-center">UoM</th>
                <th className="py-2.5 px-3 text-right">PO Ordered</th>
                <th className="py-2.5 px-3 text-right">PO Outstanding</th>
                <th className="py-2.5 px-3 text-right bg-blue-900/30">Delivered</th>
                <th className="py-2.5 px-3 text-right bg-green-900/30">Accepted</th>
                <th className="py-2.5 px-3 text-right bg-red-900/30">Rejected</th>
                <th className="py-2.5 px-3 text-right">Damaged</th>
                <th className="py-2.5 px-3 text-right">Short</th>
                <th className="py-2.5 px-3 text-right">Unit Rate</th>
                <th className="py-2.5 px-3 text-right">Accepted Total</th>
                <th className="py-2.5 px-3">Storage Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {grn.items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="py-2.5 px-3 font-medium text-gray-500">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-gray-900">{item.materialCode}</div>
                    <div className="text-gray-600">{item.materialName}</div>
                    {item.remarks && (
                      <div className="text-[11px] text-red-600 mt-0.5 italic">Note: {item.remarks}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-medium">{item.unitCode}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{item.orderedQuantity}</td>
                  <td className="py-2.5 px-3 text-right font-medium text-gray-700">{item.poOutstandingQuantity}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-gray-900 bg-blue-50/50">
                    {item.deliveredQuantity}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-green-700 bg-green-50/50">
                    {item.acceptedQuantity}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-red-600 bg-red-50/50">
                    {item.rejectedQuantity}
                  </td>
                  <td className="py-2.5 px-3 text-right text-yellow-700 font-medium">{item.damagedQuantity}</td>
                  <td className="py-2.5 px-3 text-right text-orange-700 font-medium">{item.shortQuantity}</td>
                  <td className="py-2.5 px-3 text-right text-gray-700">${item.unitPrice.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                    ${item.totalAcceptedAmount.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-gray-600">{item.storageLocation || grn.storageLocation}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-400 text-xs">
                <td colSpan={5} className="py-2.5 px-3 text-right uppercase">
                  Batch Totals:
                </td>
                <td className="py-2.5 px-3 text-right text-blue-900">{grn.totalDeliveredQuantity}</td>
                <td className="py-2.5 px-3 text-right text-green-800">{grn.totalAcceptedQuantity}</td>
                <td className="py-2.5 px-3 text-right text-red-700">{grn.totalRejectedQuantity}</td>
                <td className="py-2.5 px-3 text-right text-yellow-700">{grn.totalDamagedQuantity}</td>
                <td className="py-2.5 px-3 text-right text-orange-700">{grn.totalShortQuantity}</td>
                <td className="py-2.5 px-3 text-right text-gray-700">USD</td>
                <td className="py-2.5 px-3 text-right text-[#DD6B20] text-sm">
                  ${grn.totalAcceptedValue.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* SCM-F-01 QA Inspection Checklist Card */}
      <Card
        title="Standard Operating Procedure SCM-F-01 Rev 1.0 — QA Inspection"
        className="mb-6"
        actions={
          grn.status === 'SubmittedForInspection' && !isEditingInspection && canInspect && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsEditingInspection(true)}
            >
              Edit QA Checklist
            </Button>
          )
        }
      >
        {isEditingInspection ? (
          <form onSubmit={handleInspectionSubmit} className="space-y-4 text-xs">
            {actionError && (
              <div className="p-3 bg-red-50 border border-red-300 text-red-900 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-600" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2.5 p-2 bg-gray-50 border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.challanMatchesPO}
                  onChange={(e) => setChecklist({ ...checklist, challanMatchesPO: e.target.checked })}
                  className="rounded-none text-[#DD6B20] focus:ring-[#DD6B20]"
                />
                <span className="font-semibold text-gray-800">1. Challan matches Purchase Order line items</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 bg-gray-50 border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.vehicleUnloadedSafely}
                  onChange={(e) => setChecklist({ ...checklist, vehicleUnloadedSafely: e.target.checked })}
                  className="rounded-none text-[#DD6B20] focus:ring-[#DD6B20]"
                />
                <span className="font-semibold text-gray-800">2. Vehicle unloaded safely in designated site bay</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 bg-gray-50 border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.physicallyCounted}
                  onChange={(e) => setChecklist({ ...checklist, physicallyCounted: e.target.checked })}
                  className="rounded-none text-[#DD6B20] focus:ring-[#DD6B20]"
                />
                <span className="font-semibold text-gray-800">3. Physical 100% tally count / weighing performed</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 bg-gray-50 border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.packagingIntact}
                  onChange={(e) => setChecklist({ ...checklist, packagingIntact: e.target.checked })}
                  className="rounded-none text-[#DD6B20] focus:ring-[#DD6B20]"
                />
                <span className="font-semibold text-gray-800">4. Packaging intact without moisture/handling damage</span>
              </label>

              <div className="p-2 bg-gray-50 border border-gray-200">
                <label className="flex items-center gap-2.5 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={checklist.batchTestCertsProvided}
                    onChange={(e) => setChecklist({ ...checklist, batchTestCertsProvided: e.target.checked })}
                    className="rounded-none text-[#DD6B20] focus:ring-[#DD6B20]"
                  />
                  <span className="font-semibold text-gray-800">5. Batch mill test certificates provided</span>
                </label>
                {checklist.batchTestCertsProvided && (
                  <input
                    type="text"
                    placeholder="Test certificate reference #"
                    value={checklist.testCertificateNumber || ''}
                    onChange={(e) => setChecklist({ ...checklist, testCertificateNumber: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded-none text-xs"
                  />
                )}
              </div>

              <label className="flex items-center gap-2.5 p-2 bg-gray-50 border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.materialsMeetSpecs}
                  onChange={(e) => setChecklist({ ...checklist, materialsMeetSpecs: e.target.checked })}
                  className="rounded-none text-[#DD6B20] focus:ring-[#DD6B20]"
                />
                <span className="font-semibold text-gray-800">6. Materials meet ASTM/BS engineering specifications</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 bg-gray-50 border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.binTagsAttached}
                  onChange={(e) => setChecklist({ ...checklist, binTagsAttached: e.target.checked })}
                  className="rounded-none text-[#DD6B20] focus:ring-[#DD6B20]"
                />
                <span className="font-semibold text-gray-800">7. Bin tags & physical identification attached</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 bg-gray-50 border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.discrepancyIdentified}
                  onChange={(e) => setChecklist({ ...checklist, discrepancyIdentified: e.target.checked })}
                  className="rounded-none text-red-600 focus:ring-red-500"
                />
                <span className="font-semibold text-red-800">8. Discrepancy identified during physical intake</span>
              </label>
            </div>

            {/* Debit Note Recommendation */}
            <div className="p-3 bg-red-50 border border-red-200">
              <label className="flex items-center gap-2.5 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={checklist.debitNoteRequired}
                  onChange={(e) => setChecklist({ ...checklist, debitNoteRequired: e.target.checked })}
                  className="rounded-none text-red-600 focus:ring-red-500"
                />
                <span className="font-bold text-red-900">Recommend Debit Note against Supplier for Discrepancy / Damage</span>
              </label>
              {checklist.debitNoteRequired && (
                <input
                  type="text"
                  placeholder="Detail reason for debit note recommendation (mandatory)..."
                  value={checklist.debitNoteReason || ''}
                  onChange={(e) => setChecklist({ ...checklist, debitNoteReason: e.target.value })}
                  className="w-full px-2 py-1.5 border border-red-300 rounded-none text-xs bg-white text-red-900"
                  required
                />
              )}
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Quality Inspector Remarks
              </label>
              <textarea
                rows={2}
                placeholder="Remarks regarding physical inspection, tensile results, sample retention..."
                value={checklist.inspectionRemarks}
                onChange={(e) => setChecklist({ ...checklist, inspectionRemarks: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-none text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditingInspection(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isActionProcessing}
                style={{ backgroundColor: 'var(--color-primary, #DD6B20)', borderColor: '#DD6B20' }}
              >
                {isActionProcessing ? 'Saving...' : 'Save & Certify QA Inspection'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-xs space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 flex items-center justify-center font-bold text-[10px] text-white ${grn.inspectionChecklist.challanMatchesPO ? 'bg-green-600' : 'bg-red-600'}`}>
                  {grn.inspectionChecklist.challanMatchesPO ? '✓' : '✗'}
                </span>
                <span>Challan matches PO specifications</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 flex items-center justify-center font-bold text-[10px] text-white ${grn.inspectionChecklist.vehicleUnloadedSafely ? 'bg-green-600' : 'bg-red-600'}`}>
                  {grn.inspectionChecklist.vehicleUnloadedSafely ? '✓' : '✗'}
                </span>
                <span>Vehicle unloaded safely in yard bay</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 flex items-center justify-center font-bold text-[10px] text-white ${grn.inspectionChecklist.physicallyCounted ? 'bg-green-600' : 'bg-red-600'}`}>
                  {grn.inspectionChecklist.physicallyCounted ? '✓' : '✗'}
                </span>
                <span>Physical 100% tally count verified</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 flex items-center justify-center font-bold text-[10px] text-white ${grn.inspectionChecklist.packagingIntact ? 'bg-green-600' : 'bg-red-600'}`}>
                  {grn.inspectionChecklist.packagingIntact ? '✓' : '✗'}
                </span>
                <span>Packaging intact without transit moisture/damage</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 flex items-center justify-center font-bold text-[10px] text-white ${grn.inspectionChecklist.batchTestCertsProvided ? 'bg-green-600' : 'bg-gray-400'}`}>
                  {grn.inspectionChecklist.batchTestCertsProvided ? '✓' : '-'}
                </span>
                <span>
                  Mill test certificate {grn.inspectionChecklist.testCertificateNumber ? `(#${grn.inspectionChecklist.testCertificateNumber})` : '(Not Provided)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 flex items-center justify-center font-bold text-[10px] text-white ${grn.inspectionChecklist.materialsMeetSpecs ? 'bg-green-600' : 'bg-red-600'}`}>
                  {grn.inspectionChecklist.materialsMeetSpecs ? '✓' : '✗'}
                </span>
                <span>Materials meet engineering specifications</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 flex items-center justify-center font-bold text-[10px] text-white ${grn.inspectionChecklist.binTagsAttached ? 'bg-green-600' : 'bg-gray-400'}`}>
                  {grn.inspectionChecklist.binTagsAttached ? '✓' : '-'}
                </span>
                <span>Physical bin tags attached</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 flex items-center justify-center font-bold text-[10px] text-white ${grn.inspectionChecklist.discrepancyIdentified ? 'bg-red-600' : 'bg-green-600'}`}>
                  {grn.inspectionChecklist.discrepancyIdentified ? '!' : '✓'}
                </span>
                <span>
                  Discrepancy: <strong>{grn.inspectionChecklist.discrepancyIdentified ? 'Discrepancy Identified' : 'No Discrepancy'}</strong>
                </span>
              </div>
            </div>

            {grn.inspectionChecklist.debitNoteRequired && (
              <div className="p-3 bg-red-100 border border-red-300 text-red-900 font-medium">
                <strong>DEBIT NOTE RECOMMENDED:</strong> {grn.inspectionChecklist.debitNoteReason || 'Deduction from supplier account recommended.'}
              </div>
            )}

            {grn.inspectionChecklist.inspectionRemarks && (
              <div className="p-2 bg-gray-50 border border-gray-200 text-gray-700 italic">
                Inspector Notes: {grn.inspectionChecklist.inspectionRemarks}
              </div>
            )}

            {grn.inspectedByName && (
              <div className="text-[11px] text-gray-500 pt-2 border-t border-gray-200">
                Inspected by <strong>{grn.inspectedByName}</strong> on {grn.inspectedAtUtc ? new Date(grn.inspectedAtUtc).toLocaleString() : 'N/A'}.
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Chronological Audit Trail */}
      <Card title="Chronological Audit Log" className="mb-6">
        <div className="space-y-3">
          {grn.auditTrail.map((log) => (
            <div key={log.id} className="flex items-start gap-3 text-xs border-l-2 border-[#DD6B20] pl-3 py-1">
              <div className="min-w-[120px] text-gray-400 text-[11px]">
                {new Date(log.timestampUtc).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div>
                <span className="font-bold text-gray-900">{log.action}</span>
                <span className="text-gray-500 ml-1.5">by {log.actorName} ({log.actorRole})</span>
                <div className="text-gray-700 mt-0.5">{log.comments}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Decision Action Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-xl border border-gray-300">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {modalType === 'Approve' && 'Supervisory Dual-Control Approval'}
              {modalType === 'Reject' && 'Reject Goods Received Note'}
              {modalType === 'Return' && 'Return GRN for Correction'}
              {modalType === 'Post' && 'Post GRN to Receipt Ledger'}
            </h3>

            <p className="text-xs text-gray-600 mb-4">
              {modalType === 'Approve' && 'Confirm approval of this inspected Goods Received Note. Stock will be ready for receipt ledger posting.'}
              {modalType === 'Reject' && 'Rejecting this delivery intake will cancel the receipt note and retain audit justification.'}
              {modalType === 'Return' && 'Return this draft to the storekeeper with revision instructions.'}
              {modalType === 'Post' && 'Posting will update the durable receipt ledger and increment cumulative received quantities on Purchase Order ' + grn.purchaseOrderNumber + '.'}
            </p>

            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-900 text-xs">
                {actionError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                {modalType === 'Reject' ? 'Rejection Reason *' : modalType === 'Return' ? 'Correction Notes *' : 'Comments / Justification'}
              </label>
              <textarea
                rows={3}
                placeholder={
                  modalType === 'Reject'
                    ? 'State why this physical delivery was rejected...'
                    : modalType === 'Return'
                    ? 'State what needs correction by the storekeeper...'
                    : 'Optional approval or posting commentary...'
                }
                value={modalComments}
                onChange={(e) => setModalComments(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-none text-xs focus:outline-none focus:border-[#DD6B20]"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setModalType(null);
                  setActionError(null);
                }}
                disabled={isActionProcessing}
              >
                Cancel
              </Button>

              <Button
                variant={modalType === 'Reject' ? 'danger' : 'primary'}
                size="sm"
                onClick={handleActionConfirm}
                disabled={isActionProcessing}
                style={
                  modalType === 'Approve'
                    ? { backgroundColor: '#38A169', borderColor: '#38A169' }
                    : modalType === 'Post'
                    ? { backgroundColor: 'var(--color-primary, #DD6B20)', borderColor: '#DD6B20' }
                    : undefined
                }
              >
                {isActionProcessing ? 'Processing...' : `Confirm ${modalType}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};
