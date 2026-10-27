namespace ConstructionStock.Domain.Entities;

/// <summary>
/// Current aggregated stock balance per material, warehouse, and project.
/// Derived authoritatively from append-only StockLedgerEntry transactions and reconciled atomically.
/// </summary>
public class StockBalance
{
    public string Id { get; set; } = string.Empty;

    // Material Identity & Classification
    public string MaterialId { get; set; } = string.Empty;
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialName { get; set; } = string.Empty;
    public string? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public string UnitCode { get; set; } = string.Empty;

    // Location Identity
    public string WarehouseId { get; set; } = string.Empty;
    public string WarehouseName { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;

    // Physical Quantities
    public decimal QuantityOnHand { get; set; }
    public decimal QuantityReserved { get; set; } // Reserved for active approved allocations
    public decimal QuantityAvailable => QuantityOnHand - QuantityReserved;
    public decimal QuantityInTransit { get; set; }

    // Continuous Moving Weighted-Average Costing (WAC)
    public decimal WeightedAverageCost { get; set; }
    public decimal InventoryValue => Math.Round(QuantityOnHand * WeightedAverageCost, 2);

    // Audit and Optimistic Concurrency Control
    public int Version { get; set; } = 1;
    public byte[] RowVersion { get; set; } = [];
    public DateTime LastUpdatedUtc { get; set; }
}
