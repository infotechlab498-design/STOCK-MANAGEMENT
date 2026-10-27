namespace ConstructionStock.Domain.Entities;

public class MaterialCategory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty; // e.g. STEEL, CEMENT, SAND
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class UnitOfMeasure
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty; // e.g. BAG, MT, KG, PCS, M, SQM, CUM, L
    public string Name { get; set; } = string.Empty;
    public string Symbol { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class UnitConversion
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Optional material-specific link. If null, applies as a global unit conversion.
    /// E.g. Cement bags = 50kg is specific to Cement; 1 MT = 1000kg is global.
    /// </summary>
    public Guid? MaterialId { get; set; }

    public Guid FromUnitId { get; set; }
    public string FromUnitCode { get; set; } = string.Empty;

    public Guid ToUnitId { get; set; }
    public string ToUnitCode { get; set; } = string.Empty;

    /// <summary>
    /// Conversion factor: 1 FromUnit = ConversionFactor * ToUnit. Must be > 0.
    /// </summary>
    public decimal ConversionFactor { get; set; }

    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}
