import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Boxes,
  Warehouse,
  Building2,
  Clock,
  RefreshCw,
  FileSpreadsheet,
  TrendingUp,
  PieChart,
  Layers,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import { AppLayout } from '../layouts/AppLayout';
import {
  inventoryService,
  InventoryValuationData,
} from '../services/api/inventoryService';
import { useNavigate } from 'react-router-dom';

const EMPTY_SUMMARY: InventoryValuationData['summary'] = {
  totalInventoryValue: 0,
  totalQuantityOnHand: 0,
  distinctMaterials: 0,
  activeLocations: 0,
  asOfTimestampUtc: '',
};

export const InventoryValuationPage: React.FC = () => {
  const navigate = useNavigate();
  const [valuationData, setValuationData] = useState<InventoryValuationData | null>(null);
  const [activeTab, setActiveTab] = useState<'material' | 'warehouse' | 'project'>('material');

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchValuation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await inventoryService.getValuation({
        warehouseId: selectedWarehouse,
        projectId: selectedProject,
      });

      if (res.success && res.data) {
        const raw = res.data as InventoryValuationData & {
          totalInventoryValue?: number;
          totalQuantityOnHand?: number;
        };
        setValuationData({
          byMaterial: raw.byMaterial || [],
          byWarehouse: raw.byWarehouse || [],
          byProject: raw.byProject || [],
          summary: {
            totalInventoryValue:
              raw.summary?.totalInventoryValue ?? raw.totalInventoryValue ?? 0,
            totalQuantityOnHand:
              raw.summary?.totalQuantityOnHand ?? raw.totalQuantityOnHand ?? 0,
            distinctMaterials: raw.summary?.distinctMaterials ?? raw.byMaterial?.length ?? 0,
            activeLocations: raw.summary?.activeLocations ?? raw.byWarehouse?.length ?? 0,
            asOfTimestampUtc: raw.summary?.asOfTimestampUtc || new Date().toISOString(),
          },
        });
      } else {
        setError(res.message || 'Failed to load inventory valuation.');
        setValuationData(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server.');
      setValuationData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedWarehouse, selectedProject]);

  useEffect(() => {
    fetchValuation();
  }, [fetchValuation]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const formatCost = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
    }).format(val || 0);
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'N/A';
    try {
      return new Date(isoStr).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return isoStr;
    }
  };

  const summary = valuationData?.summary ?? EMPTY_SUMMARY;
  const totalValue = summary.totalInventoryValue || 0;

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Dashboard', onClick: () => navigate('/dashboard') },
        { label: 'Reports', onClick: () => navigate('/reports') },
        { label: 'Inventory Valuation', active: true },
      ]}
      title="Inventory Valuation (Moving WAC)"
      description="Financial inventory balance valued strictly using continuous moving weighted-average costing per SOP SCM-F-01"
      actions={
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={15} />}
            onClick={fetchValuation}
            isLoading={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileSpreadsheet size={15} />}
            onClick={() => window.print()}
          >
            Export Report
          </Button>
        </div>
      }
    >
      {/* Valuation Summary KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard
          label="Total Inventory Valuation"
          value={formatCurrency(totalValue)}
          icon={<DollarSign size={20} />}
          accent="orange"
          meta="Perpetual Moving WAC Rollup"
        />
        <StatCard
          label="Total On-Hand Quantity"
          value={(summary.totalQuantityOnHand || 0).toLocaleString('en-US')}
          icon={<Boxes size={20} />}
          accent="charcoal"
          meta={`${summary.distinctMaterials || 0} Stocked Material Masters`}
        />
        <StatCard
          label="Active Locations"
          value={summary.activeLocations || 0}
          icon={<Warehouse size={20} />}
          accent="charcoal"
          meta="Distinct Warehouse & Site Yards"
        />
        <StatCard
          label="Valuation As-Of Timestamp"
          value={summary.asOfTimestampUtc ? 'Current UTC' : 'N/A'}
          icon={<Clock size={20} />}
          accent="success"
          meta={formatDate(summary.asOfTimestampUtc)}
        />
      </div>

      {/* Filter Card */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
            alignItems: 'end',
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-charcoal-700)',
                marginBottom: 'var(--space-1)',
              }}
            >
              Filter Warehouse / Yard
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--color-charcoal-300)',
                padding: '0 10px',
                fontSize: '0.875rem',
              }}
            >
              <option value="ALL">All Warehouses & Yards</option>
              <option value="WH-01">WH-01: Metro Central Staging Yard</option>
              <option value="WH-02">WH-02: North Industrial Depot & Yard</option>
              <option value="WH-03">WH-03: East Harbor Transit Hub</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-charcoal-700)',
                marginBottom: 'var(--space-1)',
              }}
            >
              Filter Project Site
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--color-charcoal-300)',
                padding: '0 10px',
                fontSize: '0.875rem',
              }}
            >
              <option value="ALL">All Project Sites</option>
              <option value="PRJ-101">PRJ-101: Metro Rail Line 3 Extension</option>
              <option value="PRJ-102">PRJ-102: Harbor Commercial Docklands</option>
              <option value="PRJ-103">PRJ-103: Skyline Corporate Towers</option>
            </select>
          </div>

          <div
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-charcoal-600)',
              paddingBottom: '8px',
            }}
          >
            <strong>Valuation Precision:</strong> Unit costs calculated with 4-decimal precision; totals rounded to 2 decimal places.
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '2px solid var(--color-charcoal-200)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <button
          onClick={() => setActiveTab('material')}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: 'none',
            background: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'material' ? '3px solid var(--color-orange-500)' : 'none',
            color: activeTab === 'material' ? 'var(--color-orange-600)' : 'var(--color-charcoal-600)',
          }}
        >
          By Material Master ({valuationData?.byMaterial.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('warehouse')}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: 'none',
            background: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'warehouse' ? '3px solid var(--color-orange-500)' : 'none',
            color: activeTab === 'warehouse' ? 'var(--color-orange-600)' : 'var(--color-charcoal-600)',
          }}
        >
          By Warehouse / Yard ({valuationData?.byWarehouse.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('project')}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: 'none',
            background: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'project' ? '3px solid var(--color-orange-500)' : 'none',
            color: activeTab === 'project' ? 'var(--color-orange-600)' : 'var(--color-charcoal-600)',
          }}
        >
          By Project Site ({valuationData?.byProject.length || 0})
        </button>
      </div>

      {isLoading ? (
        <Card>
          <LoadingSpinner label="Compiling inventory valuation rollups..." />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState
            title="Error Loading Valuation"
            description={error}
            action={
              <Button variant="secondary" size="sm" onClick={fetchValuation}>
                Retry Request
              </Button>
            }
          />
        </Card>
      ) : activeTab === 'material' ? (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material Code & Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Total Quantity</th>
                  <th>UoM</th>
                  <th style={{ textAlign: 'right' }}>Weighted Avg Cost ($)</th>
                  <th style={{ textAlign: 'right' }}>Total Valuation ($)</th>
                  <th style={{ textAlign: 'center' }}>Locations</th>
                </tr>
              </thead>
              <tbody>
                {valuationData?.byMaterial.map((m) => (
                  <tr key={m.materialId}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>
                        {m.materialCode}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-600)' }}>
                        {m.materialName}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-secondary">{m.categoryName}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {m.totalQuantity.toLocaleString('en-US')}
                    </td>
                    <td>{m.unitCode}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCost(m.averageCost)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: 'var(--color-orange-700)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {formatCurrency(m.totalValue)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-outline">{m.locationCount} Yards</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : activeTab === 'warehouse' ? (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Warehouse / Storage Yard</th>
                  <th style={{ textAlign: 'center' }}>Stocked Items</th>
                  <th style={{ textAlign: 'right' }}>Total On-Hand Quantity</th>
                  <th style={{ textAlign: 'right' }}>Total Valuation ($)</th>
                  <th style={{ textAlign: 'right' }}>% of Inventory</th>
                </tr>
              </thead>
              <tbody>
                {(valuationData?.byWarehouse || []).map((w) => {
                  const pct =
                    totalValue > 0
                      ? ((w.totalValue / totalValue) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <tr key={w.locationId}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Warehouse size={16} style={{ color: 'var(--color-charcoal-600)' }} />
                          {w.locationName}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-secondary">{w.itemCount} SKUs</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {w.totalQuantity.toLocaleString('en-US')}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: 'var(--color-orange-700)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {formatCurrency(w.totalValue)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project Site Location</th>
                  <th style={{ textAlign: 'center' }}>Stocked Items</th>
                  <th style={{ textAlign: 'right' }}>Total On-Hand Quantity</th>
                  <th style={{ textAlign: 'right' }}>Total Valuation ($)</th>
                  <th style={{ textAlign: 'right' }}>% of Inventory</th>
                </tr>
              </thead>
              <tbody>
                {(valuationData?.byProject || []).map((p) => {
                  const pct =
                    totalValue > 0
                      ? ((p.totalValue / totalValue) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <tr key={p.locationId}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Building2 size={16} style={{ color: 'var(--color-orange-600)' }} />
                          {p.locationName}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-secondary">{p.itemCount} SKUs</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {p.totalQuantity.toLocaleString('en-US')}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: 'var(--color-orange-700)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {formatCurrency(p.totalValue)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{pct}%</td>
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
