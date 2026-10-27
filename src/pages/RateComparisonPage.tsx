import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  ArrowLeft,
  Plus,
  RefreshCw,
  Building2,
  Calendar,
  DollarSign,
  TrendingDown,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Truck,
  Eye,
  X,
} from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { LoadingSpinner, EmptyState } from '../components/common/EmptyState';
import {
  purchaseOrderService,
  RateComparisonItemDto,
  QuotationDto,
} from '../services/api/purchaseOrderService';
import { supplierService, SupplierDto } from '../services/api/supplierService';
import { materialService, Material } from '../services/api/materialService';

export const RateComparisonPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [comparisons, setComparisons] = useState<RateComparisonItemDto[]>([]);
  const [quotations, setQuotations] = useState<QuotationDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New Quote Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newQuoteRef, setNewQuoteRef] = useState<string>('');
  const [newQuoteSupplierId, setNewQuoteSupplierId] = useState<string>('');
  const [newQuoteValidUntil, setNewQuoteValidUntil] = useState<string>('');
  const [quoteLines, setQuoteLines] = useState<
    Array<{ materialId: string; quotedQuantity: number; unitRate: number; discount: number; taxRate: number; freight: number }>
  >([]);

  const canManageProcurement = hasRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [compData, quoteData, supData, matDataRes] = await Promise.all([
        purchaseOrderService.getRateComparison(),
        purchaseOrderService.getQuotations(),
        supplierService.getSuppliers({ status: 'ACTIVE' }),
        materialService.getMaterials(undefined, undefined, 'ACTIVE'),
      ]);
      setComparisons(compData || []);
      setQuotations(quoteData || []);
      setSuppliers(supData || []);
      setMaterials(matDataRes.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load supplier rates.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAdd = () => {
    setNewQuoteRef(`QT-${Date.now().toString(36).toUpperCase()}`);
    setNewQuoteSupplierId(suppliers[0]?.id || '');
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10);
    setNewQuoteValidUntil(in30Days);
    if (materials.length > 0) {
      setQuoteLines([
        {
          materialId: materials[0].id,
          quotedQuantity: 10,
          unitRate: 100,
          discount: 0,
          taxRate: 5,
          freight: 50,
        },
      ]);
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuoteRef.trim()) {
      setFormError('Quotation reference is required.');
      return;
    }
    if (!newQuoteSupplierId) {
      setFormError('Supplier is required.');
      return;
    }
    if (quoteLines.length === 0) {
      setFormError('At least one quoted material line is required.');
      return;
    }

    setFormSubmitting(true);
    try {
      await purchaseOrderService.createQuotation({
        quotationReference: newQuoteRef.trim(),
        supplierId: newQuoteSupplierId,
        validUntil: newQuoteValidUntil,
        items: quoteLines.map((l) => ({
          materialId: l.materialId,
          quotedQuantity: l.quotedQuantity,
          unitRate: l.unitRate,
          discount: l.discount,
          taxRate: l.taxRate,
          estimatedFreight: l.freight,
        })),
      });
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err?.message || 'Failed to register quotation.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/purchase-orders')}
              icon={<ArrowLeft size={16} />}
            >
              Back
            </Button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <FileSpreadsheet size={24} style={{ color: 'var(--color-orange-500)' }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-charcoal-900)', margin: 0 }}>
                  Supplier Rate & Quotation Comparison
                </h1>
              </div>
              <p style={{ color: 'var(--color-charcoal-600)', margin: '4px 0 0', fontSize: '0.875rem' }}>
                Side-by-side unit rate comparison across approved suppliers for major construction materials.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              icon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}
            >
              Refresh
            </Button>
            {canManageProcurement && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenAdd}
                icon={<Plus size={16} />}
              >
                Register Quotation
              </Button>
            )}
          </div>
        </div>

        {/* Notice on Quotations */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: '#F7FAFC',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem',
            color: 'var(--color-charcoal-700)',
          }}
        >
          <strong>Governance Note:</strong> Quotation records serve as commercial benchmarks. A quotation does NOT automatically generate or approve a purchase order without an explicit authorized procurement action.
        </div>

        {/* Rate Comparison Matrix */}
        {isLoading ? (
          <Card>
            <div style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
              <LoadingSpinner label="Compiling multi-supplier rate comparison matrix..." />
            </div>
          </Card>
        ) : error ? (
          <Card>
            <EmptyState
              title="Error Loading Rates"
              description={error}
              action={<Button variant="secondary" onClick={loadData}>Retry</Button>}
            />
          </Card>
        ) : comparisons.length === 0 ? (
          <Card>
            <EmptyState
              title="No Quotations on File"
              description="No supplier quotations have been entered to compare rates."
              action={
                canManageProcurement ? (
                  <Button variant="primary" onClick={handleOpenAdd}>
                    Register First Quotation
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {comparisons.map((item) => (
              <Card
                key={item.materialId}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>{item.materialName}</span>
                    <Badge variant="neutral">{item.materialCode}</Badge>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-charcoal-500)' }}>
                      Base UOM: {item.unitCode}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#276749',
                        backgroundColor: '#C6F6D5',
                        padding: '0.2rem 0.6rem',
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <TrendingDown size={14} /> Lowest Rate: ${item.lowestEffectiveRate.toFixed(2)} ({item.lowestRateSupplier})
                    </span>
                  </div>
                }
              >
                <div style={{ overflowX: 'auto', margin: 'calc(-1 * var(--space-4))' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-bg-page)', borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                          Supplier
                        </th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                          Quote Reference
                        </th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                          Validity
                        </th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                          Base Rate
                        </th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                          Tax %
                        </th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                          Freight
                        </th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                          Effective Unit Rate
                        </th>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 600, color: 'var(--color-charcoal-700)' }}>
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.quotes.map((quote, qIdx) => {
                        const isLowest = qIdx === 0;
                        return (
                          <tr
                            key={quote.quotationId + qIdx}
                            style={{
                              borderBottom: '1px solid var(--color-border)',
                              backgroundColor: isLowest ? 'rgba(238, 248, 242, 0.4)' : undefined,
                            }}
                          >
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <div style={{ fontWeight: 600, color: 'var(--color-charcoal-900)' }}>
                                {quote.supplierName}
                              </div>
                              {isLowest && (
                                <span style={{ fontSize: '0.6875rem', color: '#276749', fontWeight: 700, textTransform: 'uppercase' }}>
                                  ★ Best Price
                                </span>
                              )}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-charcoal-700)' }}>
                              {quote.quotationReference}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-charcoal-600)' }}>
                              Until {quote.validUntil}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 500 }}>
                              ${quote.unitRate.toFixed(2)}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', color: 'var(--color-charcoal-600)' }}>
                              {quote.taxRate}%
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', color: 'var(--color-charcoal-600)' }}>
                              ${quote.estimatedFreight.toFixed(2)}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 700, color: isLowest ? '#22543D' : 'var(--color-charcoal-900)' }}>
                              ${quote.effectiveUnitCost.toFixed(2)} / {item.unitCode}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                              {canManageProcurement && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => navigate(`/purchase-orders/new?supplierId=${quote.supplierId}`)}
                                  title="Draft PO using this supplier's rates"
                                >
                                  Draft PO
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Register Quotation Modal */}
        {isModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
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
                maxWidth: '650px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: 'var(--space-6)',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--color-charcoal-900)' }}>
                  Register Supplier Quotation
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-charcoal-500)' }}
                >
                  <X size={20} />
                </button>
              </div>

              {formError && (
                <div style={{ padding: 'var(--space-3)', backgroundColor: '#FFF5F5', color: '#C53030', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleSaveQuotation} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                      Quote Reference *
                    </label>
                    <input
                      type="text"
                      value={newQuoteRef}
                      onChange={(e) => setNewQuoteRef(e.target.value)}
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
                      Supplier *
                    </label>
                    <select
                      value={newQuoteSupplierId}
                      onChange={(e) => setNewQuoteSupplierId(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: '0.875rem',
                        backgroundColor: 'var(--color-surface)',
                      }}
                    >
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-charcoal-700)', marginBottom: 4 }}>
                    Validity Date *
                  </label>
                  <input
                    type="date"
                    value={newQuoteValidUntil}
                    onChange={(e) => setNewQuoteValidUntil(e.target.value)}
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

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Quoted Materials</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setQuoteLines([
                          ...quoteLines,
                          {
                            materialId: materials[0]?.id || '',
                            quotedQuantity: 10,
                            unitRate: 50,
                            discount: 0,
                            taxRate: 5,
                            freight: 0,
                          },
                        ])
                      }
                      icon={<Plus size={14} />}
                    >
                      Add Line
                    </Button>
                  </div>

                  {quoteLines.map((line, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                        gap: 'var(--space-2)',
                        alignItems: 'center',
                        marginBottom: 'var(--space-2)',
                      }}
                    >
                      <select
                        value={line.materialId}
                        onChange={(e) => {
                          const updated = [...quoteLines];
                          updated[idx].materialId = e.target.value;
                          setQuoteLines(updated);
                        }}
                        style={{
                          padding: 'var(--space-1) var(--space-2)',
                          fontSize: '0.8125rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        placeholder="Qty"
                        value={line.quotedQuantity}
                        onChange={(e) => {
                          const updated = [...quoteLines];
                          updated[idx].quotedQuantity = parseFloat(e.target.value) || 1;
                          setQuoteLines(updated);
                        }}
                        style={{
                          padding: 'var(--space-1) var(--space-2)',
                          fontSize: '0.8125rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          textAlign: 'right',
                        }}
                      />

                      <input
                        type="number"
                        placeholder="Rate ($)"
                        value={line.unitRate}
                        onChange={(e) => {
                          const updated = [...quoteLines];
                          updated[idx].unitRate = parseFloat(e.target.value) || 0;
                          setQuoteLines(updated);
                        }}
                        style={{
                          padding: 'var(--space-1) var(--space-2)',
                          fontSize: '0.8125rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          textAlign: 'right',
                        }}
                      />

                      <input
                        type="number"
                        placeholder="Freight ($)"
                        value={line.freight}
                        onChange={(e) => {
                          const updated = [...quoteLines];
                          updated[idx].freight = parseFloat(e.target.value) || 0;
                          setQuoteLines(updated);
                        }}
                        style={{
                          padding: 'var(--space-1) var(--space-2)',
                          fontSize: '0.8125rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          textAlign: 'right',
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => setQuoteLines(quoteLines.filter((_, i) => i !== idx))}
                        style={{ background: 'transparent', border: 'none', color: '#C53030', cursor: 'pointer' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                  <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={formSubmitting}>
                    {formSubmitting ? 'Registering...' : 'Save Quotation'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};
