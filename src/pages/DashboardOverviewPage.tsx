import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  Truck,
  ArrowLeftRight,
  TrendingUp,
  FileSpreadsheet,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  FileCheck,
  Building,
  Warehouse,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { StatCard } from '../components/common/StatCard';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { StatusBadge } from '../components/common/StatusBadge';
import { useNavigation } from '../app/NavigationContext';
import { useAuth } from '../app/AuthContext';

interface LedgerMovement {
  id: string;
  txRef: string;
  timestampUtc: string;
  type: 'GRN' | 'ISSUE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'RETURN';
  materialCode: string;
  materialName: string;
  quantity: string;
  uom: string;
  weightedAvgCost: string;
  totalValue: string;
  location: string;
  status: 'POSTED' | 'IN_TRANSIT' | 'PENDING_APPROVAL';
}

interface LocationSummary {
  id: string;
  name: string;
  code: string;
  project: string;
  totalSkus: number;
  valuation: string;
  status: string;
}

interface LowStockItem {
  id: string;
  code: string;
  name: string;
  currentStock: number;
  safetyThreshold: number;
  reorderPoint: number;
  uom: string;
  deficiency: number;
}

const mockMovements: LedgerMovement[] = [
  {
    id: 'TX-10091',
    txRef: 'GRN-2026-0492',
    timestampUtc: '2026-10-27 11:42 UTC',
    type: 'GRN',
    materialCode: 'STEEL-REBAR-T16',
    materialName: 'High-Tensile Deformed Rebar 16mm (Grade 500)',
    quantity: '+14.500',
    uom: 'MT',
    weightedAvgCost: '$782.40',
    totalValue: '$11,344.80',
    location: 'Metro North Site Store',
    status: 'POSTED',
  },
  {
    id: 'TX-10090',
    txRef: 'ISS-2026-0188',
    timestampUtc: '2026-10-27 09:15 UTC',
    type: 'ISSUE',
    materialCode: 'CEM-OPC-50KG',
    materialName: 'Ordinary Portland Cement (CEM I 42.5N)',
    quantity: '-420.000',
    uom: 'Bags',
    weightedAvgCost: '$6.85',
    totalValue: '$2,877.00',
    location: 'Metro North Site Store',
    status: 'POSTED',
  },
  {
    id: 'TX-10089',
    txRef: 'TRF-2026-0041',
    timestampUtc: '2026-10-27 07:50 UTC',
    type: 'TRANSFER_OUT',
    materialCode: 'PIPE-PVC-110MM',
    materialName: 'Heavy Duty Underground PVC Drainage Pipe 110mm x 6m',
    quantity: '-80.000',
    uom: 'Lengths',
    weightedAvgCost: '$24.30',
    totalValue: '$1,944.00',
    location: 'Central Yard → Pier Depot',
    status: 'IN_TRANSIT',
  },
  {
    id: 'TX-10088',
    txRef: 'RET-2026-0012',
    timestampUtc: '2026-10-26 16:30 UTC',
    type: 'RETURN',
    materialCode: 'FORM-PLY-18MM',
    materialName: 'Film-Faced Shuttering Plywood 18mm 2440x1220mm',
    quantity: '+35.000',
    uom: 'Sheets',
    weightedAvgCost: '$38.20',
    totalValue: '$1,337.00',
    location: 'Metro North Site Store',
    status: 'POSTED',
  },
];

const locationOverviews: LocationSummary[] = [
  {
    id: 'LOC-1',
    name: 'Central Holding Yard',
    code: 'WH-CENTRAL',
    project: 'PRJ-METRO-01',
    totalSkus: 382,
    valuation: '$894,320.00',
    status: 'Optimal',
  },
  {
    id: 'LOC-2',
    name: 'Metro North Site Store',
    code: 'WH-SITE-A',
    project: 'PRJ-METRO-01',
    totalSkus: 214,
    valuation: '$384,150.50',
    status: 'Active Issuance',
  },
  {
    id: 'LOC-3',
    name: 'Viaduct Pier Staging Depot',
    code: 'WH-SITE-B',
    project: 'PRJ-BRIDGE-04',
    totalSkus: 94,
    valuation: '$204,460.00',
    status: 'Transfers Pending',
  },
];

const lowStockItems: LowStockItem[] = [
  {
    id: 'L1',
    code: 'CEM-OPC-50KG',
    name: 'Ordinary Portland Cement 50kg Bags',
    currentStock: 80,
    safetyThreshold: 200,
    reorderPoint: 350,
    uom: 'Bags',
    deficiency: 120,
  },
  {
    id: 'L2',
    code: 'AGG-CRUSH-20MM',
    name: 'Coarse Aggregate 20mm Nominal',
    currentStock: 18.5,
    safetyThreshold: 40.0,
    reorderPoint: 60.0,
    uom: 'MT',
    deficiency: 21.5,
  },
  {
    id: 'L3',
    code: 'TIE-WIRE-16G',
    name: 'Black Annealed Rebar Tying Wire 16 Gauge',
    currentStock: 6,
    safetyThreshold: 25,
    reorderPoint: 40,
    uom: 'Rolls',
    deficiency: 19,
  },
];

