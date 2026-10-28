/*
  StructStock schema for SQL Server.
  Run in SSMS against localhost\SQLEXPRESS (or your instance) before 002_seed.sql.
*/
IF DB_ID(N'StructStock') IS NULL
BEGIN
    CREATE DATABASE StructStock;
END
GO

USE StructStock;
GO

/* ---------- Identity ---------- */
IF OBJECT_ID(N'dbo.Role', N'U') IS NULL
CREATE TABLE dbo.Role (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_Role PRIMARY KEY,
    Name nvarchar(80) NOT NULL,
    Description nvarchar(400) NOT NULL,
    CONSTRAINT UQ_Role_Name UNIQUE (Name)
);
GO

IF OBJECT_ID(N'dbo.AppUser', N'U') IS NULL
CREATE TABLE dbo.AppUser (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_AppUser PRIMARY KEY,
    Username nvarchar(80) NOT NULL,
    NormalizedUsername nvarchar(80) NOT NULL,
    Email nvarchar(200) NOT NULL,
    NormalizedEmail nvarchar(200) NOT NULL,
    FullName nvarchar(200) NOT NULL,
    PasswordHash nvarchar(500) NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_AppUser_IsActive DEFAULT (1),
    CreatedAtUtc datetime2 NOT NULL,
    UpdatedAtUtc datetime2 NULL,
    LastLoginAtUtc datetime2 NULL,
    CONSTRAINT UQ_AppUser_Username UNIQUE (NormalizedUsername),
    CONSTRAINT UQ_AppUser_Email UNIQUE (NormalizedEmail)
);
GO

IF OBJECT_ID(N'dbo.UserRole', N'U') IS NULL
CREATE TABLE dbo.UserRole (
    UserId nvarchar(40) NOT NULL,
    RoleId nvarchar(40) NOT NULL,
    CONSTRAINT PK_UserRole PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRole_User FOREIGN KEY (UserId) REFERENCES dbo.AppUser(Id),
    CONSTRAINT FK_UserRole_Role FOREIGN KEY (RoleId) REFERENCES dbo.Role(Id)
);
GO

IF OBJECT_ID(N'dbo.LoginAttempt', N'U') IS NULL
CREATE TABLE dbo.LoginAttempt (
    TrackerKey nvarchar(300) NOT NULL CONSTRAINT PK_LoginAttempt PRIMARY KEY,
    FailCount int NOT NULL,
    LockedUntilUtc datetime2 NULL
);
GO

/* ---------- Masters ---------- */
IF OBJECT_ID(N'dbo.MaterialCategory', N'U') IS NULL
CREATE TABLE dbo.MaterialCategory (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_MaterialCategory PRIMARY KEY,
    Code nvarchar(40) NOT NULL,
    Name nvarchar(200) NOT NULL,
    Description nvarchar(500) NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Category_IsActive DEFAULT (1),
    CONSTRAINT UQ_MaterialCategory_Code UNIQUE (Code)
);
GO

IF OBJECT_ID(N'dbo.UnitOfMeasure', N'U') IS NULL
CREATE TABLE dbo.UnitOfMeasure (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_UnitOfMeasure PRIMARY KEY,
    Code nvarchar(40) NOT NULL,
    Name nvarchar(120) NOT NULL,
    Symbol nvarchar(20) NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Unit_IsActive DEFAULT (1),
    CONSTRAINT UQ_UnitOfMeasure_Code UNIQUE (Code)
);
GO

IF OBJECT_ID(N'dbo.Project', N'U') IS NULL
CREATE TABLE dbo.Project (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_Project PRIMARY KEY,
    Code nvarchar(40) NOT NULL,
    Name nvarchar(200) NOT NULL,
    Location nvarchar(300) NOT NULL,
    ProjectManagerId nvarchar(40) NULL,
    ProjectManagerName nvarchar(200) NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Project_IsActive DEFAULT (1),
    StartDate date NULL,
    TargetCompletionDate date NULL,
    CONSTRAINT UQ_Project_Code UNIQUE (Code),
    CONSTRAINT FK_Project_Manager FOREIGN KEY (ProjectManagerId) REFERENCES dbo.AppUser(Id)
);
GO

IF OBJECT_ID(N'dbo.Warehouse', N'U') IS NULL
CREATE TABLE dbo.Warehouse (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_Warehouse PRIMARY KEY,
    Code nvarchar(40) NOT NULL,
    Name nvarchar(200) NOT NULL,
    WarehouseType nvarchar(80) NOT NULL,
    ProjectId nvarchar(40) NOT NULL,
    Location nvarchar(300) NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Warehouse_IsActive DEFAULT (1),
    CONSTRAINT UQ_Warehouse_Code UNIQUE (Code),
    CONSTRAINT FK_Warehouse_Project FOREIGN KEY (ProjectId) REFERENCES dbo.Project(Id)
);
GO

IF OBJECT_ID(N'dbo.UserProjectScope', N'U') IS NULL
CREATE TABLE dbo.UserProjectScope (
    UserId nvarchar(40) NOT NULL,
    ProjectId nvarchar(40) NOT NULL,
    CONSTRAINT PK_UserProjectScope PRIMARY KEY (UserId, ProjectId),
    CONSTRAINT FK_UserProjectScope_User FOREIGN KEY (UserId) REFERENCES dbo.AppUser(Id),
    CONSTRAINT FK_UserProjectScope_Project FOREIGN KEY (ProjectId) REFERENCES dbo.Project(Id)
);
GO

IF OBJECT_ID(N'dbo.UserWarehouseScope', N'U') IS NULL
CREATE TABLE dbo.UserWarehouseScope (
    UserId nvarchar(40) NOT NULL,
    WarehouseId nvarchar(40) NOT NULL,
    CONSTRAINT PK_UserWarehouseScope PRIMARY KEY (UserId, WarehouseId),
    CONSTRAINT FK_UserWarehouseScope_User FOREIGN KEY (UserId) REFERENCES dbo.AppUser(Id),
    CONSTRAINT FK_UserWarehouseScope_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouse(Id)
);
GO

