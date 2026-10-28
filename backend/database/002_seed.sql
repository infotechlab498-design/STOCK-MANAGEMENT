/*
  Demo master data. Safe to re-run: inserts are skipped when the id already exists.
*/
USE StructStock;
GO

INSERT INTO dbo.Role (Id, Name, Description)
SELECT v.Id, v.Name, v.Description
FROM (VALUES
    (N'ROL-01', N'SuperAdmin', N'User administration, system governance, and master configuration'),
    (N'ROL-02', N'InventoryManager', N'Organization-wide inventory visibility and stock control operations'),
    (N'ROL-03', N'ProjectManager', N'Access limited to assigned projects and requisition approvals'),
    (N'ROL-04', N'ProcurementOfficer', N'Supplier registry, purchase orders, and procurement management'),
    (N'ROL-05', N'Storekeeper', N'Permitted warehouse receiving, material issues, and transfer dispatch'),
    (N'ROL-06', N'AccountsOfficer', N'Inventory cost analysis, weighted-average valuation, and ledger audit'),
    (N'ROL-07', N'Viewer', N'Read-only access to permitted reports and stock ledger statements'),
    (N'ROL-08', N'Auditor', N'Read-only audit of transfers, stock, and reports for assigned sites')
) AS v(Id, Name, Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Role r WHERE r.Id = v.Id);
GO

INSERT INTO dbo.AppUser (Id, Username, NormalizedUsername, Email, NormalizedEmail, FullName, PasswordHash, IsActive, CreatedAtUtc)
SELECT v.Id, v.Username, v.NormalizedUsername, v.Email, v.NormalizedEmail, v.FullName, v.PasswordHash, v.IsActive, v.CreatedAtUtc
FROM (VALUES
    (N'USR-ADMIN-01', N'admin', N'ADMIN', N'admin@constructcorp.com', N'ADMIN@CONSTRUCTCORP.COM', N'Alexander Vance', N'lXymkKlQ8jOaBF4y6RU+jg==:+1vPMYnxbcxu5Rn/vK+4k1uLNKqSWBxLh7PqILM25kQ=', 1, CAST(N'2026-01-15T08:00:00' AS datetime2)),
    (N'USR-MGR-02', N'inv.manager', N'INV.MANAGER', N'inv.manager@constructcorp.com', N'INV.MANAGER@CONSTRUCTCORP.COM', N'Elena Rostova', N'ptrqWQdhtJS3fmLJ7//ZVw==:cHxsrs4rbouB9JuyLxvqJA9bL9PuKbG6e4iE0CEQqts=', 1, CAST(N'2026-02-01T09:30:00' AS datetime2)),
    (N'USR-PM-03', N'pm.metro', N'PM.METRO', N'pm.metro@constructcorp.com', N'PM.METRO@CONSTRUCTCORP.COM', N'David Sterling', N'S/2R8I1+EQ2Rq1RkhjOhkA==:Bp/fQlybr5uvUIc194P6hcun5Xg6N7NV61nyHkHWAF4=', 1, CAST(N'2026-02-10T11:00:00' AS datetime2)),
    (N'USR-STR-04', N'store.north', N'STORE.NORTH', N'store.north@constructcorp.com', N'STORE.NORTH@CONSTRUCTCORP.COM', N'Marcus Vance', N'epKOLLpo7Md6Yc/6wNNdkA==:nwnQm77gMK2HnE2Cy9u+LaNH0QoEN1jrxKB59M20xP8=', 1, CAST(N'2026-02-15T14:15:00' AS datetime2)),
    (N'USR-PROC-05', N'procurement', N'PROCUREMENT', N'procurement@constructcorp.com', N'PROCUREMENT@CONSTRUCTCORP.COM', N'Samantha Lee', N'ot6qUvQcdabauwFlyHnogQ==:B6nw9DZbTbE2U2mpF6tqq8GBmiWfG7pEHy5jHKCTNYE=', 1, CAST(N'2026-03-01T10:00:00' AS datetime2)),
    (N'USR-ACCT-06', N'accounts', N'ACCOUNTS', N'accounts@constructcorp.com', N'ACCOUNTS@CONSTRUCTCORP.COM', N'Richard Hayes', N'JWdjcbo7oAnpAdpP0/tT1A==:cpFV4s062wLkbwvn6upIljNdl2SjBG4h8ukDBdYYqcI=', 1, CAST(N'2026-03-05T08:45:00' AS datetime2)),
    (N'USR-VIEW-07', N'auditor', N'AUDITOR', N'auditor@constructcorp.com', N'AUDITOR@CONSTRUCTCORP.COM', N'Claire Bennett', N'rEWSvSsMS+2LbgBioiyDkg==:+9mnVohVeoqOB6FMoegCqWLns1uArtS3HxoIUNLjeg0=', 1, CAST(N'2026-03-10T13:00:00' AS datetime2)),
    (N'USR-DIS-08', N'disabled.user', N'DISABLED.USER', N'disabled.user@constructcorp.com', N'DISABLED.USER@CONSTRUCTCORP.COM', N'Deactivated Personnel', N'yboyJJbhXCWQQz6mYuxZXg==:px6Oucu7tDc0ClSzS7XR5/cm2zJRPKVu3eb5KxDXVYo=', 0, CAST(N'2026-01-01T00:00:00' AS datetime2)),
    (N'USR-AUD-09', N'site.auditor', N'SITE.AUDITOR', N'site.auditor@constructcorp.com', N'SITE.AUDITOR@CONSTRUCTCORP.COM', N'Noah Patel', N'71D5IRhIkAOOiHFhwEO2zA==:aqxk56DCG7GtMtxIhKGJFf9boEdhNZYXHglNp7qE0Rc=', 1, CAST(N'2026-03-12T09:00:00' AS datetime2))
) AS v(Id, Username, NormalizedUsername, Email, NormalizedEmail, FullName, PasswordHash, IsActive, CreatedAtUtc)
WHERE NOT EXISTS (SELECT 1 FROM dbo.AppUser u WHERE u.Id = v.Id);
GO

