namespace ConstructionStock.Domain.Entities;

/// <summary>
/// Material Master entity for construction stock inventory.
/// Enforces unique ItemCode, normalized comparison, and valid stock levels.
/// </summary>
public class Material
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Unique SKU/Material identifier (e.g. STEEL-REBAR-T16). Trimmed, case-insensitive comparison.
    /// </summary>
    public string ItemCode { get; set; } = string.Empty;
    public string NormalizedItemCode { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Specification { get; set; }

    // Category reference
    public Guid CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public MaterialCategory? Category { get; set; }

    // Base Unit of Measure reference
    public Guid BaseUnitId { get; set; }
    public string BaseUnitName { get; set; } = string.Empty;
    public UnitOfMeasure? BaseUnit { get; set; }

    /// <summary>
    /// Minimum reserve threshold required before critical alerts trigger. Must be >= 0.
    /// </summary>
    public decimal MinimumStockLevel { get; set; }

    /// <summary>
    /// Reorder trigger level. Business rule: ReorderLevel >= MinimumStockLevel.
    /// </summary>
    public decimal ReorderLevel { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
    public string? CreatedByUserId { get; set; }
    public string? UpdatedByUserId { get; set; }
}