IF OBJECT_ID(N'dbo.Material', N'U') IS NULL
CREATE TABLE dbo.Material (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_Material PRIMARY KEY,
    ItemCode nvarchar(60) NOT NULL,
    NormalizedItemCode nvarchar(60) NOT NULL,
    Name nvarchar(200) NOT NULL,
    Description nvarchar(800) NULL,
    Specification nvarchar(800) NULL,
    CategoryId nvarchar(40) NOT NULL,
    BaseUnitId nvarchar(40) NOT NULL,
    MinimumStockLevel decimal(18,4) NOT NULL,
    ReorderLevel decimal(18,4) NOT NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Material_IsActive DEFAULT (1),
    CreatedAtUtc datetime2 NOT NULL,
    UpdatedAtUtc datetime2 NULL,
    CreatedByUserId nvarchar(40) NULL,
    UpdatedByUserId nvarchar(40) NULL,
    CONSTRAINT UQ_Material_ItemCode UNIQUE (NormalizedItemCode),
    CONSTRAINT FK_Material_Category FOREIGN KEY (CategoryId) REFERENCES dbo.MaterialCategory(Id),
    CONSTRAINT FK_Material_Unit FOREIGN KEY (BaseUnitId) REFERENCES dbo.UnitOfMeasure(Id)
);
GO

IF OBJECT_ID(N'dbo.UnitConversion', N'U') IS NULL
CREATE TABLE dbo.UnitConversion (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_UnitConversion PRIMARY KEY,
    MaterialId nvarchar(40) NULL,
    FromUnitId nvarchar(40) NOT NULL,
    ToUnitId nvarchar(40) NOT NULL,
    ConversionFactor decimal(18,4) NOT NULL,
    Description nvarchar(300) NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Conversion_IsActive DEFAULT (1),
    CONSTRAINT FK_UnitConversion_Material FOREIGN KEY (MaterialId) REFERENCES dbo.Material(Id),
    CONSTRAINT FK_UnitConversion_From FOREIGN KEY (FromUnitId) REFERENCES dbo.UnitOfMeasure(Id),
    CONSTRAINT FK_UnitConversion_To FOREIGN KEY (ToUnitId) REFERENCES dbo.UnitOfMeasure(Id)
);
GO

IF OBJECT_ID(N'dbo.Supplier', N'U') IS NULL
CREATE TABLE dbo.Supplier (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_Supplier PRIMARY KEY,
    SupplierCode nvarchar(40) NOT NULL,
    NormalizedSupplierCode nvarchar(40) NOT NULL,
    Name nvarchar(200) NOT NULL,
    ContactPerson nvarchar(200) NOT NULL,
    Phone nvarchar(80) NOT NULL,
    Email nvarchar(200) NOT NULL,
    Address nvarchar(400) NOT NULL,
    TaxReference nvarchar(80) NULL,
    PaymentTerms nvarchar(120) NULL,
    Notes nvarchar(800) NULL,
    IsActive bit NOT NULL CONSTRAINT DF_Supplier_IsActive DEFAULT (1),
    CreatedAtUtc datetime2 NOT NULL,
    UpdatedAtUtc datetime2 NULL,
    CreatedByUserId nvarchar(40) NULL,
    UpdatedByUserId nvarchar(40) NULL,
    CONSTRAINT UQ_Supplier_Code UNIQUE (NormalizedSupplierCode)
);
GO

IF OBJECT_ID(N'dbo.SystemSetting', N'U') IS NULL
CREATE TABLE dbo.SystemSetting (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_SystemSetting PRIMARY KEY,
    ValuationPolicy nvarchar(80) NOT NULL,
    ValuationDescription nvarchar(300) NOT NULL,
    NegativeStockAllowed bit NOT NULL,
    SelfApprovalAllowed bit NOT NULL,
    RequireGrnInspectionBeforePosting bit NOT NULL,
    JwtExpirySeconds int NOT NULL,
    Currency nvarchar(8) NOT NULL,
    AuditTrailRetentionDays int NOT NULL,
    PrefixRequisition nvarchar(12) NOT NULL,
    PrefixPurchaseOrder nvarchar(12) NOT NULL,
    PrefixGrn nvarchar(12) NOT NULL,
    PrefixIssue nvarchar(12) NOT NULL,
    PrefixReturn nvarchar(12) NOT NULL,
    PrefixTransfer nvarchar(12) NOT NULL,
    PrefixStock nvarchar(12) NOT NULL,
    PrefixQuotation nvarchar(12) NOT NULL
);
GO

IF OBJECT_ID(N'dbo.NumberSeries', N'U') IS NULL
CREATE TABLE dbo.NumberSeries (
    Prefix nvarchar(12) NOT NULL CONSTRAINT PK_NumberSeries PRIMARY KEY,
    CurrentYear int NOT NULL,
    LastNumber int NOT NULL
);
GO

/* ---------- Requisitions ---------- */
IF OBJECT_ID(N'dbo.Requisition', N'U') IS NULL
CREATE TABLE dbo.Requisition (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_Requisition PRIMARY KEY,
    RequisitionNumber nvarchar(40) NOT NULL,
    ProjectId nvarchar(40) NOT NULL,
    RequesterUserId nvarchar(40) NOT NULL,
    RequesterName nvarchar(200) NOT NULL,
    RequesterRole nvarchar(80) NOT NULL,
    RequiredDate date NOT NULL,
    Priority nvarchar(20) NOT NULL,
    Purpose nvarchar(500) NOT NULL,
    WorkActivity nvarchar(300) NULL,
    SiteLocationDetail nvarchar(300) NULL,
    Status nvarchar(40) NOT NULL,
    RejectionReason nvarchar(500) NULL,
    CorrectionNotes nvarchar(500) NULL,
    ApprovedByUserId nvarchar(40) NULL,
    ApprovedByName nvarchar(200) NULL,
    ApprovedAtUtc datetime2 NULL,
    CreatedAtUtc datetime2 NOT NULL,
    UpdatedAtUtc datetime2 NULL,
    CONSTRAINT UQ_Requisition_Number UNIQUE (RequisitionNumber),
    CONSTRAINT FK_Requisition_Project FOREIGN KEY (ProjectId) REFERENCES dbo.Project(Id)
);
GO

