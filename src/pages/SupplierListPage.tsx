import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Mail,
  Phone,
  Eye,
  Edit2,
  Power,
  X,
  CreditCard,
  MapPin,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '../app/useAuth';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { Badge } from '../components/common/Badge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import { supplierService, SupplierDto, CreateSupplierPayload } from '../services/api/supplierService';

export const SupplierListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierDto | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateSupplierPayload>({
    supplierCode: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxReference: '',
    paymentTerms: 'Net 30 Days',
    notes: '',
  });

  // Status toggle confirmation
  const [statusDialog, setStatusDialog] = useState<{ id: string; name: string; currentStatus: boolean } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canManageSuppliers = hasRole(['SuperAdmin', 'ProcurementOfficer']);

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await supplierService.getSuppliers({
        search: searchQuery || undefined,
        status: statusFilter,
      });
      setSuppliers(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load suppliers registry.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Metrics
  const metrics = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter((s) => s.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [suppliers]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      supplierCode: '',
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      taxReference: '',
      paymentTerms: 'Net 30 Days',
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup: SupplierDto) => {
    setEditingSupplier(sup);
    setFormData({
      supplierCode: sup.supplierCode,
      name: sup.name,
      contactPerson: sup.contactPerson,
      phone: sup.phone,
      email: sup.email,
      address: sup.address,
      taxReference: sup.taxReference || '',
      paymentTerms: sup.paymentTerms || 'Net 30 Days',
      notes: sup.notes || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Supplier business name is required.');
      return;
    }
    if (!editingSupplier && !formData.supplierCode.trim()) {
      setFormError('Supplier code is required.');
      return;
    }
    if (!formData.contactPerson.trim()) {
      setFormError('Contact person is required.');
      return;
    }
    if (!formData.phone.trim()) {
      setFormError('Phone number is required.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setFormError('A valid email address is required.');
      return;
    }
    if (!formData.address.trim()) {
      setFormError('Physical / business address is required.');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingSupplier) {
        await supplierService.updateSupplier(editingSupplier.id, {
          name: formData.name,
          contactPerson: formData.contactPerson,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          taxReference: formData.taxReference || undefined,
          paymentTerms: formData.paymentTerms || undefined,
          notes: formData.notes || undefined,
        });
        setActionMessage({ type: 'success', text: `Supplier '${formData.name}' updated successfully.` });
      } else {
        await supplierService.createSupplier(formData);
        setActionMessage({ type: 'success', text: `Supplier '${formData.name}' registered successfully.` });
      }
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err?.message || 'Failed to save supplier details.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusDialog) return;
    setIsUpdatingStatus(true);
    try {
      const nextStatus = !statusDialog.currentStatus;
      await supplierService.updateSupplierStatus(statusDialog.id, nextStatus);
      setActionMessage({
        type: 'success',
        text: `Supplier '${statusDialog.name}' has been ${nextStatus ? 'activated' : 'deactivated'}. Historical purchase records remain intact.`,
      });
      setStatusDialog(null);
      fetchSuppliers();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to change supplier status.',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Truck size={24} style={{ color: 'var(--color-orange-500)' }} />
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-charcoal-900)', margin: 0 }}>
                Supplier Registry & Vendors
              </h1>
            </div>
            <p style={{ color: 'var(--color-charcoal-600)', margin: '4px 0 0', fontSize: '0.875rem' }}>
              Maintain approved material vendors, trade credit terms, tax identification, and delivery records.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchSuppliers}
              disabled={isLoading}
              icon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/purchase-orders/rate-comparison')}
              icon={<FileCheck size={14} />}
            >
              Rate Comparison
            </Button>
            {canManageSuppliers && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenAdd}
                icon={<Plus size={16} />}
              >
                Add Supplier
              </Button>
            )}
          </div>
        </div>

        {/* Action / Notification Banner */}
        {actionMessage && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: actionMessage.type === 'success' ? '#F0FFF4' : '#FFF5F5',
              border: `1px solid ${actionMessage.type === 'success' ? '#9AE6B4' : '#FEB2B2'}`,
              color: actionMessage.type === 'success' ? '#22543D' : '#742A2A',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {actionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <StatCard
            label="Total Suppliers"
            value={metrics.total}
            meta="Registered trade partners"
            icon={<Building2 size={20} />}
          />
          <StatCard
            label="Active Vendors"
            value={metrics.active}
            meta="Eligible for purchase orders"
            accent="success"
            icon={<CheckCircle2 size={20} />}
          />
          <StatCard
            label="Deactivated"
            value={metrics.inactive}
            meta="Preserved for audit trail"
            icon={<AlertCircle size={20} />}
          />
        </div>

        {/* Filter Bar */}
        <Card>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '450px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 'var(--space-3)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-charcoal-400)',
                }}
              />
              <input
                type="text"
                placeholder="Search by vendor name, code, contact or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3) var(--space-2) 2.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-charcoal-900)',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>Status:</span>
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: statusFilter === st ? 'var(--color-orange-500)' : 'var(--color-border)',
                    backgroundColor: statusFilter === st ? 'var(--color-orange-50)' : 'var(--color-surface)',
                    color: statusFilter === st ? 'var(--color-orange-700)' : 'var(--color-charcoal-700)',
                  }}
                >
                  {st === 'ALL' ? 'All Vendors' : st === 'ACTIVE' ? 'Active Only' : 'Inactive Only'}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Suppliers List Table / Cards */}
        {isLoading ? (
          <Card>
            <div style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
              <LoadingSpinner label="Querying authorized supplier directory..." />
            </div>
          </Card>
        ) : error ? (
          <Card>
            <EmptyState
              title="Error Loading Suppliers"
              description={error}
              action={<Button variant="primary" onClick={fetchSuppliers}>Retry Query</Button>}
            />
          </Card>
        ) : suppliers.length === 0 ? (
          <Card>
            <EmptyState
              title="No Suppliers Found"
              description={
                searchQuery || statusFilter !== 'ALL'
                  ? 'No suppliers match your current filter parameters.'
                  : 'No trade suppliers have been registered in the system yet.'
              }
              action={canManageSuppliers ? <Button variant="primary" onClick={handleOpenAdd}>Register First Supplier</Button> : undefined}
            />
          </Card>
        ) : (
          <Card>
            <div style={{ overflowX: 'auto', margin: '-1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg-page)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      Code / Vendor Name
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      Contact Person
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      Communication
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      Credit Terms
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      Status
                    </th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((sup) => (
                    <tr
                      key={sup.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background-color var(--transition-fast)',
                      }}
                      className="hover-bg-subtle"
                    >
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>{sup.name}</span>
                          <Badge variant="neutral">{sup.supplierCode}</Badge>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} /> {sup.address}
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-charcoal-800)' }}>
                        <div style={{ fontWeight: 500 }}>{sup.contactPerson}</div>
                        {sup.taxReference && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>
                            Tax ID: {sup.taxReference}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-charcoal-700)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem' }}>
                          <Mail size={12} style={{ color: 'var(--color-charcoal-400)' }} /> {sup.email}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', marginTop: 2 }}>
                          <Phone size={12} style={{ color: 'var(--color-charcoal-400)' }} /> {sup.phone}
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--color-charcoal-800)' }}>
                          <CreditCard size={12} style={{ color: 'var(--color-orange-500)' }} />
                          {sup.paymentTerms || 'Standard Terms'}
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <StatusBadge
                          status={sup.isActive ? 'Active' : 'Inactive'}
                          label={sup.isActive ? 'Active Vendor' : 'Deactivated'}
                        />
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/suppliers/${sup.id}`)}
                            title="View Supplier Profile & Purchase History"
                            icon={<Eye size={14} />}
                          >
                            Details
                          </Button>

                          {canManageSuppliers && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenEdit(sup)}
                                title="Edit Supplier Contact and Terms"
                                icon={<Edit2 size={14} />}
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  setStatusDialog({
                                    id: sup.id,
                                    name: sup.name,
                                    currentStatus: sup.isActive,
                                  })
                                }
                                title={sup.isActive ? 'Deactivate Supplier' : 'Activate Supplier'}
                                style={{
                                  color: sup.isActive ? '#C53030' : '#2F855A',
                                  borderColor: sup.isActive ? '#FEB2B2' : '#9AE6B4',
                                }}
                                icon={<Power size={14} />}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 'var(--space-4)',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div
                style={{
                  padding: 'var(--space-4) var(--space-6)',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Building2 size={20} style={{ color: 'var(--color-orange-500)' }} />
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-charcoal-900)' }}>
                    {editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Register New Material Supplier'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-charcoal-500)' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {formError && (
                  <div
                    style={{
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#FFF5F5',
                      border: '1px solid #FEB2B2',
                      color: '#C53030',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                      Supplier Code *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SUP-APEX"
                      value={formData.supplierCode}
                      onChange={(e) => setFormData({ ...formData, supplierCode: e.target.value })}
                      disabled={Boolean(editingSupplier)}
                      required
                      style={{
                        width: '100%',
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: editingSupplier ? 'var(--color-bg-page)' : 'var(--color-surface)',
                        color: 'var(--color-charcoal-900)',
                        fontSize: '0.875rem',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>
                      Unique identifier code.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                      Legal / Business Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Structural Steel Ltd."
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-charcoal-900)',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                      Contact Person *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Robert Jenkins"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
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
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +1 (555) 342-8800"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. orders@apexsteel.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                      Tax / Business Reg Reference
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TAX-US-8849201"
                      value={formData.taxReference || ''}
                      onChange={(e) => setFormData({ ...formData, taxReference: e.target.value })}
                      style={{
                        width: '100%',
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                    Business Address *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 142 Industrial Way, Sector 4, Metro City"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                      Payment Terms
                    </label>
                    <select
                      value={formData.paymentTerms || 'Net 30 Days'}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      style={{
                        width: '100%',
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: '0.875rem',
                        backgroundColor: 'var(--color-surface)',
                      }}
                    >
                      <option value="Net 15 Days">Net 15 Days</option>
                      <option value="Net 30 Days">Net 30 Days</option>
                      <option value="Net 45 Days">Net 45 Days</option>
                      <option value="Net 60 Days">Net 60 Days</option>
                      <option value="Cash on Delivery (COD)">Cash on Delivery (COD)</option>
                      <option value="100% Advance Payment">100% Advance Payment</option>
                      <option value="50% Advance / 50% on Delivery">50% Advance / 50% on Delivery</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                      Notes / Approved Materials
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Certified mill rebar supplier"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      style={{
                        width: '100%',
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsModalOpen(false)}
                    disabled={formSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={formSubmitting}
                    icon={formSubmitting ? <RefreshCw size={14} className="animate-spin" /> : undefined}
                  >
                    {formSubmitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Register Supplier'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Status Toggle Confirmation */}
        {statusDialog && (
          <ConfirmDialog
            isOpen={true}
            title={statusDialog.currentStatus ? 'Deactivate Material Supplier' : 'Reactivate Material Supplier'}
            description={
              statusDialog.currentStatus
                ? `Are you sure you want to deactivate '${statusDialog.name}'? They will no longer be selectable for new purchase orders, but historical purchase contracts will be preserved.`
                : `Are you sure you want to reactivate '${statusDialog.name}'? They will become eligible for new purchase orders.`
            }
            confirmLabel={statusDialog.currentStatus ? 'Deactivate' : 'Reactivate'}
            cancelLabel="Cancel"
            variant={statusDialog.currentStatus ? 'danger' : 'primary'}
            isLoading={isUpdatingStatus}
            onConfirm={handleToggleStatus}
            onCancel={() => setStatusDialog(null)}
          />
        )}
      </div>
    </AppLayout>
  );
};
