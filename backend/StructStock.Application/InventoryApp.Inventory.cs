using Microsoft.EntityFrameworkCore;
using StructStock.Domain;

namespace StructStock.Application;

public partial class InventoryApp
{
    public async Task<object> ListBalancesAsync(
        string? search,
        string? projectId,
        string? warehouseId,
        string? materialId,
        string? status,
        int? page,
        int? pageSize,
        CancellationToken ct)
    {
        var list = await _db.Balances
            .Include(b => b.Material).ThenInclude(m => m!.Category)
            .Include(b => b.Material).ThenInclude(m => m!.BaseUnit)
            .Include(b => b.Warehouse)
            .Include(b => b.Project)
            .AsNoTracking().ToListAsync(ct);
        var filtered = list.Where(b => _me.CanAccessLocation(b.ProjectId, b.WarehouseId)).ToList();
        if (!string.IsNullOrWhiteSpace(projectId) && projectId != "ALL") filtered = filtered.Where(b => b.ProjectId == projectId).ToList();
        if (!string.IsNullOrWhiteSpace(warehouseId) && warehouseId != "ALL") filtered = filtered.Where(b => b.WarehouseId == warehouseId).ToList();
        if (!string.IsNullOrWhiteSpace(materialId) && materialId != "ALL") filtered = filtered.Where(b => b.MaterialId == materialId).ToList();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            filtered = filtered.Where(b =>
                (b.Material?.ItemCode ?? "").ToUpper().Contains(term) ||
                (b.Material?.Name ?? "").ToUpper().Contains(term)).ToList();
        }

        static bool IsLowStock(InventoryBalance b) =>
            b.Material != null && b.QuantityAvailable <= b.Material.ReorderLevel;

        var statusKey = (status ?? "ALL").Trim().ToUpperInvariant();
        filtered = statusKey switch
        {
            "LOW_STOCK" => filtered.Where(IsLowStock).ToList(),
            "OUT_OF_STOCK" => filtered.Where(b => b.QuantityAvailable <= 0).ToList(),
            "IN_STOCK" => filtered.Where(b => b.QuantityAvailable > 0 && !IsLowStock(b)).ToList(),
            _ => filtered
        };

        var metrics = new
        {
            totalMaterials = filtered.Select(b => b.MaterialId).Distinct().Count(),
            totalLocations = filtered.Select(b => b.WarehouseId).Distinct().Count(),
            totalInventoryValue = Money.Round2(filtered.Sum(b => b.InventoryValue)),
            totalQuantityOnHand = Money.Round4(filtered.Sum(b => b.QuantityOnHand)),
            lowStockCount = filtered.Count(IsLowStock)
        };

        var index = PageNo(page);
        var take = PageSize(pageSize);
        var total = filtered.Count;
        var pages = Math.Max(1, (int)Math.Ceiling(total / (double)take));
        var items = filtered
            .OrderBy(b => b.Material?.ItemCode)
            .ThenBy(b => b.Warehouse?.Name)
            .Skip((index - 1) * take)
            .Take(take)
            .Select(MapBalance)
            .ToList();

