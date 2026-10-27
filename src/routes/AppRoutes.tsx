import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';
import { LoginPage } from '../components/auth/LoginPage';
import { DashboardOverviewPage } from '../pages/DashboardOverviewPage';
import { UsersManagementPage } from '../pages/UsersManagementPage';
import { ArchitectureFoundationPage } from '../pages/ArchitectureFoundationPage';
import { MaterialMasterPage } from '../pages/MaterialMasterPage';
import { RequisitionListPage } from '../pages/RequisitionListPage';
import { RequisitionDetailPage } from '../pages/RequisitionDetailPage';
import { RequisitionFormPage } from '../pages/RequisitionFormPage';
import { ApprovalInboxPage } from '../pages/ApprovalInboxPage';
import { SupplierListPage } from '../pages/SupplierListPage';
import { SupplierDetailPage } from '../pages/SupplierDetailPage';
import { PurchaseOrderListPage } from '../pages/PurchaseOrderListPage';
import { PurchaseOrderFormPage } from '../pages/PurchaseOrderFormPage';
import { PurchaseOrderDetailPage } from '../pages/PurchaseOrderDetailPage';
import { RateComparisonPage } from '../pages/RateComparisonPage';
import { GrnListPage } from '../pages/GrnListPage';
import { CreateGrnPage } from '../pages/CreateGrnPage';
import { GrnDetailPage } from '../pages/GrnDetailPage';
import { StockBalancesPage } from '../pages/StockBalancesPage';
import { StockLedgerPage } from '../pages/StockLedgerPage';
import { InventoryValuationPage } from '../pages/InventoryValuationPage';
import { InventoryReconciliationPage } from '../pages/InventoryReconciliationPage';
import { MaterialIssueListPage } from '../pages/MaterialIssueListPage';
import { MaterialIssueFormPage } from '../pages/MaterialIssueFormPage';
import { MaterialIssueDetailPage } from '../pages/MaterialIssueDetailPage';
import { MaterialIssueApprovalInboxPage } from '../pages/MaterialIssueApprovalInboxPage';
import { MaterialReturnListPage } from '../pages/MaterialReturnListPage';
import { MaterialReturnFormPage } from '../pages/MaterialReturnFormPage';
import { MaterialReturnDetailPage } from '../pages/MaterialReturnDetailPage';
import { RequisitionFulfillmentPage } from '../pages/RequisitionFulfillmentPage';
import { ModulePlaceholderPage } from '../pages/ModulePlaceholderPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoadingSpinner } from '../components/common/EmptyState';

