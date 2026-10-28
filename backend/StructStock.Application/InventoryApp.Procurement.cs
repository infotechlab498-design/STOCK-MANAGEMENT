using Microsoft.EntityFrameworkCore;
using StructStock.Domain;

namespace StructStock.Application;

public partial class InventoryApp
{
    public async Task<object> ListPurchaseOrdersAsync(string? search, string? status, string? projectId, string? supplierId, int? page, int? pageSize, CancellationToken ct)
    {
        var list = await _db.PurchaseOrders
            .Include(p => p.Supplier).Include(p => p.Project).Include(p => p.Requisition)
            .Include(p => p.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(p => p.Audits)
            .AsNoTracking().ToListAsync(ct);
        var filtered = list.Where(p => _me.CanAccessProject(p.ProjectId)).ToList();
        if (!string.IsNullOrWhiteSpace(status) && status != "ALL") filtered = filtered.Where(p => p.Status == status).ToList();
        if (!string.IsNullOrWhiteSpace(projectId) && projectId != "ALL") filtered = filtered.Where(p => p.ProjectId == projectId).ToList();
        if (!string.IsNullOrWhiteSpace(supplierId) && supplierId != "ALL") filtered = filtered.Where(p => p.SupplierId == supplierId).ToList();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            filtered = filtered.Where(p => p.PoNumber.ToUpper().Contains(term) || (p.Supplier?.Name ?? "").ToUpper().Contains(term)).ToList();
        }

        return ApiResponse.Ok(Page(filtered.OrderByDescending(p => p.CreatedAtUtc).Select(MapPo).ToList(), page, pageSize));
    }

    public async Task<object> GetPurchaseOrderAsync(string id, CancellationToken ct)
    {
        var po = await LoadPo(id, ct) ?? throw new AppException(404, "Purchase order not found");
        if (!_me.CanAccessProject(po.ProjectId)) throw new AppException(403, "Forbidden");
        return ApiResponse.Ok(MapPo(po));
    }

