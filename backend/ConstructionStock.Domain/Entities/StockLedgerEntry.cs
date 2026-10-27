using ConstructionStock.Domain.Enums;

namespace ConstructionStock.Domain.Entities;

/// <summary>
/// Authoritative append-only stock transaction ledger.
/// Represents the single source of truth for all physical and financial inventory movements.
/// Records can never be silently edited or deleted through ordinary CRUD endpoints.
/// </summary>
public class StockLedgerEntry
{
    public string Id { get; set; } = string.Empty;
    public string ReferenceNumber { get; set; } = string.Empty; // e.g. STK-2026-0001

    public StockTransactionType TransactionType { get; set; } = StockTransactionType.GoodsReceivedNote;
    public string SourceDocumentType { get; set; } = "GoodsReceivedNote";
    public string SourceDocumentId { get; set; } = string.Empty;
    public string SourceDocumentNumber { get; set; } = string.Empty; // e.g. GRN-2026-0001
    public string SourceLineId { get; set; } = string.Empty;

    // Material Snapshot
    public string MaterialId { get; set; } = string.Empty;
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialName { get; set; } = string.Empty;
    public string UnitCode { get; set; } = string.Empty;

    // Location Dimensions
    public string WarehouseId { get; set; } = string.Empty;
    public string WarehouseName { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;

    // Movement Quantities
    public decimal QuantityIn { get; set; }
    public decimal QuantityOut { get; set; }
    public decimal SignedQuantity { get; set; } // + for inbound receipts, - for issues

    // Valuation Components
    public decimal UnitCost { get; set; } // Specific receipt cost (GRN) or current moving WAC (Issues)
    public decimal TransactionValue { get; set; } // SignedQuantity * UnitCost

    // Running Balance Snapshots Immediately After Posting
    public decimal BalanceQuantityAfter { get; set; }
    public decimal WeightedAverageCostAfter { get; set; }
    public decimal TotalValuationAfter { get; set; }

    // Traceability & Concurrency
    public string? BatchNumber { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty; // Unique key e.g. GRN_ID_LINE_ID
    public DateTime TransactionDate { get; set; }
    public DateTime TimestampUtc { get; set; }
    public string CreatedByUserId { get; set; } = string.Empty;
    public string CreatedByName { get; set; } = string.Empty;
    public string? Remarks { get; set; }
}
