using Microsoft.EntityFrameworkCore;
using StructStock.Domain;

namespace StructStock.Application;

public partial class InventoryApp
{
    public async Task<object> ListIssuesAsync(string? status, string? projectId, int? page, int? pageSize, CancellationToken ct)
    {
        var list = await QueryIssues().AsNoTracking().ToListAsync(ct);
        var filtered = list.Where(i => _me.CanAccessLocation(i.ProjectId, i.WarehouseId)).ToList();
        if (!string.IsNullOrWhiteSpace(status) && status != "ALL") filtered = filtered.Where(i => i.Status == status).ToList();
        if (!string.IsNullOrWhiteSpace(projectId) && projectId != "ALL") filtered = filtered.Where(i => i.ProjectId == projectId).ToList();
        return ApiResponse.Ok(Page(filtered.OrderByDescending(i => i.CreatedAtUtc).Select(MapIssue).ToList(), page, pageSize));
    }

    public async Task<object> GetIssueAsync(string id, CancellationToken ct)
    {
        var issue = await LoadIssue(id, ct) ?? throw new AppException(404, "Material issue not found");
        RequireLocation(issue.ProjectId, issue.WarehouseId);
        return ApiResponse.Ok(MapIssue(issue));
    }

    public async Task<object> CreateIssueAsync(IssueWriteRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper");
        var requisition = await LoadRequisition(req.RequisitionId!, ct)
            ?? throw new AppException(400, "Approved requisition is required");
        if (requisition.Status != "Approved") throw new AppException(400, "Requisition must be Approved");
        var warehouse = await _db.Warehouses.FirstOrDefaultAsync(w => w.Id == req.WarehouseId, ct)
            ?? throw new AppException(400, "Warehouse is required");
        RequireLocation(requisition.ProjectId, warehouse.Id);
        var settings = await Settings(ct);
        var issue = new MaterialIssue
        {
            Id = Ids.New("MIV"),
            IssueNumber = await NextNumber(settings.PrefixIssue, ct),
            RequisitionId = requisition.Id,
            ProjectId = requisition.ProjectId,
            WarehouseId = warehouse.Id,
            IssueDate = req.IssueDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : req.IssueDate,
            Status = "Draft",
            Purpose = req.Purpose?.Trim() ?? requisition.Purpose,
            WorkActivity = req.WorkActivity,
            ReceivedByPerson = req.ReceivedByPerson?.Trim() ?? "",
            Remarks = req.Remarks,
            CreatedByUserId = _me.UserId,
            CreatedByName = _me.FullName,
            CreatedAtUtc = DateTime.UtcNow,
            Requisition = requisition,
            Project = requisition.Project,
            Warehouse = warehouse
        };
        foreach (var item in req.Items ?? new())
        {
            var reqLine = requisition.Lines.FirstOrDefault(l => l.Id == item.RequisitionItemId)
                ?? throw new AppException(400, "Requisition line not found");
            issue.Lines.Add(new MaterialIssueLine
            {
                Id = Ids.New("MIL"),
                MaterialIssueId = issue.Id,
                RequisitionLineId = reqLine.Id,
                MaterialId = reqLine.MaterialId,
                RequestedQuantity = reqLine.RequestedQuantity,
                PreviouslyFulfilledQuantity = item.PreviouslyFulfilledQuantity,
                QuantityToIssue = item.QuantityToIssue,
                StorageLocation = item.StorageLocation,
                Remarks = item.Remarks,
                Material = reqLine.Material,
                RequisitionLine = reqLine
            });
        }

        issue.Audits.Add(AuditIssue(issue.Id, "DraftCreated", "Draft created"));
        _db.MaterialIssues.Add(issue);
        await Save(ct);
        return ApiResponse.Ok(MapIssue(issue));
    }

