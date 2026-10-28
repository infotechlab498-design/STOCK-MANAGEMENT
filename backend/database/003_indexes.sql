USE StructStock;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Requisition_Status_Project' AND object_id = OBJECT_ID(N'dbo.Requisition'))
    CREATE INDEX IX_Requisition_Status_Project ON dbo.Requisition (Status, ProjectId, CreatedAtUtc DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PurchaseOrder_Status_Project' AND object_id = OBJECT_ID(N'dbo.PurchaseOrder'))
    CREATE INDEX IX_PurchaseOrder_Status_Project ON dbo.PurchaseOrder (Status, ProjectId, SupplierId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GoodsReceipt_Status' AND object_id = OBJECT_ID(N'dbo.GoodsReceipt'))
    CREATE INDEX IX_GoodsReceipt_Status ON dbo.GoodsReceipt (Status, ProjectId, WarehouseId, GrnDate);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_StockLedger_Material_Location' AND object_id = OBJECT_ID(N'dbo.StockLedger'))
    CREATE INDEX IX_StockLedger_Material_Location ON dbo.StockLedger (MaterialId, WarehouseId, ProjectId, TimestampUtc DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MaterialIssue_Status' AND object_id = OBJECT_ID(N'dbo.MaterialIssue'))
    CREATE INDEX IX_MaterialIssue_Status ON dbo.MaterialIssue (Status, ProjectId, WarehouseId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MaterialReturn_Status' AND object_id = OBJECT_ID(N'dbo.MaterialReturn'))
    CREATE INDEX IX_MaterialReturn_Status ON dbo.MaterialReturn (Status, ProjectId, WarehouseId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_StockTransfer_Status' AND object_id = OBJECT_ID(N'dbo.StockTransfer'))
    CREATE INDEX IX_StockTransfer_Status ON dbo.StockTransfer (Status, SourceProjectId, DestinationProjectId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notification_Created' AND object_id = OBJECT_ID(N'dbo.Notification'))
    CREATE INDEX IX_Notification_Created ON dbo.Notification (CreatedAtUtc DESC, Category);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_NotificationRead_User' AND object_id = OBJECT_ID(N'dbo.NotificationRead'))
    CREATE INDEX IX_NotificationRead_User ON dbo.NotificationRead (UserId, NotificationId);
GO
