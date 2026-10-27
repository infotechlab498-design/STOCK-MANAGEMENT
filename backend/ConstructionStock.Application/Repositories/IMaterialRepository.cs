using ConstructionStock.Domain.Entities;

namespace ConstructionStock.Application.Repositories;

public interface IMaterialRepository
{
    Task<IReadOnlyList<Material>> GetAllAsync(
        string? search = null,
        Guid? categoryId = null,
        bool? isActive = null,
        CancellationToken cancellationToken = default);

    Task<Material?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Material?> GetByItemCodeAsync(string itemCode, CancellationToken cancellationToken = default);
    Task<Material> CreateAsync(Material material, CancellationToken cancellationToken = default);
    Task<Material> UpdateAsync(Material material, CancellationToken cancellationToken = default);
    Task<bool> UpdateStatusAsync(Guid id, bool isActive, string? updatedByUserId = null, CancellationToken cancellationToken = default);
    Task<bool> IsItemCodeTakenAsync(string itemCode, Guid? excludeId = null, CancellationToken cancellationToken = default);
}

public interface ICategoryRepository
{
    Task<IReadOnlyList<MaterialCategory>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<MaterialCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<MaterialCategory> CreateAsync(MaterialCategory category, CancellationToken cancellationToken = default);
}

public interface IUnitRepository
{
    Task<IReadOnlyList<UnitOfMeasure>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<UnitOfMeasure?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UnitConversion>> GetConversionsAsync(Guid? materialId = null, CancellationToken cancellationToken = default);
}
