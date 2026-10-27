import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Layers,
  RefreshCw,
  CheckCircle2,
  Building2,
  Warehouse,
  Scale,
  Truck,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingState, ErrorState } from '../components/common/StateViews';
import { apiClient } from '../services/api/apiClient';
import {
  materialService,
  MaterialCategory,
  UnitOfMeasure,
  UnitConversion,
} from '../services/api/materialService';
import { ProjectDto } from '../services/api/requisitionService';

export interface ModulePlaceholderProps {
  moduleName: string;
  category: string;
  description: string;
  targetPrompt: string;
  businessCapabilities: string[];
}

interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
  type: string;
  projectId: string;
  projectName: string;
  location: string;
  isActive: boolean;
  skuCount: number;
}

interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  projectName: string;
  supplierName: string;
  expectedDeliveryDate?: string;
  status: string;
}

interface SystemSettingsRecord {
  valuationPolicy: string;
  valuationDescription: string;
  negativeStockAllowed: boolean;
  selfApprovalAllowed: boolean;
  requireGrnInspectionBeforePosting: boolean;
  jwtExpirySeconds: number;
  currency: string;
  auditTrailRetentionDays: number;
}

export const ModulePlaceholderPage: React.FC<ModulePlaceholderProps> = ({
  moduleName,
  category,
  description,
  businessCapabilities,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PurchaseOrderSummary[]>([]);
  const [settings, setSettings] = useState<SystemSettingsRecord | null>(null);

  const loadModuleData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (path === '/material-categories') {
        const res = await materialService.getCategories();
        setCategories(res.data || []);
      } else if (path === '/units') {
        const [uRes, cRes] = await Promise.all([
          materialService.getUnits(),
          materialService.getUnitConversions(),
        ]);
        setUnits(uRes.data || []);
        setConversions(cRes.data || []);
      } else if (path === '/projects') {
        const res = await apiClient.get<ProjectDto[]>('/projects');
        setProjects(res.data || []);
      } else if (path === '/warehouses') {
        const res = await apiClient.get<WarehouseRecord[]>('/warehouses');
        setWarehouses(res.data || []);
      } else if (path === '/pending-deliveries') {
        const res = await apiClient.get<{ items?: PurchaseOrderSummary[] } | PurchaseOrderSummary[]>(
          '/purchase-orders'
        );
        const payload = res.data;
        const list: PurchaseOrderSummary[] = Array.isArray(payload)
          ? payload
          : payload?.items || [];
        setPendingOrders(
          list.filter((po: PurchaseOrderSummary) =>
            ['Issued', 'Approved', 'PartiallyReceived', 'SentToSupplier'].includes(po.status)
          )
        );
      } else if (path === '/settings') {
        const res = await apiClient.get<SystemSettingsRecord>('/settings');
        setSettings(res.data || null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load module data');
    } finally {
      setIsLoading(false);
    }
  }, [path]);

  useEffect(() => {
    loadModuleData();
  }, [loadModuleData]);

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'StructStock', onClick: () => navigate('/dashboard') },
        { label: category },
        { label: moduleName, active: true },
      ]}
      title={moduleName}
      description={description}
      badge={<Badge variant="success">Active Workspace</Badge>}
      actions={
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button
            variant="secondary"
            icon={<RefreshCw size={16} />}
            onClick={loadModuleData}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </Button>
          <Button
            variant="primary"
            icon={<BookOpen size={16} />}
            onClick={() => navigate('/architecture')}
          >
            Architecture
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
        {isLoading ? (
          <Card>
            <LoadingState label={`Loading ${moduleName}...`} />
          </Card>
        ) : error ? (
          <Card>
            <ErrorState title={`Failed to load ${moduleName}`} message={error} onRetry={loadModuleData} />
          </Card>
        ) : (
          <>
            {path === '/material-categories' && (
              <Card
                title="Material Categories & Taxonomy"
                subtitle={`${categories.length} standardized construction material categories configured`}
                actions={
                  <Button variant="primary" size="sm" onClick={() => navigate('/materials')}>
                    Open Material Master
                  </Button>
                }
              >
                <div style={{ overflowX: 'auto' }}>
                  <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: 12, color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>Code</th>
                        <th style={{ padding: '10px 12px' }}>Category Name</th>
                        <th style={{ padding: '10px 12px' }}>Description</th>
                        <th style={{ padding: '10px 12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => (
                        <tr key={cat.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 13 }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{cat.code}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Layers size={14} style={{ color: 'var(--color-orange-600)' }} />
                              {cat.name}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{cat.description || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <Badge variant={cat.isActive ? 'success' : 'neutral'}>
                              {cat.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {path === '/units' && (
              <>
                <Card
                  title="Standard Units of Measure (UOM)"
                  subtitle={`${units.length} engineering measurement units registered`}
                >
                  <div style={{ overflowX: 'auto' }}>
                    <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: 12, color: 'var(--color-text-muted)' }}>
                          <th style={{ padding: '10px 12px' }}>Code</th>
                          <th style={{ padding: '10px 12px' }}>Unit Name</th>
                          <th style={{ padding: '10px 12px' }}>Symbol</th>
                          <th style={{ padding: '10px 12px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {units.map((u) => (
                          <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 13 }}>
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{u.code}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <Scale size={14} style={{ color: 'var(--color-orange-600)' }} />
                                {u.name}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>{u.symbol}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <Badge variant={u.isActive ? 'success' : 'neutral'}>
                                {u.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card
                  title="Unit Conversion Rules"
                  subtitle={`${conversions.length} conversion factors between procurement and base stock units`}
                >
                  <div style={{ overflowX: 'auto' }}>
                    <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: 12, color: 'var(--color-text-muted)' }}>
                          <th style={{ padding: '10px 12px' }}>From Unit</th>
                          <th style={{ padding: '10px 12px' }}>To Unit</th>
                          <th style={{ padding: '10px 12px' }}>Conversion Factor</th>
                          <th style={{ padding: '10px 12px' }}>Rule Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conversions.map((c) => (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 13 }}>
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.fromUnitCode}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.toUnitCode}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>× {c.conversionFactor}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{c.description || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}

            {path === '/projects' && (
              <Card
                title="Active Construction Projects & Cost Centers"
                subtitle={`${projects.length} authorized project sites in your operational scope`}
                actions={
                  <Button variant="primary" size="sm" onClick={() => navigate('/requisitions')}>
                    View Site Requisitions
                  </Button>
                }
              >
                <div style={{ overflowX: 'auto' }}>
                  <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: 12, color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>Project Code</th>
                        <th style={{ padding: '10px 12px' }}>Project Name</th>
                        <th style={{ padding: '10px 12px' }}>Site Location</th>
                        <th style={{ padding: '10px 12px' }}>Project Manager</th>
                        <th style={{ padding: '10px 12px' }}>Status</th>
                        <th style={{ padding: '10px 12px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 13 }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{p.code}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Building2 size={14} style={{ color: 'var(--color-orange-600)' }} />
                              {p.name}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{p.location}</td>
                          <td style={{ padding: '10px 12px' }}>{p.projectManagerName}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <Badge variant={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Active' : 'Closed'}</Badge>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<ExternalLink size={14} />}
                              onClick={() => navigate('/inventory/balances')}
                            >
                              Site Stock
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {path === '/warehouses' && (
              <Card
                title="Warehouses & Site Storage Yards"
                subtitle={`${warehouses.length} physical storage locations linked to project cost centers`}
                actions={
                  <Button variant="primary" size="sm" onClick={() => navigate('/stock-transfers')}>
                    Stock Transfers
                  </Button>
                }
              >
                <div style={{ overflowX: 'auto' }}>
                  <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: 12, color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>Store Code</th>
                        <th style={{ padding: '10px 12px' }}>Warehouse / Yard Name</th>
                        <th style={{ padding: '10px 12px' }}>Store Type</th>
                        <th style={{ padding: '10px 12px' }}>Linked Project</th>
                        <th style={{ padding: '10px 12px' }}>Stocked SKUs</th>
                        <th style={{ padding: '10px 12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warehouses.map((w) => (
                        <tr key={w.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 13 }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{w.code}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Warehouse size={14} style={{ color: 'var(--color-orange-600)' }} />
                              {w.name}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <Badge variant="transit">{w.type}</Badge>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)' }}>{w.projectName}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{w.skuCount} SKUs</td>
                          <td style={{ padding: '10px 12px' }}>
                            <Badge variant={w.isActive ? 'success' : 'neutral'}>{w.isActive ? 'Operational' : 'Inactive'}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {path === '/pending-deliveries' && (
              <Card
                title="Expected Site Deliveries & Open Purchase Orders"
                subtitle={`${pendingOrders.length} active purchase orders awaiting Goods Received Note (GRN) inspection`}
                actions={
                  <Button variant="primary" size="sm" onClick={() => navigate('/grns/new')}>
                    Record GRN Receipt
                  </Button>
                }
              >
                <div style={{ overflowX: 'auto' }}>
                  <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: 12, color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>PO Number</th>
                        <th style={{ padding: '10px 12px' }}>Project Site</th>
                        <th style={{ padding: '10px 12px' }}>Supplier</th>
                        <th style={{ padding: '10px 12px' }}>Expected Delivery</th>
                        <th style={{ padding: '10px 12px' }}>Order Status</th>
                        <th style={{ padding: '10px 12px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingOrders.map((po) => (
                        <tr key={po.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 13 }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{po.poNumber}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{po.projectName}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Truck size={14} style={{ color: 'var(--color-orange-600)' }} />
                              {po.supplierName}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>
                            {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : 'Scheduled'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <Badge variant="warning">{po.status}</Badge>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <Button variant="secondary" size="sm" onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                              Inspect PO
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {path === '/settings' && settings && (
              <Card
                title="Enterprise System Governance & Valuation Configuration"
                subtitle="Enforced inventory accounting, security, and approval rules"
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                  <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                      <ShieldCheck size={16} style={{ color: 'var(--color-green-600)' }} />
                      Valuation Policy
                    </div>
                    <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
                      {settings.valuationPolicy}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {settings.valuationDescription} ({settings.currency})
                    </div>
                  </div>

                  <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                      <CheckCircle2 size={16} style={{ color: 'var(--color-green-600)' }} />
                      Inventory Ledger Safeguards
                    </div>
                    <ul style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)', paddingLeft: 16 }}>
                      <li>Negative Stock Permitted: <strong>{settings.negativeStockAllowed ? 'Yes' : 'No (Strictly Blocked)'}</strong></li>
                      <li>Self-Approval Permitted: <strong>{settings.selfApprovalAllowed ? 'Yes' : 'No (Dual-Control Enforced)'}</strong></li>
                      <li>GRN Inspection Required: <strong>{settings.requireGrnInspectionBeforePosting ? 'Mandatory' : 'Optional'}</strong></li>
                    </ul>
                  </div>
                </div>
              </Card>
            )}

            <Card title="Module Governance & Capabilities">
              <ul
                style={{
                  listStyle: 'disc',
                  paddingLeft: 'var(--space-5)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-muted)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 8,
                }}
              >
                {businessCapabilities.map((cap, i) => (
                  <li key={i}>{cap}</li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

