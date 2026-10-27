using ConstructionStock.Domain.Entities;

namespace ConstructionStock.Application.Repositories;

public interface IGoodsReceivedNoteRepository
{
    Task<IEnumerable<GoodsReceivedNote>> GetAllAsync(
        string? projectId = null,
        string? warehouseId = null,
        string? purchaseOrderId = null,
        string? supplierId = null,
        GrnStatus? status = null,
        string? search = null);

    Task<GoodsReceivedNote?> GetByIdAsync(string id);
    Task<GoodsReceivedNote?> GetByNumberAsync(string grnNumber);
    Task<GoodsReceivedNote> CreateAsync(GoodsReceivedNote grn);
    Task<GoodsReceivedNote> UpdateAsync(GoodsReceivedNote grn);
    Task<bool> ExistsAsync(string id);
    Task<string> GetNextGrnNumberAsync();
}