    public async Task<object> UpdateIssueAsync(string id, IssueWriteRequest req, CancellationToken ct)
    {
        var issue = await LoadIssue(id, ct) ?? throw new AppException(404, "Material issue not found");
        if (issue.Status is not ("Draft" or "ReturnedForCorrection")) throw new AppException(400, "Cannot edit this issue");
        issue.Purpose = req.Purpose ?? issue.Purpose;
        issue.WorkActivity = req.WorkActivity;
        issue.ReceivedByPerson = req.ReceivedByPerson ?? issue.ReceivedByPerson;
        issue.Remarks = req.Remarks;
        issue.Status = "Draft";
        issue.UpdatedAtUtc = DateTime.UtcNow;
        if (req.Items != null)
        {
            _db.MaterialIssueLines.RemoveRange(issue.Lines);
            issue.Lines.Clear();
            foreach (var item in req.Items)
            {
                var reqLine = issue.Requisition!.Lines.First(l => l.Id == item.RequisitionItemId);
                issue.Lines.Add(new MaterialIssueLine
                {
                    Id = Ids.New("MIL"),
                    MaterialIssueId = issue.Id,
                    RequisitionLineId = reqLine.Id,
                    MaterialId = reqLine.MaterialId,
                    RequestedQuantity = reqLine.RequestedQuantity,
                    PreviouslyFulfilledQuantity = item.PreviouslyFulfilledQuantity,
                    QuantityToIssue = item.QuantityToIssue,
                    StorageLocation = item.StorageLocation,
                    Remarks = item.Remarks,
                    Material = reqLine.Material
                });
            }
        }

        issue.Audits.Add(AuditIssue(issue.Id, "Updated", "Updated"));
        await Save(ct);
        return ApiResponse.Ok(MapIssue(issue));
    }

    public async Task<object> SubmitIssueAsync(string id, CancellationToken ct)
    {
        var issue = await LoadIssue(id, ct) ?? throw new AppException(404, "Material issue not found");
        if (issue.Status is not ("Draft" or "ReturnedForCorrection")) throw new AppException(400, "Invalid status");
        issue.Status = "Submitted";
        issue.SubmittedByUserId = _me.UserId;
        issue.SubmittedByName = _me.FullName;
        issue.SubmittedAtUtc = DateTime.UtcNow;
        issue.Audits.Add(AuditIssue(issue.Id, "Submitted", "Submitted"));
        await Save(ct);
        return ApiResponse.Ok(MapIssue(issue));
    }

    public async Task<object> ApproveIssueAsync(string id, string? comments, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var issue = await LoadIssue(id, ct) ?? throw new AppException(404, "Material issue not found");
        if (issue.Status != "Submitted") throw new AppException(400, "Must be Submitted");
        await EnsureCanApprove(issue.CreatedByUserId, ct);
        issue.Status = "Approved";
        issue.ApprovedByUserId = _me.UserId;
        issue.ApprovedByName = _me.FullName;
        issue.ApprovedAtUtc = DateTime.UtcNow;
        issue.Audits.Add(AuditIssue(issue.Id, "Approved", comments ?? "Approved"));
        await Save(ct);
        return ApiResponse.Ok(MapIssue(issue));
    }

    public async Task<object> RejectIssueAsync(string id, string? reason, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var issue = await LoadIssue(id, ct) ?? throw new AppException(404, "Material issue not found");
        issue.Status = "Rejected";
        issue.RejectionReason = reason ?? "Rejected";
        issue.Audits.Add(AuditIssue(issue.Id, "Rejected", issue.RejectionReason));
        await Save(ct);
        return ApiResponse.Ok(MapIssue(issue));
    }

    public async Task<object> ReturnIssueAsync(string id, string? notes, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var issue = await LoadIssue(id, ct) ?? throw new AppException(404, "Material issue not found");
        issue.Status = "ReturnedForCorrection";
        issue.CorrectionNotes = notes ?? "Returned";
        issue.Audits.Add(AuditIssue(issue.Id, "ReturnedForCorrection", issue.CorrectionNotes));
        await Save(ct);
        return ApiResponse.Ok(MapIssue(issue));
    }

