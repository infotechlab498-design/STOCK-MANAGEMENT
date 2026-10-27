namespace ConstructionStock.Domain.Entities;

/// <summary>
/// Current aggregated stock balance per material and warehouse.
/// Reconciled atomically with StockLedgerEntry transactions.
/// </summary>
public class StockBalance
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid WarehouseId { get; set; }
    public Guid MaterialId { get; set; }

    public decimal QuantityOnHand { get; set; }
    public decimal QuantityReserved { get; set; } // Reserved for approved requisitions
    public decimal QuantityAvailable => QuantityOnHand - QuantityReserved;
    public decimal QuantityInTransit { get; set; }

    // Continuous weighted-average cost per unit
    public decimal WeightedAverageCost { get; set; }
    public decimal TotalValuation => QuantityOnHand * WeightedAverageCost;

    // Concurrency token for optimistic / pessimistic locking
    public byte[] RowVersion { get; set; } = [];
    public DateTime LastUpdatedUtc { get; set; }
}