IF OBJECT_ID(N'dbo.RequisitionLine', N'U') IS NULL
CREATE TABLE dbo.RequisitionLine (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_RequisitionLine PRIMARY KEY,
    RequisitionId nvarchar(40) NOT NULL,
    MaterialId nvarchar(40) NOT NULL,
    RequestedQuantity decimal(18,4) NOT NULL,
    Remarks nvarchar(400) NULL,
    CONSTRAINT FK_RequisitionLine_Header FOREIGN KEY (RequisitionId) REFERENCES dbo.Requisition(Id) ON DELETE CASCADE,
    CONSTRAINT FK_RequisitionLine_Material FOREIGN KEY (MaterialId) REFERENCES dbo.Material(Id)
);
GO

IF OBJECT_ID(N'dbo.RequisitionAudit', N'U') IS NULL
CREATE TABLE dbo.RequisitionAudit (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_RequisitionAudit PRIMARY KEY,
    RequisitionId nvarchar(40) NOT NULL,
    ActorUserId nvarchar(40) NOT NULL,
    ActorName nvarchar(200) NOT NULL,
    ActorRole nvarchar(80) NOT NULL,
    Action nvarchar(40) NOT NULL,
    Comments nvarchar(500) NULL,
    TimestampUtc datetime2 NOT NULL,
    CONSTRAINT FK_RequisitionAudit_Header FOREIGN KEY (RequisitionId) REFERENCES dbo.Requisition(Id) ON DELETE CASCADE
);
GO

/* ---------- Purchase orders and quotations ---------- */
IF OBJECT_ID(N'dbo.PurchaseOrder', N'U') IS NULL
CREATE TABLE dbo.PurchaseOrder (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_PurchaseOrder PRIMARY KEY,
    PoNumber nvarchar(40) NOT NULL,
    SupplierId nvarchar(40) NOT NULL,
    RequisitionId nvarchar(40) NULL,
    ProjectId nvarchar(40) NOT NULL,
    DeliveryLocation nvarchar(300) NOT NULL,
    OrderDate date NOT NULL,
    ExpectedDeliveryDate date NOT NULL,
    Currency nvarchar(8) NOT NULL,
    PaymentTerms nvarchar(120) NOT NULL,
    Notes nvarchar(800) NULL,
    Status nvarchar(40) NOT NULL,
    Subtotal decimal(18,4) NOT NULL,
    ItemsDiscount decimal(18,4) NOT NULL,
    HeaderDiscount decimal(18,4) NOT NULL,
    TotalDiscount decimal(18,4) NOT NULL,
    TaxAmount decimal(18,4) NOT NULL,
    Freight decimal(18,4) NOT NULL,
    GrandTotal decimal(18,4) NOT NULL,
    RejectionReason nvarchar(500) NULL,
    CancellationReason nvarchar(500) NULL,
    ApprovedByUserId nvarchar(40) NULL,
    ApprovedByName nvarchar(200) NULL,
    ApprovedAtUtc datetime2 NULL,
    IssuedByUserId nvarchar(40) NULL,
    IssuedByName nvarchar(200) NULL,
    IssuedAtUtc datetime2 NULL,
    CreatedAtUtc datetime2 NOT NULL,
    UpdatedAtUtc datetime2 NULL,
    CreatedByUserId nvarchar(40) NOT NULL,
    CreatedByName nvarchar(200) NOT NULL,
    CONSTRAINT UQ_PurchaseOrder_Number UNIQUE (PoNumber),
    CONSTRAINT FK_PurchaseOrder_Supplier FOREIGN KEY (SupplierId) REFERENCES dbo.Supplier(Id),
    CONSTRAINT FK_PurchaseOrder_Project FOREIGN KEY (ProjectId) REFERENCES dbo.Project(Id),
    CONSTRAINT FK_PurchaseOrder_Requisition FOREIGN KEY (RequisitionId) REFERENCES dbo.Requisition(Id)
);
GO

