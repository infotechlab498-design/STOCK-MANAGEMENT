using Microsoft.EntityFrameworkCore;
using StructStock.Domain;

namespace StructStock.Application;

public partial class InventoryApp
{
    public async Task<object> ListGrnsAsync(string? search, string? status, string? projectId, int? page, int? pageSize, CancellationToken ct)
    {
        var list = await _db.GoodsReceipts
            .Include(g => g.PurchaseOrder).Include(g => g.Supplier).Include(g => g.Project).Include(g => g.Warehouse)
            .Include(g => g.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(g => g.Audits)
            .AsNoTracking().ToListAsync(ct);
        var filtered = list.Where(g => _me.CanAccessLocation(g.ProjectId, g.WarehouseId)).ToList();
        if (!string.IsNullOrWhiteSpace(status) && status != "ALL") filtered = filtered.Where(g => g.Status == status).ToList();
        if (!string.IsNullOrWhiteSpace(projectId) && projectId != "ALL") filtered = filtered.Where(g => g.ProjectId == projectId).ToList();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            filtered = filtered.Where(g => g.GrnNumber.ToUpper().Contains(term) || (g.PurchaseOrder?.PoNumber ?? "").ToUpper().Contains(term)).ToList();
        }

        return ApiResponse.Ok(Page(filtered.OrderByDescending(g => g.CreatedAtUtc).Select(MapGrn).ToList(), page, pageSize));
    }

    public async Task<object> GetGrnAsync(string id, CancellationToken ct)
    {
        var grn = await LoadGrn(id, ct) ?? throw new AppException(404, "GRN not found");
        RequireLocation(grn.ProjectId, grn.WarehouseId);
        return ApiResponse.Ok(MapGrn(grn));
    }

    public async Task<object> GrnHistoryAsync(string id, CancellationToken ct)
    {
        var grn = await LoadGrn(id, ct) ?? throw new AppException(404, "GRN not found");
        return ApiResponse.Ok(grn.Audits.OrderBy(a => a.TimestampUtc).Select(a => new
        {
            id = a.Id,
            grnId = a.GoodsReceiptId,
            actorUserId = a.ActorUserId,
            actorName = a.ActorName,
            actorRole = a.ActorRole,
            action = a.Action,
            comments = a.Comments,
            timestampUtc = a.TimestampUtc.ToString("o")
        }));
    }