// Protected Route Guard
export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: string[];
}> = ({ children, allowedRoles }) => {
  const { user, token, isLoading, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <LoadingSpinner label="Authenticating session security credentials..." />
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  const { user, token, isLoading } = useAuth();

  return (
    <Routes>
      {/* Public Login Route */}
      <Route
        path="/login"
        element={
          !isLoading && token && user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage />
          )
        }
      />

      {/* Root redirect */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to="/dashboard" replace />
          </ProtectedRoute>
        }
      />

      {/* Core Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardOverviewPage />
          </ProtectedRoute>
        }
      />

      {/* Master Data Routes */}
      <Route
        path="/materials"
        element={
          <ProtectedRoute>
            <MaterialMasterPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/material-categories"
        element={
          <ProtectedRoute>
            <ModulePlaceholderPage
              moduleName="Material Categories"
              category="Master Data"
              description="Taxonomy and grouping structure for construction inventories."
              targetPrompt="Prompt 2"
              businessCapabilities={[
                'Hierarchical material categories and subcategories',
                'Default valuation and storage temperature rules',
                'Hazardous material tags and handling protocols',
              ]}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/units"
        element={
          <ProtectedRoute>
            <ModulePlaceholderPage
              moduleName="Units of Measure (UoM)"
              category="Master Data"
              description="Standardized engineering metrics and dual-unit packaging conversion factors."
              targetPrompt="Prompt 2"
              businessCapabilities={[
                'Base units (MT, Bags, Lengths, Pcs, SqM, CuM)',
                'Precision conversion factors with strict decimal rounding',
                'Packaging ratios (e.g. 50kg Bags to Metric Tonnes)',
              ]}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/suppliers"
        element={
          <ProtectedRoute>
            <SupplierListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/suppliers/:id"
        element={
          <ProtectedRoute>
            <SupplierDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ModulePlaceholderPage
              moduleName="Construction Projects"
              category="Master Data"
              description="Multi-project portfolio, cost centers, and site staging boundaries."
              targetPrompt="Prompt 2"
              businessCapabilities={[
                'Multi-project boundary scoping',
                'Assigned Project Managers and site controllers',
                'Work Breakdown Structure (WBS) cost codes',
              ]}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/warehouses"
        element={
          <ProtectedRoute>
            <ModulePlaceholderPage
              moduleName="Warehouses & Site Yards"
              category="Master Data"
              description="Central holding yards, on-site storage sheds, and transit hubs."
              targetPrompt="Prompt 2"
              businessCapabilities={[
                'Location and staging yard definitions',
                'Designated Storekeeper access assignments',
                'Bin location tracking and capacity limits',
              ]}
            />
          </ProtectedRoute>
        }
      />

      {/* Material Requisitions & Approvals */}
      <Route
        path="/requisitions"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProjectManager', 'Storekeeper']}>
            <RequisitionListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/requisitions/new"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProjectManager', 'Storekeeper']}>
            <RequisitionFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/requisitions/:id"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProjectManager', 'Storekeeper']}>
            <RequisitionDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/requisitions/:id/edit"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProjectManager', 'Storekeeper']}>
            <RequisitionFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/requisitions/:id/fulfillment"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProjectManager', 'Storekeeper']}>
            <RequisitionFulfillmentPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/approvals"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProjectManager']}>
            <ApprovalInboxPage />
          </ProtectedRoute>
        }
      />

      {/* Procurement & Purchase Orders */}
      <Route
        path="/purchase-orders"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProcurementOfficer', 'ProjectManager']}>
            <PurchaseOrderListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/purchase-orders/new"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']}>
            <PurchaseOrderFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/purchase-orders/:id"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProcurementOfficer', 'ProjectManager']}>
            <PurchaseOrderDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/purchase-orders/:id/edit"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']}>
            <PurchaseOrderFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/purchase-orders/rate-comparison"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProcurementOfficer', 'ProjectManager']}>
            <RateComparisonPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/quotations"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProcurementOfficer', 'ProjectManager']}>
            <RateComparisonPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pending-deliveries"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']}>
            <ModulePlaceholderPage
              moduleName="Pending Deliveries"
              category="Procurement"
              description="Supplier shipment dispatch monitoring and site gate arrival scheduling."
              targetPrompt="Prompt 5"
              businessCapabilities={[
                'In-transit supplier tracking',
                'Expected delivery date monitoring',
                'Late delivery escalation alerts',
              ]}
            />
          </ProtectedRoute>
        }
      />

      {/* Goods Receiving & Quality Inspection */}
      <Route
        path="/grns"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProcurementOfficer', 'ProjectManager']}>
            <GrnListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/grns/new"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProcurementOfficer']}>
            <CreateGrnPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/grns/:id"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProcurementOfficer', 'ProjectManager']}>
            <GrnDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/grns/:id/edit"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProcurementOfficer']}>
            <CreateGrnPage />
          </ProtectedRoute>
        }
      />

      {/* Inventory & Stock */}
      <Route
        path="/stock"
        element={
          <ProtectedRoute>
            <StockBalancesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory/balances"
        element={
          <ProtectedRoute>
            <StockBalancesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-ledger"
        element={
          <ProtectedRoute>
            <StockLedgerPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory/ledger"
        element={
          <ProtectedRoute>
            <StockLedgerPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory/reconciliation"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'AccountsOfficer', 'ProjectManager']}>
            <InventoryReconciliationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-transfers"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']}>
            <ModulePlaceholderPage
              moduleName="Inter-Site Stock Transfers"
              category="Inventory & Stock"
              description="3-stage custody stock transfers between project locations."
              targetPrompt="Prompt 6"
              businessCapabilities={[
                'Stage 1: Source dispatch quantity reduction',
                'Stage 2: In-transit custody lock',
                'Stage 3: Destination receipt inspection and atomic addition',
              ]}
            />
          </ProtectedRoute>
        }
      />

      {/* Material Issues */}
      <Route
        path="/material-issues"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']}>
            <MaterialIssueListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/material-issues/new"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']}>
            <MaterialIssueFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/material-issues/approval-inbox"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProjectManager']}>
            <MaterialIssueApprovalInboxPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/material-issues/:id"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']}>
            <MaterialIssueDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Material Returns */}
      <Route
        path="/material-returns"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']}>
            <MaterialReturnListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/material-returns/new"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']}>
            <MaterialReturnFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/material-returns/:id"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']}>
            <MaterialReturnDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Reports & Valuation */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ModulePlaceholderPage
              moduleName="Stock Summary Reports"
              category="Reports & Valuation"
              description="Comprehensive stock reports, turnover analysis, and inventory distribution."
              targetPrompt="Prompt 6"
              businessCapabilities={[
                'Organization-wide inventory summary',
                'Slow-moving and dead stock identification',
                'Excel (.xlsx) and PDF statement generation',
              ]}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports/valuation"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'AccountsOfficer']}>
            <InventoryValuationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports/consumption"
        element={
          <ProtectedRoute>
            <ModulePlaceholderPage
              moduleName="Material Consumption Analytics"
              category="Reports & Valuation"
              description="Material consumption rates compared against Bill of Quantities (BOQ) benchmarks."
              targetPrompt="Prompt 6"
              businessCapabilities={[
                'Actual vs Estimated consumption metrics',
                'Site waste percentage tracking',
                'Project stage cost variance',
              ]}
            />
          </ProtectedRoute>
        }
      />

      {/* Administration */}
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager']}>
            <UsersManagementPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin']}>
            <ModulePlaceholderPage
              moduleName="System Settings"
              category="Administration"
              description="System configuration, numbering series prefixes, and session policy parameters."
              targetPrompt="Prompt 6"
              businessCapabilities={[
                'Document number prefixes (GRN-, REQ-, PO-, TRF-)',
                'Session inactivity timeout parameters',
                'Audit log archive and retention rules',
              ]}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/architecture"
        element={
          <ProtectedRoute>
            <ArchitectureFoundationPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all 404 Route */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <NotFoundPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};
