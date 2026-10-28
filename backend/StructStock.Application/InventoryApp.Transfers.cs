using Microsoft.EntityFrameworkCore;
using StructStock.Domain;

namespace StructStock.Application;

public partial class InventoryApp
{
    public async Task<object> ListTransfersAsync(string? status, int? page, int? pageSize, CancellationToken ct)
    {
        var list = await QueryTransfers().AsNoTracking().ToListAsync(ct);
        var filtered = list.Where(t =>
            _me.CanAccessLocation(t.SourceProjectId, t.SourceWarehouseId) ||
            _me.CanAccessLocation(t.DestinationProjectId, t.DestinationWarehouseId)).ToList();
        if (!string.IsNullOrWhiteSpace(status) && status != "ALL") filtered = filtered.Where(t => t.Status == status).ToList();
        return ApiResponse.Ok(Page(filtered.OrderByDescending(t => t.CreatedAtUtc).Select(MapTransfer).ToList(), page, pageSize));
    }

    public async Task<object> GetTransferAsync(string id, CancellationToken ct)
    {
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        if (!_me.CanAccessLocation(t.SourceProjectId, t.SourceWarehouseId) &&
            !_me.CanAccessLocation(t.DestinationProjectId, t.DestinationWarehouseId))
        {
            throw new AppException(403, "Forbidden");
        }

        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> TransferHistoryAsync(string id, CancellationToken ct)
    {
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        return ApiResponse.Ok(t.Audits.OrderBy(a => a.TimestampUtc));
    }

    public async Task<object> TransferReconciliationAsync(string id, CancellationToken ct)
    {
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        return ApiResponse.Ok(new
        {
            transfer = MapTransfer(t),
            lines = t.Lines.Select(l => new
            {
                id = l.Id,
                materialCode = l.Material?.ItemCode ?? "",
                dispatched = l.DispatchedQuantity,
                receivedGood = l.ReceivedGoodQuantity,
                damaged = l.DamagedQuantity,
                shortQty = l.ShortQuantity,
                remainingInTransit = l.RemainingInTransitQuantity
            })
        });
    }

    public async Task<object> DiscrepanciesAsync(CancellationToken ct)
    {
        var list = await QueryTransfers().AsNoTracking()
            .Where(t => t.DiscrepancyStatus == "PendingReview")
            .ToListAsync(ct);
        var filtered = list.Where(t =>
            _me.CanAccessLocation(t.SourceProjectId, t.SourceWarehouseId) ||
            _me.CanAccessLocation(t.DestinationProjectId, t.DestinationWarehouseId)).ToList();
        return ApiResponse.Ok(filtered.Select(MapTransfer).ToList());
    }

    public async Task<object> InTransitInventoryAsync(CancellationToken ct)
    {
        var balances = await _db.Balances
            .Include(b => b.Material).Include(b => b.Warehouse).Include(b => b.Project)
            .AsNoTracking()
            .Where(b => b.QuantityInTransit > 0)
            .ToListAsync(ct);
        var filtered = balances.Where(b => _me.CanAccessLocation(b.ProjectId, b.WarehouseId)).Select(MapBalance).ToList();
        return ApiResponse.Ok(filtered);
    }

    public async Task<object> CreateTransferAsync(TransferWriteRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper", "ProjectManager");
        var source = await _db.Warehouses.Include(w => w.Project).FirstOrDefaultAsync(w => w.Id == req.SourceWarehouseId, ct)
            ?? throw new AppException(400, "Source warehouse required");
        var dest = await _db.Warehouses.Include(w => w.Project).FirstOrDefaultAsync(w => w.Id == req.DestinationWarehouseId, ct)
            ?? throw new AppException(400, "Destination warehouse required");
        if (source.Id == dest.Id) throw new AppException(400, "Source and destination must differ");
        RequireLocation(source.ProjectId, source.Id);
        var settings = await Settings(ct);
        var t = new StockTransfer
        {
            Id = Ids.New("STN"),
            TransferNumber = await NextNumber(settings.PrefixTransfer, ct),
            SourceWarehouseId = source.Id,
            SourceProjectId = source.ProjectId,
            DestinationWarehouseId = dest.Id,
            DestinationProjectId = dest.ProjectId,
            RequestDate = req.RequestDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : req.RequestDate,
            PlannedDispatchDate = req.PlannedDispatchDate,
            ExpectedArrivalDate = req.ExpectedArrivalDate,
            Purpose = req.Purpose?.Trim() ?? "",
            TransferReason = req.TransferReason,
            ReferenceNumber = req.ReferenceNumber,
            Priority = req.Priority ?? "Medium",
            Status = "Draft",
            CreatedByUserId = _me.UserId,
            CreatedByName = _me.FullName,
            CreatedAtUtc = DateTime.UtcNow,
            SourceWarehouse = source,
            DestinationWarehouse = dest,
            SourceProject = source.Project,
            DestinationProject = dest.Project
        };
        foreach (var item in req.Items ?? new())
        {
            var material = await _db.Materials.Include(m => m.BaseUnit).FirstAsync(m => m.Id == item.MaterialId, ct);
            t.Lines.Add(new StockTransferLine
            {
                Id = Ids.New("STL"),
                StockTransferId = t.Id,
                MaterialId = material.Id,
                RequestedQuantity = item.RequestedQuantity,
                ApprovedQuantity = item.RequestedQuantity,
                Material = material
            });
        }

        t.Audits.Add(AuditTransfer(t.Id, "DraftCreated", "Draft created"));
        _db.StockTransfers.Add(t);
        await Save(ct);
        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> UpdateTransferAsync(string id, TransferWriteRequest req, CancellationToken ct)
    {
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        if (t.Status is not ("Draft" or "ReturnedForCorrection")) throw new AppException(400, "Cannot edit");
        t.Purpose = req.Purpose ?? t.Purpose;
        t.TransferReason = req.TransferReason;
        t.Priority = req.Priority ?? t.Priority;
        t.PlannedDispatchDate = req.PlannedDispatchDate;
        t.ExpectedArrivalDate = req.ExpectedArrivalDate;
        t.Status = "Draft";
        t.UpdatedAtUtc = DateTime.UtcNow;
        t.Audits.Add(AuditTransfer(t.Id, "Updated", "Updated"));
        await Save(ct);
        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> SubmitTransferAsync(string id, CancellationToken ct)
    {
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        t.Status = "Submitted";
        t.SubmittedByUserId = _me.UserId;
        t.SubmittedByName = _me.FullName;
        t.SubmittedAtUtc = DateTime.UtcNow;
        t.Audits.Add(AuditTransfer(t.Id, "Submitted", "Submitted"));
        await Save(ct);
        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> ApproveTransferAsync(string id, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        await EnsureCanApprove(t.CreatedByUserId, ct);
        t.Status = "Approved";
        t.ApprovedByUserId = _me.UserId;
        t.ApprovedByName = _me.FullName;
        t.ApprovedAtUtc = DateTime.UtcNow;
        foreach (var line in t.Lines) line.ApprovedQuantity = line.RequestedQuantity;
        t.Audits.Add(AuditTransfer(t.Id, "Approved", "Approved"));
        await Save(ct);
        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> RejectTransferAsync(string id, string? reason, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        t.Status = "Rejected";
        t.RejectionReason = reason ?? "Rejected";
        t.Audits.Add(AuditTransfer(t.Id, "Rejected", t.RejectionReason));
        await Save(ct);
        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> ReturnTransferAsync(string id, string? notes, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        t.Status = "ReturnedForCorrection";
        t.CorrectionNotes = notes ?? "Returned";
        t.Audits.Add(AuditTransfer(t.Id, "ReturnedForCorrection", t.CorrectionNotes));
        await Save(ct);
        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> CancelTransferAsync(string id, string? reason, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager", "Storekeeper");
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        if (t.Status is "Dispatched" or "PartiallyReceived" or "Received" or "Completed")
        {
            throw new AppException(400, "Cannot cancel after dispatch");
        }

        t.Status = "Cancelled";
        t.CancellationReason = reason ?? "Cancelled";
        t.CancelledByUserId = _me.UserId;
        t.CancelledByName = _me.FullName;
        t.CancelledAtUtc = DateTime.UtcNow;
        t.Audits.Add(AuditTransfer(t.Id, "Cancelled", t.CancellationReason));
        await Save(ct);
        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> DispatchTransferAsync(string id, TransferDispatchRequest? req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper");
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        if (t.Status != "Approved") throw new AppException(400, "Must be Approved");
        RequireLocation(t.SourceProjectId, t.SourceWarehouseId);
        t.VehicleNumber = req?.VehicleNumber;
        t.DriverName = req?.DriverName;
        t.DispatchReference = req?.DispatchReference;
        t.ActualDispatchDate = DateOnly.FromDateTime(DateTime.UtcNow);
        t.DispatchedByUserId = _me.UserId;
        t.DispatchedByName = _me.FullName;
        t.DispatchedAtUtc = DateTime.UtcNow;
        t.Status = "Dispatched";
        t.PostingJournalStatus = "Dispatched";

        foreach (var line in t.Lines)
        {
            var qty = line.ApprovedQuantity > 0 ? line.ApprovedQuantity : line.RequestedQuantity;
            var balance = await _db.Balances.FirstOrDefaultAsync(b =>
                b.MaterialId == line.MaterialId && b.WarehouseId == t.SourceWarehouseId && b.ProjectId == t.SourceProjectId, ct);
            var unitCost = balance?.WeightedAverageCost ?? 0;
            var entry = await PostStock(new StockMove(
                "TransferOut", false, 0, qty, unitCost, qty,
                line.MaterialId, t.SourceWarehouseId, t.SourceProjectId,
                "StockTransfer", t.Id, t.TransferNumber, line.Id,
                $"TRF-OUT:{t.Id}:{line.Id}", null, false), ct);
            line.DispatchedQuantity = qty;
            line.UnitCostAtDispatch = unitCost;
            line.TotalDispatchedAmount = Money.Round2(qty * unitCost);
            line.RemainingInTransitQuantity = qty;
            line.SourceStockLedgerEntryId = entry.Id;
        }

        t.Audits.Add(AuditTransfer(t.Id, "Dispatched", "Dispatched"));
        Notify("StockTransfer", "Dispatched", "Warning", "Transfer dispatched",
            $"{t.TransferNumber} in transit", "StockTransfer", t.Id, t.TransferNumber,
            $"/stock-transfers/{t.Id}", t.Status, t.SourceProjectId, t.SourceWarehouseId,
            t.DestinationProjectId, t.DestinationWarehouseId,
            "SuperAdmin", "InventoryManager", "Storekeeper", "ProjectManager");
        await Save(ct);
        await tx.CommitAsync(ct);
        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> ReceiveTransferAsync(string id, TransferReceiveRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper");
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        if (t.Status is not ("Dispatched" or "PartiallyReceived")) throw new AppException(400, "Invalid status for receive");
        RequireLocation(t.DestinationProjectId, t.DestinationWarehouseId);

        foreach (var item in req.Items ?? new())
        {
            var line = t.Lines.FirstOrDefault(l => l.Id == item.LineId)
                ?? throw new AppException(400, "Transfer line not found");
            var good = item.ReceivedGoodQuantity;
            var damaged = item.DamagedQuantity;
            var shortQty = item.ShortQuantity;
            if (good + damaged + shortQty > line.RemainingInTransitQuantity + 0.0001m)
            {
                throw new AppException(400, "Received quantities exceed remaining in-transit");
            }

            if (good > 0)
            {
                var entry = await PostStock(new StockMove(
                    "TransferIn", true, good, 0, line.UnitCostAtDispatch, -good,
                    line.MaterialId, t.DestinationWarehouseId, t.DestinationProjectId,
                    "StockTransfer", t.Id, t.TransferNumber, line.Id,
                    $"TRF-IN:{t.Id}:{line.Id}:{Guid.NewGuid():N}", item.InspectionNotes, true), ct);
                line.DestinationStockLedgerEntryId = entry.Id;
            }
            else if (damaged + shortQty > 0)
            {
                // Reduce in-transit at source without adding destination stock
                var balance = await _db.Balances.FirstOrDefaultAsync(b =>
                    b.MaterialId == line.MaterialId && b.WarehouseId == t.SourceWarehouseId && b.ProjectId == t.SourceProjectId, ct);
                if (balance != null)
                {
                    balance.QuantityInTransit = Money.Round4(Math.Max(0, balance.QuantityInTransit - (damaged + shortQty)));
                    balance.LastUpdatedUtc = DateTime.UtcNow;
                }
            }

            line.ReceivedGoodQuantity += good;
            line.DamagedQuantity += damaged;
            line.ShortQuantity += shortQty;
            line.RemainingInTransitQuantity = Money.Round4(Math.Max(0, line.RemainingInTransitQuantity - good - damaged - shortQty));
            line.InspectionNotes = item.InspectionNotes;
            if (damaged + shortQty > 0)
            {
                line.ResolutionStatus = "Pending";
                t.DiscrepancyStatus = "PendingReview";
            }
        }

        t.ActualReceiptDate = DateOnly.FromDateTime(DateTime.UtcNow);
        t.ReceivedByUserId = _me.UserId;
        t.ReceivedByName = _me.FullName;
        t.ReceivedAtUtc = DateTime.UtcNow;
        var allDone = t.Lines.All(l => l.RemainingInTransitQuantity <= 0.0001m);
        t.Status = allDone ? "Received" : "PartiallyReceived";
        t.PostingJournalStatus = allDone ? "Reconciled" : "PendingReceipt";
        t.Audits.Add(AuditTransfer(t.Id, allDone ? "Received" : "PartiallyReceived", "Receipt recorded"));
        await Save(ct);
        await tx.CommitAsync(ct);
        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> InspectTransferAsync(string id, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper", "ProjectManager");
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        t.InspectedByUserId = _me.UserId;
        t.InspectedByName = _me.FullName;
        t.InspectedAtUtc = DateTime.UtcNow;
        t.Audits.Add(AuditTransfer(t.Id, "Inspected", "Inspected"));
        await Save(ct);
        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> CompleteTransferAsync(string id, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        if (t.Status is not ("Received" or "PartiallyReceived")) throw new AppException(400, "Must be Received");
        if (t.DiscrepancyStatus == "PendingReview")
        {
            throw new AppException(400, "Resolve discrepancies before completion");
        }

        t.Status = "Completed";
        t.PostingJournalStatus = "Completed";
        t.CompletedByUserId = _me.UserId;
        t.CompletedByName = _me.FullName;
        t.CompletedAtUtc = DateTime.UtcNow;
        t.Audits.Add(AuditTransfer(t.Id, "Completed", "Completed"));
        await Save(ct);
        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> ResolveDiscrepancyAsync(string id, string lineId, ResolveDiscrepancyRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        var line = t.Lines.FirstOrDefault(l => l.Id == lineId) ?? throw new AppException(404, "Line not found");
        line.ResolutionStatus = "Resolved";
        line.ResolutionAction = req.ResolutionAction ?? "Resolved";
        line.ResolutionNotes = req.ResolutionNotes;
        line.ResolvedByUserId = _me.UserId;
        line.ResolvedByName = _me.FullName;
        line.ResolvedAtUtc = DateTime.UtcNow;
        if (t.Lines.All(l => l.ResolutionStatus is "Resolved" or "None"))
        {
            t.DiscrepancyStatus = "Resolved";
        }

        t.Audits.Add(AuditTransfer(t.Id, "DiscrepancyResolved", $"Line {lineId}: {line.ResolutionAction}"));
        await Save(ct);
        return ApiResponse.Ok(MapTransfer(t));
    }

    public async Task<object> DeleteTransferAsync(string id, CancellationToken ct)
    {
        var t = await LoadTransfer(id, ct) ?? throw new AppException(404, "Stock transfer not found");
        if (t.Status != "Draft") throw new AppException(400, "Only Draft can be deleted");
        _db.StockTransfers.Remove(t);
        await Save(ct);
        return ApiResponse.Ok(new { id });
    }

    private IQueryable<StockTransfer> QueryTransfers() =>
        _db.StockTransfers
            .Include(t => t.SourceWarehouse).Include(t => t.DestinationWarehouse)
            .Include(t => t.SourceProject).Include(t => t.DestinationProject)
            .Include(t => t.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(t => t.Audits);

    private Task<StockTransfer?> LoadTransfer(string id, CancellationToken ct) =>
        QueryTransfers().FirstOrDefaultAsync(t => t.Id == id, ct);

    private StockTransferAudit AuditTransfer(string id, string action, string? comments) => new()
    {
        Id = Ids.New("STA"), StockTransferId = id, ActorUserId = _me.UserId, ActorName = _me.FullName,
        ActorRole = _me.PrimaryRole, Action = action, Comments = comments, TimestampUtc = DateTime.UtcNow
    };

    private static object MapTransfer(StockTransfer t) => new
    {
        id = t.Id,
        transferNumber = t.TransferNumber,
        sourceWarehouseId = t.SourceWarehouseId,
        sourceWarehouseName = t.SourceWarehouse?.Name ?? "",
        sourceProjectId = t.SourceProjectId,
        sourceProjectName = t.SourceProject?.Name ?? "",
        destinationWarehouseId = t.DestinationWarehouseId,
        destinationWarehouseName = t.DestinationWarehouse?.Name ?? "",
        destinationProjectId = t.DestinationProjectId,
        destinationProjectName = t.DestinationProject?.Name ?? "",
        isCrossProject = t.SourceProjectId != t.DestinationProjectId,
        isCrossWarehouse = t.SourceWarehouseId != t.DestinationWarehouseId,
        requestDate = t.RequestDate.ToString("yyyy-MM-dd"),
        plannedDispatchDate = t.PlannedDispatchDate?.ToString("yyyy-MM-dd"),
        actualDispatchDate = t.ActualDispatchDate?.ToString("yyyy-MM-dd"),
        expectedArrivalDate = t.ExpectedArrivalDate?.ToString("yyyy-MM-dd"),
        actualReceiptDate = t.ActualReceiptDate?.ToString("yyyy-MM-dd"),
        purpose = t.Purpose,
        transferReason = t.TransferReason,
        referenceNumber = t.ReferenceNumber,
        vehicleNumber = t.VehicleNumber,
        driverName = t.DriverName,
        dispatchReference = t.DispatchReference,
        priority = t.Priority,
        status = t.Status,
        discrepancyStatus = t.DiscrepancyStatus,
        postingJournalStatus = t.PostingJournalStatus,
        items = t.Lines.Select(l => new
        {
            id = l.Id,
            stockTransferId = l.StockTransferId,
            materialId = l.MaterialId,
            materialCode = l.Material?.ItemCode ?? "",
            materialName = l.Material?.Name ?? "",
            unitCode = l.Material?.BaseUnit?.Code ?? "",
            requestedQuantity = l.RequestedQuantity,
            approvedQuantity = l.ApprovedQuantity,
            dispatchedQuantity = l.DispatchedQuantity,
            receivedGoodQuantity = l.ReceivedGoodQuantity,
            damagedQuantity = l.DamagedQuantity,
            shortQuantity = l.ShortQuantity,
            disputedQuantity = l.DisputedQuantity,
            remainingInTransitQuantity = l.RemainingInTransitQuantity,
            unitCostAtDispatch = l.UnitCostAtDispatch,
            totalDispatchedAmount = l.TotalDispatchedAmount,
            sourceStockLedgerEntryId = l.SourceStockLedgerEntryId,
            destinationStockLedgerEntryId = l.DestinationStockLedgerEntryId,
            discrepancyReason = l.DiscrepancyReason,
            inspectionNotes = l.InspectionNotes,
            resolutionStatus = l.ResolutionStatus,
            resolutionAction = l.ResolutionAction,
            resolutionNotes = l.ResolutionNotes,
            resolvedByUserId = l.ResolvedByUserId,
            resolvedByName = l.ResolvedByName,
            resolvedAtUtc = l.ResolvedAtUtc?.ToString("o")
        }).ToList(),
        auditTrail = t.Audits.OrderBy(a => a.TimestampUtc).Select(a => new
        {
            id = a.Id, stockTransferId = a.StockTransferId, actorUserId = a.ActorUserId, actorName = a.ActorName,
            actorRole = a.ActorRole, action = a.Action, comments = a.Comments, timestampUtc = a.TimestampUtc.ToString("o")
        }).ToList(),
        rejectionReason = t.RejectionReason,
        correctionNotes = t.CorrectionNotes,
        cancellationReason = t.CancellationReason,
        remarks = t.Remarks,
        createdByUserId = t.CreatedByUserId,
        createdByName = t.CreatedByName,
        createdAtUtc = t.CreatedAtUtc.ToString("o"),
        submittedByUserId = t.SubmittedByUserId,
        submittedByName = t.SubmittedByName,
        submittedAtUtc = t.SubmittedAtUtc?.ToString("o"),
        approvedByUserId = t.ApprovedByUserId,
        approvedByName = t.ApprovedByName,
        approvedAtUtc = t.ApprovedAtUtc?.ToString("o"),
        dispatchedByUserId = t.DispatchedByUserId,
        dispatchedByName = t.DispatchedByName,
        dispatchedAtUtc = t.DispatchedAtUtc?.ToString("o"),
        receivedByUserId = t.ReceivedByUserId,
        receivedByName = t.ReceivedByName,
        receivedAtUtc = t.ReceivedAtUtc?.ToString("o"),
        inspectedByUserId = t.InspectedByUserId,
        inspectedByName = t.InspectedByName,
        inspectedAtUtc = t.InspectedAtUtc?.ToString("o"),
        completedByUserId = t.CompletedByUserId,
        completedByName = t.CompletedByName,
        completedAtUtc = t.CompletedAtUtc?.ToString("o"),
        cancelledByUserId = t.CancelledByUserId,
        cancelledByName = t.CancelledByName,
        cancelledAtUtc = t.CancelledAtUtc?.ToString("o"),
        updatedAtUtc = t.UpdatedAtUtc?.ToString("o")
    };
}

public record TransferLineRequest(string MaterialId, decimal RequestedQuantity);

public record TransferWriteRequest(
    string? SourceWarehouseId,
    string? DestinationWarehouseId,
    DateOnly RequestDate,
    DateOnly? PlannedDispatchDate,
    DateOnly? ExpectedArrivalDate,
    string? Purpose,
    string? TransferReason,
    string? ReferenceNumber,
    string? Priority,
    List<TransferLineRequest>? Items);

public record TransferDispatchRequest(string? VehicleNumber, string? DriverName, string? DispatchReference);

public record TransferReceiveLineRequest(
    string LineId,
    decimal ReceivedGoodQuantity,
    decimal DamagedQuantity,
    decimal ShortQuantity,
    string? InspectionNotes);

public record TransferReceiveRequest(List<TransferReceiveLineRequest>? Items);

public record ResolveDiscrepancyRequest(string? ResolutionAction, string? ResolutionNotes);