INSERT INTO dbo.UserRole (UserId, RoleId)
SELECT v.UserId, v.RoleId
FROM (VALUES
    (N'USR-ADMIN-01', N'ROL-01'),
    (N'USR-ADMIN-01', N'ROL-02'),
    (N'USR-MGR-02', N'ROL-02'),
    (N'USR-PM-03', N'ROL-03'),
    (N'USR-STR-04', N'ROL-05'),
    (N'USR-PROC-05', N'ROL-04'),
    (N'USR-ACCT-06', N'ROL-06'),
    (N'USR-VIEW-07', N'ROL-07'),
    (N'USR-DIS-08', N'ROL-07'),
    (N'USR-AUD-09', N'ROL-08')
) AS v(UserId, RoleId)
WHERE NOT EXISTS (SELECT 1 FROM dbo.UserRole ur WHERE ur.UserId = v.UserId AND ur.RoleId = v.RoleId);
GO

INSERT INTO dbo.Project (Id, Code, Name, Location, ProjectManagerId, ProjectManagerName, IsActive, StartDate, TargetCompletionDate)
SELECT v.Id, v.Code, v.Name, v.Location, v.ProjectManagerId, v.ProjectManagerName, 1, v.StartDate, v.TargetCompletionDate
FROM (VALUES
    (N'PRJ-101', N'PRJ-METRO', N'Metro Rail Line 3 Extension', N'North Industrial Sector, Corridor B', N'USR-PM-03', N'David Sterling', CAST(N'2026-01-10' AS date), CAST(N'2027-12-31' AS date)),
    (N'PRJ-102', N'PRJ-HARBOR', N'Harbor Commercial Docklands', N'East Waterfront District, Berth 4', N'USR-ADMIN-01', N'Alexander Vance', CAST(N'2026-02-01' AS date), CAST(N'2028-06-30' AS date)),
    (N'PRJ-103', N'PRJ-TOWER', N'Skyline Corporate Towers', N'Central Business District, Plot 12', N'USR-ADMIN-01', N'Alexander Vance', CAST(N'2025-11-15' AS date), CAST(N'2027-08-31' AS date))
) AS v(Id, Code, Name, Location, ProjectManagerId, ProjectManagerName, StartDate, TargetCompletionDate)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Project p WHERE p.Id = v.Id);
GO

INSERT INTO dbo.Warehouse (Id, Code, Name, WarehouseType, ProjectId, Location, IsActive)
SELECT v.Id, v.Code, v.Name, v.WarehouseType, v.ProjectId, v.Location, 1
FROM (VALUES
    (N'WH-01', N'WH-CENTRAL-01', N'Central Distribution Yard & Main Store', N'Central Warehouse', N'PRJ-101', N'Industrial Logistics Zone, Sector 4'),
    (N'WH-02', N'WH-SITE-METRO', N'Metro Rail Line 3 Extension — Site Store', N'Project Site Store', N'PRJ-101', N'North Industrial Sector, Corridor B'),
    (N'WH-03', N'WH-SITE-HARBOR', N'Harbor Commercial Docklands — Site Store', N'Project Site Store', N'PRJ-102', N'East Waterfront District, Berth 4'),
    (N'WH-04', N'WH-SITE-TOWER', N'Skyline Corporate Towers — Site Store', N'Project Site Store', N'PRJ-103', N'Central Business District, Plot 12')
) AS v(Id, Code, Name, WarehouseType, ProjectId, Location)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Warehouse w WHERE w.Id = v.Id);
GO

