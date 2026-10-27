using ConstructionStock.Domain.Entities;
using ConstructionStock.Domain.Enums;

namespace ConstructionStock.Application.Services;

public record PostMovementCommand(
    Guid ProjectId,
    Guid WarehouseId,
    Guid MaterialId,
    StockTransactionType TransactionType,
    string ReferenceNumber,
    decimal Quantity,
    decimal UnitCost, // Receipt cost (GRN) or WAC lookup (Issues/Transfers)
    string? BatchNumber,
    string UserId,
    string? Remarks
);

public interface IInventoryPostingService
{
    /// <summary>
    /// Atomically commits a stock movement to the ledger and updates balances using WAC policy.
    /// Runs within a database transaction with serializable locks.
    /// </summary>
    Task<StockLedgerEntry> PostMovementAsync(PostMovementCommand command, CancellationToken cancellationToken = default);

    /// <summary>
    /// Computes the new weighted average unit cost following an incoming receipt:
    /// New WAC = ((Old Qty * Old WAC) + (Receipt Qty * Receipt Cost)) / (Old Qty + Receipt Qty)
    /// </summary>
    decimal CalculateWeightedAverageCost(decimal existingQty, decimal existingWac, decimal incomingQty, decimal incomingUnitCost);
}
