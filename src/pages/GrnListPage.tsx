import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Plus,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { StatusBadge } from '../components/common/StatusBadge';
import { StatCard } from '../components/common/StatCard';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../app/useAuth';
import {
  grnService,
  GoodsReceivedNoteDto,
  GrnSummaryMetrics,
} from '../services/api/grnService';
import { purchaseOrderService, PurchaseOrderDto } from '../services/api/purchaseOrderService';

export const GrnListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [grns, setGrns] = useState<GoodsReceivedNoteDto[]>([]);
  const [metrics, setMetrics] = useState<GrnSummaryMetrics>({
    totalCount: 0,
    draftCount: 0,
    pendingInspectionCount: 0,
    inspectedCount: 0,
    approvedCount: 0,
    postedCount: 0,
    totalAcceptedValue: 0,
  });

  const [eligiblePos, setEligiblePos] = useState<PurchaseOrderDto[]>([]);
  const [selectedPo, setSelectedPo] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canCreateGrn = hasRole(['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProcurementOfficer']);

  const fetchGrns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [grnResult, poResult] = await Promise.all([
        grnService.getGrns({
          search: searchQuery || undefined,
          purchaseOrderId: selectedPo !== 'ALL' ? selectedPo : undefined,
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        }),
        purchaseOrderService.getPurchaseOrders({ status: 'ALL' }),
      ]);

      setGrns(grnResult.items || []);
      if (grnResult.metrics) {
        setMetrics(grnResult.metrics);
      }
      // Filter POs eligible for receiving (Issued or PartiallyReceived)
      const eligible = (poResult.items || []).filter(
        (p) => p.status === 'Issued' || p.status === 'PartiallyReceived'
      );
      setEligiblePos(eligible);
    } catch (err: any) {
      console.error('Failed to load Goods Received Notes:', err);
      setError(err?.message || 'Unable to retrieve Goods Received Notes list');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedPo, selectedStatus]);

  useEffect(() => {
    fetchGrns();
  }, [fetchGrns]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGrns();
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Dashboard', onClick: () => navigate('/dashboard') },
        { label: 'Goods Receiving' },
      ]}
      title="Goods Received Notes (GRN)"
      description="Physical delivery intake, tally counting, SCM-F-01 QA inspection, and durable stock receipt ledger control."
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fetchGrns}
            icon={<RefreshCw size={15} />}
          >
            Refresh
          </Button>
          {canCreateGrn && (
            <Button
              variant="primary"
              onClick={() => navigate('/grns/new')}
              icon={<Plus size={16} />}
              style={{ backgroundColor: 'var(--color-primary, #DD6B20)', borderColor: '#DD6B20' }}
            >
              New Goods Receipt
            </Button>
          )}
        </div>
      }
    >
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="Total GRNs"
          value={metrics.totalCount}
          icon={<Truck size={18} className="text-gray-700" />}
        />
        <StatCard
          label="Drafts"
          value={metrics.draftCount}
          icon={<FileText size={18} className="text-gray-500" />}
        />
        <StatCard
          label="Pending Inspection"
          value={metrics.pendingInspectionCount}
          icon={<Clock size={18} className="text-yellow-600" />}
        />
        <StatCard
          label="Inspected"
          value={metrics.inspectedCount}
          icon={<ShieldCheck size={18} className="text-blue-600" />}
        />
        <StatCard
          label="Approved"
          value={metrics.approvedCount}
          icon={<CheckCircle2 size={18} className="text-purple-600" />}
        />
        <StatCard
          label="Posted to Ledger"
          value={metrics.postedCount}
          icon={<Layers size={18} className="text-green-600" />}
          meta={<span className="text-xs text-gray-500 font-mono">{metrics.totalAcceptedValue > 0 ? `$${metrics.totalAcceptedValue.toLocaleString()}` : '$0.00'}</span>}
        />
      </div>

      {/* Eligible POs Notification Banner */}
      {eligiblePos.length > 0 && (
        <div className="mb-6 bg-orange-50 border border-orange-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-[#DD6B20] text-white flex items-center justify-center font-bold">
              {eligiblePos.length}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                {eligiblePos.length} Purchase Order{eligiblePos.length > 1 ? 's' : ''} Ready for Physical Receipt
              </h4>
              <p className="text-xs text-gray-600">
                Issued commercial contracts with open outstanding quantities awaiting site delivery tally.
              </p>
            </div>
          </div>
          {canCreateGrn && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/grns/new')}
              icon={<ArrowRight size={14} />}
              iconPosition="right"
            >
              Receive Stock
            </Button>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="mb-6">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center flex-1">
            <div className="relative min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search GRN #, PO #, Challan #, Supplier, Vehicle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-[#DD6B20]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 uppercase">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-[#DD6B20] bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="SubmittedForInspection">Submitted For Inspection</option>
                <option value="Inspected">Inspected (QA Passed)</option>
                <option value="Approved">Approved</option>
                <option value="Posted">Posted to Receipt Ledger</option>
                <option value="ReturnedForCorrection">Returned for Correction</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 uppercase">Purchase Order:</span>
              <select
                value={selectedPo}
                onChange={(e) => setSelectedPo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-[#DD6B20] bg-white max-w-[240px]"
              >
                <option value="ALL">All Purchase Orders</option>
                {eligiblePos.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} — {po.supplierName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" variant="primary">
            Apply Filters
          </Button>
        </form>
      </Card>

      {/* Error View */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-300 text-red-900 text-sm flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* GRN Table */}
      {isLoading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner label="Loading Goods Received Notes..." />
        </div>
      ) : grns.length === 0 ? (
        <EmptyState
          title="No Goods Received Notes Found"
          description={
            searchQuery || selectedStatus !== 'ALL' || selectedPo !== 'ALL'
              ? 'No records match the active search filter criteria.'
              : 'No Goods Received Notes have been created yet. When deliveries arrive at site, create a GRN against an issued Purchase Order.'
          }
          action={
            canCreateGrn && (
              <Button
                variant="primary"
                onClick={() => navigate('/grns/new')}
                icon={<Plus size={16} />}
              >
                Create First Goods Receipt
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[#2D3748] text-white text-xs uppercase font-semibold border-b border-gray-300">
                  <th className="py-3 px-4">GRN Number</th>
                  <th className="py-3 px-4">Purchase Order</th>
                  <th className="py-3 px-4">Supplier / Challan</th>
                  <th className="py-3 px-4">Receiving Yard</th>
                  <th className="py-3 px-4 text-center">Receipt Date</th>
                  <th className="py-3 px-4 text-right">Delivered / Accepted</th>
                  <th className="py-3 px-4 text-right">Accepted Value</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {grns.map((grn) => {
                  const hasDiscrepancy = grn.inspectionChecklist?.discrepancyIdentified || grn.totalRejectedQuantity > 0;
                  return (
                    <tr
                      key={grn.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/grns/${grn.id}`)}
                    >
                      <td className="py-3 px-4 font-bold text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#DD6B20] hover:underline">{grn.grnNumber}</span>
                          {hasDiscrepancy && (
                            <span
                              title="Discrepancy / Damage Recorded"
                              className="text-xs px-1 bg-red-100 text-red-800 border border-red-300 font-semibold"
                            >
                              DISCREPANCY
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 font-normal">
                          By: {grn.receivedByName}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{grn.purchaseOrderNumber}</div>
                        <div className="text-xs text-gray-500">{grn.projectName}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 truncate max-w-[200px]" title={grn.supplierName}>
                          {grn.supplierName}
                        </div>
                        <div className="text-xs text-gray-500">
                          Challan: <span className="font-mono text-gray-700">{grn.deliveryChallanNumber}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-gray-900 font-medium">{grn.warehouseName}</div>
                        <div className="text-xs text-gray-500">Veh: {grn.vehicleNumber}</div>
                      </td>

                      <td className="py-3 px-4 text-center text-xs text-gray-600">
                        <div>{grn.grnDate}</div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(grn.receivedAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="font-semibold text-gray-900">
                          {grn.totalAcceptedQuantity} <span className="text-xs text-gray-500 font-normal">/ {grn.totalDeliveredQuantity}</span>
                        </div>
                        {grn.totalRejectedQuantity > 0 && (
                          <div className="text-xs text-red-600 font-medium">
                            {grn.totalRejectedQuantity} rejected
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-gray-900">
                        ${grn.totalAcceptedValue.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={grn.status} />
                      </td>

                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/grns/${grn.id}`)}
                            icon={<Eye size={13} />}
                          >
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppLayout>
  );
};
