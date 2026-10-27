import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';
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
          <ProtectedRoute>
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
          <ProtectedRoute>
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
        path="/requisitions/create"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProjectManager', 'Storekeeper']}>
            <Navigate to="/requisitions/new" replace />
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
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'ProcurementOfficer', 'Storekeeper', 'ProjectManager']}>
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

      {/* Stock Transfers & In-Transit Inventory */}
      <Route
        path="/stock-transfers"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager', 'AccountsOfficer', 'Auditor', 'Viewer']}>
            <StockTransferListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-transfers/new"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']}>
            <StockTransferFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-transfers/in-transit"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager', 'AccountsOfficer', 'Auditor', 'Viewer']}>
            <InTransitInventoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory/in-transit"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager', 'AccountsOfficer', 'Auditor', 'Viewer']}>
            <InTransitInventoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-transfers/discrepancies"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager', 'AccountsOfficer', 'Auditor', 'Viewer']}>
            <TransferDiscrepancyQueuePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-transfers/:id/edit"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']}>
            <StockTransferFormPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-transfers/:id"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager', 'AccountsOfficer', 'Auditor', 'Viewer']}>
            <StockTransferDetailPage />
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

      {/* Reports, Exports & Notifications */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsCenterPage />
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
            <ReportsCenterPage defaultReportType="consumption-issues-returns" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsCenterPage />
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