    public async Task<object> PoReceiptsAsync(string poId, CancellationToken ct)
    {
        var list = await _db.GoodsReceipts
            .Include(g => g.PurchaseOrder).Include(g => g.Supplier).Include(g => g.Project).Include(g => g.Warehouse)
            .Include(g => g.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(g => g.Audits)
            .AsNoTracking()
            .Where(g => g.PurchaseOrderId == poId)
            .ToListAsync(ct);
        return ApiResponse.Ok(list.Select(MapGrn).ToList());
    }

    public async Task<object> CreateGrnAsync(GrnWriteRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper");
        var po = await LoadPo(req.PurchaseOrderId!, ct)
            ?? throw new AppException(400, "Purchase order is required");
        if (po.Status is not ("Issued" or "PartiallyReceived"))
        {
            throw new AppException(400, "GRN can only be created against Issued or PartiallyReceived purchase orders");
        }

        var warehouse = await _db.Warehouses.Include(w => w.Project).FirstOrDefaultAsync(w => w.Id == req.WarehouseId, ct)
            ?? throw new AppException(400, "Warehouse is required");
        RequireLocation(po.ProjectId, warehouse.Id);

        var settings = await Settings(ct);
        var grn = new GoodsReceipt
        {
            Id = Ids.New("GRN"),
            GrnNumber = await NextNumber(settings.PrefixGrn, ct),
            PurchaseOrderId = po.Id,
            SupplierId = po.SupplierId,
            ProjectId = po.ProjectId,
            WarehouseId = warehouse.Id,
            StorageLocation = req.StorageLocation?.Trim() ?? warehouse.Name,
            GrnDate = req.GrnDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : req.GrnDate,
            ReceivedAtUtc = DateTime.UtcNow,
            DeliveryChallanNumber = req.DeliveryChallanNumber?.Trim() ?? "",
            DeliveryChallanDate = req.DeliveryChallanDate,
            VehicleNumber = req.VehicleNumber,
            DeliveredBy = req.DeliveredBy,
            Status = "Draft",
            GeneralRemarks = req.GeneralRemarks,
            ReceivedByUserId = _me.UserId,
            ReceivedByName = _me.FullName,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
            PurchaseOrder = po,
            Supplier = po.Supplier,
            Project = po.Project,
            Warehouse = warehouse
        };

        ApplyChecklist(grn, req.InspectionChecklist);
        foreach (var item in req.Items ?? new())
        {
            var poLine = po.Lines.FirstOrDefault(l => l.Id == item.PurchaseOrderItemId)
                ?? throw new AppException(400, $"PO line '{item.PurchaseOrderItemId}' not found");
            var material = poLine.Material ?? await _db.Materials.Include(m => m.BaseUnit).FirstAsync(m => m.Id == poLine.MaterialId, ct);
            var accepted = item.AcceptedQuantity;
            grn.Lines.Add(new GoodsReceiptLine
            {
                Id = Ids.New("GRL"),
                GoodsReceiptId = grn.Id,
                PurchaseOrderLineId = poLine.Id,
                MaterialId = poLine.MaterialId,
                OrderedQuantity = poLine.OrderedQuantity,
                PreviouslyReceivedQuantity = poLine.ReceivedQuantity,
                DeliveredQuantity = item.DeliveredQuantity,
                AcceptedQuantity = accepted,
                RejectedQuantity = item.RejectedQuantity,
                DamagedQuantity = item.DamagedQuantity,
                ShortQuantity = item.ShortQuantity,
                Remarks = item.Remarks,
                StorageLocation = item.StorageLocation ?? grn.StorageLocation,
                UnitPrice = poLine.UnitRate,
                TotalAcceptedAmount = Money.Round2(accepted * poLine.UnitRate),
                Material = material,
                PurchaseOrderLine = poLine
            });
        }

        RecalcGrnTotals(grn);
        grn.Audits.Add(AuditGrn(grn.Id, "DraftCreated", "Draft created"));
        _db.GoodsReceipts.Add(grn);
        await Save(ct);
        return ApiResponse.Ok(MapGrn(grn));
    }

    public async Task<object> UpdateGrnAsync(string id, GrnWriteRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper");
        var grn = await LoadGrn(id, ct) ?? throw new AppException(404, "GRN not found");
        if (grn.Status is not ("Draft" or "ReturnedForCorrection"))
        {
            throw new AppException(400, "Only Draft or ReturnedForCorrection GRNs can be edited");
        }

        if (!string.IsNullOrWhiteSpace(req.WarehouseId) && req.WarehouseId != grn.WarehouseId)
        {
            var warehouse = await _db.Warehouses.FirstAsync(w => w.Id == req.WarehouseId, ct);
            RequireLocation(grn.ProjectId, warehouse.Id);
            grn.WarehouseId = warehouse.Id;
            grn.Warehouse = warehouse;
        }

        grn.StorageLocation = req.StorageLocation ?? grn.StorageLocation;
        grn.DeliveryChallanNumber = req.DeliveryChallanNumber ?? grn.DeliveryChallanNumber;
        grn.DeliveryChallanDate = req.DeliveryChallanDate ?? grn.DeliveryChallanDate;
        grn.VehicleNumber = req.VehicleNumber;
        grn.DeliveredBy = req.DeliveredBy;
        grn.GeneralRemarks = req.GeneralRemarks;
        grn.Status = "Draft";
        grn.UpdatedAtUtc = DateTime.UtcNow;
        ApplyChecklist(grn, req.InspectionChecklist);

        if (req.Items != null)
        {
            var po = await LoadPo(grn.PurchaseOrderId, ct) ?? throw new AppException(400, "PO missing");
            _db.GoodsReceiptLines.RemoveRange(grn.Lines);
            grn.Lines.Clear();
            foreach (var item in req.Items)
            {
                var poLine = po.Lines.First(l => l.Id == item.PurchaseOrderItemId);
                var material = poLine.Material ?? await _db.Materials.Include(m => m.BaseUnit).FirstAsync(m => m.Id == poLine.MaterialId, ct);
                grn.Lines.Add(new GoodsReceiptLine
                {
                    Id = Ids.New("GRL"),
                    GoodsReceiptId = grn.Id,
                    PurchaseOrderLineId = poLine.Id,
                    MaterialId = poLine.MaterialId,
                    OrderedQuantity = poLine.OrderedQuantity,
                    PreviouslyReceivedQuantity = poLine.ReceivedQuantity,
                    DeliveredQuantity = item.DeliveredQuantity,
                    AcceptedQuantity = item.AcceptedQuantity,
                    RejectedQuantity = item.RejectedQuantity,
                    DamagedQuantity = item.DamagedQuantity,
                    ShortQuantity = item.ShortQuantity,
                    Remarks = item.Remarks,
                    StorageLocation = item.StorageLocation ?? grn.StorageLocation,
                    UnitPrice = poLine.UnitRate,
                    TotalAcceptedAmount = Money.Round2(item.AcceptedQuantity * poLine.UnitRate),
                    Material = material
                });
            }
        }

        RecalcGrnTotals(grn);
        grn.Audits.Add(AuditGrn(grn.Id, "Updated", "Updated"));
        await Save(ct);
        return ApiResponse.Ok(MapGrn(grn));
    }

    public async Task<object> SubmitGrnAsync(string id, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper");
        var grn = await LoadGrn(id, ct) ?? throw new AppException(404, "GRN not found");
        if (grn.Status is not ("Draft" or "ReturnedForCorrection")) throw new AppException(400, "Invalid status for submit");
        grn.Status = "SubmittedForInspection";
        grn.UpdatedAtUtc = DateTime.UtcNow;
        grn.Audits.Add(AuditGrn(grn.Id, "Submitted", "Submitted for inspection"));
        await Save(ct);
        return ApiResponse.Ok(MapGrn(grn));
    }

    public async Task<object> InspectGrnAsync(string id, InspectionChecklistRequest? checklist, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper");
        var grn = await LoadGrn(id, ct) ?? throw new AppException(404, "GRN not found");
        if (grn.Status != "SubmittedForInspection") throw new AppException(400, "GRN must be SubmittedForInspection");
        ApplyChecklist(grn, checklist);
        grn.Status = "Inspected";
        grn.InspectedByUserId = _me.UserId;
        grn.InspectedByName = _me.FullName;
        grn.InspectedAtUtc = DateTime.UtcNow;
        grn.UpdatedAtUtc = DateTime.UtcNow;
        grn.Audits.Add(AuditGrn(grn.Id, "Inspected", "Inspection completed"));
        await Save(ct);
        return ApiResponse.Ok(MapGrn(grn));
    }

    public async Task<object> ApproveGrnAsync(string id, string? comments, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var grn = await LoadGrn(id, ct) ?? throw new AppException(404, "GRN not found");
        if (grn.Status is not ("Inspected" or "SubmittedForInspection")) throw new AppException(400, "Invalid status for approve");
        await EnsureCanApprove(grn.ReceivedByUserId, ct);
        grn.Status = "Approved";
        grn.ApprovedByUserId = _me.UserId;
        grn.ApprovedByName = _me.FullName;
        grn.ApprovedAtUtc = DateTime.UtcNow;
        grn.Audits.Add(AuditGrn(grn.Id, "Approved", comments ?? "Approved"));
        await Save(ct);
        return ApiResponse.Ok(MapGrn(grn));
    }

    public async Task<object> RejectGrnAsync(string id, string? reason, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var grn = await LoadGrn(id, ct) ?? throw new AppException(404, "GRN not found");
        grn.Status = "Rejected";
        grn.RejectionReason = reason ?? "Rejected";
        grn.Audits.Add(AuditGrn(grn.Id, "Rejected", grn.RejectionReason));
        await Save(ct);
        return ApiResponse.Ok(MapGrn(grn));
    }

    public async Task<object> ReturnGrnAsync(string id, string? notes, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var grn = await LoadGrn(id, ct) ?? throw new AppException(404, "GRN not found");
        grn.Status = "ReturnedForCorrection";
        grn.CorrectionNotes = notes ?? "Returned for correction";
        grn.Audits.Add(AuditGrn(grn.Id, "ReturnedForCorrection", grn.CorrectionNotes));
        await Save(ct);
        return ApiResponse.Ok(MapGrn(grn));
    }

    public async Task<object> PostGrnAsync(string id, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "Storekeeper", "AccountsOfficer");
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var grn = await LoadGrn(id, ct) ?? throw new AppException(404, "GRN not found");
        RequireLocation(grn.ProjectId, grn.WarehouseId);
        var settings = await Settings(ct);
        if (settings.RequireGrnInspectionBeforePosting && grn.Status is not ("Inspected" or "Approved"))
        {
            throw new AppException(400, "GRN must be inspected (or approved) before posting");
        }

        if (grn.Status == "Posted") throw new AppException(400, "GRN is already posted");
        var po = await LoadPo(grn.PurchaseOrderId, ct) ?? throw new AppException(400, "Purchase order missing");

        foreach (var line in grn.Lines.Where(l => l.AcceptedQuantity > 0))
        {
            if (line.UnitPrice <= 0)
            {
                throw new AppException(400, $"Cannot value inventory posting: Material has a non-positive unit cost.");
            }

            var entry = await PostStock(new StockMove(
                "GoodsReceivedNote",
                true,
                line.AcceptedQuantity,
                0,
                line.UnitPrice,
                0,
                line.MaterialId,
                grn.WarehouseId,
                grn.ProjectId,
                "GRN",
                grn.Id,
                grn.GrnNumber,
                line.Id,
                $"GRN:{grn.Id}:{line.Id}",
                line.Remarks,
                true), ct);

            _db.ReceiptLedgers.Add(new ReceiptLedger
            {
                Id = Ids.New("RCL"),
                GoodsReceiptId = grn.Id,
                GoodsReceiptLineId = line.Id,
                PurchaseOrderId = po.Id,
                SupplierId = grn.SupplierId,
                ProjectId = grn.ProjectId,
                WarehouseId = grn.WarehouseId,
                MaterialId = line.MaterialId,
                AcceptedQuantity = line.AcceptedQuantity,
                UnitPrice = line.UnitPrice,
                TotalAmount = line.TotalAcceptedAmount,
                StorageLocation = line.StorageLocation,
                DeliveryChallanNumber = grn.DeliveryChallanNumber,
                PostedAtUtc = DateTime.UtcNow,
                PostedByUserId = _me.UserId,
                PostedByName = _me.FullName,
                ReconciledWithInventoryLedger = true
            });

            var poLine = po.Lines.First(l => l.Id == line.PurchaseOrderLineId);
            poLine.ReceivedQuantity = Money.Round4(poLine.ReceivedQuantity + line.AcceptedQuantity);
            _ = entry;
        }

        var fully = po.Lines.All(l => l.ReceivedQuantity >= l.OrderedQuantity - 0.0001m);
        po.Status = fully ? "FullyReceived" : "PartiallyReceived";
        po.UpdatedAtUtc = DateTime.UtcNow;

        grn.Status = "Posted";
        grn.PostedByUserId = _me.UserId;
        grn.PostedByName = _me.FullName;
        grn.PostedAtUtc = DateTime.UtcNow;
        grn.UpdatedAtUtc = DateTime.UtcNow;
        grn.Audits.Add(AuditGrn(grn.Id, "Posted", "Posted to stock ledger"));
        Notify("GRN", "Posted", "Success", "Goods receipt posted",
            $"{grn.GrnNumber} posted to inventory",
            "GRN", grn.Id, grn.GrnNumber, $"/grns/{grn.Id}",
            grn.Status, grn.ProjectId, grn.WarehouseId, null, null,
            "SuperAdmin", "InventoryManager", "Storekeeper", "AccountsOfficer", "ProcurementOfficer");

        await Save(ct);
        await tx.CommitAsync(ct);
        return ApiResponse.Ok(MapGrn(grn));
    }

