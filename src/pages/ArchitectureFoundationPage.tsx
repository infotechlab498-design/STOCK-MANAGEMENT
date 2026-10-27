import React from 'react';
import {
  Server,
  Layers,
  Database,
  Shield,
  Palette,
  Terminal,
  FileCode,
  CheckCircle,
  Clock,
  ArrowRight,
  HardHat,
  Cpu,
  Boxes,
} from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useNavigate } from 'react-router-dom';

export const ArchitectureFoundationPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'StructStock', onClick: () => navigate('/dashboard') },
        { label: 'Architecture & Design System', active: true },
      ]}
      title="System Architecture & Design System Specification"
      description="Clean Architecture solution boundaries, .NET 10 / C# 14 backend conventions, plain CSS design tokens, and inventory rules."
      actions={
        <Button
          variant="primary"
          icon={<ArrowRight size={16} />}
          onClick={() => navigate('/dashboard')}
        >
          Return to Dashboard
        </Button>
      }
    >
      {/* Design System Tokens Showcase */}
      <Card
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Palette size={20} style={{ color: 'var(--color-orange-500)' }} />
            <span>Shared Design System Tokens & Color Palette</span>
          </span>
        }
        subtitle="Enforces Primary Charcoal (#2D3748), Safety Orange (#DD6B20), and Page Background (#F7FAFC) without Tailwind CSS."
        className="mb-6"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Color Swatches */}
          <div>
            <h4 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
              Core Brand & Structural Swatches
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ height: 60, backgroundColor: '#2D3748' }} />
                <div style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
                  <div style={{ fontWeight: 600 }}>Primary Charcoal</div>
                  <div className="td-mono" style={{ color: 'var(--color-text-subtle)' }}>#2D3748</div>
                  <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.6875rem' }}>Core brand / headers</div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ height: 60, backgroundColor: '#DD6B20' }} />
                <div style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
                  <div style={{ fontWeight: 600, color: '#C05621' }}>Safety Orange</div>
                  <div className="td-mono" style={{ color: 'var(--color-text-subtle)' }}>#DD6B20</div>
                  <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.6875rem' }}>Primary CTA & highlights</div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ height: 60, backgroundColor: '#F7FAFC', borderBottom: '1px solid #E2E8F0' }} />
                <div style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
                  <div style={{ fontWeight: 600 }}>Page Background</div>
                  <div className="td-mono" style={{ color: 'var(--color-text-subtle)' }}>#F7FAFC</div>
                  <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.6875rem' }}>Subtle industrial canvas</div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ height: 60, backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }} />
                <div style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
                  <div style={{ fontWeight: 600 }}>Surface White</div>
                  <div className="td-mono" style={{ color: 'var(--color-text-subtle)' }}>#FFFFFF</div>
                  <div style={{ color: 'var(--color-text-subtle)', fontSize: '0.6875rem' }}>Card & table containers</div>
                </div>
              </div>
            </div>
          </div>

          {/* Button & Badge Component Previews */}
          <div>
            <h4 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
              Component Styles: Buttons & Status Badges
            </h4>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <Button variant="primary">Safety Orange Primary</Button>
              <Button variant="secondary">Neutral Secondary</Button>
              <Button variant="dark">Charcoal Dark</Button>
              <Button variant="ghost">Ghost Action</Button>
              <Button variant="danger">Danger Reversal</Button>
              <Button variant="primary" size="sm">Small Action</Button>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge variant="success">GRN Received (Approved)</Badge>
              <Badge variant="warning">Requisition Pending</Badge>
              <Badge variant="transit">Transfer In-Transit</Badge>
              <Badge variant="danger">Inspection Rejected</Badge>
              <Badge variant="orange">Issue to Job</Badge>
              <Badge variant="neutral">Draft Record</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Architecture Layers Breakdown */}
      <div className="grid-2" style={{ marginTop: 'var(--space-6)' }}>
        <Card
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Server size={20} style={{ color: 'var(--color-charcoal-800)' }} />
              <span>Backend Architecture (.NET 10 / C# 14)</span>
            </span>
          }
          subtitle="Strict Clean Architecture with inward-pointing dependencies."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>1. ConstructionStock.Domain</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                Pure domain models, aggregate roots (Material, StockLedgerEntry, StockBalance, Project, Warehouse, TransferOrder), domain enums, domain exceptions. Zero external dependencies.
              </div>
            </div>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>2. ConstructionStock.Application</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                CQRS handlers / application services, DTOs, FluentValidation rules, IApplicationDbContext interface, stock posting service with weighted-average valuation logic.
              </div>
            </div>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>3. ConstructionStock.Infrastructure</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                EF Core 10 DbContext with SQL Server provider, atomic transaction execution, migrations, pessimistic concurrency row locks, audit log interception.
              </div>
            </div>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>4. ConstructionStock.Api</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                ASP.NET Core .NET 10 Web API, JWT Bearer authentication, role-based authorization attributes, global ProblemDetails exception handling, Swagger / OpenAPI 3.
              </div>
            </div>
          </div>
        </Card>

        <Card
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Cpu size={20} style={{ color: 'var(--color-orange-500)' }} />
              <span>Frontend Layer Responsibilities (React 19)</span>
            </span>
          }
          subtitle="Modular, predictable, type-safe frontend architecture."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>src/services/api/</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                Centralized <code>apiClient.ts</code>, configurable base URL, JWT Bearer token injection, typed error handling, no secrets stored in frontend code.
              </div>
            </div>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>src/styles/</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                Pure Plain CSS design system tokens (variables, reset, base, components, layout). Zero Tailwind CSS. Fluid rem clamp scales supporting 320px to 4K displays.
              </div>
            </div>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>src/layouts/ & src/components/</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                Collapsible desktop sidebar, mobile drawer, project/warehouse context header, reusable accessible buttons, tables, stat cards, empty states.
              </div>
            </div>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-charcoal-900)' }}>src/features/ & src/pages/</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', marginTop: 2 }}>
                Feature modules isolating domain logic: materials, requisitions, purchase orders, GRN, stock ledger, transfers, and valuation reports.
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Ten Architectural Principles Checklist */}
      <Card
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Shield size={20} style={{ color: 'var(--color-success-text)' }} />
            <span>Core Enterprise Inventory Rules & Safeguards</span>
          </span>
        }
        subtitle="Mandatory business rules enforced across backend and frontend."
        className="mt-6"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          <div style={{ borderLeft: '3px solid var(--color-orange-500)', paddingLeft: 'var(--space-3)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-charcoal-900)' }}>
              1. Authoritative Transaction Ledger
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Stock ledger is append-only. Balances reconcile directly to posted movements. No silent deletes or in-place edits.
            </div>
          </div>

          <div style={{ borderLeft: '3px solid var(--color-charcoal-800)', paddingLeft: 'var(--space-3)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-charcoal-900)' }}>
              2. Weighted-Average Costing (WAC)
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Continuous recalculation upon GRN receipt. Issues and transfers preserve current WAC. Zero floating-point data types.
            </div>
          </div>

          <div style={{ borderLeft: '3px solid #38A169', paddingLeft: 'var(--space-3)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-charcoal-900)' }}>
              3. Concurrency-Safe Atomic Posting
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              SQL Server serializable/snapshot transactions prevent race conditions and duplicate postings. Negative stock is rejected.
            </div>
          </div>

          <div style={{ borderLeft: '3px solid #319795', paddingLeft: 'var(--space-3)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-charcoal-900)' }}>
              4. 3-Phase Custody Stock Transfers
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Dispatch decreases source; stock sits in transit; receipt confirmation atomically credits destination.
            </div>
          </div>

          <div style={{ borderLeft: '3px solid var(--color-orange-500)', paddingLeft: 'var(--space-3)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-charcoal-900)' }}>
              5. Multi-Project & Warehouse Scoping
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              StoreKeepers and Engineers operate within assigned project/warehouse scopes; centralized audit trails record every change.
            </div>
          </div>

          <div style={{ borderLeft: '3px solid var(--color-charcoal-800)', paddingLeft: 'var(--space-3)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-charcoal-900)' }}>
              6. UTC Audit Timestamps & Traceability
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              All movements and approvals record UTC timestamps, user identity, IP address, and approval hierarchy chain.
            </div>
          </div>
        </div>
      </Card>
    </AppLayout>
  );
};
