using Microsoft.EntityFrameworkCore;
using StructStock.Domain;

namespace StructStock.Application;

public partial class InventoryApp
{
    public async Task<object> ListRequisitionsAsync(string? search, string? status, string? projectId, int? page, int? pageSize, CancellationToken ct)
    {
        var query = await _db.Requisitions
            .Include(r => r.Project)
            .Include(r => r.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.Category)
            .Include(r => r.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(r => r.Audits)
            .AsNoTracking()
            .ToListAsync(ct);

        var filtered = query.Where(r => _me.CanAccessProject(r.ProjectId) || r.RequesterUserId == _me.UserId).ToList();
        if (!string.IsNullOrWhiteSpace(projectId) && projectId != "ALL")
        {
            filtered = filtered.Where(r => r.ProjectId == projectId).ToList();
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
        {
            filtered = filtered.Where(r => r.Status == status).ToList();
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            filtered = filtered.Where(r =>
                r.RequisitionNumber.ToUpper().Contains(term) ||
                (r.Project?.Name ?? "").ToUpper().Contains(term) ||
                r.Purpose.ToUpper().Contains(term)).ToList();
        }

        filtered = filtered.OrderByDescending(r => r.CreatedAtUtc).ToList();
        return ApiResponse.Ok(Page(filtered.Select(MapRequisition).ToList(), page, pageSize));
    }

    public async Task<object> ApprovalsInboxAsync(CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var items = await _db.Requisitions
            .Include(r => r.Project)
            .Include(r => r.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.Category)
            .Include(r => r.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(r => r.Audits)
            .AsNoTracking()
            .Where(r => r.Status == "Submitted")
            .ToListAsync(ct);
        var filtered = items.Where(r => _me.CanAccessProject(r.ProjectId)).OrderBy(r => r.CreatedAtUtc).ToList();
        return ApiResponse.Ok(filtered.Select(MapRequisition).ToList());
    }

    public async Task<object> GetRequisitionAsync(string id, CancellationToken ct)
    {
        var r = await LoadRequisition(id, ct) ?? throw new AppException(404, "Requisition not found");
        if (!_me.CanAccessProject(r.ProjectId) && r.RequesterUserId != _me.UserId)
        {
            throw new AppException(403, "Forbidden: You do not have authorization to access this requisition");
        }

        return ApiResponse.Ok(MapRequisition(r));
    }

    public async Task<object> CreateRequisitionAsync(RequisitionWriteRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.ProjectId)) throw new AppException(400, "Project selection is required");
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == req.ProjectId && p.IsActive, ct)
            ?? throw new AppException(400, $"Active project with ID '{req.ProjectId}' was not found");
        if (!_me.CanAccessProject(project.Id))
        {
            throw new AppException(403, "Forbidden: You do not have authorization to create requisitions for this project");
        }

        if (req.RequiredDate == default) throw new AppException(400, "Valid required date is required");
        if (req.Items == null || req.Items.Count == 0) throw new AppException(400, "At least one material line is required");

        var settings = await Settings(ct);
        var requisition = new Requisition
        {
            Id = Ids.New("REQ"),
            RequisitionNumber = await NextNumber(settings.PrefixRequisition, ct),
            ProjectId = project.Id,
            RequesterUserId = _me.UserId,
            RequesterName = _me.FullName,
            RequesterRole = _me.PrimaryRole,
            RequiredDate = req.RequiredDate,
            Priority = string.IsNullOrWhiteSpace(req.Priority) ? "Medium" : req.Priority!,
            Purpose = req.Purpose?.Trim() ?? "Site construction material requirement",
            WorkActivity = req.WorkActivity,
            SiteLocationDetail = req.SiteLocationDetail,
            Status = "Draft",
            CreatedAtUtc = DateTime.UtcNow,
            Project = project
        };

        foreach (var item in req.Items)
        {
            var material = await _db.Materials.Include(m => m.Category).Include(m => m.BaseUnit)
                .FirstOrDefaultAsync(m => m.Id == item.MaterialId && m.IsActive, ct)
                ?? throw new AppException(400, $"Material '{item.MaterialId}' was not found or is inactive");
            if (item.RequestedQuantity <= 0) throw new AppException(400, "Requested quantity must be positive");
            requisition.Lines.Add(new RequisitionLine
            {
                Id = Ids.New("RQI"),
                RequisitionId = requisition.Id,
                MaterialId = material.Id,
                RequestedQuantity = item.RequestedQuantity,
                Remarks = item.Remarks,
                Material = material
            });
        }

        requisition.Audits.Add(AuditReq(requisition.Id, "DraftCreated", "Draft created"));
        _db.Requisitions.Add(requisition);
        Notify("Requisition", "Created", "Info", "Requisition drafted",
            $"{requisition.RequisitionNumber} created for {project.Name}",
            "Requisition", requisition.Id, requisition.RequisitionNumber, $"/requisitions/{requisition.Id}",
            requisition.Status, project.Id, null, null, null, "SuperAdmin", "InventoryManager", "ProjectManager");
        await Save(ct);
        return ApiResponse.Ok(MapRequisition(requisition));
    }