INSERT INTO dbo.UserProjectScope (UserId, ProjectId)
SELECT v.UserId, v.ProjectId
FROM (VALUES
    (N'USR-ADMIN-01', N'PRJ-101'), (N'USR-ADMIN-01', N'PRJ-102'), (N'USR-ADMIN-01', N'PRJ-103'),
    (N'USR-MGR-02', N'PRJ-101'), (N'USR-MGR-02', N'PRJ-102'), (N'USR-MGR-02', N'PRJ-103'),
    (N'USR-PM-03', N'PRJ-101'),
    (N'USR-STR-04', N'PRJ-101'),
    (N'USR-PROC-05', N'PRJ-101'), (N'USR-PROC-05', N'PRJ-102'),
    (N'USR-ACCT-06', N'PRJ-101'), (N'USR-ACCT-06', N'PRJ-102'), (N'USR-ACCT-06', N'PRJ-103'),
    (N'USR-VIEW-07', N'PRJ-101'),
    (N'USR-DIS-08', N'PRJ-101'),
    (N'USR-AUD-09', N'PRJ-101')
) AS v(UserId, ProjectId)
WHERE NOT EXISTS (SELECT 1 FROM dbo.UserProjectScope s WHERE s.UserId = v.UserId AND s.ProjectId = v.ProjectId);
GO

INSERT INTO dbo.UserWarehouseScope (UserId, WarehouseId)
SELECT v.UserId, v.WarehouseId
FROM (VALUES
    (N'USR-ADMIN-01', N'WH-01'), (N'USR-ADMIN-01', N'WH-02'), (N'USR-ADMIN-01', N'WH-03'), (N'USR-ADMIN-01', N'WH-04'),
    (N'USR-MGR-02', N'WH-01'), (N'USR-MGR-02', N'WH-02'), (N'USR-MGR-02', N'WH-03'), (N'USR-MGR-02', N'WH-04'),
    (N'USR-PM-03', N'WH-01'), (N'USR-PM-03', N'WH-02'),
    (N'USR-STR-04', N'WH-02'),
    (N'USR-PROC-05', N'WH-01'), (N'USR-PROC-05', N'WH-02'),
    (N'USR-ACCT-06', N'WH-01'), (N'USR-ACCT-06', N'WH-02'), (N'USR-ACCT-06', N'WH-03'), (N'USR-ACCT-06', N'WH-04'),
    (N'USR-VIEW-07', N'WH-02'),
    (N'USR-DIS-08', N'WH-02'),
    (N'USR-AUD-09', N'WH-02')
) AS v(UserId, WarehouseId)
WHERE NOT EXISTS (SELECT 1 FROM dbo.UserWarehouseScope s WHERE s.UserId = v.UserId AND s.WarehouseId = v.WarehouseId);
GO

INSERT INTO dbo.MaterialCategory (Id, Code, Name, Description, IsActive)
SELECT v.Id, v.Code, v.Name, v.Description, 1
FROM (VALUES
    (N'CAT-STEEL', N'STEEL', N'Structural Steel & Rebar', N'Deformed reinforcement rebar, wire mesh, I-beams'),
    (N'CAT-CEMENT', N'CEMENT', N'Cement & Binders', N'Ordinary Portland Cement, Sulfate Resistant, Hydrated Lime'),
    (N'CAT-SAND', N'SAND', N'Sand & Fine Aggregates', N'Washed river sand, plaster sand, concrete sand'),
    (N'CAT-CRUSH', N'CRUSH', N'Crushed Aggregates & Gravel', N'10mm, 20mm, 40mm sub-base graded gravel'),
    (N'CAT-BRICKS', N'BRICKS', N'Bricks & Masonry Blocks', N'Red clay bricks, hollow concrete blocks, autoclaved aerated concrete (AAC)'),
    (N'CAT-TILES', N'TILES', N'Tiles & Ceramics', N'Vitrified floor tiles, glazed wall tiles, pavers'),
    (N'CAT-MARBLE', N'MARBLE', N'Marble & Granite', N'Granite counter slabs, polished marble tiles, thresholds'),
    (N'CAT-ELECTRICAL', N'ELECTRICAL', N'Electrical & Conduits', N'Cables, PVC conduit pipes, switchgear, distribution panels'),
    (N'CAT-PLUMBING', N'PLUMBING', N'Plumbing & Drainage', N'uPVC drainage pipes, PPR water pipes, valves, fittings'),
    (N'CAT-PAINT', N'PAINT', N'Paints & Waterproofing', N'Acrylic emulsion, primer, bituminous sealant membranes'),
    (N'CAT-TOOLS', N'TOOLS', N'Site Tools & Consumables', N'Diamond blades, steel trowels, shovels, PPE consumables'),
    (N'CAT-OTHER', N'OTHER', N'Other Construction Materials', N'Shuttering plywood, formwork ties, rebar spacers')
) AS v(Id, Code, Name, Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.MaterialCategory c WHERE c.Id = v.Id);
GO