    private static void RecalcGrnTotals(GoodsReceipt grn)
    {
        grn.TotalDeliveredQuantity = Money.Round4(grn.Lines.Sum(l => l.DeliveredQuantity));
        grn.TotalAcceptedQuantity = Money.Round4(grn.Lines.Sum(l => l.AcceptedQuantity));
        grn.TotalRejectedQuantity = Money.Round4(grn.Lines.Sum(l => l.RejectedQuantity));
        grn.TotalDamagedQuantity = Money.Round4(grn.Lines.Sum(l => l.DamagedQuantity));
        grn.TotalShortQuantity = Money.Round4(grn.Lines.Sum(l => l.ShortQuantity));
        grn.TotalAcceptedValue = Money.Round2(grn.Lines.Sum(l => l.TotalAcceptedAmount));
    }

    private static void ApplyChecklist(GoodsReceipt grn, InspectionChecklistRequest? c)
    {
        if (c == null) return;
        grn.ChallanMatchesPO = c.ChallanMatchesPO;
        grn.VehicleUnloadedSafely = c.VehicleUnloadedSafely;
        grn.PhysicallyCounted = c.PhysicallyCounted;
        grn.PackagingIntact = c.PackagingIntact;
        grn.BatchTestCertsProvided = c.BatchTestCertsProvided;
        grn.TestCertificateNumber = c.TestCertificateNumber;
        grn.MaterialsMeetSpecs = c.MaterialsMeetSpecs;
        grn.BinTagsAttached = c.BinTagsAttached;
        grn.InspectionRemarks = c.InspectionRemarks ?? "";
        grn.DiscrepancyIdentified = c.DiscrepancyIdentified;
        grn.DebitNoteRequired = c.DebitNoteRequired;
        grn.DebitNoteReason = c.DebitNoteReason;
    }

