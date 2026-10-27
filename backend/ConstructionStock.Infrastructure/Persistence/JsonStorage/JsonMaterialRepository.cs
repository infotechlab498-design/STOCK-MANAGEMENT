using System.Text.Json;
using ConstructionStock.Application.Repositories;
using ConstructionStock.Domain.Entities;

namespace ConstructionStock.Infrastructure.Persistence.JsonStorage;

/// <summary>
/// Thread-safe JSON file storage implementation of IMaterialRepository, ICategoryRepository, and IUnitRepository.
/// Uses atomic write-to-temp-file-and-replace to prevent corruption during process writes.
/// Intended for development and single-instance environments only.
/// </summary>
public class JsonMaterialRepository : IMaterialRepository, ICategoryRepository, IUnitRepository
{
    private readonly string _dataDirectory;
    private readonly string _materialsFilePath;
    private readonly string _categoriesFilePath;
    private readonly string _unitsFilePath;
    private readonly string _conversionsFilePath;

    private static readonly SemaphoreSlim _fileLock = new(1, 1);
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    public JsonMaterialRepository(string? dataDirectory = null)
    {
        _dataDirectory = dataDirectory ?? Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "data");
        Directory.CreateDirectory(_dataDirectory);

        _materialsFilePath = Path.Combine(_dataDirectory, "materials.json");
        _categoriesFilePath = Path.Combine(_dataDirectory, "categories.json");
        _unitsFilePath = Path.Combine(_dataDirectory, "units.json");
        _conversionsFilePath = Path.Combine(_dataDirectory, "unit_conversions.json");