    public async Task<object> PostIssueAsync(string id, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper");
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var issue = await LoadIssue(id, ct) ?? throw new AppException(404, "Material issue not found");
        if (issue.Status != "Approved") throw new AppException(400, "Issue must be Approved before posting");
        RequireLocation(issue.ProjectId, issue.WarehouseId);

        foreach (var line in issue.Lines.Where(l => l.QuantityToIssue > 0))
        {
            var balance = await _db.Balances.FirstOrDefaultAsync(b =>
                b.MaterialId == line.MaterialId && b.WarehouseId == issue.WarehouseId && b.ProjectId == issue.ProjectId, ct);
            var unitCost = balance?.WeightedAverageCost ?? 0;
            var entry = await PostStock(new StockMove(
                "MaterialIssue", false, 0, line.QuantityToIssue, unitCost, 0,
                line.MaterialId, issue.WarehouseId, issue.ProjectId,
                "MaterialIssue", issue.Id, issue.IssueNumber, line.Id,
                $"ISSUE:{issue.Id}:{line.Id}", line.Remarks, false), ct);
            line.ActualIssuedQuantity = line.QuantityToIssue;
            line.UnitCost = unitCost;
            line.TotalIssuedAmount = Money.Round2(line.QuantityToIssue * unitCost);
            line.StockLedgerEntryId = entry.Id;
        }

        issue.Status = "Posted";
        issue.PostedByUserId = _me.UserId;
        issue.PostedByName = _me.FullName;
        issue.PostedAtUtc = DateTime.UtcNow;
        issue.Audits.Add(AuditIssue(issue.Id, "Posted", "Posted to stock"));
        Notify("MaterialIssue", "Posted", "Success", "Material issue posted",
            $"{issue.IssueNumber} posted", "MaterialIssue", issue.Id, issue.IssueNumber,
            $"/material-issues/{issue.Id}", issue.Status, issue.ProjectId, issue.WarehouseId, null, null,
            "SuperAdmin", "InventoryManager", "Storekeeper", "ProjectManager", "AccountsOfficer");
        await Save(ct);
        await tx.CommitAsync(ct);
        return ApiResponse.Ok(MapIssue(issue));
    }

    public async Task<object> IssueHistoryAsync(string id, CancellationToken ct)
    {
        var issue = await LoadIssue(id, ct) ?? throw new AppException(404, "Material issue not found");
        return ApiResponse.Ok(issue.Audits.OrderBy(a => a.TimestampUtc));
    }

    public async Task<object> DeleteIssueAsync(string id, CancellationToken ct)
    {
        var issue = await LoadIssue(id, ct) ?? throw new AppException(404, "Material issue not found");
        if (issue.Status != "Draft") throw new AppException(400, "Only Draft can be deleted");
        _db.MaterialIssues.Remove(issue);
        await Save(ct);
        return ApiResponse.Ok(new { id });
    }

    public async Task<object> ListReturnsAsync(string? status, string? projectId, int? page, int? pageSize, CancellationToken ct)
    {
        var list = await QueryReturns().AsNoTracking().ToListAsync(ct);
        var filtered = list.Where(r => _me.CanAccessLocation(r.ProjectId, r.WarehouseId)).ToList();
        if (!string.IsNullOrWhiteSpace(status) && status != "ALL") filtered = filtered.Where(r => r.Status == status).ToList();
        if (!string.IsNullOrWhiteSpace(projectId) && projectId != "ALL") filtered = filtered.Where(r => r.ProjectId == projectId).ToList();
        return ApiResponse.Ok(Page(filtered.OrderByDescending(r => r.CreatedAtUtc).Select(MapReturn).ToList(), page, pageSize));
    }

    public async Task<object> GetReturnAsync(string id, CancellationToken ct)
    {
        var ret = await LoadReturn(id, ct) ?? throw new AppException(404, "Material return not found");
        RequireLocation(ret.ProjectId, ret.WarehouseId);
        return ApiResponse.Ok(MapReturn(ret));
    }

    public async Task<object> CreateReturnAsync(ReturnWriteRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper");
        var issue = await LoadIssue(req.MaterialIssueId!, ct)
            ?? throw new AppException(400, "Posted material issue is required");
        if (issue.Status != "Posted") throw new AppException(400, "Can only return against Posted issues");
        RequireLocation(issue.ProjectId, issue.WarehouseId);
        var settings = await Settings(ct);
        var ret = new MaterialReturn
        {
            Id = Ids.New("MRN"),
            ReturnNumber = await NextNumber(settings.PrefixReturn, ct),
            MaterialIssueId = issue.Id,
            RequisitionId = issue.RequisitionId,
            ProjectId = issue.ProjectId,
            WarehouseId = issue.WarehouseId,
            ReturnDate = req.ReturnDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : req.ReturnDate,
            ReturnedByPerson = req.ReturnedByPerson?.Trim() ?? "",
            Reason = req.Reason?.Trim() ?? "",
            Status = "Draft",
            Remarks = req.Remarks,
            CreatedByUserId = _me.UserId,
            CreatedByName = _me.FullName,
            CreatedAtUtc = DateTime.UtcNow,
            MaterialIssue = issue,
            Project = issue.Project,
            Warehouse = issue.Warehouse
        };
        foreach (var item in req.Items ?? new())
        {
            var issueLine = issue.Lines.FirstOrDefault(l => l.Id == item.MaterialIssueItemId)
                ?? throw new AppException(400, "Issue line not found");
            var issuedQty = issueLine.ActualIssuedQuantity ?? issueLine.QuantityToIssue;
            ret.Lines.Add(new MaterialReturnLine
            {
                Id = Ids.New("MRL"),
                MaterialReturnId = ret.Id,
                MaterialIssueLineId = issueLine.Id,
                MaterialId = issueLine.MaterialId,
                IssuedQuantity = issuedQty,
                PreviouslyReturnedQuantity = item.PreviouslyReturnedQuantity,
                ReturnedQuantity = item.ReturnedQuantity,
                Condition = item.Condition ?? "ReusableGood",
                Disposition = item.Disposition ?? "ReturnToUsableStock",
                UnitCost = issueLine.UnitCost ?? 0,
                TotalReturnAmount = Money.Round2(item.ReturnedQuantity * (issueLine.UnitCost ?? 0)),
                InspectionNotes = item.InspectionNotes,
                Material = issueLine.Material,
                MaterialIssueLine = issueLine
            });
        }

        ret.Audits.Add(AuditReturn(ret.Id, "DraftCreated", "Draft created"));
        _db.MaterialReturns.Add(ret);
        await Save(ct);
        return ApiResponse.Ok(MapReturn(ret));
    }

