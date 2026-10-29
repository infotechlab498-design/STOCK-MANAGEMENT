using System.Text;
using Microsoft.EntityFrameworkCore;
using StructStock.Domain;

namespace StructStock.Application;

public partial class InventoryApp
{
    public async Task<object> ListNotificationsAsync(int? page, int? pageSize, CancellationToken ct)
    {
        var notes = await VisibleNotifications(ct);
        var ordered = notes.OrderByDescending(n => n.CreatedAtUtc).ToList();
        var unreadCount = ordered.Count(n => n.Reads.All(r => r.UserId != _me.UserId));
        var index = PageNo(page);
        var take = PageSize(pageSize);
        var total = ordered.Count;
        var pages = Math.Max(1, (int)Math.Ceiling(total / (double)take));
        var items = ordered.Skip((index - 1) * take).Take(take).Select(n => MapNotification(n, _me.UserId)).ToList();
        return ApiResponse.Ok(new
        {
            items,
            pageIndex = index,
            pageSize = take,
            totalCount = total,
            totalPages = pages,
            hasPreviousPage = index > 1,
            hasNextPage = index < pages,
            unreadCount
        });
    }

    public async Task<object> UnreadNotificationCountAsync(CancellationToken ct)
    {
        var notes = await VisibleNotifications(ct);
        var count = notes.Count(n => n.Reads.All(r => r.UserId != _me.UserId));
        return ApiResponse.Ok(new { count, unreadCount = count, totalAccessibleCount = notes.Count });
    }

    public async Task<object> MarkNotificationReadAsync(string id, CancellationToken ct)
    {
        var note = await _db.Notifications.Include(n => n.Reads).FirstOrDefaultAsync(n => n.Id == id, ct)
            ?? throw new AppException(404, "Notification not found");
        if (note.Reads.All(r => r.UserId != _me.UserId))
        {
            _db.NotificationReads.Add(new NotificationRead
            {
                NotificationId = note.Id,
                UserId = _me.UserId,
                ReadAtUtc = DateTime.UtcNow
            });
            await Save(ct);
        }

        return ApiResponse.Ok(new { id, read = true });
    }

    public async Task<object> MarkAllNotificationsReadAsync(CancellationToken ct)
    {
        var notes = await VisibleNotifications(ct);
        foreach (var note in notes.Where(n => n.Reads.All(r => r.UserId != _me.UserId)))
        {
            _db.NotificationReads.Add(new NotificationRead
            {
                NotificationId = note.Id,
                UserId = _me.UserId,
                ReadAtUtc = DateTime.UtcNow
            });
        }

        await Save(ct);
        return ApiResponse.Ok(new { readAll = true });
    }

