import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Truck,
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Eye,
  Plus,
  RefreshCw,
  Clock,
  Shield,
} from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import { supplierService, SupplierDto } from '../services/api/supplierService';
import { PurchaseOrderDto } from '../services/api/purchaseOrderService';

export const SupplierDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [supplier, setSupplier] = useState<SupplierDto | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canCreatePO = hasRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [supData, ordersData] = await Promise.all([
        supplierService.getSupplierById(id),
        supplierService.getSupplierPurchaseOrders(id),
      ]);
      setSupplier(supData);
      setPurchaseOrders(ordersData || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load supplier details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <AppLayout>
        <Card>
          <div style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
            <LoadingSpinner label="Fetching vendor profile and purchase history..." />
          </div>
        </Card>
      </AppLayout>
    );
  }

  if (error || !supplier) {
    return (
      <AppLayout>
        <Card>
          <EmptyState
            title="Supplier Record Not Found"
            description={error || `No supplier found matching identifier '${id}'.`}
            action={
              <Button variant="secondary" onClick={() => navigate('/suppliers')}>
                Return to Suppliers
              </Button>
            }
          />
        </Card>
      </AppLayout>
    );
  }

  const totalCommitted = purchaseOrders.reduce(
    (acc, po) => acc + (po.status !== 'Cancelled' ? po.grandTotal : 0),
    0
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Navigation / Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/suppliers')}
              icon={<ArrowLeft size={16} />}
            >
              Back
            </Button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-charcoal-900)', margin: 0 }}>
                  {supplier.name}
                </h1>
                <Badge variant="orange">{supplier.supplierCode}</Badge>
                <StatusBadge
                  status={supplier.isActive ? 'Active' : 'Inactive'}
                  label={supplier.isActive ? 'Active Vendor' : 'Deactivated'}
                />
              </div>
              <p style={{ color: 'var(--color-charcoal-600)', margin: '4px 0 0', fontSize: '0.875rem' }}>
                Registered Vendor Profile & Historical Procurement Contracts
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              icon={<RefreshCw size={14} />}
            >
              Refresh
            </Button>
            {canCreatePO && supplier.isActive && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/purchase-orders/new?supplierId=${supplier.id}`)}
                icon={<Plus size={16} />}
              >
                Create PO for this Vendor
              </Button>
            )}
          </div>
        </div>

        {/* Profile Card & Procurement Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {/* Contact & Terms Card */}
          <Card title="Vendor Profile & Commercial Terms">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <Building2 size={16} style={{ color: 'var(--color-orange-500)', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>Contact Person</div>
                  <div style={{ color: 'var(--color-charcoal-700)' }}>{supplier.contactPerson}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <Mail size={16} style={{ color: 'var(--color-orange-500)', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>Email Address</div>
                  <div style={{ color: 'var(--color-charcoal-700)' }}>{supplier.email}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <Phone size={16} style={{ color: 'var(--color-orange-500)', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>Phone Number</div>
                  <div style={{ color: 'var(--color-charcoal-700)' }}>{supplier.phone}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <MapPin size={16} style={{ color: 'var(--color-orange-500)', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>Head Office / Yard Address</div>
                  <div style={{ color: 'var(--color-charcoal-700)' }}>{supplier.address}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <CreditCard size={16} style={{ color: 'var(--color-orange-500)', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>Credit & Payment Terms</div>
                  <div style={{ color: 'var(--color-charcoal-700)' }}>{supplier.paymentTerms || 'Standard Terms (Net 30 Days)'}</div>
                </div>
              </div>

              {supplier.taxReference && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  <Shield size={16} style={{ color: 'var(--color-orange-500)', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>Tax & Commercial Registration</div>
                    <div style={{ color: 'var(--color-charcoal-700)' }}>{supplier.taxReference}</div>
                  </div>
                </div>
              )}

              {supplier.notes && (
                <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-bg-page)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-charcoal-600)' }}>Procurement Notes:</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-800)', marginTop: 2 }}>{supplier.notes}</div>
                </div>
              )}
            </div>
          </Card>

          {/* Purchasing History Summary */}
          <Card title="Contract Summary">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-page)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)' }}>Purchase Orders</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-charcoal-900)', marginTop: 4 }}>
                    {purchaseOrders.length}
                  </div>
                </div>

                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-page)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-600)' }}>Total Committed</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-orange-600)', marginTop: 4 }}>
                    ${totalCommitted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-600)', lineHeight: 1.5 }}>
                <p style={{ margin: 0 }}>
                  This supplier record is bound to the historical audit trail. If deactivated, existing purchase orders
                  and future goods receipts remain completely valid and intact.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>
                <Calendar size={14} /> Registered: {new Date(supplier.createdAtUtc).toLocaleDateString()}
              </div>
            </div>
          </Card>
        </div>

        {/* Purchase Orders Table */}
        <Card title={`Purchase Orders for ${supplier.name} (${purchaseOrders.length})`}>
          {purchaseOrders.length === 0 ? (
            <div style={{ padding: 'var(--space-6)' }}>
              <EmptyState
                title="No Purchase Orders Yet"
                description={`No purchase contracts have been issued to ${supplier.name} so far.`}
                action={
                  canCreatePO && supplier.isActive ? (
                    <Button variant="primary" onClick={() => navigate(`/purchase-orders/new?supplierId=${supplier.id}`)}>
                      Draft First PO
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div style={{ overflowX: 'auto', margin: 'calc(-1 * var(--space-4))' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg-page)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>PO #</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Project Site</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Order Date</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Delivery Expected</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Grand Total</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Status</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} style={{ borderBottom: '1px solid var(--color-border)' }} className="hover-bg-subtle">
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-charcoal-900)' }}>
                        {po.poNumber}
                        {po.requisitionNumber && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', fontWeight: 400 }}>
                            via Req: {po.requisitionNumber}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ fontWeight: 500, color: 'var(--color-charcoal-800)' }}>{po.projectName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>{po.deliveryLocation}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-charcoal-700)' }}>
                        {po.orderDate}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-charcoal-700)' }}>
                        {po.expectedDeliveryDate}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 700, color: 'var(--color-charcoal-900)' }}>
                        ${po.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <StatusBadge
                          status={po.status}
                          label={
                            po.status === 'PendingApproval'
                              ? 'Pending Approval'
                              : po.status
                          }
                        />
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/purchase-orders/${po.id}`)}
                          icon={<Eye size={14} />}
                        >
                          View PO
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};
