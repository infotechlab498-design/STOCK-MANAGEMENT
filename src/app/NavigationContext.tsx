import React, { createContext, useContext, useState, ReactNode } from 'react';

export type AppPage =
  | 'dashboard'
  | 'materials'
  | 'requisitions'
  | 'purchase-orders'
  | 'grn'
  | 'issues'
  | 'transfers'
  | 'ledger'
  | 'reports'
  | 'architecture'
  | 'users';

export interface ProjectContext {
  id: string;
  code: string;
  name: string;
}

export interface WarehouseContext {
  id: string;
  code: string;
  name: string;
  projectId: string;
}

export interface UserContext {
  id: string;
  fullName: string;
  role: 'StoreKeeper' | 'ProjectManager' | 'InventoryController' | 'Admin';
  email: string;
}

interface NavigationContextType {
  currentPage: AppPage;
  setCurrentPage: (page: AppPage) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  activeProject: ProjectContext;
  setActiveProject: (p: ProjectContext) => void;
  activeWarehouse: WarehouseContext;
  setActiveWarehouse: (w: WarehouseContext) => void;
  currentUser: UserContext;
  availableProjects: ProjectContext[];
  availableWarehouses: WarehouseContext[];
}

const defaultProjects: ProjectContext[] = [
  { id: 'PRJ-101', code: 'PRJ-METRO-01', name: 'Downtown Metro Station Phase 2' },
  { id: 'PRJ-102', code: 'PRJ-BRIDGE-04', name: 'River Crossing Viaduct Package B' },
  { id: 'PRJ-103', code: 'PRJ-TOWER-09', name: 'Horizon Commercial High-Rise' },
];

const defaultWarehouses: WarehouseContext[] = [
  { id: 'WH-01', code: 'WH-CENTRAL', name: 'Central Holding Yard', projectId: 'PRJ-101' },
  { id: 'WH-02', code: 'WH-SITE-A', name: 'Metro North Site Store', projectId: 'PRJ-101' },
  { id: 'WH-03', code: 'WH-SITE-B', name: 'Viaduct Pier Staging Depot', projectId: 'PRJ-102' },
];

const defaultUser: UserContext = {
  id: 'USR-8821',
  fullName: 'Marcus Vance',
  role: 'InventoryController',
  email: 'm.vance@constructcorp.internal',
};

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [activeProject, setActiveProject] = useState<ProjectContext>(defaultProjects[0]);
  const [activeWarehouse, setActiveWarehouse] = useState<WarehouseContext>(defaultWarehouses[0]);

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);

  return (
    <NavigationContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        sidebarCollapsed,
        toggleSidebar,
        mobileMenuOpen,
        setMobileMenuOpen,
        activeProject,
        setActiveProject,
        activeWarehouse,
        setActiveWarehouse,
        currentUser: defaultUser,
        availableProjects: defaultProjects,
        availableWarehouses: defaultWarehouses,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}