export const DashboardOverviewPage: React.FC = () => {
  const { activeProject, activeWarehouse } = useNavigation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredMovements = filterType === 'ALL'
    ? mockMovements
    : mockMovements.filter((m) => m.type.startsWith(filterType));

  const getMovementBadge = (type: LedgerMovement['type']) => {
    switch (type) {
      case 'GRN':
        return <Badge variant="success">GRN Receipt</Badge>;
      case 'ISSUE':
        return <Badge variant="orange">Issue to Job</Badge>;
      case 'TRANSFER_IN':
      case 'TRANSFER_OUT':
        return <Badge variant="transit">Inter-Site Transfer</Badge>;
      case 'RETURN':
        return <Badge variant="neutral">Site Return</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'StructStock', onClick: () => navigate('/dashboard') },
        { label: activeProject.code },
        { label: 'Project Dashboard', active: true },
      ]}
      title="Project Stock & Inventory Ledger"
      description={`Overview of material assets, weighted-average stock valuations, and active custody transfers under ${activeProject.name}.`}
      actions={
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            icon={<FileSpreadsheet size={16} />}
            onClick={() => navigate('/stock-ledger')}
          >
            Authoritative Ledger
          </Button>
          <Button
            variant="secondary"
            icon={<ArrowLeftRight size={16} />}
            onClick={() => navigate('/stock-transfers')}
          >
            Inter-Site Transfer
          </Button>
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => navigate('/requisitions')}
          >
            New Requisition
          </Button>
        </div>
      }
    >
      {/* 5 Responsive KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <StatCard
          label="Total Material Items"
          value="486 SKUs"
          accent="charcoal"
          icon={<Boxes size={18} />}
          meta={<span>Master data registry across 14 categories</span>}
        />
        <StatCard
          label="Total Inventory Value"
          value="$1,482,930.50"
          accent="orange"
          icon={<TrendingUp size={18} />}
          meta={
            <>
              <CheckCircle2 size={13} style={{ color: 'var(--color-success-text)' }} />
              <span>Weighted-Average Cost (WAC)</span>
            </>
          }
        />
        <StatCard
          label="Pending Requisitions"
          value="7 Requests"
          accent="orange"
          icon={<Clock size={18} />}
          meta={<span style={{ color: 'var(--color-orange-600)', fontWeight: 600 }}>3 Awaiting Project Manager Sign-Off</span>}
        />
        <StatCard
          label="Open Purchase Orders"
          value="4 POs Active"
          accent="transit"
          icon={<FileCheck size={18} />}
          meta={<span>Vendor deliveries due this week</span>}
        />
        <StatCard
          label="Low-Stock Items"
          value="18 SKUs"
          accent="orange"
          icon={<AlertTriangle size={18} />}
          meta={<span style={{ color: 'var(--color-danger-text)', fontWeight: 600 }}>Below safety reserve threshold</span>}
        />
      </div>

      {/* Two Column Layout: Location Overview + Pending Approvals */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Stock Overview by Location */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Warehouse size={18} style={{ color: 'var(--color-orange-500)' }} />
              <span>Stock Overview by Project Location</span>
            </div>
          }
          subtitle="Physical holding facilities and warehouse valuation distribution"
          actions={
            <Button
              variant="ghost"
              size="sm"
              icon={<ExternalLink size={14} />}
              onClick={() => navigate('/warehouses')}
            >
              All Locations
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {locationOverviews.map((loc) => (
              <div
                key={loc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface-hover)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>
                    {loc.name}
                  </div>
                  <div className="td-mono" style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)' }}>
                    {loc.code} • {loc.totalSkus} SKUs in stock
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="td-mono" style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>
                    {loc.valuation}
                  </div>
                  <Badge variant="success" showDot={false}>{loc.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Pending Approvals & Low-Stock Alerts */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Clock size={18} style={{ color: 'var(--color-orange-500)' }} />
              <span>Pending Governance Approvals</span>
            </div>
          }
          subtitle="Requests requiring authorization before stock issuance"
          actions={
            <Button
              variant="ghost"
              size="sm"
              icon={<ChevronRight size={14} />}
              onClick={() => navigate('/approvals')}
            >
              Approval Queue (3)
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div
              style={{
                padding: 'var(--space-3)',
                borderLeft: '3px solid var(--color-orange-500)',
                backgroundColor: 'var(--color-orange-100)',
                borderRadius: '0 var(--radius-md) var(--radius-md) 0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="td-mono" style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                  REQ-2026-0089
                </span>
                <Badge variant="orange">Site Requisition</Badge>
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-charcoal-900)', marginTop: 2 }}>
                14.5 MT Deformed Rebar 16mm for Foundation Pour
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                Requested by Site Eng. J. Miller • Cost Estimate: $11,344.80
              </div>
            </div>

            <div
              style={{
                padding: 'var(--space-3)',
                borderLeft: '3px solid #319795',
                backgroundColor: 'var(--color-transit-bg)',
                borderRadius: '0 var(--radius-md) var(--radius-md) 0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="td-mono" style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)' }}>
                  TRF-2026-0041
                </span>
                <Badge variant="transit">Inter-Site Transfer</Badge>
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-charcoal-900)', marginTop: 2 }}>
                80 Lengths PVC Drainage Pipe 110mm x 6m
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                Dispatched from Central Yard → Pending Pier Depot Receipt
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Authoritative Stock Ledger Activity */}
      <Card
        title="Authoritative Inventory Movement Activity"
        subtitle={`Real-time ledger stream reconciled with ${activeWarehouse.name} balances.`}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <select
              className="form-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: 'var(--font-size-xs)' }}
              aria-label="Filter ledger movement types"
            >
              <option value="ALL">All Ledger Movements</option>
              <option value="GRN">Goods Received (GRN)</option>
              <option value="ISSUE">Material Issues</option>
              <option value="TRANSFER">Inter-Site Transfers</option>
              <option value="RETURN">Site Returns</option>
            </select>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileSpreadsheet size={14} />}
              onClick={() => navigate('/stock-ledger')}
            >
              View Full Ledger
            </Button>
          </div>
        }
      >
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tx Reference</th>
                <th>UTC Timestamp</th>
                <th>Movement Type</th>
                <th>Material SKU & Description</th>
                <th style={{ textAlign: 'right' }}>Qty / UoM</th>
                <th style={{ textAlign: 'right' }}>Unit Cost (WAC)</th>
                <th style={{ textAlign: 'right' }}>Total Value</th>
                <th>Location / Depot</th>
                <th>Ledger Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((tx) => (
                <tr key={tx.id}>
                  <td className="td-mono" style={{ fontWeight: 600 }}>{tx.txRef}</td>
                  <td className="td-mono" style={{ color: 'var(--color-text-subtle)', fontSize: '0.75rem' }}>
                    {tx.timestampUtc}
                  </td>
                  <td>{getMovementBadge(tx.type)}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>
                      {tx.materialName}
                    </div>
                    <div className="td-mono" style={{ color: 'var(--color-text-subtle)', fontSize: '0.75rem' }}>
                      {tx.materialCode}
                    </div>
                  </td>
                  <td className="td-numeric" style={{ fontWeight: 600 }}>
                    <span style={{ color: tx.quantity.startsWith('+') ? '#22543D' : '#742A2A' }}>
                      {tx.quantity} {tx.uom}
                    </span>
                  </td>
                  <td className="td-numeric">{tx.weightedAvgCost}</td>
                  <td className="td-numeric" style={{ fontWeight: 600 }}>{tx.totalValue}</td>
                  <td>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {tx.location}
                    </span>
                  </td>
                  <td>
                    {tx.status === 'POSTED' ? (
                      <Badge variant="success">Posted</Badge>
                    ) : tx.status === 'IN_TRANSIT' ? (
                      <Badge variant="transit">In-Transit</Badge>
                    ) : (
                      <Badge variant="warning">Pending</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Low-Stock Safety Threshold Alerts */}
      <Card
        title="Low-Stock Critical Threshold Alerts"
        subtitle="Materials below minimum safety levels requiring procurement requisition"
        style={{ marginTop: 'var(--space-6)' }}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => navigate('/requisitions')}
          >
            Create Replenishment
          </Button>
        }
      >
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU Code</th>
                <th>Material Description</th>
                <th style={{ textAlign: 'right' }}>Current Stock</th>
                <th style={{ textAlign: 'right' }}>Safety Threshold</th>
                <th style={{ textAlign: 'right' }}>Reorder Target</th>
                <th style={{ textAlign: 'right' }}>Deficiency Deficit</th>
                <th>Action Recommended</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map((item) => (
                <tr key={item.id}>
                  <td className="td-mono" style={{ fontWeight: 600 }}>{item.code}</td>
                  <td style={{ fontWeight: 500 }}>{item.name}</td>
                  <td className="td-numeric" style={{ color: 'var(--color-danger-text)', fontWeight: 700 }}>
                    {item.currentStock} {item.uom}
                  </td>
                  <td className="td-numeric">{item.safetyThreshold} {item.uom}</td>
                  <td className="td-numeric">{item.reorderPoint} {item.uom}</td>
                  <td className="td-numeric" style={{ color: 'var(--color-orange-600)', fontWeight: 600 }}>
                    -{item.deficiency} {item.uom}
                  </td>
                  <td>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate('/requisitions')}
                    >
                      Requisition
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppLayout>
  );
};
