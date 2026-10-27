namespace ConstructionStock.Domain.Entities;

/// <summary>
/// Physical intake line item on a Goods Received Note.
/// Explicitly maps to a Purchase Order line item, enforcing strict quantity mathematics:
/// DeliveredQuantity = AcceptedQuantity + RejectedQuantity.
/// Non-overlapping DamagedQuantity and ShortQuantity for discrepancy tracking.
/// </summary>
public class GoodsReceivedItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string GrnId { get; set; } = string.Empty;

    // PO Item Linkage
    public string PurchaseOrderItemId { get; set; } = string.Empty;
    public string MaterialId { get; set; } = string.Empty;
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialName { get; set; } = string.Empty;
    public string? Specification { get; set; }
    public string? UnitId { get; set; }
    public string UnitCode { get; set; } = string.Empty;

    // Historical Baselines from PO
    public decimal OrderedQuantity { get; set; }
    public decimal PreviouslyReceivedQuantity { get; set; }
    public decimal PoOutstandingQuantity { get; set; }

    // Physical Intake & Inspection Quantities
    public decimal DeliveredQuantity { get; set; }
    public decimal AcceptedQuantity { get; set; }
    public decimal RejectedQuantity { get; set; }
    public decimal DamagedQuantity { get; set; }
    public decimal ShortQuantity { get; set; }

    // Storage & Commercial
    public string StorageLocation { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public decimal TotalAcceptedAmount { get; set; }
    public string? Remarks { get; set; }
}
