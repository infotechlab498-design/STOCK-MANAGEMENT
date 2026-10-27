import React from 'react';
import { GoodsReceivedNoteDto } from '../../services/api/grnService';

interface GrnPrintViewProps {
  grn: GoodsReceivedNoteDto;
  onClose?: () => void;
}

export const GrnPrintView: React.FC<GrnPrintViewProps> = ({ grn, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="grn-print-wrapper bg-white text-gray-900 p-8 max-w-5xl mx-auto border border-gray-300 shadow-md print:shadow-none print:border-none print:p-0">
      {/* Print Controls (hidden on print) */}
      <div className="print:hidden mb-6 flex justify-between items-center bg-gray-100 p-4 border border-gray-200">
        <div className="text-sm text-gray-600">
          Standard Operating Procedure <strong>SCM-F-01 Rev 1.0</strong> — Official Receiving Document
        </div>
        <div className="flex gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-400 bg-white hover:bg-gray-50 text-sm font-medium text-gray-800"
            >
              Close Print Preview
            </button>
          )}
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-[#DD6B20] text-white hover:bg-[#C05621] text-sm font-medium"
          >
            Print GRN Document
          </button>
        </div>
      </div>

      {/* Official SCM-F-01 Header */}
      <div className="border-b-2 border-gray-800 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 uppercase">
              ConstructCorp Infrastructure Ltd.
            </h1>
            <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">
              Materials Management & Quality Control Division
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Central Construction Depot & Site Logistics | ISO 9001:2015 Compliant
            </p>
          </div>
          <div className="text-right">
            <div className="inline-block border-2 border-gray-800 px-3 py-1 text-center">
              <span className="block text-xs font-semibold text-gray-500 uppercase">Document Code</span>
              <span className="text-sm font-bold text-gray-900">SCM-F-01 Rev 1.0</span>
            </div>
            <div className="mt-2 text-xl font-bold text-[#DD6B20]">
              {grn.grnNumber}
            </div>
            <div className="text-xs text-gray-600 font-medium">
              Status: <span className="font-bold uppercase">{grn.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Commercial & Logistics Metadata Grid */}
      <div className="grid grid-cols-2 gap-4 border border-gray-300 p-4 mb-6 text-sm">
        <div>
          <div className="grid grid-cols-3 gap-1 py-1 border-b border-gray-200">
            <span className="font-semibold text-gray-600">Purchase Order:</span>
            <span className="col-span-2 font-bold text-gray-900">{grn.purchaseOrderNumber}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 py-1 border-b border-gray-200">
            <span className="font-semibold text-gray-600">Supplier:</span>
            <span className="col-span-2 text-gray-900">{grn.supplierName} ({grn.supplierCode})</span>
          </div>
          <div className="grid grid-cols-3 gap-1 py-1 border-b border-gray-200">
            <span className="font-semibold text-gray-600">Project / Site:</span>
            <span className="col-span-2 text-gray-900">{grn.projectName} ({grn.projectId})</span>
          </div>
          <div className="grid grid-cols-3 gap-1 py-1">
            <span className="font-semibold text-gray-600">Warehouse / Yard:</span>
            <span className="col-span-2 text-gray-900">{grn.warehouseName} ({grn.warehouseId})</span>
          </div>
        </div>

        <div>
          <div className="grid grid-cols-3 gap-1 py-1 border-b border-gray-200">
            <span className="font-semibold text-gray-600">Receipt Date:</span>
            <span className="col-span-2 text-gray-900">{grn.grnDate} ({new Date(grn.receivedAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
          </div>
          <div className="grid grid-cols-3 gap-1 py-1 border-b border-gray-200">
            <span className="font-semibold text-gray-600">Delivery Challan:</span>
            <span className="col-span-2 font-bold text-gray-900">{grn.deliveryChallanNumber} (Date: {grn.deliveryChallanDate || 'N/A'})</span>
          </div>
          <div className="grid grid-cols-3 gap-1 py-1 border-b border-gray-200">
            <span className="font-semibold text-gray-600">Vehicle / Carrier:</span>
            <span className="col-span-2 text-gray-900">{grn.vehicleNumber}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 py-1">
            <span className="font-semibold text-gray-600">Delivered By:</span>
            <span className="col-span-2 text-gray-900">{grn.deliveredBy}</span>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
          Physical Intake & Inspection Tally (Enforcing Delivered = Accepted + Rejected)
        </h3>
        <table className="w-full border-collapse border border-gray-300 text-xs">
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-left font-bold border-b border-gray-300">
              <th className="p-2 border-r border-gray-300 w-8">#</th>
              <th className="p-2 border-r border-gray-300">Material SKU & Description</th>
              <th className="p-2 border-r border-gray-300 text-center w-16">UoM</th>
              <th className="p-2 border-r border-gray-300 text-right w-16">PO Ord</th>
              <th className="p-2 border-r border-gray-300 text-right w-16">Delivered</th>
              <th className="p-2 border-r border-gray-300 text-right w-16 bg-green-50 text-green-900">Accepted</th>
              <th className="p-2 border-r border-gray-300 text-right w-16 bg-red-50 text-red-900">Rejected</th>
              <th className="p-2 border-r border-gray-300 text-right w-16 text-yellow-800">Damaged</th>
              <th className="p-2 border-r border-gray-300 text-right w-16 text-orange-800">Short</th>
              <th className="p-2 border-r border-gray-300 text-right w-20">Unit Rate</th>
              <th className="p-2 text-right w-24">Accepted Total</th>
            </tr>
          </thead>
          <tbody>
            {grn.items.map((item, index) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="p-2 border-r border-gray-300 text-center font-medium">{index + 1}</td>
                <td className="p-2 border-r border-gray-300">
                  <div className="font-bold text-gray-900">{item.materialCode}</div>
                  <div className="text-gray-700">{item.materialName}</div>
                  {item.storageLocation && (
                    <div className="text-[10px] text-gray-500">Loc: {item.storageLocation}</div>
                  )}
                  {item.remarks && (
                    <div className="text-[10px] text-red-600 italic">Note: {item.remarks}</div>
                  )}
                </td>
                <td className="p-2 border-r border-gray-300 text-center">{item.unitCode}</td>
                <td className="p-2 border-r border-gray-300 text-right font-medium">{item.orderedQuantity}</td>
                <td className="p-2 border-r border-gray-300 text-right font-bold">{item.deliveredQuantity}</td>
                <td className="p-2 border-r border-gray-300 text-right font-bold text-green-700 bg-green-50/50">
                  {item.acceptedQuantity}
                </td>
                <td className="p-2 border-r border-gray-300 text-right font-bold text-red-600 bg-red-50/50">
                  {item.rejectedQuantity}
                </td>
                <td className="p-2 border-r border-gray-300 text-right text-yellow-700">
                  {item.damagedQuantity}
                </td>
                <td className="p-2 border-r border-gray-300 text-right text-orange-700">
                  {item.shortQuantity}
                </td>
                <td className="p-2 border-r border-gray-300 text-right">${item.unitPrice.toFixed(2)}</td>
                <td className="p-2 text-right font-bold text-gray-900">${item.totalAcceptedAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
              <td colSpan={4} className="p-2 text-right border-r border-gray-300">Total Quantities & Value:</td>
              <td className="p-2 text-right border-r border-gray-300">{grn.totalDeliveredQuantity}</td>
              <td className="p-2 text-right border-r border-gray-300 text-green-800">{grn.totalAcceptedQuantity}</td>
              <td className="p-2 text-right border-r border-gray-300 text-red-700">{grn.totalRejectedQuantity}</td>
              <td className="p-2 text-right border-r border-gray-300 text-yellow-700">{grn.totalDamagedQuantity}</td>
              <td className="p-2 text-right border-r border-gray-300 text-orange-700">{grn.totalShortQuantity}</td>
              <td className="p-2 text-right border-r border-gray-300">USD</td>
              <td className="p-2 text-right text-sm text-[#DD6B20]">${grn.totalAcceptedValue.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* SCM-F-01 Quality Inspection Checklist Results */}
      <div className="border border-gray-300 p-4 mb-6 text-xs bg-gray-50">
        <h3 className="font-bold uppercase tracking-wider text-gray-800 mb-3 border-b border-gray-200 pb-1">
          Quality Assurance Inspection Checklist (SCM-F-01 Rev 1.0)
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className={`w-4 h-4 border flex items-center justify-center font-bold text-[10px] ${grn.inspectionChecklist.challanMatchesPO ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'}`}>
              {grn.inspectionChecklist.challanMatchesPO ? '✓' : '✗'}
            </span>
            <span>Delivery Challan matches Purchase Order specifications</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`w-4 h-4 border flex items-center justify-center font-bold text-[10px] ${grn.inspectionChecklist.vehicleUnloadedSafely ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'}`}>
              {grn.inspectionChecklist.vehicleUnloadedSafely ? '✓' : '✗'}
            </span>
            <span>Vehicle unloaded safely in designated yard location</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`w-4 h-4 border flex items-center justify-center font-bold text-[10px] ${grn.inspectionChecklist.physicallyCounted ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'}`}>
              {grn.inspectionChecklist.physicallyCounted ? '✓' : '✗'}
            </span>
            <span>Materials physically counted and weighed/tallied 100%</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`w-4 h-4 border flex items-center justify-center font-bold text-[10px] ${grn.inspectionChecklist.packagingIntact ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'}`}>
              {grn.inspectionChecklist.packagingIntact ? '✓' : '✗'}
            </span>
            <span>Packaging intact with zero moisture, puncture, or transit damage</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`w-4 h-4 border flex items-center justify-center font-bold text-[10px] ${grn.inspectionChecklist.batchTestCertsProvided ? 'bg-green-600 text-white border-green-600' : 'bg-gray-200 text-gray-500 border-gray-400'}`}>
              {grn.inspectionChecklist.batchTestCertsProvided ? '✓' : '-'}
            </span>
            <span>
              Batch Mill/Test Certificates provided {grn.inspectionChecklist.testCertificateNumber ? `(#${grn.inspectionChecklist.testCertificateNumber})` : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`w-4 h-4 border flex items-center justify-center font-bold text-[10px] ${grn.inspectionChecklist.materialsMeetSpecs ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'}`}>
              {grn.inspectionChecklist.materialsMeetSpecs ? '✓' : '✗'}
            </span>
            <span>Materials strictly meet approved engineering specifications</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`w-4 h-4 border flex items-center justify-center font-bold text-[10px] ${grn.inspectionChecklist.binTagsAttached ? 'bg-green-600 text-white border-green-600' : 'bg-gray-200 text-gray-500 border-gray-400'}`}>
              {grn.inspectionChecklist.binTagsAttached ? '✓' : '-'}
            </span>
            <span>Bin tags & identification stock labels attached to pallets/bundles</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`w-4 h-4 border flex items-center justify-center font-bold text-[10px] ${grn.inspectionChecklist.discrepancyIdentified ? 'bg-red-600 text-white border-red-600' : 'bg-green-600 text-white border-green-600'}`}>
              {grn.inspectionChecklist.discrepancyIdentified ? '!' : '✓'}
            </span>
            <span>
              Discrepancy Status: <strong>{grn.inspectionChecklist.discrepancyIdentified ? 'Discrepancy Identified' : 'Clean Receipt (No Discrepancy)'}</strong>
            </span>
          </div>
        </div>

        {grn.inspectionChecklist.debitNoteRequired && (
          <div className="mt-3 p-2 bg-red-100 border border-red-300 text-red-900 rounded-none text-xs">
            <strong>DEBIT NOTE RECOMMENDED:</strong> {grn.inspectionChecklist.debitNoteReason || 'Discrepant quantity/damaged goods to be adjusted against supplier invoice.'}
          </div>
        )}

        {grn.inspectionChecklist.inspectionRemarks && (
          <div className="mt-2 text-gray-600 italic">
            Inspector Remarks: {grn.inspectionChecklist.inspectionRemarks}
          </div>
        )}
      </div>

      {/* Official Dual-Control Sign-Off Matrix */}
      <div className="grid grid-cols-4 gap-4 border border-gray-300 p-4 text-xs">
        <div className="border-r border-gray-200 pr-2">
          <div className="font-bold text-gray-700 uppercase mb-1">1. Received Physical Intake</div>
          <div className="h-10 border-b border-gray-300 mb-2"></div>
          <div className="font-semibold text-gray-900">{grn.receivedByName}</div>
          <div className="text-[10px] text-gray-500">Storekeeper / Yard Clerk</div>
          <div className="text-[10px] text-gray-400">{new Date(grn.createdAtUtc).toLocaleDateString()}</div>
        </div>

        <div className="border-r border-gray-200 pr-2">
          <div className="font-bold text-gray-700 uppercase mb-1">2. QA Inspection</div>
          <div className="h-10 border-b border-gray-300 mb-2"></div>
          <div className="font-semibold text-gray-900">{grn.inspectedByName || 'Pending Inspection'}</div>
          <div className="text-[10px] text-gray-500">Site Quality Inspector</div>
          <div className="text-[10px] text-gray-400">{grn.inspectedAtUtc ? new Date(grn.inspectedAtUtc).toLocaleDateString() : '-'}</div>
        </div>

        <div className="border-r border-gray-200 pr-2">
          <div className="font-bold text-gray-700 uppercase mb-1">3. Supervisory Dual-Approval</div>
          <div className="h-10 border-b border-gray-300 mb-2"></div>
          <div className="font-semibold text-gray-900">{grn.approvedByName || 'Pending Approval'}</div>
          <div className="text-[10px] text-gray-500">Inventory / Project Manager</div>
          <div className="text-[10px] text-gray-400">{grn.approvedAtUtc ? new Date(grn.approvedAtUtc).toLocaleDateString() : '-'}</div>
        </div>

        <div>
          <div className="font-bold text-gray-700 uppercase mb-1">4. Receipt Ledger Posting</div>
          <div className="h-10 border-b border-gray-300 mb-2"></div>
          <div className="font-semibold text-gray-900">{grn.postedByName || 'Unposted'}</div>
          <div className="text-[10px] text-gray-500">Posting Controller</div>
          <div className="text-[10px] text-gray-400">{grn.postedAtUtc ? new Date(grn.postedAtUtc).toLocaleDateString() : '-'}</div>
        </div>
      </div>

      {/* SCM-F-01 Distribution Copies Footer */}
      <div className="mt-6 pt-4 border-t border-gray-300 flex justify-between text-[10px] text-gray-500 uppercase">
        <div>Distribution: Copy 1: Stores Physical File &bull; Copy 2: Accounts Payable &bull; Copy 3: Supplier / Carrier</div>
        <div>System Stamped: {new Date().toISOString()}</div>
      </div>
    </div>
  );
};
