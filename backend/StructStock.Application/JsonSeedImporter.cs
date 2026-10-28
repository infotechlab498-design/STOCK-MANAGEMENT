using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StructStock.Domain;
using StructStock.Infrastructure;

namespace StructStock.Application;

public class JsonSeedImporter
{
    private readonly AppDbContext _db;
    private readonly string _dataDir;

    public JsonSeedImporter(AppDbContext db, string dataDir)
    {
        _db = db;
        _dataDir = dataDir;
    }

    public async Task ImportAsync(CancellationToken ct = default)
    {
        if (!Directory.Exists(_dataDir))
        {
            Console.WriteLine($"[seed-json] No data directory at {_dataDir}");
            return;
        }

        await ImportMaterials(ct);
        await ImportRequisitions(ct);
        Console.WriteLine("[seed-json] Import finished (existing ids skipped).");
    }

    private async Task ImportMaterials(CancellationToken ct)
    {
        var path = Path.Combine(_dataDir, "materials.json");
        if (!File.Exists(path)) return;
        using var doc = JsonDocument.Parse(await File.ReadAllTextAsync(path, ct));
        foreach (var el in doc.RootElement.EnumerateArray())
        {
            var id = el.GetProperty("id").GetString()!;
            if (await _db.Materials.AnyAsync(m => m.Id == id, ct)) continue;
            var categoryId = el.GetProperty("categoryId").GetString()!;
            var unitId = el.GetProperty("baseUnitId").GetString()!;
            if (!await _db.Categories.AnyAsync(c => c.Id == categoryId, ct)) continue;
            if (!await _db.Units.AnyAsync(u => u.Id == unitId, ct)) continue;
            _db.Materials.Add(new Material
            {
                Id = id,
                ItemCode = el.GetProperty("itemCode").GetString()!,
                NormalizedItemCode = el.TryGetProperty("normalizedItemCode", out var n) ? n.GetString()! : el.GetProperty("itemCode").GetString()!.ToUpperInvariant(),
                Name = el.GetProperty("name").GetString()!,
                Description = el.TryGetProperty("description", out var d) ? d.GetString() : null,
                Specification = el.TryGetProperty("specification", out var s) ? s.GetString() : null,
                CategoryId = categoryId,
                BaseUnitId = unitId,
                MinimumStockLevel = el.TryGetProperty("minimumStockLevel", out var min) ? min.GetDecimal() : 0,
                ReorderLevel = el.TryGetProperty("reorderLevel", out var re) ? re.GetDecimal() : 0,
                IsActive = !el.TryGetProperty("isActive", out var a) || a.GetBoolean(),
                CreatedAtUtc = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync(ct);
    }

    private async Task ImportRequisitions(CancellationToken ct)
    {
        var path = Path.Combine(_dataDir, "requisitions.json");
        if (!File.Exists(path)) return;
        using var doc = JsonDocument.Parse(await File.ReadAllTextAsync(path, ct));
        foreach (var el in doc.RootElement.EnumerateArray())
        {
            var id = el.GetProperty("id").GetString()!;
            if (await _db.Requisitions.AnyAsync(r => r.Id == id, ct)) continue;
            var projectId = el.GetProperty("projectId").GetString()!;
            if (!await _db.Projects.AnyAsync(p => p.Id == projectId, ct)) continue;
            var req = new Requisition
            {
                Id = id,
                RequisitionNumber = el.GetProperty("requisitionNumber").GetString()!,
                ProjectId = projectId,
                RequesterUserId = el.TryGetProperty("requesterUserId", out var u) ? u.GetString()! : "USR-ADMIN-01",
                RequesterName = el.TryGetProperty("requesterName", out var rn) ? rn.GetString()! : "Import",
                RequesterRole = el.TryGetProperty("requesterRole", out var rr) ? rr.GetString()! : "SuperAdmin",
                RequiredDate = DateOnly.TryParse(el.GetProperty("requiredDate").GetString(), out var rd) ? rd : DateOnly.FromDateTime(DateTime.UtcNow),
                Priority = el.TryGetProperty("priority", out var pr) ? pr.GetString()! : "Medium",
                Purpose = el.TryGetProperty("purpose", out var pu) ? pu.GetString()! : "Imported",
                Status = el.TryGetProperty("status", out var st) ? st.GetString()! : "Draft",
                CreatedAtUtc = DateTime.UtcNow
            };
            if (el.TryGetProperty("items", out var items) && items.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in items.EnumerateArray())
                {
                    var materialId = item.GetProperty("materialId").GetString()!;
                    if (!await _db.Materials.AnyAsync(m => m.Id == materialId, ct)) continue;
                    req.Lines.Add(new RequisitionLine
                    {
                        Id = item.TryGetProperty("id", out var lid) ? lid.GetString()! : Ids.New("RQI"),
                        RequisitionId = req.Id,
                        MaterialId = materialId,
                        RequestedQuantity = item.GetProperty("requestedQuantity").GetDecimal(),
                        Remarks = item.TryGetProperty("remarks", out var rem) ? rem.GetString() : null
                    });
                }
            }

            _db.Requisitions.Add(req);
        }

        await _db.SaveChangesAsync(ct);
    }
}
