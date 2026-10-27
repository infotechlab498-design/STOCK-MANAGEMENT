using ConstructionStock.Domain.Entities;

namespace ConstructionStock.Application.Repositories;

public interface ISupplierRepository
{
    Task<IReadOnlyList<Supplier>> GetAllAsync(string? searchTerm = null, bool? activeOnly = null, CancellationToken cancellationToken = default);
    Task<Supplier?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Supplier?> GetByCodeAsync(string supplierCode, CancellationToken cancellationToken = default);
    Task<Supplier> CreateAsync(Supplier supplier, CancellationToken cancellationToken = default);
    Task<Supplier> UpdateAsync(Supplier supplier, CancellationToken cancellationToken = default);
    Task<bool> ExistsCodeAsync(string supplierCode, Guid? excludeId = null, CancellationToken cancellationToken = default);
}