    public async Task<object> DashboardSummaryAsync(
        string? projectId,
        string? warehouseId,
        string? fromDate,
        string? toDate,
        CancellationToken ct)
    {
        var balances = await _db.Balances
            .Include(b => b.Material!).ThenInclude(m => m.Category)
            .Include(b => b.Material!).ThenInclude(m => m.BaseUnit)
            .Include(b => b.Warehouse)
            .Include(b => b.Project)
            .AsNoTracking()
            .ToListAsync(ct);

        balances = balances
            .Where(b => _me.CanAccessLocation(b.ProjectId, b.WarehouseId))
            .Where(b => string.IsNullOrWhiteSpace(projectId) || projectId == "ALL" || b.ProjectId == projectId)
            .Where(b => string.IsNullOrWhiteSpace(warehouseId) || warehouseId == "ALL" || b.WarehouseId == warehouseId)
            .ToList();

        DateTime? fromUtc = DateTime.TryParse(fromDate, out var fd) ? fd.ToUniversalTime() : null;
        DateTime? toUtc = DateTime.TryParse(toDate, out var td) ? td.ToUniversalTime().Date.AddDays(1).AddTicks(-1) : null;

        bool InDate(DateTime value) =>
            (!fromUtc.HasValue || value >= fromUtc.Value) && (!toUtc.HasValue || value <= toUtc.Value);

        var projects = await _db.Projects.AsNoTracking()
            .Where(p => p.IsActive && (_me.IsGlobal || _me.ProjectScopes.Contains(p.Id)))
            .OrderBy(p => p.Code)
            .Select(p => new { id = p.Id, code = p.Code, name = p.Name, location = p.Location })
            .ToListAsync(ct);

        var warehouses = await _db.Warehouses.AsNoTracking()
            .Where(w => w.IsActive && (_me.IsGlobal || _me.WarehouseScopes.Contains(w.Id)))
            .OrderBy(w => w.Code)
            .Select(w => new { id = w.Id, name = w.Name, projectId = w.ProjectId })
            .ToListAsync(ct);

        var pendingReq = await _db.Requisitions.CountAsync(r =>
            r.Status == "Submitted" &&
            (_me.IsGlobal || _me.ProjectScopes.Contains(r.ProjectId)) &&
            (string.IsNullOrWhiteSpace(projectId) || projectId == "ALL" || r.ProjectId == projectId), ct);

        var pendingPo = await _db.PurchaseOrders.CountAsync(p =>
            p.Status == "PendingApproval" &&
            (_me.IsGlobal || _me.ProjectScopes.Contains(p.ProjectId)) &&
            (string.IsNullOrWhiteSpace(projectId) || projectId == "ALL" || p.ProjectId == projectId), ct);

        var pendingGrn = await _db.GoodsReceipts.CountAsync(g =>
            (g.Status == "SubmittedForInspection" || g.Status == "Inspected") &&
            (_me.IsGlobal || _me.ProjectScopes.Contains(g.ProjectId)) &&
            (string.IsNullOrWhiteSpace(projectId) || projectId == "ALL" || g.ProjectId == projectId) &&
            (string.IsNullOrWhiteSpace(warehouseId) || warehouseId == "ALL" || g.WarehouseId == warehouseId), ct);

        var outstandingIssues = await _db.MaterialIssues.CountAsync(i =>
            i.Status != "Posted" && i.Status != "Cancelled" && i.Status != "Rejected" &&
            (_me.IsGlobal || _me.ProjectScopes.Contains(i.ProjectId)) &&
            (string.IsNullOrWhiteSpace(projectId) || projectId == "ALL" || i.ProjectId == projectId), ct);

        var pendingIssueApprovals = await _db.MaterialIssues.CountAsync(i =>
            i.Status == "Submitted" &&
            (_me.IsGlobal || _me.ProjectScopes.Contains(i.ProjectId)) &&
            (string.IsNullOrWhiteSpace(projectId) || projectId == "ALL" || i.ProjectId == projectId), ct);

        var openTransfers = await _db.StockTransfers
            .Where(t => t.Status != "Completed" && t.Status != "Cancelled" &&
                        (_me.IsGlobal || _me.ProjectScopes.Contains(t.SourceProjectId) || _me.ProjectScopes.Contains(t.DestinationProjectId)))
            .ToListAsync(ct);
        if (!string.IsNullOrWhiteSpace(projectId) && projectId != "ALL")
        {
            openTransfers = openTransfers
                .Where(t => t.SourceProjectId == projectId || t.DestinationProjectId == projectId)
                .ToList();
        }

        var inTransitTransfers = openTransfers.Count(t => t.Status == "InTransit" || t.Status == "Dispatched");
        var transferDiscrepancies = await _db.StockTransfers.CountAsync(t => t.DiscrepancyStatus == "PendingReview", ct);
        var returnDiscrepancies = await _db.MaterialReturns.CountAsync(r =>
            r.Status == "Submitted" || r.Status == "PendingInspection" || r.Status == "Inspected", ct);
        var grnDiscrepancies = await _db.GoodsReceipts.CountAsync(g => g.DiscrepancyIdentified, ct);
        var unread = (await VisibleNotifications(ct)).Count(n => n.Reads.All(r => r.UserId != _me.UserId));

        string Severity(InventoryBalance b)
        {
            if (b.QuantityAvailable <= 0) return "OutOfStock";
            if (b.Material != null && b.QuantityAvailable <= b.Material.MinimumStockLevel) return "Critical";
            return "Reorder";
        }

        var lowStock = balances
            .Where(b => b.Material != null && b.QuantityAvailable <= b.Material.ReorderLevel)
            .Select(b => new
            {
                balanceId = b.Id,
                materialId = b.MaterialId,
                materialCode = b.Material!.ItemCode,
                materialName = b.Material.Name,
                categoryName = b.Material.Category?.Name ?? "Uncategorized",
                unitCode = b.Material.BaseUnit?.Code ?? "",
                warehouseId = b.WarehouseId,
                warehouseName = b.Warehouse?.Name ?? "",
                projectId = b.ProjectId,
                projectName = b.Project?.Name ?? "",
                quantityOnHand = b.QuantityOnHand,
                quantityAvailable = b.QuantityAvailable,
                quantityInTransit = b.QuantityInTransit,
                minimumStockLevel = b.Material.MinimumStockLevel,
                reorderLevel = b.Material.ReorderLevel,
                shortfallQuantity = Money.Round4(Math.Max(0, b.Material.ReorderLevel - b.QuantityAvailable)),
                weightedAverageCost = b.WeightedAverageCost,
                estimatedReplenishmentCost = Money.Round2(Math.Max(0, b.Material.ReorderLevel - b.QuantityAvailable) * b.WeightedAverageCost),
                severity = Severity(b)
            })
            .OrderBy(x => x.quantityAvailable)
            .Take(20)
            .ToList();

        var totalValue = Money.Round2(balances.Sum(b => b.InventoryValue));
        var categoryGroups = balances
            .GroupBy(b => b.Material?.Category?.Name ?? "Uncategorized")
            .Select(g =>
            {
                var value = Money.Round2(g.Sum(x => x.InventoryValue));
                return new
                {
                    categoryName = g.Key,
                    totalQuantity = Money.Round4(g.Sum(x => x.QuantityOnHand)),
                    totalValue = value,
                    itemCount = g.Select(x => x.MaterialId).Distinct().Count(),
                    sharePercent = totalValue > 0 ? Math.Round(value / totalValue * 100m, 1) : 0m
                };
            })
            .OrderByDescending(c => c.totalValue)
            .ToList();

        var grnsByWh = await _db.GoodsReceipts.AsNoTracking()
            .Where(g => g.Status == "SubmittedForInspection" || g.Status == "Inspected")
            .GroupBy(g => g.WarehouseId)
            .Select(g => new { warehouseId = g.Key, count = g.Count() })
            .ToListAsync(ct);
        var issuesByWh = await _db.MaterialIssues.AsNoTracking()
            .Where(i => i.Status != "Posted" && i.Status != "Cancelled" && i.Status != "Rejected")
            .GroupBy(i => i.WarehouseId)
            .Select(g => new { warehouseId = g.Key, count = g.Count() })
            .ToListAsync(ct);
        var transfersByWh = openTransfers
            .GroupBy(t => t.SourceWarehouseId)
            .ToDictionary(g => g.Key, g => g.Count());

        var locationSummaries = balances
            .GroupBy(b => new { b.WarehouseId, b.ProjectId })
            .Select(g =>
            {
                var first = g.First();
                return new
                {
                    warehouseId = g.Key.WarehouseId,
                    warehouseName = first.Warehouse?.Name ?? "",
                    projectId = g.Key.ProjectId,
                    projectName = first.Project?.Name ?? "",
                    distinctMaterials = g.Select(x => x.MaterialId).Distinct().Count(),
                    quantityOnHand = Money.Round4(g.Sum(x => x.QuantityOnHand)),
                    quantityAvailable = Money.Round4(g.Sum(x => x.QuantityAvailable)),
                    quantityInTransit = Money.Round4(g.Sum(x => x.QuantityInTransit)),
                    inventoryValue = Money.Round2(g.Sum(x => x.InventoryValue)),
                    lowStockCount = g.Count(x => x.Material != null && x.QuantityAvailable <= x.Material.ReorderLevel),
                    pendingGrnCount = grnsByWh.FirstOrDefault(x => x.warehouseId == g.Key.WarehouseId)?.count ?? 0,
                    openIssueCount = issuesByWh.FirstOrDefault(x => x.warehouseId == g.Key.WarehouseId)?.count ?? 0,
                    openTransferCount = transfersByWh.TryGetValue(g.Key.WarehouseId, out var tc) ? tc : 0
                };
            })
            .OrderBy(x => x.warehouseName)
            .ToList();

        var recentLedger = await _db.Ledger
            .Include(e => e.Material!).ThenInclude(m => m.BaseUnit)
            .Include(e => e.Warehouse)
            .Include(e => e.Project)
            .AsNoTracking()
            .OrderByDescending(e => e.TimestampUtc)
            .Take(100)
            .ToListAsync(ct);

        var movements = recentLedger
            .Where(e => _me.CanAccessLocation(e.ProjectId, e.WarehouseId))
            .Where(e => string.IsNullOrWhiteSpace(projectId) || projectId == "ALL" || e.ProjectId == projectId)
            .Where(e => string.IsNullOrWhiteSpace(warehouseId) || warehouseId == "ALL" || e.WarehouseId == warehouseId)
            .Where(e => InDate(e.TimestampUtc))
            .Take(10)
            .Select(MapLedger)
            .ToList();

        var recentAuditActivity = recentLedger
            .Where(e => _me.CanAccessLocation(e.ProjectId, e.WarehouseId))
            .Where(e => string.IsNullOrWhiteSpace(projectId) || projectId == "ALL" || e.ProjectId == projectId)
            .Where(e => InDate(e.TimestampUtc))
            .Take(10)
            .Select(e => new
            {
                id = e.Id,
                timestampUtc = e.TimestampUtc.ToString("o"),
                module = e.SourceDocumentType,
                documentNumber = e.SourceDocumentNumber,
                documentId = e.SourceDocumentId,
                action = e.TransactionType,
                actorName = e.CreatedByName,
                actorRole = "",
                summary = $"{e.TransactionType} • {e.Material?.ItemCode ?? e.MaterialId} • qty {e.SignedQuantity}",
                projectId = e.ProjectId,
                warehouseId = e.WarehouseId,
                targetRoute = e.SourceDocumentType switch
                {
                    "GoodsReceipt" => $"/grns/{e.SourceDocumentId}",
                    "MaterialIssue" => $"/material-issues/{e.SourceDocumentId}",
                    "MaterialReturn" => $"/material-returns/{e.SourceDocumentId}",
                    "StockTransfer" => $"/stock-transfers/{e.SourceDocumentId}",
                    "PurchaseOrder" => $"/purchase-orders/{e.SourceDocumentId}",
                    _ => "/stock-ledger"
                }
            })
            .ToList();

        var totalOnHand = Money.Round4(balances.Sum(b => b.QuantityOnHand));
        var totalReserved = Money.Round4(balances.Sum(b => b.QuantityReserved));
        var totalAvailable = Money.Round4(balances.Sum(b => b.QuantityAvailable));
        var totalInTransitQty = Money.Round4(balances.Sum(b => b.QuantityInTransit));
        var totalInTransitValue = Money.Round2(balances.Sum(b => b.QuantityInTransit * b.WeightedAverageCost));

        return ApiResponse.Ok(new
        {
            asOfTimestampUtc = DateTime.UtcNow.ToString("o"),
            filtersApplied = new
            {
                projectId = string.IsNullOrWhiteSpace(projectId) ? "ALL" : projectId,
                warehouseId = string.IsNullOrWhiteSpace(warehouseId) ? "ALL" : warehouseId,
                fromDate = fromDate,
                toDate = toDate
            },
            accessibleScopes = new { projects, warehouses },
            kpis = new
            {
                // Full dashboard contract (React)
                totalInventoryValue = totalValue,
                totalQuantityOnHand = totalOnHand,
                totalQuantityReserved = totalReserved,
                totalQuantityAvailable = totalAvailable,
                totalInTransitQuantity = totalInTransitQty,
                totalInTransitValue = totalInTransitValue,
                distinctMaterialsCount = balances.Select(b => b.MaterialId).Distinct().Count(),
                activeLocationsCount = balances.Select(b => b.WarehouseId).Distinct().Count(),
                lowStockCount = lowStock.Count,
                criticalStockCount = lowStock.Count(x => x.severity is "Critical" or "OutOfStock"),
                pendingRequisitionApprovals = pendingReq,
                outstandingMaterialIssues = outstandingIssues,
                pendingIssueApprovalsCount = pendingIssueApprovals,
                pendingGrnsInspection = pendingGrn,
                openTransfersCount = openTransfers.Count,
                inTransitTransfersCount = inTransitTransfers,
                unresolvedDiscrepanciesCount = transferDiscrepancies + grnDiscrepancies + returnDiscrepancies,
                grnDiscrepanciesCount = grnDiscrepancies,
                transferDiscrepanciesCount = transferDiscrepancies,
                returnDiscrepanciesCount = returnDiscrepancies,
                pendingPoApprovalsCount = pendingPo,
                // Sidebar / legacy aliases
                materialCount = await _db.Materials.CountAsync(m => m.IsActive, ct),
                pendingRequisitionApprovalsCount = pendingReq,
                pendingGrnInspectionsCount = pendingGrn,
                inTransitQuantity = totalInTransitQty,
                unreadNotificationsCount = unread
            },
            lowStockItems = lowStock,
            locationSummaries,
            categoryValuation = categoryGroups,
            recentMovements = movements,
            recentAuditActivity
        });
    }