IF OBJECT_ID(N'dbo.PurchaseOrderLine', N'U') IS NULL
CREATE TABLE dbo.PurchaseOrderLine (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_PurchaseOrderLine PRIMARY KEY,
    PurchaseOrderId nvarchar(40) NOT NULL,
    MaterialId nvarchar(40) NOT NULL,
    RequisitionLineId nvarchar(40) NULL,
    OrderedQuantity decimal(18,4) NOT NULL,
    ReceivedQuantity decimal(18,4) NOT NULL,
    UnitRate decimal(18,4) NOT NULL,
    LineDiscount decimal(18,4) NOT NULL,
    TaxRate decimal(18,4) NOT NULL,
    TaxAmount decimal(18,4) NOT NULL,
    LineTotal decimal(18,4) NOT NULL,
    Notes nvarchar(400) NULL,
    CONSTRAINT FK_PurchaseOrderLine_Header FOREIGN KEY (PurchaseOrderId) REFERENCES dbo.PurchaseOrder(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PurchaseOrderLine_Material FOREIGN KEY (MaterialId) REFERENCES dbo.Material(Id)
);
GO

IF OBJECT_ID(N'dbo.PurchaseOrderAudit', N'U') IS NULL
CREATE TABLE dbo.PurchaseOrderAudit (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_PurchaseOrderAudit PRIMARY KEY,
    PurchaseOrderId nvarchar(40) NOT NULL,
    ActorUserId nvarchar(40) NOT NULL,
    ActorName nvarchar(200) NOT NULL,
    ActorRole nvarchar(80) NOT NULL,
    Action nvarchar(40) NOT NULL,
    Comments nvarchar(500) NULL,
    TimestampUtc datetime2 NOT NULL,
    CONSTRAINT FK_PurchaseOrderAudit_Header FOREIGN KEY (PurchaseOrderId) REFERENCES dbo.PurchaseOrder(Id) ON DELETE CASCADE
);
GO

IF OBJECT_ID(N'dbo.Quotation', N'U') IS NULL
CREATE TABLE dbo.Quotation (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_Quotation PRIMARY KEY,
    QuotationReference nvarchar(40) NOT NULL,
    SupplierId nvarchar(40) NOT NULL,
    QuoteDate date NOT NULL,
    ValidUntil date NOT NULL,
    Currency nvarchar(8) NOT NULL,
    PaymentTerms nvarchar(120) NOT NULL,
    Notes nvarchar(800) NULL,
    CreatedAtUtc datetime2 NOT NULL,
    CONSTRAINT UQ_Quotation_Reference UNIQUE (QuotationReference),
    CONSTRAINT FK_Quotation_Supplier FOREIGN KEY (SupplierId) REFERENCES dbo.Supplier(Id)
);
GO

IF OBJECT_ID(N'dbo.QuotationLine', N'U') IS NULL
CREATE TABLE dbo.QuotationLine (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_QuotationLine PRIMARY KEY,
    QuotationId nvarchar(40) NOT NULL,
    MaterialId nvarchar(40) NOT NULL,
    QuotedQuantity decimal(18,4) NOT NULL,
    UnitRate decimal(18,4) NOT NULL,
    Discount decimal(18,4) NOT NULL,
    TaxRate decimal(18,4) NOT NULL,
    EstimatedFreight decimal(18,4) NOT NULL,
    LineTotal decimal(18,4) NOT NULL,
    CONSTRAINT FK_QuotationLine_Header FOREIGN KEY (QuotationId) REFERENCES dbo.Quotation(Id) ON DELETE CASCADE,
    CONSTRAINT FK_QuotationLine_Material FOREIGN KEY (MaterialId) REFERENCES dbo.Material(Id)
);
GO

/* ---------- Goods receipts ---------- */
IF OBJECT_ID(N'dbo.GoodsReceipt', N'U') IS NULL
CREATE TABLE dbo.GoodsReceipt (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_GoodsReceipt PRIMARY KEY,
    GrnNumber nvarchar(40) NOT NULL,
    PurchaseOrderId nvarchar(40) NOT NULL,
    SupplierId nvarchar(40) NOT NULL,
    ProjectId nvarchar(40) NOT NULL,
    WarehouseId nvarchar(40) NOT NULL,
    StorageLocation nvarchar(200) NOT NULL,
    GrnDate date NOT NULL,
    ReceivedAtUtc datetime2 NOT NULL,
    DeliveryChallanNumber nvarchar(80) NOT NULL,
    DeliveryChallanDate date NULL,
    VehicleNumber nvarchar(40) NULL,
    DeliveredBy nvarchar(200) NULL,
    Status nvarchar(40) NOT NULL,
    ChallanMatchesPO bit NOT NULL,
    VehicleUnloadedSafely bit NOT NULL,
    PhysicallyCounted bit NOT NULL,
    PackagingIntact bit NOT NULL,
    BatchTestCertsProvided bit NOT NULL,
    TestCertificateNumber nvarchar(80) NULL,
    MaterialsMeetSpecs bit NOT NULL,
    BinTagsAttached bit NOT NULL,
    InspectionRemarks nvarchar(800) NOT NULL,
    DiscrepancyIdentified bit NOT NULL,
    DebitNoteRequired bit NOT NULL,
    DebitNoteReason nvarchar(400) NULL,
    TotalDeliveredQuantity decimal(18,4) NOT NULL,
    TotalAcceptedQuantity decimal(18,4) NOT NULL,
    TotalRejectedQuantity decimal(18,4) NOT NULL,
    TotalDamagedQuantity decimal(18,4) NOT NULL,
    TotalShortQuantity decimal(18,4) NOT NULL,
    TotalAcceptedValue decimal(18,4) NOT NULL,
    GeneralRemarks nvarchar(800) NULL,
    RejectionReason nvarchar(500) NULL,
    CorrectionNotes nvarchar(500) NULL,
    ReceivedByUserId nvarchar(40) NOT NULL,
    ReceivedByName nvarchar(200) NOT NULL,
    InspectedByUserId nvarchar(40) NULL,
    InspectedByName nvarchar(200) NULL,
    InspectedAtUtc datetime2 NULL,
    ApprovedByUserId nvarchar(40) NULL,
    ApprovedByName nvarchar(200) NULL,
    ApprovedAtUtc datetime2 NULL,
    PostedByUserId nvarchar(40) NULL,
    PostedByName nvarchar(200) NULL,
    PostedAtUtc datetime2 NULL,
    CreatedAtUtc datetime2 NOT NULL,
    UpdatedAtUtc datetime2 NOT NULL,
    CONSTRAINT UQ_GoodsReceipt_Number UNIQUE (GrnNumber),
    CONSTRAINT FK_GoodsReceipt_PO FOREIGN KEY (PurchaseOrderId) REFERENCES dbo.PurchaseOrder(Id),
    CONSTRAINT FK_GoodsReceipt_Supplier FOREIGN KEY (SupplierId) REFERENCES dbo.Supplier(Id),
    CONSTRAINT FK_GoodsReceipt_Project FOREIGN KEY (ProjectId) REFERENCES dbo.Project(Id),
    CONSTRAINT FK_GoodsReceipt_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouse(Id)
);
GO

IF OBJECT_ID(N'dbo.GoodsReceiptLine', N'U') IS NULL
CREATE TABLE dbo.GoodsReceiptLine (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_GoodsReceiptLine PRIMARY KEY,
    GoodsReceiptId nvarchar(40) NOT NULL,
    PurchaseOrderLineId nvarchar(40) NOT NULL,
    MaterialId nvarchar(40) NOT NULL,
    OrderedQuantity decimal(18,4) NOT NULL,
    PreviouslyReceivedQuantity decimal(18,4) NOT NULL,
    DeliveredQuantity decimal(18,4) NOT NULL,
    AcceptedQuantity decimal(18,4) NOT NULL,
    RejectedQuantity decimal(18,4) NOT NULL,
    DamagedQuantity decimal(18,4) NOT NULL,
    ShortQuantity decimal(18,4) NOT NULL,
    Remarks nvarchar(400) NULL,
    StorageLocation nvarchar(200) NOT NULL,
    UnitPrice decimal(18,4) NOT NULL,
    TotalAcceptedAmount decimal(18,4) NOT NULL,
    CONSTRAINT FK_GoodsReceiptLine_Header FOREIGN KEY (GoodsReceiptId) REFERENCES dbo.GoodsReceipt(Id) ON DELETE CASCADE,
    CONSTRAINT FK_GoodsReceiptLine_POLine FOREIGN KEY (PurchaseOrderLineId) REFERENCES dbo.PurchaseOrderLine(Id),
    CONSTRAINT FK_GoodsReceiptLine_Material FOREIGN KEY (MaterialId) REFERENCES dbo.Material(Id)
);
GO

IF OBJECT_ID(N'dbo.GoodsReceiptAudit', N'U') IS NULL
CREATE TABLE dbo.GoodsReceiptAudit (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_GoodsReceiptAudit PRIMARY KEY,
    GoodsReceiptId nvarchar(40) NOT NULL,
    ActorUserId nvarchar(40) NOT NULL,
    ActorName nvarchar(200) NOT NULL,
    ActorRole nvarchar(80) NOT NULL,
    Action nvarchar(40) NOT NULL,
    Comments nvarchar(500) NOT NULL,
    TimestampUtc datetime2 NOT NULL,
    CONSTRAINT FK_GoodsReceiptAudit_Header FOREIGN KEY (GoodsReceiptId) REFERENCES dbo.GoodsReceipt(Id) ON DELETE CASCADE
);
GO

IF OBJECT_ID(N'dbo.ReceiptLedger', N'U') IS NULL
CREATE TABLE dbo.ReceiptLedger (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_ReceiptLedger PRIMARY KEY,
    GoodsReceiptId nvarchar(40) NOT NULL,
    GoodsReceiptLineId nvarchar(40) NOT NULL,
    PurchaseOrderId nvarchar(40) NOT NULL,
    SupplierId nvarchar(40) NOT NULL,
    ProjectId nvarchar(40) NOT NULL,
    WarehouseId nvarchar(40) NOT NULL,
    MaterialId nvarchar(40) NOT NULL,
    AcceptedQuantity decimal(18,4) NOT NULL,
    UnitPrice decimal(18,4) NOT NULL,
    TotalAmount decimal(18,4) NOT NULL,
    StorageLocation nvarchar(200) NOT NULL,
    DeliveryChallanNumber nvarchar(80) NOT NULL,
    PostedAtUtc datetime2 NOT NULL,
    PostedByUserId nvarchar(40) NOT NULL,
    PostedByName nvarchar(200) NOT NULL,
    ReconciledWithInventoryLedger bit NOT NULL,
    CONSTRAINT UQ_ReceiptLedger_Line UNIQUE (GoodsReceiptLineId)
);
GO

/* ---------- Stock ---------- */
IF OBJECT_ID(N'dbo.InventoryBalance', N'U') IS NULL
CREATE TABLE dbo.InventoryBalance (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_InventoryBalance PRIMARY KEY,
    MaterialId nvarchar(40) NOT NULL,
    WarehouseId nvarchar(40) NOT NULL,
    ProjectId nvarchar(40) NOT NULL,
    QuantityOnHand decimal(18,4) NOT NULL,
    QuantityReserved decimal(18,4) NOT NULL,
    QuantityAvailable decimal(18,4) NOT NULL,
    QuantityInTransit decimal(18,4) NOT NULL,
    WeightedAverageCost decimal(18,4) NOT NULL,
    InventoryValue decimal(18,4) NOT NULL,
    Version int NOT NULL,
    LastUpdatedUtc datetime2 NOT NULL,
    RowVersion rowversion NOT NULL,
    CONSTRAINT UQ_InventoryBalance_Location UNIQUE (MaterialId, WarehouseId, ProjectId),
    CONSTRAINT FK_InventoryBalance_Material FOREIGN KEY (MaterialId) REFERENCES dbo.Material(Id),
    CONSTRAINT FK_InventoryBalance_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouse(Id),
    CONSTRAINT FK_InventoryBalance_Project FOREIGN KEY (ProjectId) REFERENCES dbo.Project(Id)
);
GO

IF OBJECT_ID(N'dbo.StockLedger', N'U') IS NULL
CREATE TABLE dbo.StockLedger (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_StockLedger PRIMARY KEY,
    ReferenceNumber nvarchar(40) NOT NULL,
    TransactionType nvarchar(40) NOT NULL,
    SourceDocumentType nvarchar(40) NOT NULL,
    SourceDocumentId nvarchar(40) NOT NULL,
    SourceDocumentNumber nvarchar(40) NOT NULL,
    SourceLineId nvarchar(40) NOT NULL,
    MaterialId nvarchar(40) NOT NULL,
    WarehouseId nvarchar(40) NOT NULL,
    ProjectId nvarchar(40) NOT NULL,
    QuantityIn decimal(18,4) NOT NULL,
    QuantityOut decimal(18,4) NOT NULL,
    SignedQuantity decimal(18,4) NOT NULL,
    UnitCost decimal(18,4) NOT NULL,
    TransactionValue decimal(18,4) NOT NULL,
    BalanceQuantityAfter decimal(18,4) NOT NULL,
    WeightedAverageCostAfter decimal(18,4) NOT NULL,
    TotalValuationAfter decimal(18,4) NOT NULL,
    BatchNumber nvarchar(80) NULL,
    IdempotencyKey nvarchar(120) NOT NULL,
    TransactionDate date NOT NULL,
    TimestampUtc datetime2 NOT NULL,
    CreatedByUserId nvarchar(40) NOT NULL,
    CreatedByName nvarchar(200) NOT NULL,
    Remarks nvarchar(500) NULL,
    CONSTRAINT UQ_StockLedger_Idempotency UNIQUE (IdempotencyKey),
    CONSTRAINT UQ_StockLedger_Reference UNIQUE (ReferenceNumber),
    CONSTRAINT FK_StockLedger_Material FOREIGN KEY (MaterialId) REFERENCES dbo.Material(Id),
    CONSTRAINT FK_StockLedger_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouse(Id),
    CONSTRAINT FK_StockLedger_Project FOREIGN KEY (ProjectId) REFERENCES dbo.Project(Id)
);
GO

IF OBJECT_ID(N'dbo.TR_StockLedger_AppendOnly', N'TR') IS NULL
EXEC('
CREATE TRIGGER dbo.TR_StockLedger_AppendOnly
ON dbo.StockLedger
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    THROW 50001, ''StockLedger is append-only. Post a reversal or adjustment instead of editing history.'', 1;
END
');
GO

/* ---------- Issues, returns, transfers ---------- */
IF OBJECT_ID(N'dbo.MaterialIssue', N'U') IS NULL
CREATE TABLE dbo.MaterialIssue (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_MaterialIssue PRIMARY KEY,
    IssueNumber nvarchar(40) NOT NULL,
    RequisitionId nvarchar(40) NOT NULL,
    ProjectId nvarchar(40) NOT NULL,
    WarehouseId nvarchar(40) NOT NULL,
    IssueDate date NOT NULL,
    Status nvarchar(40) NOT NULL,
    Purpose nvarchar(500) NOT NULL,
    WorkActivity nvarchar(300) NULL,
    ReceivedByPerson nvarchar(200) NOT NULL,
    RejectionReason nvarchar(500) NULL,
    CorrectionNotes nvarchar(500) NULL,
    Remarks nvarchar(800) NULL,
    CreatedByUserId nvarchar(40) NOT NULL,
    CreatedByName nvarchar(200) NOT NULL,
    CreatedAtUtc datetime2 NOT NULL,
    SubmittedByUserId nvarchar(40) NULL,
    SubmittedByName nvarchar(200) NULL,
    SubmittedAtUtc datetime2 NULL,
    ApprovedByUserId nvarchar(40) NULL,
    ApprovedByName nvarchar(200) NULL,
    ApprovedAtUtc datetime2 NULL,
    PostedByUserId nvarchar(40) NULL,
    PostedByName nvarchar(200) NULL,
    PostedAtUtc datetime2 NULL,
    UpdatedAtUtc datetime2 NULL,
    CONSTRAINT UQ_MaterialIssue_Number UNIQUE (IssueNumber),
    CONSTRAINT FK_MaterialIssue_Requisition FOREIGN KEY (RequisitionId) REFERENCES dbo.Requisition(Id),
    CONSTRAINT FK_MaterialIssue_Project FOREIGN KEY (ProjectId) REFERENCES dbo.Project(Id),
    CONSTRAINT FK_MaterialIssue_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouse(Id)
);
GO

IF OBJECT_ID(N'dbo.MaterialIssueLine', N'U') IS NULL
CREATE TABLE dbo.MaterialIssueLine (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_MaterialIssueLine PRIMARY KEY,
    MaterialIssueId nvarchar(40) NOT NULL,
    RequisitionLineId nvarchar(40) NOT NULL,
    MaterialId nvarchar(40) NOT NULL,
    RequestedQuantity decimal(18,4) NOT NULL,
    PreviouslyFulfilledQuantity decimal(18,4) NOT NULL,
    QuantityToIssue decimal(18,4) NOT NULL,
    ActualIssuedQuantity decimal(18,4) NULL,
    UnitCost decimal(18,4) NULL,
    TotalIssuedAmount decimal(18,4) NULL,
    StorageLocation nvarchar(200) NULL,
    Remarks nvarchar(400) NULL,
    StockLedgerEntryId nvarchar(40) NULL,
    CONSTRAINT FK_MaterialIssueLine_Header FOREIGN KEY (MaterialIssueId) REFERENCES dbo.MaterialIssue(Id) ON DELETE CASCADE,
    CONSTRAINT FK_MaterialIssueLine_ReqLine FOREIGN KEY (RequisitionLineId) REFERENCES dbo.RequisitionLine(Id),
    CONSTRAINT FK_MaterialIssueLine_Material FOREIGN KEY (MaterialId) REFERENCES dbo.Material(Id)
);
GO

IF OBJECT_ID(N'dbo.MaterialIssueAudit', N'U') IS NULL
CREATE TABLE dbo.MaterialIssueAudit (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_MaterialIssueAudit PRIMARY KEY,
    MaterialIssueId nvarchar(40) NOT NULL,
    ActorUserId nvarchar(40) NOT NULL,
    ActorName nvarchar(200) NOT NULL,
    ActorRole nvarchar(80) NOT NULL,
    Action nvarchar(40) NOT NULL,
    Comments nvarchar(500) NULL,
    TimestampUtc datetime2 NOT NULL,
    CONSTRAINT FK_MaterialIssueAudit_Header FOREIGN KEY (MaterialIssueId) REFERENCES dbo.MaterialIssue(Id) ON DELETE CASCADE
);
GO

IF OBJECT_ID(N'dbo.MaterialReturn', N'U') IS NULL
CREATE TABLE dbo.MaterialReturn (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_MaterialReturn PRIMARY KEY,
    ReturnNumber nvarchar(40) NOT NULL,
    MaterialIssueId nvarchar(40) NOT NULL,
    RequisitionId nvarchar(40) NOT NULL,
    ProjectId nvarchar(40) NOT NULL,
    WarehouseId nvarchar(40) NOT NULL,
    ReturnDate date NOT NULL,
    ReturnedByPerson nvarchar(200) NOT NULL,
    Reason nvarchar(500) NOT NULL,
    Status nvarchar(40) NOT NULL,
    RejectionReason nvarchar(500) NULL,
    Remarks nvarchar(800) NULL,
    CreatedByUserId nvarchar(40) NOT NULL,
    CreatedByName nvarchar(200) NOT NULL,
    CreatedAtUtc datetime2 NOT NULL,
    InspectedByUserId nvarchar(40) NULL,
    InspectedByName nvarchar(200) NULL,
    InspectedAtUtc datetime2 NULL,
    ApprovedByUserId nvarchar(40) NULL,
    ApprovedByName nvarchar(200) NULL,
    ApprovedAtUtc datetime2 NULL,
    PostedByUserId nvarchar(40) NULL,
    PostedByName nvarchar(200) NULL,
    PostedAtUtc datetime2 NULL,
    UpdatedAtUtc datetime2 NULL,
    CONSTRAINT UQ_MaterialReturn_Number UNIQUE (ReturnNumber),
    CONSTRAINT FK_MaterialReturn_Issue FOREIGN KEY (MaterialIssueId) REFERENCES dbo.MaterialIssue(Id),
    CONSTRAINT FK_MaterialReturn_Requisition FOREIGN KEY (RequisitionId) REFERENCES dbo.Requisition(Id),
    CONSTRAINT FK_MaterialReturn_Project FOREIGN KEY (ProjectId) REFERENCES dbo.Project(Id),
    CONSTRAINT FK_MaterialReturn_Warehouse FOREIGN KEY (WarehouseId) REFERENCES dbo.Warehouse(Id)
);
GO

IF OBJECT_ID(N'dbo.MaterialReturnLine', N'U') IS NULL
CREATE TABLE dbo.MaterialReturnLine (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_MaterialReturnLine PRIMARY KEY,
    MaterialReturnId nvarchar(40) NOT NULL,
    MaterialIssueLineId nvarchar(40) NOT NULL,
    MaterialId nvarchar(40) NOT NULL,
    IssuedQuantity decimal(18,4) NOT NULL,
    PreviouslyReturnedQuantity decimal(18,4) NOT NULL,
    ReturnedQuantity decimal(18,4) NOT NULL,
    Condition nvarchar(40) NOT NULL,
    Disposition nvarchar(40) NOT NULL,
    UnitCost decimal(18,4) NOT NULL,
    TotalReturnAmount decimal(18,4) NOT NULL,
    InspectionNotes nvarchar(400) NULL,
    StockLedgerEntryId nvarchar(40) NULL,
    CONSTRAINT FK_MaterialReturnLine_Header FOREIGN KEY (MaterialReturnId) REFERENCES dbo.MaterialReturn(Id) ON DELETE CASCADE,
    CONSTRAINT FK_MaterialReturnLine_IssueLine FOREIGN KEY (MaterialIssueLineId) REFERENCES dbo.MaterialIssueLine(Id),
    CONSTRAINT FK_MaterialReturnLine_Material FOREIGN KEY (MaterialId) REFERENCES dbo.Material(Id)
);
GO

IF OBJECT_ID(N'dbo.MaterialReturnAudit', N'U') IS NULL
CREATE TABLE dbo.MaterialReturnAudit (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_MaterialReturnAudit PRIMARY KEY,
    MaterialReturnId nvarchar(40) NOT NULL,
    ActorUserId nvarchar(40) NOT NULL,
    ActorName nvarchar(200) NOT NULL,
    ActorRole nvarchar(80) NOT NULL,
    Action nvarchar(40) NOT NULL,
    Comments nvarchar(500) NULL,
    TimestampUtc datetime2 NOT NULL,
    CONSTRAINT FK_MaterialReturnAudit_Header FOREIGN KEY (MaterialReturnId) REFERENCES dbo.MaterialReturn(Id) ON DELETE CASCADE
);
GO

IF OBJECT_ID(N'dbo.StockTransfer', N'U') IS NULL
CREATE TABLE dbo.StockTransfer (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_StockTransfer PRIMARY KEY,
    TransferNumber nvarchar(40) NOT NULL,
    SourceWarehouseId nvarchar(40) NOT NULL,
    SourceProjectId nvarchar(40) NOT NULL,
    DestinationWarehouseId nvarchar(40) NOT NULL,
    DestinationProjectId nvarchar(40) NOT NULL,
    RequestDate date NOT NULL,
    PlannedDispatchDate date NULL,
    ActualDispatchDate date NULL,
    ExpectedArrivalDate date NULL,
    ActualReceiptDate date NULL,
    Purpose nvarchar(500) NOT NULL,
    TransferReason nvarchar(300) NULL,
    ReferenceNumber nvarchar(80) NULL,
    VehicleNumber nvarchar(40) NULL,
    DriverName nvarchar(200) NULL,
    DispatchReference nvarchar(80) NULL,
    Priority nvarchar(20) NOT NULL,
    Status nvarchar(40) NOT NULL,
    DiscrepancyStatus nvarchar(40) NOT NULL,
    PostingJournalStatus nvarchar(40) NOT NULL,
    RejectionReason nvarchar(500) NULL,
    CorrectionNotes nvarchar(500) NULL,
    CancellationReason nvarchar(500) NULL,
    Remarks nvarchar(800) NULL,
    CreatedByUserId nvarchar(40) NOT NULL,
    CreatedByName nvarchar(200) NOT NULL,
    CreatedAtUtc datetime2 NOT NULL,
    SubmittedByUserId nvarchar(40) NULL,
    SubmittedByName nvarchar(200) NULL,
    SubmittedAtUtc datetime2 NULL,
    ApprovedByUserId nvarchar(40) NULL,
    ApprovedByName nvarchar(200) NULL,
    ApprovedAtUtc datetime2 NULL,
    DispatchedByUserId nvarchar(40) NULL,
    DispatchedByName nvarchar(200) NULL,
    DispatchedAtUtc datetime2 NULL,
    ReceivedByUserId nvarchar(40) NULL,
    ReceivedByName nvarchar(200) NULL,
    ReceivedAtUtc datetime2 NULL,
    InspectedByUserId nvarchar(40) NULL,
    InspectedByName nvarchar(200) NULL,
    InspectedAtUtc datetime2 NULL,
    CompletedByUserId nvarchar(40) NULL,
    CompletedByName nvarchar(200) NULL,
    CompletedAtUtc datetime2 NULL,
    CancelledByUserId nvarchar(40) NULL,
    CancelledByName nvarchar(200) NULL,
    CancelledAtUtc datetime2 NULL,
    UpdatedAtUtc datetime2 NULL,
    CONSTRAINT UQ_StockTransfer_Number UNIQUE (TransferNumber),
    CONSTRAINT FK_StockTransfer_SourceWh FOREIGN KEY (SourceWarehouseId) REFERENCES dbo.Warehouse(Id),
    CONSTRAINT FK_StockTransfer_DestWh FOREIGN KEY (DestinationWarehouseId) REFERENCES dbo.Warehouse(Id),
    CONSTRAINT FK_StockTransfer_SourcePrj FOREIGN KEY (SourceProjectId) REFERENCES dbo.Project(Id),
    CONSTRAINT FK_StockTransfer_DestPrj FOREIGN KEY (DestinationProjectId) REFERENCES dbo.Project(Id)
);
GO

IF OBJECT_ID(N'dbo.StockTransferLine', N'U') IS NULL
CREATE TABLE dbo.StockTransferLine (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_StockTransferLine PRIMARY KEY,
    StockTransferId nvarchar(40) NOT NULL,
    MaterialId nvarchar(40) NOT NULL,
    RequestedQuantity decimal(18,4) NOT NULL,
    ApprovedQuantity decimal(18,4) NOT NULL,
    DispatchedQuantity decimal(18,4) NOT NULL,
    ReceivedGoodQuantity decimal(18,4) NOT NULL,
    DamagedQuantity decimal(18,4) NOT NULL,
    ShortQuantity decimal(18,4) NOT NULL,
    DisputedQuantity decimal(18,4) NOT NULL,
    RemainingInTransitQuantity decimal(18,4) NOT NULL,
    UnitCostAtDispatch decimal(18,4) NOT NULL,
    TotalDispatchedAmount decimal(18,4) NOT NULL,
    SourceStockLedgerEntryId nvarchar(40) NULL,
    DestinationStockLedgerEntryId nvarchar(40) NULL,
    DiscrepancyReason nvarchar(400) NULL,
    InspectionNotes nvarchar(400) NULL,
    EvidenceReferences nvarchar(800) NULL,
    ResolutionStatus nvarchar(20) NOT NULL,
    ResolutionAction nvarchar(40) NULL,
    ResolutionNotes nvarchar(500) NULL,
    ResolvedByUserId nvarchar(40) NULL,
    ResolvedByName nvarchar(200) NULL,
    ResolvedAtUtc datetime2 NULL,
    CONSTRAINT FK_StockTransferLine_Header FOREIGN KEY (StockTransferId) REFERENCES dbo.StockTransfer(Id) ON DELETE CASCADE,
    CONSTRAINT FK_StockTransferLine_Material FOREIGN KEY (MaterialId) REFERENCES dbo.Material(Id)
);
GO

IF OBJECT_ID(N'dbo.StockTransferAudit', N'U') IS NULL
CREATE TABLE dbo.StockTransferAudit (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_StockTransferAudit PRIMARY KEY,
    StockTransferId nvarchar(40) NOT NULL,
    ActorUserId nvarchar(40) NOT NULL,
    ActorName nvarchar(200) NOT NULL,
    ActorRole nvarchar(80) NOT NULL,
    Action nvarchar(40) NOT NULL,
    Comments nvarchar(500) NULL,
    TimestampUtc datetime2 NOT NULL,
    CONSTRAINT FK_StockTransferAudit_Header FOREIGN KEY (StockTransferId) REFERENCES dbo.StockTransfer(Id) ON DELETE CASCADE
);
GO

/* ---------- Notifications ---------- */
IF OBJECT_ID(N'dbo.Notification', N'U') IS NULL
CREATE TABLE dbo.Notification (
    Id nvarchar(40) NOT NULL CONSTRAINT PK_Notification PRIMARY KEY,
    EventKey nvarchar(160) NOT NULL,
    Category nvarchar(40) NOT NULL,
    EventType nvarchar(80) NOT NULL,
    Severity nvarchar(20) NOT NULL,
    Title nvarchar(200) NOT NULL,
    Message nvarchar(800) NOT NULL,
    SourceDocumentType nvarchar(40) NOT NULL,
    SourceDocumentId nvarchar(40) NOT NULL,
    SourceDocumentNumber nvarchar(40) NOT NULL,
    TargetRoute nvarchar(200) NOT NULL,
    ProjectId nvarchar(40) NULL,
    WarehouseId nvarchar(40) NULL,
    SecondaryProjectId nvarchar(40) NULL,
    SecondaryWarehouseId nvarchar(40) NULL,
    CreatedAtUtc datetime2 NOT NULL
);
GO

IF OBJECT_ID(N'dbo.NotificationRecipientUser', N'U') IS NULL
CREATE TABLE dbo.NotificationRecipientUser (
    NotificationId nvarchar(40) NOT NULL,
    UserId nvarchar(40) NOT NULL,
    CONSTRAINT PK_NotificationRecipientUser PRIMARY KEY (NotificationId, UserId),
    CONSTRAINT FK_NotificationRecipientUser_Note FOREIGN KEY (NotificationId) REFERENCES dbo.Notification(Id) ON DELETE CASCADE
);
GO

IF OBJECT_ID(N'dbo.NotificationRecipientRole', N'U') IS NULL
CREATE TABLE dbo.NotificationRecipientRole (
    NotificationId nvarchar(40) NOT NULL,
    RoleName nvarchar(80) NOT NULL,
    CONSTRAINT PK_NotificationRecipientRole PRIMARY KEY (NotificationId, RoleName),
    CONSTRAINT FK_NotificationRecipientRole_Note FOREIGN KEY (NotificationId) REFERENCES dbo.Notification(Id) ON DELETE CASCADE
);
GO

IF OBJECT_ID(N'dbo.NotificationRead', N'U') IS NULL
CREATE TABLE dbo.NotificationRead (
    NotificationId nvarchar(40) NOT NULL,
    UserId nvarchar(40) NOT NULL,
    ReadAtUtc datetime2 NOT NULL,
    CONSTRAINT PK_NotificationRead PRIMARY KEY (NotificationId, UserId),
    CONSTRAINT FK_NotificationRead_Note FOREIGN KEY (NotificationId) REFERENCES dbo.Notification(Id) ON DELETE CASCADE
);
GO