    public async Task<object> GetSupplierPurchaseOrdersAsync(string supplierId, CancellationToken ct)
    {
        var list = await _db.PurchaseOrders
            .Include(p => p.Supplier).Include(p => p.Project)
            .Include(p => p.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(p => p.Audits)
            .AsNoTracking()
            .Where(p => p.SupplierId == supplierId)
            .ToListAsync(ct);
        return ApiResponse.Ok(list.Where(p => _me.CanAccessProject(p.ProjectId)).Select(MapPo).ToList());
    }

    public async Task<object> ApprovedRequisitionsForPoAsync(CancellationToken ct)
    {
        var reqs = await _db.Requisitions
            .Include(r => r.Project)
            .Include(r => r.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(r => r.Audits)
            .AsNoTracking()
            .Where(r => r.Status == "Approved")
            .ToListAsync(ct);
        return ApiResponse.Ok(reqs.Where(r => _me.CanAccessProject(r.ProjectId)).Select(MapRequisition).ToList());
    }

    public async Task<object> PendingDeliveriesAsync(CancellationToken ct)
    {
        var list = await _db.PurchaseOrders
            .Include(p => p.Supplier).Include(p => p.Project)
            .Include(p => p.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(p => p.Audits)
            .AsNoTracking()
            .Where(p => p.Status == "Issued" || p.Status == "PartiallyReceived")
            .ToListAsync(ct);
        var filtered = list.Where(p => _me.CanAccessProject(p.ProjectId))
            .OrderBy(p => p.ExpectedDeliveryDate)
            .Select(p => new
            {
                purchaseOrder = MapPo(p),
                outstandingQuantity = p.Lines.Sum(l => Math.Max(0, l.OrderedQuantity - l.ReceivedQuantity)),
                expectedDeliveryDate = p.ExpectedDeliveryDate.ToString("yyyy-MM-dd"),
                createGrnRoute = $"/grns/new?purchaseOrderId={p.Id}"
            }).ToList();
        return ApiResponse.Ok(filtered);
    }

    public async Task<object> CreatePurchaseOrderAsync(PoWriteRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProcurementOfficer");
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == req.SupplierId && s.IsActive, ct)
            ?? throw new AppException(400, "Active supplier is required");
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == req.ProjectId && p.IsActive, ct)
            ?? throw new AppException(400, "Active project is required");
        if (!_me.CanAccessProject(project.Id)) throw new AppException(403, "Forbidden project");
        if (req.Items == null || req.Items.Count == 0) throw new AppException(400, "At least one PO line is required");

        var settings = await Settings(ct);
        var po = new PurchaseOrder
        {
            Id = Ids.New("PO"),
            PoNumber = await NextNumber(settings.PrefixPurchaseOrder, ct),
            SupplierId = supplier.Id,
            RequisitionId = req.RequisitionId,
            ProjectId = project.Id,
            DeliveryLocation = req.DeliveryLocation?.Trim() ?? project.Location,
            OrderDate = req.OrderDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : req.OrderDate,
            ExpectedDeliveryDate = req.ExpectedDeliveryDate,
            Currency = string.IsNullOrWhiteSpace(req.Currency) ? settings.Currency : req.Currency!,
            PaymentTerms = req.PaymentTerms?.Trim() ?? supplier.PaymentTerms ?? "Net 30 Days",
            Notes = req.Notes,
            Status = "Draft",
            HeaderDiscount = req.HeaderDiscount,
            Freight = req.Freight,
            CreatedAtUtc = DateTime.UtcNow,
            CreatedByUserId = _me.UserId,
            CreatedByName = _me.FullName,
            Supplier = supplier,
            Project = project
        };

        foreach (var item in req.Items)
        {
            var material = await _db.Materials.Include(m => m.BaseUnit).FirstAsync(m => m.Id == item.MaterialId, ct);
            var lineSub = Money.Round2(item.OrderedQuantity * item.UnitRate - item.LineDiscount);
            var tax = Money.Round2(lineSub * item.TaxRate / 100m);
            po.Lines.Add(new PurchaseOrderLine
            {
                Id = Ids.New("POL"),
                PurchaseOrderId = po.Id,
                MaterialId = material.Id,
                RequisitionLineId = item.RequisitionItemId,
                OrderedQuantity = item.OrderedQuantity,
                UnitRate = item.UnitRate,
                LineDiscount = item.LineDiscount,
                TaxRate = item.TaxRate,
                TaxAmount = tax,
                LineTotal = Money.Round2(lineSub + tax),
                Notes = item.Notes,
                Material = material
            });
        }

        RecalcPoTotals(po);
        po.Audits.Add(AuditPo(po.Id, "DraftCreated", "Draft created"));
        _db.PurchaseOrders.Add(po);
        Notify("PurchaseOrder", "Created", "Info", "Purchase order drafted",
            $"{po.PoNumber} for {supplier.Name}",
            "PurchaseOrder", po.Id, po.PoNumber, $"/purchase-orders/{po.Id}",
            po.Status, po.ProjectId, null, null, null, "SuperAdmin", "InventoryManager", "ProcurementOfficer", "ProjectManager");
        await Save(ct);
        return ApiResponse.Ok(MapPo(po));
    }

    public async Task<object> UpdatePurchaseOrderAsync(string id, PoWriteRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProcurementOfficer");
        var po = await LoadPo(id, ct) ?? throw new AppException(404, "Purchase order not found");
        if (po.Status is not ("Draft" or "Rejected")) throw new AppException(400, "Only Draft or Rejected POs can be edited");
        if (!string.IsNullOrWhiteSpace(req.DeliveryLocation)) po.DeliveryLocation = req.DeliveryLocation.Trim();
        if (req.ExpectedDeliveryDate != default) po.ExpectedDeliveryDate = req.ExpectedDeliveryDate;
        po.PaymentTerms = req.PaymentTerms ?? po.PaymentTerms;
        po.Notes = req.Notes;
        po.HeaderDiscount = req.HeaderDiscount;
        po.Freight = req.Freight;
        po.Status = "Draft";
        po.UpdatedAtUtc = DateTime.UtcNow;
        if (req.Items != null)
        {
            _db.PurchaseOrderLines.RemoveRange(po.Lines);
            po.Lines.Clear();
            foreach (var item in req.Items)
            {
                var material = await _db.Materials.Include(m => m.BaseUnit).FirstAsync(m => m.Id == item.MaterialId, ct);
                var lineSub = Money.Round2(item.OrderedQuantity * item.UnitRate - item.LineDiscount);
                var tax = Money.Round2(lineSub * item.TaxRate / 100m);
                po.Lines.Add(new PurchaseOrderLine
                {
                    Id = Ids.New("POL"),
                    PurchaseOrderId = po.Id,
                    MaterialId = material.Id,
                    RequisitionLineId = item.RequisitionItemId,
                    OrderedQuantity = item.OrderedQuantity,
                    UnitRate = item.UnitRate,
                    LineDiscount = item.LineDiscount,
                    TaxRate = item.TaxRate,
                    TaxAmount = tax,
                    LineTotal = Money.Round2(lineSub + tax),
                    Notes = item.Notes,
                    Material = material
                });
            }
        }

        RecalcPoTotals(po);
        po.Audits.Add(AuditPo(po.Id, "Updated", "Updated"));
        await Save(ct);
        return ApiResponse.Ok(MapPo(po));
    }

    public async Task<object> SubmitPurchaseOrderAsync(string id, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProcurementOfficer");
        var po = await LoadPo(id, ct) ?? throw new AppException(404, "Purchase order not found");
        if (po.Status != "Draft") throw new AppException(400, "Only Draft POs can be submitted");
        po.Status = "PendingApproval";
        po.UpdatedAtUtc = DateTime.UtcNow;
        po.Audits.Add(AuditPo(po.Id, "Submitted", "Submitted for approval"));
        await Save(ct);
        return ApiResponse.Ok(MapPo(po));
    }

    public async Task<object> ApprovePurchaseOrderAsync(string id, string? comments, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var po = await LoadPo(id, ct) ?? throw new AppException(404, "Purchase order not found");
        if (po.Status != "PendingApproval") throw new AppException(400, "Only PendingApproval POs can be approved");
        await EnsureCanApprove(po.CreatedByUserId, ct);
        po.Status = "Approved";
        po.ApprovedByUserId = _me.UserId;
        po.ApprovedByName = _me.FullName;
        po.ApprovedAtUtc = DateTime.UtcNow;
        po.Audits.Add(AuditPo(po.Id, "Approved", comments ?? "Approved"));
        await Save(ct);
        return ApiResponse.Ok(MapPo(po));
    }

    public async Task<object> RejectPurchaseOrderAsync(string id, string? reason, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProjectManager");
        var po = await LoadPo(id, ct) ?? throw new AppException(404, "Purchase order not found");
        if (po.Status != "PendingApproval") throw new AppException(400, "Only PendingApproval POs can be rejected");
        await EnsureCanApprove(po.CreatedByUserId, ct);
        po.Status = "Rejected";
        po.RejectionReason = reason ?? "Rejected";
        po.Audits.Add(AuditPo(po.Id, "Rejected", po.RejectionReason));
        await Save(ct);
        return ApiResponse.Ok(MapPo(po));
    }

    public async Task<object> IssuePurchaseOrderAsync(string id, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProcurementOfficer");
        var po = await LoadPo(id, ct) ?? throw new AppException(404, "Purchase order not found");
        if (po.Status != "Approved") throw new AppException(400, "Only Approved POs can be issued");
        po.Status = "Issued";
        po.IssuedByUserId = _me.UserId;
        po.IssuedByName = _me.FullName;
        po.IssuedAtUtc = DateTime.UtcNow;
        po.Audits.Add(AuditPo(po.Id, "Issued", "Issued to supplier"));
        Notify("PurchaseOrder", "Issued", "Warning", "Purchase order issued",
            $"{po.PoNumber} awaiting delivery",
            "PurchaseOrder", po.Id, po.PoNumber, $"/pending-deliveries",
            po.Status, po.ProjectId, null, null, null, "SuperAdmin", "InventoryManager", "ProcurementOfficer", "Storekeeper");
        await Save(ct);
        return ApiResponse.Ok(MapPo(po));
    }

    public async Task<object> CancelPurchaseOrderAsync(string id, string? reason, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProcurementOfficer");
        var po = await LoadPo(id, ct) ?? throw new AppException(404, "Purchase order not found");
        if (po.Status is "FullyReceived" or "Cancelled") throw new AppException(400, "Cannot cancel this PO");
        po.Status = "Cancelled";
        po.CancellationReason = reason ?? "Cancelled";
        po.Audits.Add(AuditPo(po.Id, "Cancelled", po.CancellationReason));
        await Save(ct);
        return ApiResponse.Ok(MapPo(po));
    }

    public async Task<object> PurchaseOrderHistoryAsync(string id, CancellationToken ct)
    {
        var po = await LoadPo(id, ct) ?? throw new AppException(404, "Purchase order not found");
        return ApiResponse.Ok(po.Audits.OrderBy(a => a.TimestampUtc).Select(a => new
        {
            id = a.Id,
            poId = a.PurchaseOrderId,
            actorUserId = a.ActorUserId,
            actorName = a.ActorName,
            actorRole = a.ActorRole,
            action = a.Action,
            comments = a.Comments,
            timestampUtc = a.TimestampUtc.ToString("o")
        }));
    }

    public async Task<object> ListQuotationsAsync(CancellationToken ct)
    {
        var list = await _db.Quotations.Include(q => q.Supplier)
            .Include(q => q.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .AsNoTracking().OrderByDescending(q => q.CreatedAtUtc).ToListAsync(ct);
        return ApiResponse.Ok(list.Select(MapQuotation).ToList());
    }

    public async Task<object> CreateQuotationAsync(QuotationWriteRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager", "ProcurementOfficer");
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == req.SupplierId, ct)
            ?? throw new AppException(400, "Supplier required");
        var settings = await Settings(ct);
        var q = new Quotation
        {
            Id = Ids.New("QT"),
            QuotationReference = await NextNumber(settings.PrefixQuotation, ct),
            SupplierId = supplier.Id,
            QuoteDate = req.Date == default ? DateOnly.FromDateTime(DateTime.UtcNow) : req.Date,
            ValidUntil = req.ValidUntil,
            Currency = req.Currency ?? settings.Currency,
            PaymentTerms = req.PaymentTerms ?? "",
            Notes = req.Notes,
            CreatedAtUtc = DateTime.UtcNow,
            Supplier = supplier
        };
        foreach (var item in req.Items ?? new())
        {
            var material = await _db.Materials.Include(m => m.BaseUnit).FirstAsync(m => m.Id == item.MaterialId, ct);
            q.Lines.Add(new QuotationLine
            {
                Id = Ids.New("QTL"),
                QuotationId = q.Id,
                MaterialId = material.Id,
                QuotedQuantity = item.QuotedQuantity,
                UnitRate = item.UnitRate,
                Discount = item.Discount,
                TaxRate = item.TaxRate,
                EstimatedFreight = item.EstimatedFreight,
                LineTotal = Money.Round2(item.QuotedQuantity * item.UnitRate - item.Discount + item.EstimatedFreight),
                Material = material
            });
        }

        _db.Quotations.Add(q);
        await Save(ct);
        return ApiResponse.Ok(MapQuotation(q));
    }

    public async Task<object> CompareQuotationsAsync(CancellationToken ct)
    {
        var list = await _db.Quotations.Include(q => q.Supplier)
            .Include(q => q.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .AsNoTracking().ToListAsync(ct);
        var materialMap = new Dictionary<string, object>();
        foreach (var q in list)
        {
            foreach (var item in q.Lines)
            {
                if (!materialMap.TryGetValue(item.MaterialId, out var entryObj))
                {
                    entryObj = new Dictionary<string, object?>
                    {
                        ["materialId"] = item.MaterialId,
                        ["materialCode"] = item.Material?.ItemCode ?? "",
                        ["materialName"] = item.Material?.Name ?? "",
                        ["unitCode"] = item.Material?.BaseUnit?.Code ?? "",
                        ["quotes"] = new List<object>()
                    };
                    materialMap[item.MaterialId] = entryObj;
                }

                ((List<object>)((Dictionary<string, object?>)entryObj)["quotes"]!).Add(new
                {
                    quotationId = q.Id,
                    quotationReference = q.QuotationReference,
                    supplierId = q.SupplierId,
                    supplierName = q.Supplier?.Name ?? "",
                    unitRate = item.UnitRate,
                    discount = item.Discount,
                    taxRate = item.TaxRate,
                    estimatedFreight = item.EstimatedFreight,
                    lineTotal = item.LineTotal,
                    validUntil = q.ValidUntil.ToString("yyyy-MM-dd")
                });
            }
        }

        return ApiResponse.Ok(materialMap.Values.ToList());
    }

    private static void RecalcPoTotals(PurchaseOrder po)
    {
        po.Subtotal = Money.Round2(po.Lines.Sum(l => l.OrderedQuantity * l.UnitRate));
        po.ItemsDiscount = Money.Round2(po.Lines.Sum(l => l.LineDiscount));
        po.TotalDiscount = Money.Round2(po.ItemsDiscount + po.HeaderDiscount);
        po.TaxAmount = Money.Round2(po.Lines.Sum(l => l.TaxAmount));
        po.GrandTotal = Money.Round2(po.Subtotal - po.TotalDiscount + po.TaxAmount + po.Freight);
    }

    private async Task<PurchaseOrder?> LoadPo(string id, CancellationToken ct) =>
        await _db.PurchaseOrders
            .Include(p => p.Supplier).Include(p => p.Project).Include(p => p.Requisition)
            .Include(p => p.Lines).ThenInclude(l => l.Material).ThenInclude(m => m!.BaseUnit)
            .Include(p => p.Audits)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

    private PurchaseOrderAudit AuditPo(string id, string action, string? comments) => new()
    {
        Id = Ids.New("POA"),
        PurchaseOrderId = id,
        ActorUserId = _me.UserId,
        ActorName = _me.FullName,
        ActorRole = _me.PrimaryRole,
        Action = action,
        Comments = comments,
        TimestampUtc = DateTime.UtcNow
    };

    private static object MapPo(PurchaseOrder p)
    {
        var ordered = p.Lines.Sum(l => l.OrderedQuantity);
        var received = p.Lines.Sum(l => l.ReceivedQuantity);
        return new
        {
            id = p.Id,
            poNumber = p.PoNumber,
            supplierId = p.SupplierId,
            supplierCode = p.Supplier?.SupplierCode ?? "",
            supplierName = p.Supplier?.Name ?? "",
            supplierContact = p.Supplier?.ContactPerson ?? "",
            requisitionId = p.RequisitionId,
            requisitionNumber = p.Requisition?.RequisitionNumber,
            projectId = p.ProjectId,
            projectCode = p.Project?.Code ?? "",
            projectName = p.Project?.Name ?? "",
            deliveryLocation = p.DeliveryLocation,
            orderDate = p.OrderDate.ToString("yyyy-MM-dd"),
            expectedDeliveryDate = p.ExpectedDeliveryDate.ToString("yyyy-MM-dd"),
            currency = p.Currency,
            paymentTerms = p.PaymentTerms,
            notes = p.Notes,
            status = p.Status,
            items = p.Lines.Select(l => new
            {
                id = l.Id,
                parentPoId = l.PurchaseOrderId,
                materialId = l.MaterialId,
                materialCode = l.Material?.ItemCode ?? "",
                materialName = l.Material?.Name ?? "",
                specification = l.Material?.Specification,
                unitId = l.Material?.BaseUnitId ?? "",
                unitCode = l.Material?.BaseUnit?.Code ?? "",
                requisitionItemId = l.RequisitionLineId,
                orderedQuantity = l.OrderedQuantity,
                receivedQuantity = l.ReceivedQuantity,
                outstandingQuantity = Math.Max(0, l.OrderedQuantity - l.ReceivedQuantity),
                unitRate = l.UnitRate,
                lineDiscount = l.LineDiscount,
                taxRate = l.TaxRate,
                taxAmount = l.TaxAmount,
                lineTotal = l.LineTotal,
                notes = l.Notes
            }).ToList(),
            subtotal = p.Subtotal,
            subTotal = p.Subtotal,
            orderedQuantity = ordered,
            receivedQuantity = received,
            outstandingQuantity = Math.Max(0, ordered - received),
            itemsDiscount = p.ItemsDiscount,
            headerDiscount = p.HeaderDiscount,
            totalDiscount = p.TotalDiscount,
            taxAmount = p.TaxAmount,
            freight = p.Freight,
            grandTotal = p.GrandTotal,
            approvalHistory = p.Audits.OrderBy(a => a.TimestampUtc).Select(a => new
            {
                id = a.Id,
                poId = a.PurchaseOrderId,
                actorUserId = a.ActorUserId,
                actorName = a.ActorName,
                actorRole = a.ActorRole,
                action = a.Action,
                comments = a.Comments,
                timestampUtc = a.TimestampUtc.ToString("o")
            }).ToList(),
            rejectionReason = p.RejectionReason,
            cancellationReason = p.CancellationReason,
            approvedByUserId = p.ApprovedByUserId,
            approvedByName = p.ApprovedByName,
            approvedAtUtc = p.ApprovedAtUtc?.ToString("o"),
            issuedByUserId = p.IssuedByUserId,
            issuedByName = p.IssuedByName,
            issuedAtUtc = p.IssuedAtUtc?.ToString("o"),
            createdAtUtc = p.CreatedAtUtc.ToString("o"),
            updatedAtUtc = p.UpdatedAtUtc?.ToString("o"),
            createdByUserId = p.CreatedByUserId,
            createdByName = p.CreatedByName
        };
    }

    private static object MapQuotation(Quotation q) => new
    {
        id = q.Id,
        quotationReference = q.QuotationReference,
        supplierId = q.SupplierId,
        supplierName = q.Supplier?.Name ?? "",
        date = q.QuoteDate.ToString("yyyy-MM-dd"),
        validUntil = q.ValidUntil.ToString("yyyy-MM-dd"),
        currency = q.Currency,
        paymentTerms = q.PaymentTerms,
        notes = q.Notes,
        items = q.Lines.Select(l => new
        {
            materialId = l.MaterialId,
            materialCode = l.Material?.ItemCode ?? "",
            materialName = l.Material?.Name ?? "",
            unitCode = l.Material?.BaseUnit?.Code ?? "",
            quotedQuantity = l.QuotedQuantity,
            unitRate = l.UnitRate,
            discount = l.Discount,
            taxRate = l.TaxRate,
            estimatedFreight = l.EstimatedFreight,
            lineTotal = l.LineTotal
        }).ToList(),
        createdAtUtc = q.CreatedAtUtc.ToString("o")
    };
}

public record PoLineRequest(
    string MaterialId,
    string? RequisitionItemId,
    decimal OrderedQuantity,
    decimal UnitRate,
    decimal LineDiscount,
    decimal TaxRate,
    string? Notes);

public record PoWriteRequest(
    string? SupplierId,
    string? RequisitionId,
    string? ProjectId,
    string? DeliveryLocation,
    DateOnly OrderDate,
    DateOnly ExpectedDeliveryDate,
    string? Currency,
    string? PaymentTerms,
    string? Notes,
    decimal HeaderDiscount,
    decimal Freight,
    List<PoLineRequest>? Items);

public record QuotationLineRequest(
    string MaterialId,
    decimal QuotedQuantity,
    decimal UnitRate,
    decimal Discount,
    decimal TaxRate,
    decimal EstimatedFreight);

public record QuotationWriteRequest(
    string? SupplierId,
    DateOnly Date,
    DateOnly ValidUntil,
    string? Currency,
    string? PaymentTerms,
    string? Notes,
    List<QuotationLineRequest>? Items);