    public async Task<object> GetReportAsync(string reportType, Dictionary<string, string?> filters, CancellationToken ct)
    {
        var built = await BuildReport(reportType, filters, ct);
        var page = int.TryParse(filters.GetValueOrDefault("page"), out var p) ? p : 1;
        var size = int.TryParse(filters.GetValueOrDefault("pageSize"), out var s) ? s : 25;
        size = Math.Clamp(size, 1, 500);
        page = Math.Max(1, page);
        var total = built.Rows.Count;
        var items = built.Rows.Skip((page - 1) * size).Take(size).ToList();
        return ApiResponse.Ok(new
        {
            reportType = built.ReportType,
            title = built.Title,
            subtitle = built.Subtitle,
            asOfTimestampUtc = DateTime.UtcNow.ToString("o"),
            filtersApplied = filters,
            summary = built.Summary,
            columns = built.Columns,
            items,
            pageIndex = page,
            pageSize = size,
            totalCount = total,
            totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)size))
        });
    }

    public async Task<(string FileName, string Csv)> ExportReportCsvAsync(string reportType, Dictionary<string, string?> filters, CancellationToken ct)
    {
        var built = await BuildReport(reportType, filters, ct);
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", built.Columns.Select(c => EscapeCsv(c.Header))));
        foreach (var row in built.Rows)
        {
            var dict = (IDictionary<string, object?>)row;
            sb.AppendLine(string.Join(",", built.Columns.Select(c => EscapeCsv(dict.TryGetValue(c.Key, out var v) ? v?.ToString() ?? "" : ""))));
        }

        return ($"{reportType}-{DateTime.UtcNow:yyyy-MM-dd}.csv", sb.ToString());
    }

    private async Task<ReportBuilt> BuildReport(string reportType, Dictionary<string, string?> filters, CancellationToken ct)
    {
        switch (reportType)
        {
            case "stock-balances":
            {
                var balances = await _db.Balances.Include(b => b.Material).Include(b => b.Warehouse).Include(b => b.Project)
                    .AsNoTracking().ToListAsync(ct);
                var rows = balances.Where(b => _me.CanAccessLocation(b.ProjectId, b.WarehouseId))
                    .Select(b => ToDict(new
                    {
                        materialCode = b.Material?.ItemCode ?? "",
                        warehouseName = b.Warehouse?.Name ?? "",
                        quantityOnHand = b.QuantityOnHand,
                        inventoryValue = b.InventoryValue
                    })).ToList();
                return new ReportBuilt(reportType, "Stock Balances", "On-hand by location",
                    new[] { Col("materialCode", "Material"), Col("warehouseName", "Warehouse"), Col("quantityOnHand", "Qty"), Col("inventoryValue", "Value") },
                    rows, new { count = rows.Count });
            }
            case "inventory-valuation":
            {
                var balances = await _db.Balances.Include(b => b.Material).Include(b => b.Warehouse).AsNoTracking().ToListAsync(ct);
                var filtered = balances.Where(b => _me.CanAccessLocation(b.ProjectId, b.WarehouseId)).ToList();
                var rows = filtered.Select(b => ToDict(new
                {
                    materialCode = b.Material?.ItemCode ?? "",
                    warehouseName = b.Warehouse?.Name ?? "",
                    weightedAverageCost = b.WeightedAverageCost,
                    inventoryValue = b.InventoryValue
                })).ToList();
                return new ReportBuilt(reportType, "Inventory Valuation", "WAC valuation",
                    new[] { Col("materialCode", "Material"), Col("warehouseName", "Warehouse"), Col("weightedAverageCost", "WAC"), Col("inventoryValue", "Value") },
                    rows, new { totalInventoryValue = Money.Round2(filtered.Sum(x => x.InventoryValue)) });
            }
            case "stock-ledger":
            {
                var ledger = await _db.Ledger.Include(e => e.Material).AsNoTracking().OrderByDescending(e => e.TimestampUtc).ToListAsync(ct);
                var rows = ledger.Where(e => _me.CanAccessLocation(e.ProjectId, e.WarehouseId))
                    .Select(e => ToDict(new
                    {
                        referenceNumber = e.ReferenceNumber,
                        transactionType = e.TransactionType,
                        materialCode = e.Material?.ItemCode ?? "",
                        signedQuantity = e.SignedQuantity
                    })).ToList();
                return new ReportBuilt(reportType, "Stock Ledger", "Authoritative movements",
                    new[] { Col("referenceNumber", "Ref"), Col("transactionType", "Type"), Col("materialCode", "Material"), Col("signedQuantity", "Qty") },
                    rows, new { count = rows.Count });
            }
            case "low-stock-reorder":
            {
                var balances = await _db.Balances.Include(b => b.Material).Include(b => b.Warehouse).AsNoTracking().ToListAsync(ct);
                var rows = balances.Where(b => _me.CanAccessLocation(b.ProjectId, b.WarehouseId) && b.Material != null && b.QuantityAvailable <= b.Material.ReorderLevel)
                    .Select(b => ToDict(new
                    {
                        materialCode = b.Material!.ItemCode,
                        materialName = b.Material.Name,
                        warehouseName = b.Warehouse?.Name ?? "",
                        quantityAvailable = b.QuantityAvailable,
                        reorderLevel = b.Material.ReorderLevel
                    })).ToList();
                return new ReportBuilt(reportType, "Low Stock / Reorder", "Below reorder level",
                    new[] { Col("materialCode", "Material"), Col("warehouseName", "Warehouse"), Col("quantityAvailable", "Available"), Col("reorderLevel", "Reorder") },
                    rows, new { count = rows.Count });
            }
            case "transfers-in-transit":
            {
                var balances = await _db.Balances.Include(b => b.Material).Include(b => b.Warehouse).AsNoTracking()
                    .Where(b => b.QuantityInTransit > 0).ToListAsync(ct);
                var items = balances.Where(b => _me.CanAccessLocation(b.ProjectId, b.WarehouseId))
                    .Select(b => ToDict(new
                    {
                        materialCode = b.Material?.ItemCode ?? "",
                        warehouseName = b.Warehouse?.Name ?? "",
                        quantityInTransit = b.QuantityInTransit
                    })).ToList();
                return new ReportBuilt(reportType, "In-Transit Inventory", "Quantities in transit",
                    new[] { Col("materialCode", "Material"), Col("warehouseName", "Warehouse"), Col("quantityInTransit", "In Transit") },
                    items, new { count = items.Count });
            }
            case "grn-po-summary":
            {
                var pos = await _db.PurchaseOrders.Include(p => p.Supplier).AsNoTracking().ToListAsync(ct);
                var rows = pos.Where(p => _me.CanAccessProject(p.ProjectId)).Select(p => ToDict(new
                {
                    poNumber = p.PoNumber,
                    supplierName = p.Supplier?.Name ?? "",
                    status = p.Status,
                    grandTotal = p.GrandTotal
                })).ToList();
                return new ReportBuilt(reportType, "GRN / PO Summary", "Purchase order status",
                    new[] { Col("poNumber", "PO"), Col("supplierName", "Supplier"), Col("status", "Status"), Col("grandTotal", "Total") },
                    rows, new { count = rows.Count });
            }
            case "consumption-issues-returns":
            {
                var issues = await _db.MaterialIssues.Include(i => i.Project).AsNoTracking().Where(i => i.Status == "Posted").ToListAsync(ct);
                var rows = issues.Where(i => _me.CanAccessProject(i.ProjectId)).Select(i => ToDict(new
                {
                    issueNumber = i.IssueNumber,
                    projectName = i.Project?.Name ?? "",
                    issueDate = i.IssueDate.ToString("yyyy-MM-dd"),
                    status = i.Status
                })).ToList();
                return new ReportBuilt(reportType, "Consumption", "Posted issues",
                    new[] { Col("issueNumber", "Issue"), Col("projectName", "Project"), Col("issueDate", "Date"), Col("status", "Status") },
                    rows, new { count = rows.Count });
            }
            case "requisition-turnaround":
            {
                var reqs = await _db.Requisitions.Include(r => r.Project).AsNoTracking().ToListAsync(ct);
                var rows = reqs.Where(r => _me.CanAccessProject(r.ProjectId)).Select(r => ToDict(new
                {
                    requisitionNumber = r.RequisitionNumber,
                    projectName = r.Project?.Name ?? "",
                    status = r.Status,
                    createdAtUtc = r.CreatedAtUtc.ToString("o"),
                    approvedAtUtc = r.ApprovedAtUtc?.ToString("o")
                })).ToList();
                return new ReportBuilt(reportType, "Requisition Turnaround", "Approval cycle",
                    new[] { Col("requisitionNumber", "Requisition"), Col("projectName", "Project"), Col("status", "Status"), Col("approvedAtUtc", "Approved") },
                    rows, new { count = rows.Count });
            }
            default:
                throw new AppException(400, $"Unsupported report type '{reportType}'. Valid types: stock-balances, inventory-valuation, stock-ledger, grn-po-summary, consumption-issues-returns, transfers-in-transit, requisition-turnaround, low-stock-reorder.");
        }
    }

    private async Task<List<Notification>> VisibleNotifications(CancellationToken ct)
    {
        var notes = await _db.Notifications
            .Include(n => n.RecipientRoles)
            .Include(n => n.RecipientUsers)
            .Include(n => n.Reads)
            .AsNoTracking()
            .OrderByDescending(n => n.CreatedAtUtc)
            .Take(500)
            .ToListAsync(ct);

        return notes.Where(n =>
        {
            var roleMatch = n.RecipientRoles.Any(r => _me.Roles.Contains(r.RoleName));
            var userMatch = n.RecipientUsers.Any(u => u.UserId == _me.UserId);
            if (!roleMatch && !userMatch) return false;
            return _me.CanAccessLocation(n.ProjectId, n.WarehouseId) ||
                   _me.CanAccessLocation(n.SecondaryProjectId, n.SecondaryWarehouseId) ||
                   _me.IsGlobal;
        }).ToList();
    }

    private static object MapNotification(Notification n, string userId) => new
    {
        id = n.Id,
        eventKey = n.EventKey,
        category = n.Category,
        eventType = n.EventType,
        severity = n.Severity,
        title = n.Title,
        message = n.Message,
        sourceDocumentType = n.SourceDocumentType,
        sourceDocumentId = n.SourceDocumentId,
        sourceDocumentNumber = n.SourceDocumentNumber,
        targetRoute = n.TargetRoute,
        projectId = n.ProjectId,
        warehouseId = n.WarehouseId,
        isRead = n.Reads.Any(r => r.UserId == userId),
        createdAtUtc = n.CreatedAtUtc.ToString("o")
    };

    private static ReportColumn Col(string key, string header) => new(key, header);
    private static string EscapeCsv(string value)
    {
        if (value.Contains('"') || value.Contains(',') || value.Contains('\n'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }

    private static Dictionary<string, object?> ToDict(object obj)
    {
        if (obj is Dictionary<string, object?> d) return d;
        if (obj is IDictionary<string, object?> id) return id.ToDictionary(k => k.Key, v => v.Value);
        return obj.GetType().GetProperties().ToDictionary(p => p.Name, p => p.GetValue(obj));
    }

    private sealed record ReportColumn(string Key, string Header);
    private sealed record ReportBuilt(string ReportType, string Title, string Subtitle, ReportColumn[] Columns, List<Dictionary<string, object?>> Rows, object Summary);
}