        InitializeReferenceData();
    }

    private void InitializeReferenceData()
    {
        // Initialize Categories if not present
        if (!File.Exists(_categoriesFilePath))
        {
            var initialCategories = new List<MaterialCategory>
            {
                new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111101"), Code = "STEEL", Name = "Structural Steel & Rebar", Description = "Reinforcement rebar, structural I-beams, mesh, wire" },
                new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111102"), Code = "CEMENT", Name = "Cement & Binders", Description = "Ordinary Portland, Sulfate Resistant, Lime" },
                new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111103"), Code = "SAND", Name = "Sand & Fine Aggregates", Description = "Washed river sand, plaster sand, silica" },
                new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111104"), Code = "CRUSH", Name = "Crushed Aggregates & Gravel", Description = "10mm, 20mm, 40mm sub-base gravel" },
                new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111105"), Code = "BRICKS", Name = "Bricks & Masonry Blocks", Description = "Red clay bricks, solid concrete blocks, AAC blocks" },
                new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111106"), Code = "TILES", Name = "Tiles & Ceramics", Description = "Porcelain floor tiles, ceramic wall tiles, pavers" },
                new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111107"), Code = "MARBLE", Name = "Marble & Granite", Description = "Polished slabs, stair treads, threshold trims" },
                new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111108"), Code = "ELECTRICAL", Name = "Electrical & Conduits", Description = "Cables, PVC conduits, distribution panels, circuit breakers" },
                new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111109"), Code = "PLUMBING", Name = "Plumbing & Drainage", Description = "uPVC pipes, PPR pressure pipes, valves, fittings" },
                new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111110"), Code = "PAINT", Name = "Paints & Waterproofing", Description = "Emulsion, primer, bituminous membranes, epoxies" },
                new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111111"), Code = "TOOLS", Name = "Site Tools & Consumables", Description = "Diamond blades, shovel, trowels, safety gear" },
                new() { Id = Guid.Parse("11111111-1111-1111-1111-111111111112"), Code = "OTHER", Name = "Other Site Materials", Description = "Shuttering ply, binding wire, spacers" }
            };
            WriteAtomicList(_categoriesFilePath, initialCategories);
        }

        // Initialize Units if not present
        if (!File.Exists(_unitsFilePath))
        {
            var initialUnits = new List<UnitOfMeasure>
            {
                new() { Id = Guid.Parse("22222222-2222-2222-2222-222222222201"), Code = "PCS", Name = "Piece", Symbol = "pcs" },
                new() { Id = Guid.Parse("22222222-2222-2222-2222-222222222202"), Code = "BAG", Name = "Bag", Symbol = "bag" },
                new() { Id = Guid.Parse("22222222-2222-2222-2222-222222222203"), Code = "KG", Name = "Kilogram", Symbol = "kg" },
                new() { Id = Guid.Parse("22222222-2222-2222-2222-222222222204"), Code = "MT", Name = "Metric Tonne", Symbol = "MT" },
                new() { Id = Guid.Parse("22222222-2222-2222-2222-222222222205"), Code = "L", Name = "Litre", Symbol = "L" },
                new() { Id = Guid.Parse("22222222-2222-2222-2222-222222222206"), Code = "M", Name = "Meter", Symbol = "m" },
                new() { Id = Guid.Parse("22222222-2222-2222-2222-222222222207"), Code = "SQM", Name = "Square Meter", Symbol = "m²" },
                new() { Id = Guid.Parse("22222222-2222-2222-2222-222222222208"), Code = "CUM", Name = "Cubic Meter", Symbol = "m³" }
            };
            WriteAtomicList(_unitsFilePath, initialUnits);
        }

        // Initialize Unit Conversions if not present
        if (!File.Exists(_conversionsFilePath))
        {
            var initialConversions = new List<UnitConversion>
            {
                new() { Id = Guid.NewGuid(), FromUnitId = Guid.Parse("22222222-2222-2222-2222-222222222204"), FromUnitCode = "MT", ToUnitId = Guid.Parse("22222222-2222-2222-2222-222222222203"), ToUnitCode = "KG", ConversionFactor = 1000m, Description = "1 Metric Tonne = 1,000 Kilograms" },
                new() { Id = Guid.NewGuid(), FromUnitId = Guid.Parse("22222222-2222-2222-2222-222222222202"), FromUnitCode = "BAG", ToUnitId = Guid.Parse("22222222-2222-2222-2222-222222222203"), ToUnitCode = "KG", ConversionFactor = 50m, Description = "1 Standard Cement Bag = 50 Kilograms" }
            };
            WriteAtomicList(_conversionsFilePath, initialConversions);
        }

        // Initialize Materials if not present
        if (!File.Exists(_materialsFilePath))
        {
            var initialMaterials = new List<Material>
            {
                new()
                {
                    Id = Guid.Parse("33333333-3333-3333-3333-333333333301"),
                    ItemCode = "STEEL-REBAR-T16",
                    NormalizedItemCode = "STEEL-REBAR-T16",
                    Name = "High-Tensile Deformed Rebar 16mm",
                    Description = "Hot-rolled thermo-mechanically treated high yield rebar",
                    Specification = "Grade 500B / BS 4449, 12m standard lengths",
                    CategoryId = Guid.Parse("11111111-1111-1111-1111-111111111101"),
                    CategoryName = "Structural Steel & Rebar",
                    BaseUnitId = Guid.Parse("22222222-2222-2222-2222-222222222204"),
                    BaseUnitName = "Metric Tonne",
                    MinimumStockLevel = 10.0m,
                    ReorderLevel = 25.0m,
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.Parse("33333333-3333-3333-3333-333333333302"),
                    ItemCode = "CEM-OPC-50KG",
                    NormalizedItemCode = "CEM-OPC-50KG",
                    Name = "Ordinary Portland Cement (CEM I 42.5N)",
                    Description = "High early-strength general construction cement",
                    Specification = "BS EN 197-1, 50kg moisture-resistant packaging",
                    CategoryId = Guid.Parse("11111111-1111-1111-1111-111111111102"),
                    CategoryName = "Cement & Binders",
                    BaseUnitId = Guid.Parse("22222222-2222-2222-2222-222222222202"),
                    BaseUnitName = "Bag",
                    MinimumStockLevel = 200.0m,
                    ReorderLevel = 350.0m,
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.Parse("33333333-3333-3333-3333-333333333303"),
                    ItemCode = "AGG-CRUSH-20MM",
                    NormalizedItemCode = "AGG-CRUSH-20MM",
                    Name = "Crushed Coarse Aggregate 20mm",
                    Description = "Graded crushed blue granite for structural concrete mixes",
                    Specification = "ASTM C33, washed, flakiness index < 25%",
                    CategoryId = Guid.Parse("11111111-1111-1111-1111-111111111104"),
                    CategoryName = "Crushed Aggregates & Gravel",
                    BaseUnitId = Guid.Parse("22222222-2222-2222-2222-222222222204"),
                    BaseUnitName = "Metric Tonne",
                    MinimumStockLevel = 40.0m,
                    ReorderLevel = 60.0m,
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.Parse("33333333-3333-3333-3333-333333333304"),
                    ItemCode = "PIPE-PVC-110MM",
                    NormalizedItemCode = "PIPE-PVC-110MM",
                    Name = "Heavy Duty PVC Drainage Pipe 110mm x 6m",
                    Description = "Underground foul drainage and stormwater pipe",
                    Specification = "SN8 stiffness rating, push-fit rubber ring joint, 6.0m length",
                    CategoryId = Guid.Parse("11111111-1111-1111-1111-111111111109"),
                    CategoryName = "Plumbing & Drainage",
                    BaseUnitId = Guid.Parse("22222222-2222-2222-2222-222222222201"),
                    BaseUnitName = "Piece",
                    MinimumStockLevel = 50.0m,
                    ReorderLevel = 100.0m,
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow
                }
            };
            WriteAtomicList(_materialsFilePath, initialMaterials);
        }
    }

    private static List<T> ReadList<T>(string filePath)
    {
        if (!File.Exists(filePath)) return [];
        var json = File.ReadAllText(filePath);
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<T>>(json, _jsonOptions) ?? [];
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"JSON file '{Path.GetFileName(filePath)}' is corrupted. Manual recovery required.", ex);
        }
    }

    private static void WriteAtomicList<T>(string filePath, List<T> list)
    {
        var tempFile = $"{filePath}.{Guid.NewGuid():N}.tmp";
        var json = JsonSerializer.Serialize(list, _jsonOptions);
        File.WriteAllText(tempFile, json);
        File.Move(tempFile, filePath, overwrite: true);
    }

    // --- IMaterialRepository implementation ---

    public async Task<IReadOnlyList<Material>> GetAllAsync(
        string? search = null,
        Guid? categoryId = null,
        bool? isActive = null,
        CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            var list = ReadList<Material>(_materialsFilePath);

            var query = list.AsEnumerable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToUpperInvariant();
                query = query.Where(m =>
                    m.NormalizedItemCode.Contains(term) ||
                    m.Name.ToUpperInvariant().Contains(term) ||
                    (m.Specification != null && m.Specification.ToUpperInvariant().Contains(term)));
            }

            if (categoryId.HasValue)
            {
                query = query.Where(m => m.CategoryId == categoryId.Value);
            }

            if (isActive.HasValue)
            {
                query = query.Where(m => m.IsActive == isActive.Value);
            }

            return query.OrderBy(m => m.ItemCode).ToList();
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public async Task<Material?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            var list = ReadList<Material>(_materialsFilePath);
            return list.FirstOrDefault(m => m.Id == id);
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public async Task<Material?> GetByItemCodeAsync(string itemCode, CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            var normalized = itemCode.Trim().ToUpperInvariant();
            var list = ReadList<Material>(_materialsFilePath);
            return list.FirstOrDefault(m => m.NormalizedItemCode == normalized);
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public async Task<bool> IsItemCodeTakenAsync(string itemCode, Guid? excludeId = null, CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            var normalized = itemCode.Trim().ToUpperInvariant();
            var list = ReadList<Material>(_materialsFilePath);
            return list.Any(m => m.NormalizedItemCode == normalized && (!excludeId.HasValue || m.Id != excludeId.Value));
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public async Task<Material> CreateAsync(Material material, CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            var list = ReadList<Material>(_materialsFilePath);
            material.ItemCode = material.ItemCode.Trim();
            material.NormalizedItemCode = material.ItemCode.ToUpperInvariant();
            material.CreatedAtUtc = DateTime.UtcNow;

            list.Add(material);
            WriteAtomicList(_materialsFilePath, list);
            return material;
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public async Task<Material> UpdateAsync(Material material, CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            var list = ReadList<Material>(_materialsFilePath);
            var index = list.FindIndex(m => m.Id == material.Id);
            if (index < 0)
            {
                throw new KeyNotFoundException($"Material with ID '{material.Id}' not found");
            }

            material.UpdatedAtUtc = DateTime.UtcNow;
            list[index] = material;
            WriteAtomicList(_materialsFilePath, list);
            return material;
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public async Task<bool> UpdateStatusAsync(Guid id, bool isActive, string? updatedByUserId = null, CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            var list = ReadList<Material>(_materialsFilePath);
            var item = list.FirstOrDefault(m => m.Id == id);
            if (item == null) return false;

            item.IsActive = isActive;
            item.UpdatedAtUtc = DateTime.UtcNow;
            item.UpdatedByUserId = updatedByUserId;
            WriteAtomicList(_materialsFilePath, list);
            return true;
        }
        finally
        {
            _fileLock.Release();
        }
    }

    // --- ICategoryRepository implementation ---

    public async Task<IReadOnlyList<MaterialCategory>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            return ReadList<MaterialCategory>(_categoriesFilePath).OrderBy(c => c.Name).ToList();
        }
        finally
        {
            _fileLock.Release();
        }
    }

    async Task<MaterialCategory?> ICategoryRepository.GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            var list = ReadList<MaterialCategory>(_categoriesFilePath);
            return list.FirstOrDefault(c => c.Id == id);
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public async Task<MaterialCategory> CreateAsync(MaterialCategory category, CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            var list = ReadList<MaterialCategory>(_categoriesFilePath);
            list.Add(category);
            WriteAtomicList(_categoriesFilePath, list);
            return category;
        }
        finally
        {
            _fileLock.Release();
        }
    }

    // --- IUnitRepository implementation ---

    async Task<IReadOnlyList<UnitOfMeasure>> IUnitRepository.GetAllAsync(CancellationToken cancellationToken)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            return ReadList<UnitOfMeasure>(_unitsFilePath).OrderBy(u => u.Name).ToList();
        }
        finally
        {
            _fileLock.Release();
        }
    }

    async Task<UnitOfMeasure?> IUnitRepository.GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            var list = ReadList<UnitOfMeasure>(_unitsFilePath);
            return list.FirstOrDefault(u => u.Id == id);
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public async Task<IReadOnlyList<UnitConversion>> GetConversionsAsync(Guid? materialId = null, CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);
        try
        {
            var list = ReadList<UnitConversion>(_conversionsFilePath);
            if (materialId.HasValue)
            {
                list = list.Where(c => c.MaterialId == null || c.MaterialId == materialId.Value).ToList();
            }
            return list;
        }
        finally
        {
            _fileLock.Release();
        }
    }
}