    private async Task<GoodsReceipt?> LoadGrn(string id, CancellationToken ct) =>
        await _db.GoodsReceipts
            .Include(g => g.PurchaseOrder).ThenInclude(p => p!.Lines)
            .Include(g => g.Supplier).Include(g => g.Project).Include(g => g.Warehouse)
            .Include(g => g.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(g => g.Audits)
            .FirstOrDefaultAsync(g => g.Id == id, ct);

    private GoodsReceiptAudit AuditGrn(string id, string action, string comments) => new()
    {
        Id = Ids.New("GRA"),
        GoodsReceiptId = id,
        ActorUserId = _me.UserId,
        ActorName = _me.FullName,
        ActorRole = _me.PrimaryRole,
        Action = action,
        Comments = comments,
        TimestampUtc = DateTime.UtcNow
    };

    private static object MapGrn(GoodsReceipt g) => new
    {
        id = g.Id,
        grnNumber = g.GrnNumber,
        purchaseOrderId = g.PurchaseOrderId,
        purchaseOrderNumber = g.PurchaseOrder?.PoNumber ?? "",
        supplierId = g.SupplierId,
        supplierCode = g.Supplier?.SupplierCode ?? "",
        supplierName = g.Supplier?.Name ?? "",
        projectId = g.ProjectId,
        projectName = g.Project?.Name ?? "",
        warehouseId = g.WarehouseId,
        warehouseName = g.Warehouse?.Name ?? "",
        storageLocation = g.StorageLocation,
        grnDate = g.GrnDate.ToString("yyyy-MM-dd"),
        receivedAtUtc = g.ReceivedAtUtc.ToString("o"),
        deliveryChallanNumber = g.DeliveryChallanNumber,
        deliveryChallanDate = g.DeliveryChallanDate?.ToString("yyyy-MM-dd"),
        vehicleNumber = g.VehicleNumber,
        deliveredBy = g.DeliveredBy,
        status = g.Status,
        inspectionChecklist = new
        {
            challanMatchesPO = g.ChallanMatchesPO,
            vehicleUnloadedSafely = g.VehicleUnloadedSafely,
            physicallyCounted = g.PhysicallyCounted,
            packagingIntact = g.PackagingIntact,
            batchTestCertsProvided = g.BatchTestCertsProvided,
            testCertificateNumber = g.TestCertificateNumber,
            materialsMeetSpecs = g.MaterialsMeetSpecs,
            binTagsAttached = g.BinTagsAttached,
            inspectionRemarks = g.InspectionRemarks,
            discrepancyIdentified = g.DiscrepancyIdentified,
            debitNoteRequired = g.DebitNoteRequired,
            debitNoteReason = g.DebitNoteReason
        },
        items = g.Lines.Select(l => new
        {
            id = l.Id,
            purchaseOrderItemId = l.PurchaseOrderLineId,
            materialId = l.MaterialId,
            materialCode = l.Material?.ItemCode ?? "",
            materialName = l.Material?.Name ?? "",
            specification = l.Material?.Specification,
            unitId = l.Material?.BaseUnitId,
            unitCode = l.Material?.BaseUnit?.Code ?? "",
            orderedQuantity = l.OrderedQuantity,
            previouslyReceivedQuantity = l.PreviouslyReceivedQuantity,
            poOutstandingQuantity = Math.Max(0, l.OrderedQuantity - l.PreviouslyReceivedQuantity),
            deliveredQuantity = l.DeliveredQuantity,
            acceptedQuantity = l.AcceptedQuantity,
            rejectedQuantity = l.RejectedQuantity,
            damagedQuantity = l.DamagedQuantity,
            shortQuantity = l.ShortQuantity,
            remarks = l.Remarks,
            storageLocation = l.StorageLocation,
            unitPrice = l.UnitPrice,
            totalAcceptedAmount = l.TotalAcceptedAmount
        }).ToList(),
        totalDeliveredQuantity = g.TotalDeliveredQuantity,
        totalAcceptedQuantity = g.TotalAcceptedQuantity,
        totalRejectedQuantity = g.TotalRejectedQuantity,
        totalDamagedQuantity = g.TotalDamagedQuantity,
        totalShortQuantity = g.TotalShortQuantity,
        totalAcceptedValue = g.TotalAcceptedValue,
        generalRemarks = g.GeneralRemarks,
        rejectionReason = g.RejectionReason,
        correctionNotes = g.CorrectionNotes,
        auditTrail = g.Audits.OrderBy(a => a.TimestampUtc).Select(a => new
        {
            id = a.Id,
            grnId = a.GoodsReceiptId,
            actorUserId = a.ActorUserId,
            actorName = a.ActorName,
            actorRole = a.ActorRole,
            action = a.Action,
            comments = a.Comments,
            timestampUtc = a.TimestampUtc.ToString("o")
        }).ToList(),
        receivedByUserId = g.ReceivedByUserId,
        receivedByName = g.ReceivedByName,
        inspectedByUserId = g.InspectedByUserId,
        inspectedByName = g.InspectedByName,
        inspectedAtUtc = g.InspectedAtUtc?.ToString("o"),
        approvedByUserId = g.ApprovedByUserId,
        approvedByName = g.ApprovedByName,
        approvedAtUtc = g.ApprovedAtUtc?.ToString("o"),
        postedByUserId = g.PostedByUserId,
        postedByName = g.PostedByName,
        postedAtUtc = g.PostedAtUtc?.ToString("o"),
        createdAtUtc = g.CreatedAtUtc.ToString("o"),
        updatedAtUtc = g.UpdatedAtUtc.ToString("o")
    };
}

public record InspectionChecklistRequest(
    bool ChallanMatchesPO,
    bool VehicleUnloadedSafely,
    bool PhysicallyCounted,
    bool PackagingIntact,
    bool BatchTestCertsProvided,
    string? TestCertificateNumber,
    bool MaterialsMeetSpecs,
    bool BinTagsAttached,
    string? InspectionRemarks,
    bool DiscrepancyIdentified,
    bool DebitNoteRequired,
    string? DebitNoteReason);

public record GrnLineRequest(
    string PurchaseOrderItemId,
    decimal DeliveredQuantity,
    decimal AcceptedQuantity,
    decimal RejectedQuantity,
    decimal DamagedQuantity,
    decimal ShortQuantity,
    string? Remarks,
    string? StorageLocation);

public record GrnWriteRequest(
    string? PurchaseOrderId,
    string? WarehouseId,
    string? StorageLocation,
    DateOnly GrnDate,
    string? DeliveryChallanNumber,
    DateOnly? DeliveryChallanDate,
    string? VehicleNumber,
    string? DeliveredBy,
    string? GeneralRemarks,
    InspectionChecklistRequest? InspectionChecklist,
    List<GrnLineRequest>? Items);
