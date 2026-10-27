namespace ConstructionStock.Domain.Entities;

/// <summary>
/// Immutable receipt journal entry recorded upon posting a Goods Received Note.
/// Used to maintain a durable audit trail of accepted receipts prior to reconciliation
/// with the authoritative inventory ledger in Prompt 9.
/// </summary>
public class ReceiptLedgerEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string GrnId { get; set; } = string.Empty;
    public string GrnNumber { get; set; } = string.Empty;
    public string PurchaseOrderId { get; set; } = string.Empty;
    public string PurchaseOrderNumber { get; set; } = string.Empty;
    public string SupplierId { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string WarehouseId { get; set; } = string.Empty;
    public string MaterialId { get; set; } = string.Empty;
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialName { get; set; } = string.Empty;
    public string UnitCode { get; set; } = string.Empty;
    public decimal AcceptedQuantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalAmount { get; set; }
    public string StorageLocation { get; set; } = string.Empty;
    public string DeliveryChallanNumber { get; set; } = string.Empty;
    public DateTime PostedAtUtc { get; set; } = DateTime.UtcNow;
    public string PostedByUserId { get; set; } = string.Empty;
    public string PostedByName { get; set; } = string.Empty;
    public bool ReconciledWithInventoryLedger { get; set; } = false;
}
