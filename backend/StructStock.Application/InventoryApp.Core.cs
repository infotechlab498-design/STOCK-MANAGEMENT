using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using StructStock.Domain;
using StructStock.Infrastructure;

namespace StructStock.Application;

public partial class InventoryApp
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _me;
    private readonly ILiveEvents _live;
    private readonly UserManager<AppUser> _userManager;
    private readonly List<Func<CancellationToken, Task>> _after = new();

    public InventoryApp(AppDbContext db, ICurrentUser me, ILiveEvents live, UserManager<AppUser> userManager)
    {
        _db = db;
        _me = me;
        _live = live;
        _userManager = userManager;
    }

    private void After(Func<CancellationToken, Task> action) => _after.Add(action);

    private async Task Save(CancellationToken ct)
    {
        await _db.SaveChangesAsync(ct);
        var pending = _after.ToList();
        _after.Clear();
        foreach (var action in pending)
        {
            await action(ct);
        }
    }

    private static int PageNo(int? page) => Math.Max(1, page ?? 1);
    private static int PageSize(int? size) => Math.Clamp(size ?? 20, 1, 500);

    private static object Page<T>(IReadOnlyList<T> items, int? page, int? size)
    {
        var index = PageNo(page);
        var take = PageSize(size);
        var total = items.Count;
        var pages = Math.Max(1, (int)Math.Ceiling(total / (double)take));
        return new
        {
            items = items.Skip((index - 1) * take).Take(take).ToList(),
            pageIndex = index,
            pageSize = take,
            totalCount = total,
            totalPages = pages,
            hasPreviousPage = index > 1,
            hasNextPage = index < pages
        };
    }

    private async Task<SystemSetting> Settings(CancellationToken ct) =>
        await _db.Settings.FirstAsync(x => x.Id == "SETTINGS", ct);

    private async Task<string> NextNumber(string prefix, CancellationToken ct)
    {
        var year = DateTime.UtcNow.Year;
        var row = await _db.NumberSeries.FirstOrDefaultAsync(x => x.Prefix == prefix, ct);
        if (row == null)
        {
            row = new NumberSeries { Prefix = prefix, CurrentYear = year, LastNumber = 0 };
            _db.NumberSeries.Add(row);
        }
        if (row.CurrentYear != year)
        {
            row.CurrentYear = year;
            row.LastNumber = 0;
        }
        row.LastNumber += 1;
        return $"{prefix}-{year}-{row.LastNumber:0000}";
    }

    private async Task EnsureCanApprove(string? ownerUserId, CancellationToken ct)
    {
        var settings = await _db.Settings.AsNoTracking().FirstAsync(x => x.Id == "SETTINGS", ct);
        if (!settings.SelfApprovalAllowed && !string.IsNullOrEmpty(ownerUserId) && ownerUserId == _me.UserId)
        {
            throw new AppException(403, "Self-approval is not allowed.");
        }
    }

    private void RequireLocation(string? projectId, string? warehouseId)
    {
        if (!_me.CanAccessLocation(projectId, warehouseId))
        {
            throw new AppException(403, "Forbidden: You do not have authorization to access this project or warehouse.");
        }
    }

    private void Notify(
        string category,
        string eventType,
        string severity,
        string title,
        string message,
        string documentType,
        string documentId,
        string documentNumber,
        string targetRoute,
        string? status,
        string? projectId,
        string? warehouseId,
        string? secondaryProjectId,
        string? secondaryWarehouseId,
        params string[] roles)
    {
        var note = new Notification
        {
            Id = Ids.New("NTF"),
            EventKey = $"{documentType}:{documentId}:{eventType}",
            Category = category,
            EventType = eventType,
            Severity = severity,
            Title = title,
            Message = message,
            SourceDocumentType = documentType,
            SourceDocumentId = documentId,
            SourceDocumentNumber = documentNumber,
            TargetRoute = targetRoute,
            ProjectId = projectId,
            WarehouseId = warehouseId,
            SecondaryProjectId = secondaryProjectId,
            SecondaryWarehouseId = secondaryWarehouseId,
            CreatedAtUtc = DateTime.UtcNow
        };
        foreach (var role in roles.Distinct())
        {
            note.RecipientRoles.Add(new NotificationRecipientRole { NotificationId = note.Id, RoleName = role });
        }
        _db.Notifications.Add(note);
        After(ct => _live.PublishAsync("notification.created", new { id = note.Id, title, targetRoute, category }, projectId, warehouseId, secondaryProjectId, secondaryWarehouseId, ct));
        After(ct => _live.PublishAsync("document.changed", new { documentType, id = documentId, status, targetRoute }, projectId, warehouseId, secondaryProjectId, secondaryWarehouseId, ct));
    }

    private void NotifyStock(string materialId, string warehouseId, string projectId)
    {
        After(ct => _live.PublishAsync("stock.changed", new { materialId, warehouseId, projectId }, projectId, warehouseId, ct: ct));
    }

    public async Task<StockLedgerEntry> PostStock(StockMove move, CancellationToken ct)
    {
        var existing = _db.Ledger.Local.FirstOrDefault(x => x.IdempotencyKey == move.IdempotencyKey)
            ?? await _db.Ledger.FirstOrDefaultAsync(x => x.IdempotencyKey == move.IdempotencyKey, ct);
        if (existing != null)
        {
            return existing;
        }

        var material = await _db.Materials.FirstAsync(x => x.Id == move.MaterialId, ct);
        var warehouse = await _db.Warehouses.FirstAsync(x => x.Id == move.WarehouseId, ct);
        var project = await _db.Projects.FirstAsync(x => x.Id == move.ProjectId, ct);
        var settings = await Settings(ct);

        var balance = await _db.Balances.FirstOrDefaultAsync(
            x => x.MaterialId == move.MaterialId && x.WarehouseId == move.WarehouseId && x.ProjectId == move.ProjectId, ct);
        if (balance == null)
        {
            balance = new InventoryBalance
            {
                Id = Ids.New("BAL"),
                MaterialId = move.MaterialId,
                WarehouseId = move.WarehouseId,
                ProjectId = move.ProjectId,
                LastUpdatedUtc = DateTime.UtcNow
            };
            _db.Balances.Add(balance);
        }

        if (move.QuantityOut > balance.QuantityAvailable + 0.0001m && !settings.NegativeStockAllowed)
        {
            throw new AppException(400, $"Insufficient stock for {material.ItemCode} at {warehouse.Name}. Available {balance.QuantityAvailable}.");
        }

        if (move.RequirePositiveCost && move.QuantityIn > 0 && move.UnitCost <= 0)
        {
            throw new AppException(400, $"Cannot value inventory posting: Material '{material.ItemCode}' has a non-positive unit cost.");
        }

        var newQty = balance.QuantityOnHand + move.QuantityIn - move.QuantityOut;
        var newWac = balance.WeightedAverageCost;
        if (move.RecalculateWac && move.QuantityIn > 0)
        {
            newWac = Money.WeightedAverage(balance.QuantityOnHand, balance.WeightedAverageCost, move.QuantityIn, move.UnitCost);
        }

        balance.QuantityOnHand = Money.Round4(newQty);
        balance.WeightedAverageCost = Money.Round4(newWac);
        balance.QuantityInTransit = Money.Round4(Math.Max(0, balance.QuantityInTransit + move.InTransitDelta));
        balance.QuantityAvailable = Money.Round4(balance.QuantityOnHand - balance.QuantityReserved);
        balance.InventoryValue = Money.Round2(balance.QuantityOnHand * balance.WeightedAverageCost);
        balance.Version += 1;
        balance.LastUpdatedUtc = DateTime.UtcNow;

        var prefix = settings.PrefixStock;
        var entry = new StockLedgerEntry
        {
            Id = Ids.New("STK"),
            ReferenceNumber = await NextNumber(string.IsNullOrWhiteSpace(prefix) ? "STK" : prefix, ct),
            TransactionType = move.TransactionType,
            SourceDocumentType = move.SourceDocumentType,
            SourceDocumentId = move.SourceDocumentId,
            SourceDocumentNumber = move.SourceDocumentNumber,
            SourceLineId = move.SourceLineId,
            MaterialId = material.Id,
            WarehouseId = warehouse.Id,
            ProjectId = project.Id,
            QuantityIn = Money.Round4(move.QuantityIn),
            QuantityOut = Money.Round4(move.QuantityOut),
            SignedQuantity = Money.Round4(move.QuantityIn - move.QuantityOut),
            UnitCost = Money.Round4(move.UnitCost),
            TransactionValue = Money.Round2((move.QuantityIn - move.QuantityOut) * (move.RecalculateWac && move.QuantityIn > 0 ? move.UnitCost : newWac)),
            BalanceQuantityAfter = balance.QuantityOnHand,
            WeightedAverageCostAfter = balance.WeightedAverageCost,
            TotalValuationAfter = balance.InventoryValue,
            IdempotencyKey = move.IdempotencyKey,
            TransactionDate = DateOnly.FromDateTime(DateTime.UtcNow),
            TimestampUtc = DateTime.UtcNow,
            CreatedByUserId = _me.UserId,
            CreatedByName = _me.FullName,
            Remarks = move.Remarks
        };
        _db.Ledger.Add(entry);
        NotifyStock(material.Id, warehouse.Id, project.Id);
        return entry;
    }
}

public record StockMove(
    string TransactionType,
    bool RecalculateWac,
    decimal QuantityIn,
    decimal QuantityOut,
    decimal UnitCost,
    decimal InTransitDelta,
    string MaterialId,
    string WarehouseId,
    string ProjectId,
    string SourceDocumentType,
    string SourceDocumentId,
    string SourceDocumentNumber,
    string SourceLineId,
    string IdempotencyKey,
    string? Remarks,
    bool RequirePositiveCost);
