import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Scale,
  Edit2,
  Power,
  Eye,
  Info,
  X,
  FileText,
  Clock,
  ArrowRightLeft,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { DataTable, ColumnDef } from '../components/common/DataTable';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../app/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  materialService,
  Material,
  MaterialCategory,
  UnitOfMeasure,
  UnitConversion,
  CreateMaterialPayload,
  UpdateMaterialPayload,
} from '../services/api/materialService';
import { ApiClientException } from '../services/api/apiClient';

export const MaterialMasterPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  // Master records
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);

  // Page state
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [apiError, setApiError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);
  const [statusTogglingMaterial, setStatusTogglingMaterial] = useState<Material | null>(null);
  const [showUomGuide, setShowUomGuide] = useState<boolean>(false);

  // Create Form State
  const [createForm, setCreateForm] = useState<CreateMaterialPayload>({
    itemCode: '',
    name: '',
    description: '',
    specification: '',
    categoryId: '',
    baseUnitId: '',
    minimumStockLevel: 0,
    reorderLevel: 0,
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Edit Form State
  const [editForm, setEditForm] = useState<UpdateMaterialPayload>({
    name: '',
    description: '',
    specification: '',
    categoryId: '',
    baseUnitId: '',
    minimumStockLevel: 0,
    reorderLevel: 0,
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Check authorization roles
  const canManageMaterials = hasRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']);
  const canToggleStatus = hasRole(['SuperAdmin', 'InventoryManager']);

  // Fetch Master Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [matRes, catRes, unitRes, convRes] = await Promise.all([
        materialService.getMaterials(searchTerm, categoryFilter, statusFilter),
        materialService.getCategories(),
        materialService.getUnits(),
        materialService.getUnitConversions(),
      ]);

      if (matRes.success && matRes.data) {
        setMaterials(matRes.data);
      }
      if (catRes.success && catRes.data) {
        setCategories(catRes.data);
      }
      if (unitRes.success && unitRes.data) {
        setUnits(unitRes.data);
      }
      if (convRes.success && convRes.data) {
        setConversions(convRes.data);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientException) {
        setApiError(err.message);
      } else {
        setApiError('Unable to load Material Master data. Please check network connectivity.');
      }
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set default category and unit when modals open
  useEffect(() => {
    if (showCreateModal && categories.length > 0 && units.length > 0) {
      setCreateForm((prev) => ({
        ...prev,
        categoryId: prev.categoryId || categories[0].id,
        baseUnitId: prev.baseUnitId || units[0].id,
      }));
    }
  }, [showCreateModal, categories, units]);

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    // Frontend business rule validation
    const minStock = Number(createForm.minimumStockLevel);
    const reorder = Number(createForm.reorderLevel);

    if (isNaN(minStock) || minStock < 0) {
      setCreateError('Minimum Safety Stock must be a non-negative decimal value.');
      return;
    }

    if (isNaN(reorder) || reorder < minStock) {
      setCreateError('Reorder Point Level must be greater than or equal to Minimum Safety Stock.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await materialService.createMaterial({
        ...createForm,
        itemCode: createForm.itemCode.trim().toUpperCase(),
        minimumStockLevel: minStock,
        reorderLevel: reorder,
      });

      if (res.success) {
        setActionSuccess(`Material SKU '${createForm.itemCode.trim().toUpperCase()}' created successfully.`);
        setShowCreateModal(false);
        setCreateForm({
          itemCode: '',
          name: '',
          description: '',
          specification: '',
          categoryId: categories[0]?.id || '',
          baseUnitId: units[0]?.id || '',
          minimumStockLevel: 0,
          reorderLevel: 0,
        });
        await fetchData();
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientException) {
        setCreateError(err.message);
      } else {
        setCreateError('An unexpected error occurred while saving the material record.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (material: Material) => {
    setEditingMaterial(material);
    setEditForm({
      name: material.name,
      description: material.description || '',
      specification: material.specification || '',
      categoryId: material.categoryId,
      baseUnitId: material.baseUnitId,
      minimumStockLevel: material.minimumStockLevel,
      reorderLevel: material.reorderLevel,
    });
    setEditError(null);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;
    setEditError(null);

    const minStock = Number(editForm.minimumStockLevel);
    const reorder = Number(editForm.reorderLevel);

    if (isNaN(minStock) || minStock < 0) {
      setEditError('Minimum Safety Stock must be a non-negative decimal value.');
      return;
    }

    if (isNaN(reorder) || reorder < minStock) {
      setEditError('Reorder Point Level must be greater than or equal to Minimum Safety Stock.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await materialService.updateMaterial(editingMaterial.id, {
        ...editForm,
        minimumStockLevel: minStock,
        reorderLevel: reorder,
      });

      if (res.success) {
        setActionSuccess(`Material '${editingMaterial.itemCode}' updated successfully.`);
        setEditingMaterial(null);
        await fetchData();
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientException) {
        setEditError(err.message);
      } else {
        setEditError('Failed to update material.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Status Toggle (Activate/Deactivate)
  const handleConfirmStatusToggle = async () => {
    if (!statusTogglingMaterial) return;
    const targetStatus = !statusTogglingMaterial.isActive;
    setIsSubmitting(true);
    setApiError(null);

    try {
      const res = await materialService.updateMaterialStatus(statusTogglingMaterial.id, targetStatus);
      if (res.success) {
        setActionSuccess(
          `Material '${statusTogglingMaterial.itemCode}' has been ${targetStatus ? 'reactivated' : 'deactivated'}.`
        );
        setStatusTogglingMaterial(null);
        await fetchData();
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientException) {
        setApiError(err.message);
      } else {
        setApiError('Unable to update material status.');
      }
      setStatusTogglingMaterial(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // KPI Calculations
  const totalCount = materials.length;
  const activeCount = materials.filter((m) => m.isActive).length;
  const inactiveCount = materials.filter((m) => !m.isActive).length;
  const criticalWatchCount = materials.filter((m) => m.reorderLevel > 0).length;

  // Table Columns Definition
  const columns: ColumnDef<Material>[] = useMemo(
    () => [
      {
        key: 'itemCode',
        header: 'SKU Item Code',
        width: '180px',
        mono: true,
        render: (item) => (
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>
              {item.itemCode}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)' }}>
              ID: {item.id}
            </div>
          </div>
        ),
      },
      {
        key: 'name',
        header: 'Material Specification & Category',
        render: (item) => (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>
              {item.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '2px' }}>
              <Badge variant="orange">{item.categoryName}</Badge>
              {item.specification && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    maxWidth: '320px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={item.specification}
                >
                  {item.specification}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'baseUnitName',
        header: 'Base UoM',
        width: '120px',
        render: (item) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Scale size={14} style={{ color: 'var(--color-charcoal-500)' }} />
            <span style={{ fontWeight: 600 }}>{item.baseUnitName}</span>
          </div>
        ),
      },
      {
        key: 'stockThresholds',
        header: 'Stock Thresholds',
        width: '190px',
        render: (item) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
              <span style={{ color: 'var(--color-text-subtle)' }}>Safety Min:</span>
              <span className="td-mono" style={{ fontWeight: 600 }}>
                {item.minimumStockLevel.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
              <span style={{ color: 'var(--color-orange-600)', fontWeight: 500 }}>Reorder Pt:</span>
              <span className="td-mono" style={{ fontWeight: 700, color: 'var(--color-orange-700)' }}>
                {item.reorderLevel.toLocaleString()}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        width: '110px',
        render: (item) =>
          item.isActive ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="danger">Inactive</Badge>
          ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: '190px',
        align: 'right',
        render: (item) => (
          <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
            <Button
              variant="ghost"
              size="sm"
              icon={<Eye size={13} />}
              onClick={() => setViewingMaterial(item)}
              title="View full specifications and conversion factors"
            >
              Details
            </Button>
            {canManageMaterials && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Edit2 size={13} />}
                onClick={() => openEditModal(item)}
                title="Edit material master parameters"
              >
                Edit
              </Button>
            )}
            {canToggleStatus && (
              <Button
                variant={item.isActive ? 'danger' : 'secondary'}
                size="sm"
                icon={<Power size={13} />}
                onClick={() => setStatusTogglingMaterial(item)}
                title={item.isActive ? 'Deactivate material SKU' : 'Reactivate material SKU'}
              >
                {item.isActive ? 'Disable' : 'Enable'}
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canManageMaterials, canToggleStatus]
  );

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'StructStock', onClick: () => navigate('/dashboard') },
        { label: 'Master Data' },
        { label: 'Material Master', active: true },
      ]}
      title="Material Master Registry"
      description="Central engineering catalog for structural SKUs, units of measure, safety stock baselines, and reorder points."
      actions={
        <>
          <Button
            variant="secondary"
            icon={<ArrowRightLeft size={14} />}
            onClick={() => setShowUomGuide(!showUomGuide)}
          >
            UoM Conversions
          </Button>
          <Button
            variant="secondary"
            icon={<RefreshCw size={14} className={loading ? 'loading-spinner' : ''} />}
            onClick={() => fetchData()}
          >
            Refresh
          </Button>
          {canManageMaterials && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setShowCreateModal(true);
                setCreateError(null);
              }}
            >
              New Material SKU
            </Button>
          )}
        </>
      }
    >
      {/* Alert Notices */}
      {actionSuccess && (
        <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {apiError && (
        <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>
          <AlertTriangle size={16} />
          <span>{apiError}</span>
          <button
            type="button"
            onClick={() => setApiError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Storage Architecture Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          backgroundColor: '#EDF2F7',
          borderLeft: '4px solid var(--color-charcoal-700)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-charcoal-800)',
        }}
      >
        <ShieldCheck size={18} style={{ color: 'var(--color-charcoal-700)', flexShrink: 0 }} />
        <div>
          <strong>Storage Architecture:</strong> Operating with protected atomic JSON file storage in{' '}
          <code>/data/materials.json</code>. Changes serialize safely with atomic replacement guards. Storage interface{' '}
          <code>IMaterialRepository</code> is production-ready for SQL Server migration without UI changes.
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid-dashboard-stats">
        <StatCard
          label="Registered Catalog SKUs"
          value={totalCount}
          accent="charcoal"
          icon={<Package size={18} />}
          meta={<span>Total authoritative materials</span>}
        />
        <StatCard
          label="Active In Inventory"
          value={activeCount}
          accent="success"
          icon={<CheckCircle2 size={18} />}
          meta={<span>Available for POs & Requisitions</span>}
        />
        <StatCard
          label="Deactivated SKUs"
          value={inactiveCount}
          accent={inactiveCount > 0 ? 'orange' : 'charcoal'}
          icon={<AlertCircle size={18} />}
          meta={<span>Locked against new issuance</span>}
        />
        <StatCard
          label="Reorder Watch SKUs"
          value={criticalWatchCount}
          accent="orange"
          icon={<Layers size={18} />}
          meta={<span>Configured with automated reorder thresholds</span>}
        />
      </div>

      {/* Optional UoM Quick Reference Drawer / Banner */}
      {showUomGuide && (
        <Card style={{ marginBottom: 'var(--space-4)', border: '1px solid var(--color-orange-300)', backgroundColor: '#FFFAF0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Scale size={18} style={{ color: 'var(--color-orange-500)' }} />
              <h3 style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-charcoal-900)' }}>
                Authoritative Units of Measure & Conversion Reference
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowUomGuide(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--color-charcoal-600)' }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
            {conversions.map((cnv) => (
              <div
                key={cnv.id}
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-charcoal-800)' }}>
                  {cnv.fromUnitCode} ➔ {cnv.toUnitCode}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-orange-600)', fontWeight: 600, marginTop: '2px' }}>
                  Factor: {cnv.conversionFactor}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)', marginTop: '2px' }}>
                  {cnv.description}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 1, minWidth: 260 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Search Item Code, Name, or Specification..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-charcoal-500)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Filter size={14} style={{ color: 'var(--color-charcoal-600)' }} />
              <select
                className="form-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ width: 'auto', fontSize: 'var(--font-size-xs)' }}
                aria-label="Filter by material category"
              >
                <option value="ALL">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 'auto', fontSize: 'var(--font-size-xs)' }}
              aria-label="Filter by status"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="DISABLED">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ marginTop: 'var(--space-4)' }}>
          <DataTable
            columns={columns}
            data={materials}
            keyExtractor={(item) => item.id}
            isLoading={loading}
            emptyTitle="No materials registered"
            emptyDescription={
              searchTerm || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No material records matched your search filters. Try broadening your criteria.'
                : 'Get started by creating your first material master SKU.'
            }
            emptyAction={
              canManageMaterials ? (
                <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)}>
                  Add First Material
                </Button>
              ) : undefined
            }
          />
        </div>
      </Card>

      {/* CREATE MATERIAL MODAL */}
      {showCreateModal && (
        <div
          className="sidebar-backdrop"
          style={{
            zIndex: 'var(--z-modal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 640,
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-border)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: 'var(--space-4) var(--space-6)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-charcoal-900)' }}>
                  Register New Material SKU
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)' }}>
                  Item codes are unique, case-insensitive, and immutable once saved.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--color-charcoal-600)',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ padding: 'var(--space-6)' }}>
              {createError && (
                <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>
                  <AlertTriangle size={16} />
                  <span>{createError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label required">Item Code / SKU</label>
                  <input
                    type="text"
                    className="form-input td-mono"
                    placeholder="e.g. STEEL-REBAR-T20"
                    value={createForm.itemCode}
                    onChange={(e) => setCreateForm({ ...createForm, itemCode: e.target.value.toUpperCase() })}
                    required
                  />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                    Normalized: {createForm.itemCode ? createForm.itemCode.trim().toUpperCase() : 'None'}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label required">Material Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Deformed Rebar 20mm"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label required">Material Category</label>
                  <select
                    className="form-select"
                    value={createForm.categoryId}
                    onChange={(e) => setCreateForm({ ...createForm, categoryId: e.target.value })}
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label required">Base Unit of Measure</label>
                  <select
                    className="form-select"
                    value={createForm.baseUnitId}
                    onChange={(e) => setCreateForm({ ...createForm, baseUnitId: e.target.value })}
                    required
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
                <label className="form-label">Engineering Specification</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ASTM A615 Grade 60, 12m standard mill lengths"
                  value={createForm.specification}
                  onChange={(e) => setCreateForm({ ...createForm, specification: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
                <label className="form-label">Operational Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Additional storage notes, handling requirements, or quality inspection standards..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label required">Minimum Safety Stock Level</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input td-mono"
                    value={createForm.minimumStockLevel}
                    onChange={(e) => setCreateForm({ ...createForm, minimumStockLevel: parseFloat(e.target.value) || 0 })}
                    required
                  />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                    Emergency buffer threshold (must be &ge; 0)
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label required">Reorder Point Level</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input td-mono"
                    value={createForm.reorderLevel}
                    onChange={(e) => setCreateForm({ ...createForm, reorderLevel: parseFloat(e.target.value) || 0 })}
                    required
                  />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                    Triggers replenishment alert (must be &ge; Minimum Stock)
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Create Material SKU
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MATERIAL MODAL */}
      {editingMaterial && (
        <div
          className="sidebar-backdrop"
          style={{
            zIndex: 'var(--z-modal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 640,
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-border)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: 'var(--space-4) var(--space-6)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-charcoal-900)' }}>
                  Edit Material: {editingMaterial.itemCode}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)' }}>
                  Item Code is fixed to safeguard historical transactions and ledger records.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingMaterial(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--color-charcoal-600)',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ padding: 'var(--space-6)' }}>
              {editError && (
                <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>
                  <AlertTriangle size={16} />
                  <span>{editError}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Item Code (Immutable)</label>
                  <input
                    type="text"
                    className="form-input td-mono"
                    value={editingMaterial.itemCode}
                    disabled
                    style={{ backgroundColor: '#EDF2F7', cursor: 'not-allowed' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">Material Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label required">Material Category</label>
                  <select
                    className="form-select"
                    value={editForm.categoryId}
                    onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label required">Base Unit of Measure</label>
                  <select
                    className="form-select"
                    value={editForm.baseUnitId}
                    onChange={(e) => setEditForm({ ...editForm, baseUnitId: e.target.value })}
                    required
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
                <label className="form-label">Engineering Specification</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.specification}
                  onChange={(e) => setEditForm({ ...editForm, specification: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
                <label className="form-label">Operational Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label required">Minimum Stock Level</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input td-mono"
                    value={editForm.minimumStockLevel}
                    onChange={(e) => setEditForm({ ...editForm, minimumStockLevel: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">Reorder Level</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input td-mono"
                    value={editForm.reorderLevel}
                    onChange={(e) => setEditForm({ ...editForm, reorderLevel: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                <Button type="button" variant="secondary" onClick={() => setEditingMaterial(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS DRAWER / MODAL */}
      {viewingMaterial && (
        <div
          className="sidebar-backdrop"
          style={{
            zIndex: 'var(--z-modal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: 600,
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-border)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: 'var(--space-4) var(--space-6)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-charcoal-900)' }}>
                  Material SKU: {viewingMaterial.itemCode}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)' }}>
                  System ID: {viewingMaterial.id}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingMaterial(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--color-charcoal-600)',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-charcoal-900)' }}>
                  {viewingMaterial.name}
                </h4>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                  <Badge variant="orange">{viewingMaterial.categoryName}</Badge>
                  <Badge variant={viewingMaterial.isActive ? 'success' : 'danger'}>
                    {viewingMaterial.isActive ? 'Active SKU' : 'Disabled SKU'}
                  </Badge>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-bg-page)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)' }}>Base Unit of Measure</div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{viewingMaterial.baseUnitName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)' }}>Category Identifier</div>
                  <div className="td-mono" style={{ fontSize: 'var(--font-size-xs)' }}>{viewingMaterial.categoryId}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)' }}>Minimum Safety Buffer</div>
                  <div className="td-mono" style={{ fontWeight: 600 }}>{viewingMaterial.minimumStockLevel.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)' }}>Reorder Point Threshold</div>
                  <div className="td-mono" style={{ fontWeight: 700, color: 'var(--color-orange-600)' }}>
                    {viewingMaterial.reorderLevel.toLocaleString()}
                  </div>
                </div>
              </div>

              {viewingMaterial.specification && (
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-charcoal-800)' }}>
                    Engineering Specification
                  </div>
                  <div
                    style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-bg-page)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    {viewingMaterial.specification}
                  </div>
                </div>
              )}

              {viewingMaterial.description && (
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-charcoal-800)' }}>
                    Description & Storage Notes
                  </div>
                  <div
                    style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-bg-page)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      marginTop: 'var(--space-1)',
                    }}
                  >
                    {viewingMaterial.description}
                  </div>
                </div>
              )}

              <div
                style={{
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: 'var(--space-3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.6875rem',
                  color: 'var(--color-text-subtle)',
                }}
              >
                <div>Created: {new Date(viewingMaterial.createdAtUtc).toUTCString().replace('GMT', 'UTC')}</div>
                {viewingMaterial.updatedAtUtc && (
                  <div>Updated: {new Date(viewingMaterial.updatedAtUtc).toUTCString().replace('GMT', 'UTC')}</div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <Button variant="secondary" onClick={() => setViewingMaterial(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM STATUS TOGGLE DIALOG */}
      {statusTogglingMaterial && (
        <ConfirmDialog
          isOpen={true}
          title={statusTogglingMaterial.isActive ? 'Deactivate Material SKU?' : 'Reactivate Material SKU?'}
          description={
            statusTogglingMaterial.isActive
              ? `Deactivating '${statusTogglingMaterial.itemCode}' (${statusTogglingMaterial.name}) will lock this SKU against new Material Requisitions and Purchase Orders. Existing inventory balances and historical audit ledger lines remain intact.`
              : `Reactivating '${statusTogglingMaterial.itemCode}' will make this SKU immediately available for procurement orders and field site requests.`
          }
          variant={statusTogglingMaterial.isActive ? 'danger' : 'primary'}
          confirmLabel={statusTogglingMaterial.isActive ? 'Yes, Deactivate' : 'Yes, Reactivate'}
          isLoading={isSubmitting}
          onConfirm={handleConfirmStatusToggle}
          onCancel={() => setStatusTogglingMaterial(null)}
        />
      )}
    </AppLayout>
  );
};