        return ApiResponse.Ok(new
        {
            items,
            pageIndex = index,
            pageSize = take,
            totalCount = total,
            totalPages = pages,
            hasPreviousPage = index > 1,
            hasNextPage = index < pages,
            metrics
        });
    }

    public async Task<object> GetBalancesForMaterialAsync(string materialId, CancellationToken ct)
    {
        var list = await _db.Balances
            .Include(b => b.Material).ThenInclude(m => m!.Category)
            .Include(b => b.Material).ThenInclude(m => m!.BaseUnit)
            .Include(b => b.Warehouse).Include(b => b.Project)
            .AsNoTracking()
            .Where(b => b.MaterialId == materialId)
            .ToListAsync(ct);
        return ApiResponse.Ok(list.Where(b => _me.CanAccessLocation(b.ProjectId, b.WarehouseId)).Select(MapBalance).ToList());
    }

    public async Task<object> ListLedgerAsync(string? search, string? projectId, string? warehouseId, string? materialId, string? transactionType, int? page, int? pageSize, CancellationToken ct)
    {
        var list = await _db.Ledger
            .Include(e => e.Material).Include(e => e.Warehouse).Include(e => e.Project)
            .AsNoTracking().OrderByDescending(e => e.TimestampUtc).ToListAsync(ct);
        var filtered = list.Where(e => _me.CanAccessLocation(e.ProjectId, e.WarehouseId)).ToList();
        if (!string.IsNullOrWhiteSpace(projectId) && projectId != "ALL") filtered = filtered.Where(e => e.ProjectId == projectId).ToList();
        if (!string.IsNullOrWhiteSpace(warehouseId) && warehouseId != "ALL") filtered = filtered.Where(e => e.WarehouseId == warehouseId).ToList();
        if (!string.IsNullOrWhiteSpace(materialId) && materialId != "ALL") filtered = filtered.Where(e => e.MaterialId == materialId).ToList();
        if (!string.IsNullOrWhiteSpace(transactionType) && transactionType != "ALL") filtered = filtered.Where(e => e.TransactionType == transactionType).ToList();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            filtered = filtered.Where(e =>
                e.ReferenceNumber.ToUpper().Contains(term) ||
                e.SourceDocumentNumber.ToUpper().Contains(term) ||
                (e.Material?.ItemCode ?? "").ToUpper().Contains(term)).ToList();
        }

        return ApiResponse.Ok(Page(filtered.Select(MapLedger).ToList(), page, pageSize));
    }

    public async Task<object> GetLedgerEntryAsync(string id, CancellationToken ct)
    {
        var e = await _db.Ledger.Include(x => x.Material).Include(x => x.Warehouse).Include(x => x.Project)
            .FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new AppException(404, "Ledger entry not found");
        RequireLocation(e.ProjectId, e.WarehouseId);
        return ApiResponse.Ok(MapLedger(e));
    }

    public async Task<object> ValuationAsync(string? projectId, string? warehouseId, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "AccountsOfficer", "ProjectManager");
        var balances = await _db.Balances
            .Include(b => b.Material).ThenInclude(m => m!.Category)
            .Include(b => b.Material).ThenInclude(m => m!.BaseUnit)
            .Include(b => b.Warehouse).Include(b => b.Project)
            .AsNoTracking().ToListAsync(ct);
        var filtered = balances.Where(b => _me.CanAccessLocation(b.ProjectId, b.WarehouseId)).ToList();
        if (!string.IsNullOrWhiteSpace(projectId) && projectId != "ALL") filtered = filtered.Where(b => b.ProjectId == projectId).ToList();
        if (!string.IsNullOrWhiteSpace(warehouseId) && warehouseId != "ALL") filtered = filtered.Where(b => b.WarehouseId == warehouseId).ToList();

        var byMaterial = filtered.GroupBy(b => b.MaterialId).Select(g =>
        {
            var qty = g.Sum(x => x.QuantityOnHand);
            var value = Money.Round2(g.Sum(x => x.InventoryValue));
            return new
            {
                materialId = g.Key,
                materialCode = g.First().Material?.ItemCode ?? "",
                materialName = g.First().Material?.Name ?? "",
                categoryName = g.First().Material?.Category?.Name ?? "",
                unitCode = g.First().Material?.BaseUnit?.Code ?? "",
                totalQuantity = Money.Round4(qty),
                averageCost = qty > 0 ? Money.Round4(value / qty) : 0m,
                totalValue = value,
                locationCount = g.Select(x => x.WarehouseId).Distinct().Count(),
                // legacy aliases
                quantityOnHand = Money.Round4(qty),
                inventoryValue = value,
                weightedAverageCost = qty > 0 ? Money.Round4(value / qty) : 0m
            };
        }).OrderByDescending(x => x.totalValue).ToList();

        var byWarehouse = filtered.GroupBy(b => b.WarehouseId).Select(g =>
        {
            var qty = g.Sum(x => x.QuantityOnHand);
            var value = Money.Round2(g.Sum(x => x.InventoryValue));
            return new
            {
                locationId = g.Key,
                locationName = g.First().Warehouse?.Name ?? "",
                locationType = "Warehouse",
                itemCount = g.Select(x => x.MaterialId).Distinct().Count(),
                totalQuantity = Money.Round4(qty),
                totalValue = value,
                warehouseId = g.Key,
                warehouseName = g.First().Warehouse?.Name ?? "",
                inventoryValue = value,
                skuCount = g.Count(x => x.QuantityOnHand > 0)
            };
        }).OrderByDescending(x => x.totalValue).ToList();

        var byProject = filtered.GroupBy(b => b.ProjectId).Select(g =>
        {
            var qty = g.Sum(x => x.QuantityOnHand);
            var value = Money.Round2(g.Sum(x => x.InventoryValue));
            return new
            {
                locationId = g.Key,
                locationName = g.First().Project?.Name ?? "",
                locationType = "Project",
                itemCount = g.Select(x => x.MaterialId).Distinct().Count(),
                totalQuantity = Money.Round4(qty),
                totalValue = value,
                projectId = g.Key,
                projectName = g.First().Project?.Name ?? "",
                inventoryValue = value
            };
        }).OrderByDescending(x => x.totalValue).ToList();

        var totalInventoryValue = Money.Round2(filtered.Sum(b => b.InventoryValue));
        var totalQuantityOnHand = Money.Round4(filtered.Sum(b => b.QuantityOnHand));

        return ApiResponse.Ok(new
        {
            valuationPolicy = "WEIGHTED_AVERAGE_COST",
            byMaterial,
            byWarehouse,
            byProject,
            summary = new
            {
                totalInventoryValue,
                totalQuantityOnHand,
                distinctMaterials = byMaterial.Count,
                activeLocations = byWarehouse.Count,
                asOfTimestampUtc = DateTime.UtcNow.ToString("o")
            },
            // flat aliases for older clients
            totalInventoryValue,
            totalQuantityOnHand,
            lines = filtered.Select(MapBalance).ToList()
        });
    }

    public async Task<object> ReconciliationAsync(CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "AccountsOfficer", "ProjectManager");
        var balances = await _db.Balances.Include(b => b.Material).Include(b => b.Warehouse).Include(b => b.Project).AsNoTracking().ToListAsync(ct);
        var ledger = await _db.Ledger.AsNoTracking().ToListAsync(ct);
        var ledgerSums = ledger.GroupBy(e => $"{e.MaterialId}|{e.WarehouseId}|{e.ProjectId}")
            .ToDictionary(g => g.Key, g => new
            {
                qty = g.Sum(x => x.SignedQuantity),
                value = g.OrderByDescending(x => x.TimestampUtc).First().TotalValuationAfter,
                materialCode = g.First().MaterialId,
                location = $"{g.First().WarehouseId} / {g.First().ProjectId}"
            });

        var variances = new List<object>();
        foreach (var b in balances.Where(x => _me.CanAccessLocation(x.ProjectId, x.WarehouseId)))
        {
            var key = $"{b.MaterialId}|{b.WarehouseId}|{b.ProjectId}";
            ledgerSums.TryGetValue(key, out var sum);
            var ledgerQty = sum?.qty ?? 0;
            if (Math.Abs(ledgerQty - b.QuantityOnHand) > 0.0001m)
            {
                variances.Add(new
                {
                    materialId = b.MaterialId,
                    materialCode = b.Material?.ItemCode ?? "",
                    warehouseId = b.WarehouseId,
                    warehouseName = b.Warehouse?.Name ?? "",
                    projectId = b.ProjectId,
                    projectName = b.Project?.Name ?? "",
                    balanceQuantity = b.QuantityOnHand,
                    ledgerQuantity = ledgerQty,
                    variance = Money.Round4(b.QuantityOnHand - ledgerQty)
                });
            }
        }

        return ApiResponse.Ok(new { varianceCount = variances.Count, variances });
    }

    public async Task<object> RecoverBalancesAsync(CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var ledger = await _db.Ledger.Include(e => e.Material).OrderBy(e => e.TimestampUtc).ToListAsync(ct);
        var balances = await _db.Balances.ToListAsync(ct);
        foreach (var group in ledger.GroupBy(e => new { e.MaterialId, e.WarehouseId, e.ProjectId }))
        {
            var last = group.Last();
            var bal = balances.FirstOrDefault(b =>
                b.MaterialId == group.Key.MaterialId &&
                b.WarehouseId == group.Key.WarehouseId &&
                b.ProjectId == group.Key.ProjectId);
            if (bal == null)
            {
                bal = new InventoryBalance
                {
                    Id = Ids.New("BAL"),
                    MaterialId = group.Key.MaterialId,
                    WarehouseId = group.Key.WarehouseId,
                    ProjectId = group.Key.ProjectId
                };
                _db.Balances.Add(bal);
                balances.Add(bal);
            }

            bal.QuantityOnHand = last.BalanceQuantityAfter;
            bal.WeightedAverageCost = last.WeightedAverageCostAfter;
            bal.InventoryValue = last.TotalValuationAfter;
            bal.QuantityAvailable = bal.QuantityOnHand - bal.QuantityReserved;
            bal.Version += 1;
            bal.LastUpdatedUtc = DateTime.UtcNow;
        }

        await Save(ct);
        await tx.CommitAsync(ct);
        return ApiResponse.Ok(new { recovered = balances.Count }, "Balances rebuilt from ledger");
    }

    private static object MapBalance(InventoryBalance b)
    {
        var reorder = b.Material?.ReorderLevel ?? 0m;
        var minimum = b.Material?.MinimumStockLevel ?? 0m;
        var isLowStock = b.Material != null && b.QuantityAvailable <= reorder;
        return new
        {
            id = b.Id,
            materialId = b.MaterialId,
            materialCode = b.Material?.ItemCode ?? "",
            materialName = b.Material?.Name ?? "",
            categoryId = b.Material?.CategoryId,
            categoryName = b.Material?.Category?.Name,
            unitCode = b.Material?.BaseUnit?.Code ?? "",
            warehouseId = b.WarehouseId,
            warehouseName = b.Warehouse?.Name ?? "",
            projectId = b.ProjectId,
            projectName = b.Project?.Name ?? "",
            quantityOnHand = b.QuantityOnHand,
            quantityReserved = b.QuantityReserved,
            quantityAvailable = b.QuantityAvailable,
            quantityInTransit = b.QuantityInTransit,
            weightedAverageCost = b.WeightedAverageCost,
            inventoryValue = b.InventoryValue,
            version = b.Version,
            lastUpdatedUtc = b.LastUpdatedUtc.ToString("o"),
            globalMinimumStockLevel = minimum,
            globalReorderLevel = reorder,
            isLowStock
        };
    }

    private static object MapLedger(StockLedgerEntry e) => new
    {
        id = e.Id,
        referenceNumber = e.ReferenceNumber,
        transactionType = e.TransactionType,
        sourceDocumentType = e.SourceDocumentType,
        sourceDocumentId = e.SourceDocumentId,
        sourceDocumentNumber = e.SourceDocumentNumber,
        sourceLineId = e.SourceLineId,
        materialId = e.MaterialId,
        materialCode = e.Material?.ItemCode ?? "",
        materialName = e.Material?.Name ?? "",
        unitCode = e.Material?.BaseUnit?.Code ?? "",
        warehouseId = e.WarehouseId,
        warehouseName = e.Warehouse?.Name ?? "",
        projectId = e.ProjectId,
        projectName = e.Project?.Name ?? "",
        quantityIn = e.QuantityIn,
        quantityOut = e.QuantityOut,
        signedQuantity = e.SignedQuantity,
        unitCost = e.UnitCost,
        transactionValue = e.TransactionValue,
        balanceQuantityAfter = e.BalanceQuantityAfter,
        weightedAverageCostAfter = e.WeightedAverageCostAfter,
        totalValuationAfter = e.TotalValuationAfter,
        batchNumber = e.BatchNumber,
        idempotencyKey = e.IdempotencyKey,
        transactionDate = e.TransactionDate.ToString("yyyy-MM-dd"),
        timestampUtc = e.TimestampUtc.ToString("o"),
        createdByUserId = e.CreatedByUserId,
        createdByName = e.CreatedByName,
        remarks = e.Remarks
    };
}