    public async Task<object> UpdateReturnAsync(string id, ReturnWriteRequest req, CancellationToken ct)
    {
        var ret = await LoadReturn(id, ct) ?? throw new AppException(404, "Material return not found");
        if (ret.Status != "Draft") throw new AppException(400, "Only Draft can be edited");
        ret.ReturnedByPerson = req.ReturnedByPerson ?? ret.ReturnedByPerson;
        ret.Reason = req.Reason ?? ret.Reason;
        ret.Remarks = req.Remarks;
        ret.UpdatedAtUtc = DateTime.UtcNow;
        await Save(ct);
        return ApiResponse.Ok(MapReturn(ret));
    }

    public async Task<object> InspectReturnAsync(string id, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper");
        var ret = await LoadReturn(id, ct) ?? throw new AppException(404, "Material return not found");
        ret.Status = "Inspected";
        ret.InspectedByUserId = _me.UserId;
        ret.InspectedByName = _me.FullName;
        ret.InspectedAtUtc = DateTime.UtcNow;
        ret.Audits.Add(AuditReturn(ret.Id, "Inspected", "Inspected"));
        await Save(ct);
        return ApiResponse.Ok(MapReturn(ret));
    }

    public async Task<object> ApproveReturnAsync(string id, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var ret = await LoadReturn(id, ct) ?? throw new AppException(404, "Material return not found");
        await EnsureCanApprove(ret.CreatedByUserId, ct);
        ret.Status = "Approved";
        ret.ApprovedByUserId = _me.UserId;
        ret.ApprovedByName = _me.FullName;
        ret.ApprovedAtUtc = DateTime.UtcNow;
        ret.Audits.Add(AuditReturn(ret.Id, "Approved", "Approved"));
        await Save(ct);
        return ApiResponse.Ok(MapReturn(ret));
    }

    public async Task<object> PostReturnAsync(string id, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper");
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var ret = await LoadReturn(id, ct) ?? throw new AppException(404, "Material return not found");
        if (ret.Status != "Approved") throw new AppException(400, "Must be Approved");
        foreach (var line in ret.Lines.Where(l => l.ReturnedQuantity > 0 && l.Disposition == "ReturnToUsableStock"))
        {
            var entry = await PostStock(new StockMove(
                "SiteReturn", true, line.ReturnedQuantity, 0, line.UnitCost, 0,
                line.MaterialId, ret.WarehouseId, ret.ProjectId,
                "MaterialReturn", ret.Id, ret.ReturnNumber, line.Id,
                $"RETURN:{ret.Id}:{line.Id}", line.InspectionNotes, true), ct);
            line.StockLedgerEntryId = entry.Id;
        }

        ret.Status = "Posted";
        ret.PostedByUserId = _me.UserId;
        ret.PostedByName = _me.FullName;
        ret.PostedAtUtc = DateTime.UtcNow;
        ret.Audits.Add(AuditReturn(ret.Id, "Posted", "Posted"));
        await Save(ct);
        await tx.CommitAsync(ct);
        return ApiResponse.Ok(MapReturn(ret));
    }

    public async Task<object> ReturnHistoryAsync(string id, CancellationToken ct)
    {
        var ret = await LoadReturn(id, ct) ?? throw new AppException(404, "Material return not found");
        return ApiResponse.Ok(ret.Audits.OrderBy(a => a.TimestampUtc));
    }

