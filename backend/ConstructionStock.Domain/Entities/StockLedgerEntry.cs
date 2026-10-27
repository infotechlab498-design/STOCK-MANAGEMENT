using ConstructionStock.Domain.Enums;

namespace ConstructionStock.Domain.Entities;

/// <summary>
/// Authoritative append-only transaction ledger.
/// Represents the single source of truth for all stock movements.
/// Records can never be silently edited or deleted.
/// </summary>
public class StockLedgerEntry
{
    public long Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid WarehouseId { get; set; }
    public Guid MaterialId { get; set; }

    public StockTransactionType TransactionType { get; set; }
    public string ReferenceNumber { get; set; } = string.Empty; // e.g. GRN-2026-0042, ISS-2026-0188
    public string? BatchNumber { get; set; }

    // Authoritative signed quantity movement (+ for receipt/return, - for issue)
    public decimal Quantity { get; set; }

    // Unit valuation at time of posting (Weighted-Average Cost or GRN purchase price)
    public decimal UnitCost { get; set; }

    // Total movement value = Quantity * UnitCost
    public decimal TotalValue { get; set; }

    // Running snapshot after this entry was committed
    public decimal BalanceQuantityAfter { get; set; }
    public decimal WeightedAverageCostAfter { get; set; }
    public decimal TotalValuationAfter { get; set; }

    // Audit and traceability
    public DateTime TimestampUtc { get; set; }
    public string CreatedByUserId { get; set; } = string.Empty;
    public string? Remarks { get; set; }
}