INSERT INTO dbo.UnitOfMeasure (Id, Code, Name, Symbol, IsActive)
SELECT v.Id, v.Code, v.Name, v.Symbol, 1
FROM (VALUES
    (N'UNT-PCS', N'PCS', N'Piece', N'pcs'),
    (N'UNT-BAG', N'BAG', N'Bag (50kg standard)', N'bag'),
    (N'UNT-KG', N'KG', N'Kilogram', N'kg'),
    (N'UNT-MT', N'MT', N'Metric Tonne', N'MT'),
    (N'UNT-L', N'L', N'Litre', N'L'),
    (N'UNT-M', N'M', N'Meter', N'm'),
    (N'UNT-SQM', N'SQM', N'Square Meter', N'm2'),
    (N'UNT-CUM', N'CUM', N'Cubic Meter', N'm3')
) AS v(Id, Code, Name, Symbol)
WHERE NOT EXISTS (SELECT 1 FROM dbo.UnitOfMeasure u WHERE u.Id = v.Id);
GO

INSERT INTO dbo.Material (Id, ItemCode, NormalizedItemCode, Name, Description, Specification, CategoryId, BaseUnitId, MinimumStockLevel, ReorderLevel, IsActive, CreatedAtUtc)
SELECT v.Id, v.ItemCode, v.ItemCode, v.Name, v.Description, v.Specification, v.CategoryId, v.BaseUnitId, v.MinimumStockLevel, v.ReorderLevel, 1, v.CreatedAtUtc
FROM (VALUES
    (N'MAT-STEEL-01', N'STEEL-REBAR-T16', N'High-Tensile Deformed Rebar 16mm', N'Hot-rolled thermo-mechanically treated reinforcement rebar', N'Grade 500B / BS 4449, 12m standard lengths', N'CAT-STEEL', N'UNT-MT', CAST(10 AS decimal(18,4)), CAST(25 AS decimal(18,4)), CAST(N'2026-01-20T08:00:00' AS datetime2)),
    (N'MAT-CEM-02', N'CEM-OPC-50KG', N'Ordinary Portland Cement (CEM I 42.5N)', N'High early-strength general structural construction cement', N'BS EN 197-1, 50kg moisture-resistant packaging', N'CAT-CEMENT', N'UNT-BAG', CAST(200 AS decimal(18,4)), CAST(350 AS decimal(18,4)), CAST(N'2026-01-22T09:30:00' AS datetime2)),
    (N'MAT-AGG-03', N'AGG-CRUSH-20MM', N'Crushed Coarse Aggregate 20mm', N'Graded crushed blue granite for structural concrete mixes', N'ASTM C33, washed, flakiness index under 25 percent', N'CAT-CRUSH', N'UNT-MT', CAST(40 AS decimal(18,4)), CAST(60 AS decimal(18,4)), CAST(N'2026-02-01T11:00:00' AS datetime2)),
    (N'MAT-PIPE-04', N'PIPE-PVC-110MM', N'Heavy Duty PVC Drainage Pipe 110mm x 6m', N'Underground foul drainage and stormwater pipe', N'SN8 stiffness rating, push-fit rubber ring joint, 6.0m length', N'CAT-PLUMBING', N'UNT-PCS', CAST(50 AS decimal(18,4)), CAST(100 AS decimal(18,4)), CAST(N'2026-02-10T14:15:00' AS datetime2)),
    (N'MAT-BRK-05', N'BRK-RED-CLAY-01', N'Red Clay Facing Bricks 215x102x65mm', N'High compressive strength kiln-fired building bricks', N'BS EN 771-1, compressive strength at least 35 N/mm2', N'CAT-BRICKS', N'UNT-PCS', CAST(5000 AS decimal(18,4)), CAST(12000 AS decimal(18,4)), CAST(N'2026-02-15T10:00:00' AS datetime2))
) AS v(Id, ItemCode, Name, Description, Specification, CategoryId, BaseUnitId, MinimumStockLevel, ReorderLevel, CreatedAtUtc)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Material m WHERE m.Id = v.Id);
GO

