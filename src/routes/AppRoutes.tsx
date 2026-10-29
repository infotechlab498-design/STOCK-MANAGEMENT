import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../app/useAuth';
import { isJwtTokenValid } from '../services/api/apiClient';
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
import { StockTransferListPage } from '../pages/StockTransferListPage';
import { StockTransferFormPage } from '../pages/StockTransferFormPage';
import { StockTransferDetailPage } from '../pages/StockTransferDetailPage';
import { InTransitInventoryPage } from '../pages/InTransitInventoryPage';
import { TransferDiscrepancyQueuePage } from '../pages/TransferDiscrepancyQueuePage';
import { ReportsCenterPage } from '../pages/ReportsCenterPage';
import { NotificationsCenterPage } from '../pages/NotificationsCenterPage';
import { ModulePlaceholderPage } from '../pages/ModulePlaceholderPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LoadingSpinner } from '../components/common/EmptyState';
import { AuthenticatedShell } from '../layouts/AuthenticatedShell';
import { rolesFor, rolesForAny } from '../security/rolePermissions';

// Protected Route Guard enforcing valid JWT session and role authorization
export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: string[];
}> = ({ children, allowedRoles }) => {
  const { user, token, isLoading, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
        <LoadingSpinner label="Verifying authentication session..." />
      </div>
    );
  }

  if (!token || !user || !isJwtTokenValid(token)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const PublicLoginRoute: React.FC = () => {
  const { user, token } = useAuth();
  if (token && user && isJwtTokenValid(token)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LoginPage />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={<PublicLoginRoute />} />

      {/* Shared Sidebar + TopHeader for every authenticated page */}
      <Route element={<AuthenticatedShell />}>
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
          <ProtectedRoute allowedRoles={rolesFor('nav.master.materials.view')}>
            <MaterialMasterPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/material-categories"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.master.categories')}>
            <ModulePlaceholderPage
              moduleName="Material Categories"
              category="Master Data"
              description="Taxonomy and grouping structure for construction inventories."
              targetPrompt="Master Data"
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
          <ProtectedRoute allowedRoles={rolesFor('nav.master.units')}>
            <ModulePlaceholderPage
              moduleName="Units of Measure (UoM)"
              category="Master Data"
              description="Standardized engineering metrics and dual-unit packaging conversion factors."
              targetPrompt="Master Data"
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
          <ProtectedRoute allowedRoles={rolesFor('nav.master.suppliers.view')}>
            <SupplierListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/suppliers/:id"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.master.suppliers.view')}>
            <SupplierDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.master.projects')}>
            <ModulePlaceholderPage
              moduleName="Construction Projects"
              category="Master Data"
              description="Multi-project portfolio, cost centers, and site staging boundaries."
              targetPrompt="Master Data"
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
          <ProtectedRoute allowedRoles={rolesFor('nav.master.warehouses')}>
            <ModulePlaceholderPage
              moduleName="Warehouses & Site Yards"
              category="Master Data"
              description="Central holding yards, on-site storage sheds, and transit hubs."
              targetPrompt="Master Data"
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
          <ProtectedRoute allowedRoles={rolesFor('nav.requisitions.view')}>
            <RequisitionListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/requisitions/new"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.requisitions.write')}>
            <RequisitionFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/requisitions/create"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.requisitions.write')}>
            <Navigate to="/requisitions/new" replace />
          </ProtectedRoute>
        }
      />

      <Route
        path="/requisitions/:id"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.requisitions.view')}>
            <RequisitionDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/requisitions/:id/edit"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.requisitions.write')}>
            <RequisitionFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/requisitions/:id/fulfillment"
        element={
          <ProtectedRoute allowedRoles={rolesForAny(['nav.requisitions.view', 'nav.inventory.issues.write'])}>
            <RequisitionFulfillmentPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/approvals"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.requisitions.approve')}>
            <ApprovalInboxPage />
          </ProtectedRoute>
        }
      />

      {/* Procurement & Purchase Orders */}
      <Route
        path="/purchase-orders"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.procurement.po.view')}>
            <PurchaseOrderListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/purchase-orders/new"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.procurement.po.write')}>
            <PurchaseOrderFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/purchase-orders/:id"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.procurement.po.view')}>
            <PurchaseOrderDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/purchase-orders/:id/edit"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.procurement.po.write')}>
            <PurchaseOrderFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/purchase-orders/rate-comparison"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.procurement.rates')}>
            <RateComparisonPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/quotations"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.procurement.rates')}>
            <RateComparisonPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pending-deliveries"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.procurement.po.view')}>
            <ModulePlaceholderPage
              moduleName="Pending Deliveries"
              category="Procurement"
              description="Supplier shipment dispatch monitoring and site gate arrival scheduling."
              targetPrompt="Procurement"
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
          <ProtectedRoute allowedRoles={rolesFor('nav.receiving.grn.view')}>
            <GrnListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/grns/new"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.receiving.grn.write')}>
            <CreateGrnPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/grns/:id"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.receiving.grn.view')}>
            <GrnDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/grns/:id/edit"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.receiving.grn.write')}>
            <CreateGrnPage />
          </ProtectedRoute>
        }
      />

      {/* Inventory & Stock */}
      <Route
        path="/stock"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.stock')}>
            <StockBalancesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory/balances"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.stock')}>
            <StockBalancesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-ledger"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.ledger')}>
            <StockLedgerPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory/ledger"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.ledger')}>
            <StockLedgerPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory/reconciliation"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.reconciliation')}>
            <InventoryReconciliationPage />
          </ProtectedRoute>
        }
      />

      {/* Stock Transfers & In-Transit Inventory */}
      <Route
        path="/stock-transfers"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.transfers.view')}>
            <StockTransferListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-transfers/new"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.transfers.write')}>
            <StockTransferFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-transfers/in-transit"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.transfers.view')}>
            <InTransitInventoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory/in-transit"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.transfers.view')}>
            <InTransitInventoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-transfers/discrepancies"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.transfers.view')}>
            <TransferDiscrepancyQueuePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-transfers/:id/edit"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.transfers.write')}>
            <StockTransferFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-transfers/:id"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.transfers.view')}>
            <StockTransferDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Material Issues */}
      <Route
        path="/material-issues"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.issues.view')}>
            <MaterialIssueListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/material-issues/new"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.issues.write')}>
            <MaterialIssueFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/material-issues/approval-inbox"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.issues.approve')}>
            <MaterialIssueApprovalInboxPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/material-issues/:id"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.issues.view')}>
            <MaterialIssueDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Material Returns */}
      <Route
        path="/material-returns"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.returns.view')}>
            <MaterialReturnListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/material-returns/new"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.returns.write')}>
            <MaterialReturnFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/material-returns/:id"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.inventory.returns.view')}>
            <MaterialReturnDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Reports, Exports & Notifications */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.reports.centre')}>
            <ReportsCenterPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports/valuation"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.reports.valuation')}>
            <InventoryValuationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports/consumption"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.reports.consumption')}>
            <ReportsCenterPage defaultReportType="consumption-issues-returns" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.notifications')}>
            <NotificationsCenterPage />
          </ProtectedRoute>
        }
      />

      {/* Administration */}
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.admin.users')}>
            <UsersManagementPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={rolesFor('nav.admin.settings')}>
            <ModulePlaceholderPage
              moduleName="System Settings"
              category="Administration"
              description="System configuration, numbering series prefixes, and session policy parameters."
              targetPrompt="Administration"
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
          <ProtectedRoute allowedRoles={rolesFor('nav.admin.architecture')}>
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
      </Route>
    </Routes>
  );
};