    public async Task<object> UpdateRequisitionAsync(string id, RequisitionWriteRequest req, CancellationToken ct)
    {
        var r = await LoadRequisition(id, ct) ?? throw new AppException(404, "Requisition not found");
        if (r.Status is not ("Draft" or "ReturnedForCorrection"))
        {
            throw new AppException(400, "Only Draft or ReturnedForCorrection requisitions can be edited");
        }

        if (r.RequesterUserId != _me.UserId && !_me.HasRole("SuperAdmin", "InventoryManager"))
        {
            throw new AppException(403, "Only the requester or inventory managers can edit this requisition");
        }

        if (!string.IsNullOrWhiteSpace(req.ProjectId) && req.ProjectId != r.ProjectId)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == req.ProjectId && p.IsActive, ct)
                ?? throw new AppException(400, "Active project not found");
            if (!_me.CanAccessProject(project.Id)) throw new AppException(403, "Forbidden project scope");
            r.ProjectId = project.Id;
            r.Project = project;
        }

        if (req.RequiredDate != default) r.RequiredDate = req.RequiredDate;
        if (!string.IsNullOrWhiteSpace(req.Priority)) r.Priority = req.Priority!;
        if (!string.IsNullOrWhiteSpace(req.Purpose)) r.Purpose = req.Purpose.Trim();
        r.WorkActivity = req.WorkActivity;
        r.SiteLocationDetail = req.SiteLocationDetail;
        r.UpdatedAtUtc = DateTime.UtcNow;
        r.Status = "Draft";
        r.CorrectionNotes = null;

        if (req.Items != null)
        {
            _db.RequisitionLines.RemoveRange(r.Lines);
            r.Lines.Clear();
            foreach (var item in req.Items)
            {
                var material = await _db.Materials.Include(m => m.Category).Include(m => m.BaseUnit)
                    .FirstAsync(m => m.Id == item.MaterialId, ct);
                r.Lines.Add(new RequisitionLine
                {
                    Id = Ids.New("RQI"),
                    RequisitionId = r.Id,
                    MaterialId = material.Id,
                    RequestedQuantity = item.RequestedQuantity,
                    Remarks = item.Remarks,
                    Material = material
                });
            }
        }

        r.Audits.Add(AuditReq(r.Id, "Updated", "Requisition updated"));
        await Save(ct);
        return ApiResponse.Ok(MapRequisition(r));
    }

    public async Task<object> SubmitRequisitionAsync(string id, CancellationToken ct)
    {
        var r = await LoadRequisition(id, ct) ?? throw new AppException(404, "Requisition not found");
        if (r.Status is not ("Draft" or "ReturnedForCorrection"))
        {
            throw new AppException(400, "Only Draft or ReturnedForCorrection requisitions can be submitted");
        }

        if (r.Lines.Count == 0) throw new AppException(400, "Cannot submit an empty requisition");
        r.Status = "Submitted";
        r.UpdatedAtUtc = DateTime.UtcNow;
        r.Audits.Add(AuditReq(r.Id, "Submitted", "Submitted for approval"));
        Notify("Requisition", "Submitted", "Warning", "Requisition awaiting approval",
            $"{r.RequisitionNumber} submitted by {_me.FullName}",
            "Requisition", r.Id, r.RequisitionNumber, $"/requisitions/{r.Id}",
            r.Status, r.ProjectId, null, null, null, "SuperAdmin", "InventoryManager", "ProjectManager");
        await Save(ct);
        return ApiResponse.Ok(MapRequisition(r));
    }

    public async Task<object> ApproveRequisitionAsync(string id, string? comments, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var r = await LoadRequisition(id, ct) ?? throw new AppException(404, "Requisition not found");
        if (r.Status != "Submitted") throw new AppException(400, "Only Submitted requisitions can be approved");
        await EnsureCanApprove(r.RequesterUserId, ct);
        if (!_me.CanAccessProject(r.ProjectId)) throw new AppException(403, "Forbidden project scope");
        r.Status = "Approved";
        r.ApprovedByUserId = _me.UserId;
        r.ApprovedByName = _me.FullName;
        r.ApprovedAtUtc = DateTime.UtcNow;
        r.UpdatedAtUtc = DateTime.UtcNow;
        r.Audits.Add(AuditReq(r.Id, "Approved", comments ?? "Approved"));
        Notify("Requisition", "Approved", "Success", "Requisition approved",
            $"{r.RequisitionNumber} approved by {_me.FullName}",
            "Requisition", r.Id, r.RequisitionNumber, $"/requisitions/{r.Id}",
            r.Status, r.ProjectId, null, null, null, "SuperAdmin", "InventoryManager", "ProjectManager", "Storekeeper", "ProcurementOfficer");
        await Save(ct);
        return ApiResponse.Ok(MapRequisition(r));
    }

    public async Task<object> RejectRequisitionAsync(string id, string? reason, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var r = await LoadRequisition(id, ct) ?? throw new AppException(404, "Requisition not found");
        if (r.Status != "Submitted") throw new AppException(400, "Only Submitted requisitions can be rejected");
        await EnsureCanApprove(r.RequesterUserId, ct);
        r.Status = "Rejected";
        r.RejectionReason = string.IsNullOrWhiteSpace(reason) ? "Rejected" : reason;
        r.UpdatedAtUtc = DateTime.UtcNow;
        r.Audits.Add(AuditReq(r.Id, "Rejected", r.RejectionReason));
        Notify("Requisition", "Rejected", "Critical", "Requisition rejected",
            $"{r.RequisitionNumber}: {r.RejectionReason}",
            "Requisition", r.Id, r.RequisitionNumber, $"/requisitions/{r.Id}",
            r.Status, r.ProjectId, null, null, null, "SuperAdmin", "InventoryManager", "ProjectManager");
        await Save(ct);
        return ApiResponse.Ok(MapRequisition(r));
    }

    public async Task<object> ReturnRequisitionAsync(string id, string? notes, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var r = await LoadRequisition(id, ct) ?? throw new AppException(404, "Requisition not found");
        if (r.Status != "Submitted") throw new AppException(400, "Only Submitted requisitions can be returned");
        await EnsureCanApprove(r.RequesterUserId, ct);
        r.Status = "ReturnedForCorrection";
        r.CorrectionNotes = string.IsNullOrWhiteSpace(notes) ? "Returned for correction" : notes;
        r.UpdatedAtUtc = DateTime.UtcNow;
        r.Audits.Add(AuditReq(r.Id, "ReturnedForCorrection", r.CorrectionNotes));
        await Save(ct);
        return ApiResponse.Ok(MapRequisition(r));
    }

    public async Task<object> DeleteRequisitionAsync(string id, CancellationToken ct)
    {
        var r = await LoadRequisition(id, ct) ?? throw new AppException(404, "Requisition not found");
        if (r.Status != "Draft") throw new AppException(400, "Only Draft requisitions can be deleted");
        if (r.RequesterUserId != _me.UserId && !_me.HasRole("SuperAdmin"))
        {
            throw new AppException(403, "Forbidden");
        }

        _db.Requisitions.Remove(r);
        await Save(ct);
        return ApiResponse.Ok(new { id }, "Deleted");
    }

    public async Task<object> GetRequisitionFulfillmentAsync(string id, CancellationToken ct)
    {
        var r = await LoadRequisition(id, ct) ?? throw new AppException(404, "Requisition not found");
        if (!_me.CanAccessProject(r.ProjectId)) throw new AppException(403, "Forbidden");
        var issues = await _db.MaterialIssues
            .Include(i => i.Lines)
            .Where(i => i.RequisitionId == id && i.Status == "Posted")
            .ToListAsync(ct);

        var lines = r.Lines.Select(line =>
        {
            var fulfilled = issues.SelectMany(i => i.Lines)
                .Where(l => l.RequisitionLineId == line.Id)
                .Sum(l => l.ActualIssuedQuantity ?? l.QuantityToIssue);
            return new
            {
                requisitionLineId = line.Id,
                materialId = line.MaterialId,
                materialCode = line.Material?.ItemCode ?? "",
                materialName = line.Material?.Name ?? "",
                unitCode = line.Material?.BaseUnit?.Code ?? "",
                requestedQuantity = line.RequestedQuantity,
                fulfilledQuantity = fulfilled,
                outstandingQuantity = Math.Max(0, line.RequestedQuantity - fulfilled)
            };
        }).ToList();

        return ApiResponse.Ok(new
        {
            requisition = MapRequisition(r),
            lines,
            canCreateIssue = r.Status == "Approved" && lines.Any(l => l.outstandingQuantity > 0)
        });
    }

    private async Task<Requisition?> LoadRequisition(string id, CancellationToken ct) =>
        await _db.Requisitions
            .Include(r => r.Project)
            .Include(r => r.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.Category)
            .Include(r => r.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(r => r.Audits)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

    private RequisitionAudit AuditReq(string id, string action, string? comments) => new()
    {
        Id = Ids.New("RQA"),
        RequisitionId = id,
        ActorUserId = _me.UserId,
        ActorName = _me.FullName,
        ActorRole = _me.PrimaryRole,
        Action = action,
        Comments = comments,
        TimestampUtc = DateTime.UtcNow
    };

    private static object MapRequisition(Requisition r)
    {
        var balancesNote = "Check stock at fulfillment";
        return new
        {
            id = r.Id,
            requisitionNumber = r.RequisitionNumber,
            projectId = r.ProjectId,
            projectCode = r.Project?.Code ?? "",
            projectName = r.Project?.Name ?? "",
            requesterUserId = r.RequesterUserId,
            requesterName = r.RequesterName,
            requesterRole = r.RequesterRole,
            requiredDate = r.RequiredDate.ToString("yyyy-MM-dd"),
            priority = r.Priority,
            purpose = r.Purpose,
            workActivity = r.WorkActivity,
            siteLocationDetail = r.SiteLocationDetail,
            status = r.Status,
            items = r.Lines.Select(l => new
            {
                id = l.Id,
                materialId = l.MaterialId,
                materialCode = l.Material?.ItemCode ?? "",
                materialName = l.Material?.Name ?? "",
                categoryId = l.Material?.CategoryId ?? "",
                categoryName = l.Material?.Category?.Name ?? "",
                requestedQuantity = l.RequestedQuantity,
                unitId = l.Material?.BaseUnitId ?? "",
                unitCode = l.Material?.BaseUnit?.Code ?? "",
                remarks = l.Remarks,
                stockAvailabilityNote = balancesNote
            }).ToList(),
            approvalHistory = r.Audits.OrderBy(a => a.TimestampUtc).Select(a => new
            {
                id = a.Id,
                requisitionId = a.RequisitionId,
                actorUserId = a.ActorUserId,
                actorName = a.ActorName,
                actorRole = a.ActorRole,
                action = a.Action,
                comments = a.Comments,
                timestampUtc = a.TimestampUtc.ToString("o")
            }).ToList(),
            rejectionReason = r.RejectionReason,
            correctionNotes = r.CorrectionNotes,
            approvedByUserId = r.ApprovedByUserId,
            approvedByName = r.ApprovedByName,
            approvedAtUtc = r.ApprovedAtUtc?.ToString("o"),
            createdAtUtc = r.CreatedAtUtc.ToString("o"),
            updatedAtUtc = r.UpdatedAtUtc?.ToString("o")
        };
    }
}

public record RequisitionItemRequest(string MaterialId, decimal RequestedQuantity, string? Remarks);

public record RequisitionWriteRequest(
    string? ProjectId,
    DateOnly RequiredDate,
    string? Priority,
    string? Purpose,
    string? WorkActivity,
    string? SiteLocationDetail,
    List<RequisitionItemRequest>? Items);