INSERT INTO dbo.UnitConversion (Id, MaterialId, FromUnitId, ToUnitId, ConversionFactor, Description, IsActive)
SELECT v.Id, NULL, v.FromUnitId, v.ToUnitId, v.Factor, v.Description, 1
FROM (VALUES
    (N'CNV-1', N'UNT-MT', N'UNT-KG', CAST(1000 AS decimal(18,4)), N'1 Metric Tonne = 1,000 Kilograms'),
    (N'CNV-2', N'UNT-BAG', N'UNT-KG', CAST(50 AS decimal(18,4)), N'1 Standard Bag = 50 Kilograms')
) AS v(Id, FromUnitId, ToUnitId, Factor, Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.UnitConversion c WHERE c.Id = v.Id);
GO

INSERT INTO dbo.Supplier (Id, SupplierCode, NormalizedSupplierCode, Name, ContactPerson, Phone, Email, Address, TaxReference, PaymentTerms, Notes, IsActive, CreatedAtUtc, CreatedByUserId)
SELECT v.Id, v.SupplierCode, v.SupplierCode, v.Name, v.ContactPerson, v.Phone, v.Email, v.Address, v.TaxReference, v.PaymentTerms, v.Notes, 1, v.CreatedAtUtc, N'USR-ADMIN-01'
FROM (VALUES
    (N'SUP-APEX-01', N'SUP-APEX', N'Apex Structural Steel & Rebar Ltd.', N'Robert Jenkins', N'+1 (555) 342-8800', N'orders@apexsteel.com', N'142 Industrial Way, Sector 4, Metro City', N'TAX-US-8849201', N'Net 30 Days', N'Certified mill distributor for Grade 500B deformed rebar and wire mesh.', CAST(N'2026-01-10T08:00:00' AS datetime2)),
    (N'SUP-HORIZON-02', N'SUP-HORIZON', N'Horizon Ready-Mix & Aggregates Corp.', N'Elena Gomez', N'+1 (555) 789-2244', N'supply@horizonaggregates.com', N'88 Quarry Basin Road, North Harbor', N'TAX-US-6629104', N'Net 15 Days', N'Direct quarry operator for washed river sand, 20mm gravel, and CEM I cement.', CAST(N'2026-01-12T09:30:00' AS datetime2)),
    (N'SUP-VULCAN-03', N'SUP-VULCAN', N'Vulcan Piping & Infrastructure Supplies', N'Marcus Sterling', N'+1 (555) 443-9090', N'sales@vulcanpipes.com', N'520 Logistics Boulevard, Central Depot', N'TAX-US-3391820', N'Net 45 Days', N'Approved supplier for heavy-duty uPVC and PPR drainage and stormwater piping systems.', CAST(N'2026-01-18T11:15:00' AS datetime2))
) AS v(Id, SupplierCode, Name, ContactPerson, Phone, Email, Address, TaxReference, PaymentTerms, Notes, CreatedAtUtc)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Supplier s WHERE s.Id = v.Id);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SystemSetting WHERE Id = N'SETTINGS')
INSERT INTO dbo.SystemSetting (
    Id, ValuationPolicy, ValuationDescription, NegativeStockAllowed, SelfApprovalAllowed,
    RequireGrnInspectionBeforePosting, JwtExpirySeconds, Currency, AuditTrailRetentionDays,
    PrefixRequisition, PrefixPurchaseOrder, PrefixGrn, PrefixIssue, PrefixReturn, PrefixTransfer, PrefixStock, PrefixQuotation
) VALUES (
    N'SETTINGS', N'WEIGHTED_AVERAGE_COST', N'Moving Weighted Average Cost (WAC) per Project and Material',
    0, 0, 1, 3600, N'USD', 3650,
    N'MR', N'PO', N'GRN', N'MIV', N'MRN', N'STN', N'STK', N'QT'
);
GO

INSERT INTO dbo.NumberSeries (Prefix, CurrentYear, LastNumber)
SELECT v.Prefix, YEAR(SYSUTCDATETIME()), 0
FROM (VALUES (N'MR'), (N'PO'), (N'GRN'), (N'MIV'), (N'MRN'), (N'STN'), (N'STK'), (N'QT')) AS v(Prefix)
WHERE NOT EXISTS (SELECT 1 FROM dbo.NumberSeries n WHERE n.Prefix = v.Prefix);
GO
