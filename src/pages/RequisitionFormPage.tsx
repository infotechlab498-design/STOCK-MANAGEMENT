import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Save,
  Send,
  ArrowLeft,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/EmptyState';
import {
  requisitionService,
  ProjectDto,
  MaterialRequisitionDto,
  RequisitionPriority,
} from '../services/api/requisitionService';
import { materialService, Material } from '../services/api/materialService';
import { inventoryService, InventoryBalance } from '../services/api/inventoryService';

interface FormLineItem {
  key: string;
  id?: string;
  materialId: string;
  requestedQuantity: number | string;
  remarks?: string;
}

export const RequisitionFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id && id !== 'new');
  const navigate = useNavigate();
  const { user } = useAuth();

  // Reference Catalogs
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [projectBalances, setProjectBalances] = useState<InventoryBalance[]>([]);
  const [isLoadingRefData, setIsLoadingRefData] = useState<boolean>(true);
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null);

  // Form Fields
  const [projectId, setProjectId] = useState<string>('');
  const [requiredDate, setRequiredDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().substring(0, 10);
  });
  const [priority, setPriority] = useState<RequisitionPriority>('Medium');
  const [purpose, setPurpose] = useState<string>('');
  const [workActivity, setWorkActivity] = useState<string>('');
  const [siteLocationDetail, setSiteLocationDetail] = useState<string>('');
  const [lines, setLines] = useState<FormLineItem[]>([
    { key: 'line-1', materialId: '', requestedQuantity: 1, remarks: '' },
  ]);

  // Existing Requisition Info when editing
  const [existingRequisition, setExistingRequisition] = useState<MaterialRequisitionDto | null>(null);

  // Form State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch reference catalogs & existing requisition if in edit mode
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingRefData(true);
      setFormError(null);
      setCatalogLoadError(null);
      try {
        const [projResult, matResult] = await Promise.allSettled([
          requisitionService.getProjects(),
          materialService.getMaterials(undefined, undefined, 'ACTIVE'),
        ]);

        const failureMessages: string[] = [];

        if (projResult.status === 'fulfilled') {
          const projList = Array.isArray(projResult.value) ? projResult.value : [];
          setProjects(projList);
          if (projList.length > 0 && !projectId) {
            setProjectId(projList[0].id);
          }
        } else {
          console.error('Failed to load project sites (/api/v1/projects):', projResult.reason);
          failureMessages.push(
            `Project sites failed to load (GET /api/v1/projects): ${projResult.reason?.message || 'Request failed'}`
          );
        }

        if (matResult.status === 'fulfilled') {
          const matList = Array.isArray(matResult.value?.data) ? matResult.value.data : [];
          setMaterials(matList);
        } else {
          console.error('Failed to load material master (/api/v1/materials):', matResult.reason);
          failureMessages.push(
            `Material master catalog failed to load (GET /api/v1/materials): ${matResult.reason?.message || 'Request failed'}`
          );
        }

        if (isEditMode && id) {
          try {
            const req = await requisitionService.getRequisitionById(id);
            setExistingRequisition(req);

            if (req.status !== 'Draft' && req.status !== 'ReturnedForCorrection') {
              setFormError(`Requisition is in status '${req.status}' and cannot be modified.`);
            }

            setProjectId(req.projectId);
            setRequiredDate(req.requiredDate);
            setPriority(req.priority);
            setPurpose(req.purpose);
            setWorkActivity(req.workActivity || '');
            setSiteLocationDetail(req.siteLocationDetail || '');

            if (req.items && req.items.length > 0) {
              setLines(
                req.items.map((it, idx) => ({
                  key: `line-${idx}-${it.id}`,
                  id: it.id,
                  materialId: it.materialId,
                  requestedQuantity: it.requestedQuantity,
                  remarks: it.remarks || '',
                }))
              );
            }
          } catch (reqErr: any) {
            console.error(`Failed to load requisition ${id}:`, reqErr);
            failureMessages.push(
              `Requisition '${id}' failed to load (GET /api/v1/requisitions/${id}): ${reqErr?.message || 'Not found'}`
            );
          }
        }

        if (failureMessages.length > 0) {
          const combined = failureMessages.join(' • ');
          setCatalogLoadError(combined);
          setFormError(combined);
        }
      } catch (err: any) {
        console.error('Failed to load initial form data:', err);
        setFormError(err?.message || 'Failed to load project reference data');
      } finally {
        setIsLoadingRefData(false);
      }
    };

    loadData();
  }, [id, isEditMode]);

  // Load real stock balances for the selected project site (non-blocking)
  useEffect(() => {
    if (!projectId) {
      setProjectBalances([]);
      return;
    }
    let active = true;
    inventoryService
      .getBalances({ projectId, pageSize: 100 })
      .then((res) => {
        if (active && res.success && res.data?.items) {
          setProjectBalances(res.data.items);
        }
      })
      .catch(() => {
        if (active) setProjectBalances([]);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  // Handle adding line item
  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        key: `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        materialId: '',
        requestedQuantity: 1,
        remarks: '',
      },
    ]);
  };

  // Handle removing line item
  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      setLines([{ key: `line-${Date.now()}`, materialId: '', requestedQuantity: 1, remarks: '' }]);
      return;
    }
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update line field
  const handleUpdateLine = (index: number, field: keyof FormLineItem, value: any) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Validation
  const validateForm = (isDirectSubmit: boolean): boolean => {
    const errors: Record<string, string> = {};
    setFormError(null);

    if (catalogLoadError || projects.length === 0 || materials.length === 0) {
      setFormError(
        catalogLoadError ||
          'Required project or material master data is unavailable. Please refresh or check your permissions.'
      );
      return false;
    }

    if (!projectId) {
      errors.projectId = 'Please select a target project site';
    }

    if (!requiredDate) {
      errors.requiredDate = 'Required by date is mandatory';
    }

    if (!purpose || purpose.trim().length < 3) {
      errors.purpose = 'Purpose & engineering justification is required (minimum 3 characters)';
    }

    // Line items validation
    const validLines = lines.filter((l) => l.materialId);

    if (isDirectSubmit && validLines.length === 0) {
      errors.items = 'At least one material line item is required to submit a requisition for approval';
    }

    const seenMaterials = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.materialId) {
        if (seenMaterials.has(l.materialId)) {
          errors[`line_${i}_material`] = 'Duplicate material in requisition. Combine quantities onto a single line.';
        }
        seenMaterials.add(l.materialId);

        const qty = parseFloat(String(l.requestedQuantity));
        if (isNaN(qty) || qty <= 0) {
          errors[`line_${i}_qty`] = 'Quantity must be greater than 0';
        }
      } else if (isDirectSubmit || lines.length > 1) {
        errors[`line_${i}_material`] = 'Please select a material or remove this line';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save / Submit Handler
  const handleSaveOrSubmit = async (submitImmediately: boolean) => {
    if (!validateForm(submitImmediately)) {
      setFormError('Please correct the validation errors below before proceeding.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const activeLines = lines
        .filter((l) => l.materialId)
        .map((l) => ({
          id: l.id,
          materialId: l.materialId,
          requestedQuantity: parseFloat(String(l.requestedQuantity)),
          remarks: l.remarks ? l.remarks.trim() : undefined,
        }));

      if (isEditMode && id) {
        // Update Requisition
        await requisitionService.updateRequisition(id, {
          projectId,
          requiredDate,
          priority,
          purpose: purpose.trim(),
          workActivity: workActivity.trim() || undefined,
          siteLocationDetail: siteLocationDetail.trim() || undefined,
          items: activeLines,
          updateComments: submitImmediately
            ? 'Updated and resubmitted for approval review.'
            : 'Updated requisition draft.',
        });

        if (submitImmediately) {
          await requisitionService.submitRequisition(id, 'Resubmitted after making requested corrections.');
        }

        navigate(`/requisitions/${id}`);
      } else {
        // Create Requisition
        const created = await requisitionService.createRequisition({
          projectId,
          requiredDate,
          priority,
          purpose: purpose.trim(),
          workActivity: workActivity.trim() || undefined,
          siteLocationDetail: siteLocationDetail.trim() || undefined,
          items: activeLines,
          submitImmediately,
          initialComments: submitImmediately
            ? 'Submitted directly for approval upon creation.'
            : 'Initial requisition draft saved.',
        });

        navigate(`/requisitions/${created.id}`);
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      setFormError(err?.message || 'Failed to save material requisition');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingRefData) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: 'StructStock', onClick: () => navigate('/dashboard') },
          { label: 'Material Requisitions', onClick: () => navigate('/requisitions') },
          { label: isEditMode ? 'Edit' : 'New', active: true },
        ]}
        title={isEditMode ? 'Edit Requisition' : 'New Material Requisition'}
      >
        <Card style={{ padding: '3.5rem', textAlign: 'center' }}>
          <LoadingSpinner label="Loading project catalog and material master..." />
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'StructStock', onClick: () => navigate('/dashboard') },
        { label: 'Material Requisitions', onClick: () => navigate('/requisitions') },
        { label: isEditMode ? 'Edit Requisition' : 'New Requisition', active: true },
      ]}
      title={isEditMode ? `Edit Requisition ${existingRequisition?.requisitionNumber || ''}` : 'New Material Requisition'}
      description={
        isEditMode
          ? 'Modify line items and site delivery requirements before submitting for approval.'
          : 'Request materials for active construction project sites, specify quantities, and schedule delivery.'
      }
      actions={
        <Button
          variant="secondary"
          size="md"
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate('/requisitions')}
        >
          Cancel & Return
        </Button>
      }
    >
      {/* Returned for Correction Context Banner */}
      {existingRequisition?.status === 'ReturnedForCorrection' && (
        <div
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-warning-bg)',
            color: 'var(--color-warning-text)',
            border: '1px solid var(--color-warning-border)',
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
            fontSize: '0.875rem',
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Reviewer Correction Request:</strong>
            <p style={{ margin: 'var(--space-1) 0 0', lineHeight: 1.4 }}>
              {existingRequisition.correctionNotes || 'Please adjust the material quantities as requested by the Project Manager.'}
            </p>
          </div>
        </div>
      )}

      {/* Global Form Error */}
      {formError && (
        <div
          role="alert"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-danger-bg)',
            color: 'var(--color-danger-text)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: '0.875rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* Section 1: Project & Scheduling Details */}
        <Card>
          <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--color-charcoal-900)', margin: '0 0 var(--space-4)' }}>
            1. Project Site & Schedule Requirements
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {/* Project Site Selector */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  marginBottom: 'var(--space-1)',
                  color: 'var(--color-charcoal-700)',
                }}
              >
                Project Site *
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--border-radius-md)',
                  border: fieldErrors.projectId ? '1px solid var(--color-danger-text)' : '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-main)',
                  fontSize: '0.875rem',
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} &mdash; {p.name} ({p.location})
                  </option>
                ))}
              </select>
              {fieldErrors.projectId && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-danger-text)', marginTop: 'var(--space-1)', display: 'block' }}>
                  {fieldErrors.projectId}
                </span>
              )}
            </div>

            {/* Required By Date */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  marginBottom: 'var(--space-1)',
                  color: 'var(--color-charcoal-700)',
                }}
              >
                Required On Site Date *
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--border-radius-md)',
                  border: fieldErrors.requiredDate ? '1px solid var(--color-danger-text)' : '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-main)',
                  fontSize: '0.875rem',
                }}
              />
              {fieldErrors.requiredDate && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-danger-text)', marginTop: 'var(--space-1)', display: 'block' }}>
                  {fieldErrors.requiredDate}
                </span>
              )}
            </div>

            {/* Priority */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  marginBottom: 'var(--space-1)',
                  color: 'var(--color-charcoal-700)',
                }}
              >
                Urgency / Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as RequisitionPriority)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--border-radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-main)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="Low">Low (Standard Planned Stocking)</option>
                <option value="Medium">Medium (Scheduled Work Activity)</option>
                <option value="High">High (Impending Work Dependency)</option>
                <option value="Urgent">Urgent (Critical Path Work Halt)</option>
              </select>
            </div>

            {/* Work Activity */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  marginBottom: 'var(--space-1)',
                  color: 'var(--color-charcoal-700)',
                }}
              >
                Work Activity / Stage Package
              </label>
              <input
                type="text"
                placeholder="e.g. Substructure Concrete Pour, Drainage Trench"
                value={workActivity}
                onChange={(e) => setWorkActivity(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--border-radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-main)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {/* Site Location Detail */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  marginBottom: 'var(--space-1)',
                  color: 'var(--color-charcoal-700)',
                }}
              >
                Specific Site Staging Location / Work Face
              </label>
              <input
                type="text"
                placeholder="e.g. Pier Grid Line 44-50, Embankment West Ramp, Batching Silo 2"
                value={siteLocationDetail}
                onChange={(e) => setSiteLocationDetail(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--border-radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-main)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {/* Purpose & Justification */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  marginBottom: 'var(--space-1)',
                  color: 'var(--color-charcoal-700)',
                }}
              >
                Purpose & Engineering Justification *
              </label>
              <textarea
                rows={3}
                placeholder="Explain the technical requirement, work package mapping, or why these materials are needed on site..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--border-radius-md)',
                  border: fieldErrors.purpose ? '1px solid var(--color-danger-text)' : '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-main)',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                }}
              />
              {fieldErrors.purpose && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-danger-text)', marginTop: 'var(--space-1)', display: 'block' }}>
                  {fieldErrors.purpose}
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Section 2: Material Line Items */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--color-border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              backgroundColor: 'var(--color-bg-surface)',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--color-charcoal-900)', margin: 0 }}>
                2. Requested Material Line Items
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-charcoal-500)' }}>
                Select standard catalog items and enter requested quantity
              </span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<Plus size={16} />}
              onClick={handleAddLine}
            >
              Add Material Line
            </Button>
          </div>

          {fieldErrors.items && (
            <div
              style={{
                margin: 'var(--space-3) var(--space-4) 0',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--color-danger-bg)',
                color: 'var(--color-danger-text)',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: '0.8125rem',
              }}
            >
              {fieldErrors.items}
            </div>
          )}

          {/* Lines Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-bg-subtle)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-charcoal-700)',
                    fontWeight: 600,
                  }}
                >
                  <th style={{ padding: '0.75rem 1rem', width: '40px' }}>#</th>
                  <th style={{ padding: '0.75rem 1rem', minWidth: '280px' }}>Material SKU & Specification *</th>
                  <th style={{ padding: '0.75rem 1rem', width: '140px' }}>Quantity *</th>
                  <th style={{ padding: '0.75rem 1rem', width: '100px' }}>Unit</th>
                  <th style={{ padding: '0.75rem 1rem', minWidth: '180px' }}>Stock Availability</th>
                  <th style={{ padding: '0.75rem 1rem', minWidth: '200px' }}>Specification Remarks</th>
                  <th style={{ padding: '0.75rem 1rem', width: '60px', textAlign: 'center' }}>Remove</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const selectedMat = materials.find((m) => m.id === line.materialId);
                  const matError = fieldErrors[`line_${index}_material`];
                  const qtyError = fieldErrors[`line_${index}_qty`];

                  return (
                    <tr
                      key={line.key}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        backgroundColor: index % 2 === 0 ? 'var(--color-bg-surface)' : 'var(--color-bg-surface-hover)',
                      }}
                    >
                      {/* Row Index */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-charcoal-500)', fontWeight: 600 }}>
                        {index + 1}
                      </td>

                      {/* Material Selector */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <select
                          value={line.materialId}
                          onChange={(e) => handleUpdateLine(index, 'materialId', e.target.value)}
                          style={{
                            width: '100%',
                            padding: 'var(--space-2)',
                            borderRadius: 'var(--border-radius-md)',
                            border: matError ? '1px solid var(--color-danger-text)' : '1px solid var(--color-border-subtle)',
                            backgroundColor: 'var(--color-bg-surface)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <option value="">-- Choose Material from Master --</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.itemCode} &mdash; {m.name} ({m.baseUnitName})
                            </option>
                          ))}
                        </select>
                        {selectedMat && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--color-charcoal-500)', marginTop: '2px' }}>
                            Category: {selectedMat.categoryName} &bull; Min Stock: {selectedMat.minimumStockLevel} {selectedMat.baseUnitName}
                          </div>
                        )}
                        {matError && (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--color-danger-text)', display: 'block', marginTop: '2px' }}>
                            {matError}
                          </span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          placeholder="0.00"
                          value={line.requestedQuantity}
                          onChange={(e) => handleUpdateLine(index, 'requestedQuantity', e.target.value)}
                          style={{
                            width: '100%',
                            padding: 'var(--space-2)',
                            borderRadius: 'var(--border-radius-md)',
                            border: qtyError ? '1px solid var(--color-danger-text)' : '1px solid var(--color-border-subtle)',
                            backgroundColor: 'var(--color-bg-surface)',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            textAlign: 'right',
                          }}
                        />
                        {qtyError && (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--color-danger-text)', display: 'block', marginTop: '2px' }}>
                            {qtyError}
                          </span>
                        )}
                      </td>

                      {/* Unit */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-charcoal-700)', fontWeight: 500 }}>
                        {selectedMat ? selectedMat.baseUnitName : '&mdash;'}
                      </td>

                      {/* Stock Availability indicator */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {selectedMat ? (
                          (() => {
                            const matchingBalances = projectBalances.filter(
                              (b) => b.materialId === selectedMat.id || b.materialCode === selectedMat.itemCode
                            );
                            const totalAvailable = matchingBalances.reduce(
                              (sum, b) => sum + (b.quantityAvailable ?? b.quantityOnHand ?? 0),
                              0
                            );
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                <Badge variant={totalAvailable > 0 ? 'success' : 'warning'}>
                                  {totalAvailable.toLocaleString()} {selectedMat.baseUnitName} avail.
                                </Badge>
                                <span
                                  title="Authoritative usable stock across project site warehouses"
                                  style={{ cursor: 'help', color: 'var(--color-charcoal-500)' }}
                                >
                                  <Info size={13} />
                                </span>
                              </div>
                            );
                          })()
                        ) : (
                          <span style={{ color: 'var(--color-charcoal-400)', fontSize: '0.75rem' }}>
                            Select material
                          </span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <input
                          type="text"
                          placeholder="Length, grade, bundle specs..."
                          value={line.remarks || ''}
                          onChange={(e) => handleUpdateLine(index, 'remarks', e.target.value)}
                          style={{
                            width: '100%',
                            padding: 'var(--space-2)',
                            borderRadius: 'var(--border-radius-md)',
                            border: '1px solid var(--color-border-subtle)',
                            backgroundColor: 'var(--color-bg-surface)',
                            fontSize: '0.8125rem',
                          }}
                        />
                      </td>

                      {/* Delete Action */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(index)}
                          title="Remove line"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-charcoal-400)',
                            padding: 'var(--space-1)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 'var(--border-radius-sm)',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger-text)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-charcoal-400)')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Form Actions Footer */}
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg-subtle)',
              borderTop: '1px solid var(--color-border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-600)' }}>
              Total Line Items: <strong>{lines.filter((l) => l.materialId).length}</strong>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <Button
                variant="secondary"
                size="md"
                icon={<Save size={16} />}
                onClick={() => handleSaveOrSubmit(false)}
                disabled={isSubmitting || Boolean(catalogLoadError) || projects.length === 0 || materials.length === 0}
              >
                Save as Draft
              </Button>

              <Button
                variant="primary"
                size="md"
                icon={<Send size={16} />}
                onClick={() => handleSaveOrSubmit(true)}
                isLoading={isSubmitting}
                disabled={isSubmitting || Boolean(catalogLoadError) || projects.length === 0 || materials.length === 0}
              >
                Submit for Approval
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </AppLayout>
  );
};
