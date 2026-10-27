using ConstructionStock.Domain.Entities;

namespace ConstructionStock.Application.Repositories;

public interface IPurchaseOrderRepository
{
    Task<IReadOnlyList<PurchaseOrder>> GetAllAsync(string? projectId = null, string? supplierId = null, PurchaseOrderStatus? status = null, string? searchTerm = null, CancellationToken cancellationToken = default);
    Task<PurchaseOrder?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PurchaseOrder?> GetByNumberAsync(string poNumber, CancellationToken cancellationToken = default);
    Task<PurchaseOrder> CreateAsync(PurchaseOrder purchaseOrder, CancellationToken cancellationToken = default);
    Task<PurchaseOrder> UpdateAsync(PurchaseOrder purchaseOrder, CancellationToken cancellationToken = default);
    Task<decimal> GetAllocatedRequisitionQuantityAsync(string requisitionItemId, Guid? excludePoId = null, CancellationToken cancellationToken = default);
}
