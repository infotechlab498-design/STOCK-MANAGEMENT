namespace ConstructionStock.Application.Materials;

public record MaterialDto(
    Guid Id,
    string ItemCode,
    string Name,
    string? Description,
    string? Specification,
    Guid CategoryId,
    string CategoryName,
    Guid BaseUnitId,
    string BaseUnitName,
    decimal MinimumStockLevel,
    decimal ReorderLevel,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    string? CreatedByUserId,
    string? UpdatedByUserId
);

public record CreateMaterialDto(
    string ItemCode,
    string Name,
    string? Description,
    string? Specification,
    Guid CategoryId,
    Guid BaseUnitId,
    decimal MinimumStockLevel,
    decimal ReorderLevel
);

public record UpdateMaterialDto(
    string Name,
    string? Description,
    string? Specification,
    Guid CategoryId,
    Guid BaseUnitId,
    decimal MinimumStockLevel,
    decimal ReorderLevel
);

public record UpdateMaterialStatusDto(
    bool IsActive
);

public record MaterialCategoryDto(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    bool IsActive
);

public record CreateMaterialCategoryDto(
    string Code,
    string Name,
    string? Description
);

public record UnitOfMeasureDto(
    Guid Id,
    string Code,
    string Name,
    string Symbol,
    bool IsActive
);

public record UnitConversionDto(
    Guid Id,
    Guid? MaterialId,
    Guid FromUnitId,
    string FromUnitCode,
    Guid ToUnitId,
    string ToUnitCode,
    decimal ConversionFactor,
    string? Description
);
