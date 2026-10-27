using ConstructionStock.Domain.Entities;

namespace ConstructionStock.Application.Repositories;

public interface IStockLedgerRepository
{
    Task<StockLedgerEntry?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<StockLedgerEntry?> GetByIdempotencyKeyAsync(string idempotencyKey, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockLedgerEntry>> GetByMaterialAsync(string materialId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockLedgerEntry>> GetByLocationAsync(string warehouseId, string? projectId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockLedgerEntry>> GetAllAsync(CancellationToken cancellationToken = default);
    Task AddEntryAsync(StockLedgerEntry entry, CancellationToken cancellationToken = default);
}

public interface IStockBalanceRepository
{
    Task<StockBalance?> GetBalanceAsync(string materialId, string warehouseId, string projectId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockBalance>> GetBalancesByMaterialAsync(string materialId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockBalance>> GetAllBalancesAsync(CancellationToken cancellationToken = default);
    Task UpsertBalanceAsync(StockBalance balance, CancellationToken cancellationToken = default);
}