    public async Task<object> DeleteReturnAsync(string id, CancellationToken ct)
    {
        var ret = await LoadReturn(id, ct) ?? throw new AppException(404, "Material return not found");
        if (ret.Status != "Draft") throw new AppException(400, "Only Draft can be deleted");
        _db.MaterialReturns.Remove(ret);
        await Save(ct);
        return ApiResponse.Ok(new { id });
    }

    private IQueryable<MaterialIssue> QueryIssues() =>
        _db.MaterialIssues
            .Include(i => i.Requisition).Include(i => i.Project).Include(i => i.Warehouse)
            .Include(i => i.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(i => i.Audits);

    private IQueryable<MaterialReturn> QueryReturns() =>
        _db.MaterialReturns
            .Include(r => r.MaterialIssue).Include(r => r.Project).Include(r => r.Warehouse)
            .Include(r => r.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(r => r.Audits);

    private Task<MaterialIssue?> LoadIssue(string id, CancellationToken ct) =>
        QueryIssues().Include(i => i.Requisition!.Lines).ThenInclude(l => l.Material)
            .FirstOrDefaultAsync(i => i.Id == id, ct);

    private Task<MaterialReturn?> LoadReturn(string id, CancellationToken ct) =>
        QueryReturns().FirstOrDefaultAsync(r => r.Id == id, ct);

    private MaterialIssueAudit AuditIssue(string id, string action, string? comments) => new()
    {
        Id = Ids.New("MIA"), MaterialIssueId = id, ActorUserId = _me.UserId, ActorName = _me.FullName,
        ActorRole = _me.PrimaryRole, Action = action, Comments = comments, TimestampUtc = DateTime.UtcNow
    };

    private MaterialReturnAudit AuditReturn(string id, string action, string? comments) => new()
    {
        Id = Ids.New("MRA"), MaterialReturnId = id, ActorUserId = _me.UserId, ActorName = _me.FullName,
        ActorRole = _me.PrimaryRole, Action = action, Comments = comments, TimestampUtc = DateTime.UtcNow
    };

    private static object MapIssue(MaterialIssue i) => new
    {
        id = i.Id,
        issueNumber = i.IssueNumber,
        requisitionId = i.RequisitionId,
        requisitionNumber = i.Requisition?.RequisitionNumber ?? "",
        projectId = i.ProjectId,
        projectName = i.Project?.Name ?? "",
        warehouseId = i.WarehouseId,
        warehouseName = i.Warehouse?.Name ?? "",
        issueDate = i.IssueDate.ToString("yyyy-MM-dd"),
        status = i.Status,
        purpose = i.Purpose,
        workActivity = i.WorkActivity,
        receivedByPerson = i.ReceivedByPerson,
        items = i.Lines.Select(l => new
        {
            id = l.Id,
            materialIssueId = l.MaterialIssueId,
            requisitionItemId = l.RequisitionLineId,
            materialId = l.MaterialId,
            materialCode = l.Material?.ItemCode ?? "",
            materialName = l.Material?.Name ?? "",
            unitCode = l.Material?.BaseUnit?.Code ?? "",
            requestedQuantity = l.RequestedQuantity,
            previouslyFulfilledQuantity = l.PreviouslyFulfilledQuantity,
            outstandingQuantity = Math.Max(0, l.RequestedQuantity - l.PreviouslyFulfilledQuantity),
            quantityToIssue = l.QuantityToIssue,
            actualIssuedQuantity = l.ActualIssuedQuantity,
            unitCost = l.UnitCost,
            totalIssuedAmount = l.TotalIssuedAmount,
            storageLocation = l.StorageLocation,
            remarks = l.Remarks,
            stockLedgerEntryId = l.StockLedgerEntryId
        }).ToList(),
        auditTrail = i.Audits.OrderBy(a => a.TimestampUtc).Select(a => new
        {
            id = a.Id, materialIssueId = a.MaterialIssueId, actorUserId = a.ActorUserId, actorName = a.ActorName,
            actorRole = a.ActorRole, action = a.Action, comments = a.Comments, timestampUtc = a.TimestampUtc.ToString("o")
        }).ToList(),
        rejectionReason = i.RejectionReason,
        correctionNotes = i.CorrectionNotes,
        remarks = i.Remarks,
        createdByUserId = i.CreatedByUserId,
        createdByName = i.CreatedByName,
        createdAtUtc = i.CreatedAtUtc.ToString("o"),
        submittedByUserId = i.SubmittedByUserId,
        submittedByName = i.SubmittedByName,
        submittedAtUtc = i.SubmittedAtUtc?.ToString("o"),
        approvedByUserId = i.ApprovedByUserId,
        approvedByName = i.ApprovedByName,
        approvedAtUtc = i.ApprovedAtUtc?.ToString("o"),
        postedByUserId = i.PostedByUserId,
        postedByName = i.PostedByName,
        postedAtUtc = i.PostedAtUtc?.ToString("o"),
        updatedAtUtc = i.UpdatedAtUtc?.ToString("o")
    };

    private static object MapReturn(MaterialReturn r) => new
    {
        id = r.Id,
        returnNumber = r.ReturnNumber,
        materialIssueId = r.MaterialIssueId,
        materialIssueNumber = r.MaterialIssue?.IssueNumber ?? "",
        requisitionId = r.RequisitionId,
        requisitionNumber = r.MaterialIssue?.Requisition?.RequisitionNumber ?? "",
        projectId = r.ProjectId,
        projectName = r.Project?.Name ?? "",
        warehouseId = r.WarehouseId,
        warehouseName = r.Warehouse?.Name ?? "",
        returnDate = r.ReturnDate.ToString("yyyy-MM-dd"),
        returnedByPerson = r.ReturnedByPerson,
        reason = r.Reason,
        status = r.Status,
        items = r.Lines.Select(l => new
        {
            id = l.Id,
            materialReturnId = l.MaterialReturnId,
            materialIssueItemId = l.MaterialIssueLineId,
            materialId = l.MaterialId,
            materialCode = l.Material?.ItemCode ?? "",
            materialName = l.Material?.Name ?? "",
            unitCode = l.Material?.BaseUnit?.Code ?? "",
            issuedQuantity = l.IssuedQuantity,
            previouslyReturnedQuantity = l.PreviouslyReturnedQuantity,
            maxReturnableQuantity = Math.Max(0, l.IssuedQuantity - l.PreviouslyReturnedQuantity),
            returnedQuantity = l.ReturnedQuantity,
            condition = l.Condition,
            disposition = l.Disposition,
            unitCost = l.UnitCost,
            totalReturnAmount = l.TotalReturnAmount,
            inspectionNotes = l.InspectionNotes,
            stockLedgerEntryId = l.StockLedgerEntryId
        }).ToList(),
        auditTrail = r.Audits.OrderBy(a => a.TimestampUtc).Select(a => new
        {
            id = a.Id, materialReturnId = a.MaterialReturnId, actorUserId = a.ActorUserId, actorName = a.ActorName,
            actorRole = a.ActorRole, action = a.Action, comments = a.Comments, timestampUtc = a.TimestampUtc.ToString("o")
        }).ToList(),
        rejectionReason = r.RejectionReason,
        remarks = r.Remarks,
        createdByUserId = r.CreatedByUserId,
        createdByName = r.CreatedByName,
        createdAtUtc = r.CreatedAtUtc.ToString("o"),
        inspectedByUserId = r.InspectedByUserId,
        inspectedByName = r.InspectedByName,
        inspectedAtUtc = r.InspectedAtUtc?.ToString("o"),
        approvedByUserId = r.ApprovedByUserId,
        approvedByName = r.ApprovedByName,
        approvedAtUtc = r.ApprovedAtUtc?.ToString("o"),
        postedByUserId = r.PostedByUserId,
        postedByName = r.PostedByName,
        postedAtUtc = r.PostedAtUtc?.ToString("o"),
        updatedAtUtc = r.UpdatedAtUtc?.ToString("o")
    };
}

public record IssueLineRequest(
    string RequisitionItemId,
    decimal PreviouslyFulfilledQuantity,
    decimal QuantityToIssue,
    string? StorageLocation,
    string? Remarks);

public record IssueWriteRequest(
    string? RequisitionId,
    string? WarehouseId,
    DateOnly IssueDate,
    string? Purpose,
    string? WorkActivity,
    string? ReceivedByPerson,
    string? Remarks,
    List<IssueLineRequest>? Items);

public record ReturnLineRequest(
    string MaterialIssueItemId,
    decimal PreviouslyReturnedQuantity,
    decimal ReturnedQuantity,
    string? Condition,
    string? Disposition,
    string? InspectionNotes);

public record ReturnWriteRequest(
    string? MaterialIssueId,
    DateOnly ReturnDate,
    string? ReturnedByPerson,
    string? Reason,
    string? Remarks,
    List<ReturnLineRequest>? Items);
