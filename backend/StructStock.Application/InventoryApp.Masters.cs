using Microsoft.EntityFrameworkCore;
using StructStock.Domain;

namespace StructStock.Application;

public partial class InventoryApp
{
    public async Task<object> ListCategoriesAsync(CancellationToken ct)
    {
        var items = await _db.Categories.AsNoTracking().OrderBy(c => c.Name).ToListAsync(ct);
        return ApiResponse.Ok(items.Select(c => new
        {
            id = c.Id,
            code = c.Code,
            name = c.Name,
            description = c.Description,
            isActive = c.IsActive
        }));
    }

    public async Task<object> CreateCategoryAsync(string code, string name, string? description, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
        {
            throw new AppException(400, "Category Code and Name are required");
        }

        var normalized = code.Trim().ToUpperInvariant();
        if (await _db.Categories.AnyAsync(c => c.Code == normalized, ct))
        {
            throw new AppException(409, "Category code already exists");
        }

        var cat = new MaterialCategory
        {
            Id = Ids.New("CAT"),
            Code = normalized,
            Name = name.Trim(),
            Description = description,
            IsActive = true
        };
        _db.Categories.Add(cat);
        await Save(ct);
        return ApiResponse.Ok(new { id = cat.Id, code = cat.Code, name = cat.Name, description = cat.Description, isActive = cat.IsActive });
    }

    public async Task<object> UpdateCategoryAsync(string id, string name, string? description, bool? isActive, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        var cat = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new AppException(404, "Category not found");
        if (!string.IsNullOrWhiteSpace(name)) cat.Name = name.Trim();
        cat.Description = description;
        if (isActive.HasValue) cat.IsActive = isActive.Value;
        await Save(ct);
        return ApiResponse.Ok(new { id = cat.Id, code = cat.Code, name = cat.Name, description = cat.Description, isActive = cat.IsActive });
    }

    public async Task<object> ListUnitsAsync(CancellationToken ct)
    {
        var items = await _db.Units.AsNoTracking().OrderBy(u => u.Code).ToListAsync(ct);
        return ApiResponse.Ok(items.Select(u => new
        {
            id = u.Id,
            code = u.Code,
            name = u.Name,
            symbol = u.Symbol,
            isActive = u.IsActive
        }));
    }

    public async Task<object> CreateUnitAsync(string code, string name, string symbol, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
        {
            throw new AppException(400, "Unit code and name are required");
        }

        var normalized = code.Trim().ToUpperInvariant();
        if (await _db.Units.AnyAsync(u => u.Code == normalized, ct))
        {
            throw new AppException(409, "Unit code already exists");
        }

        var unit = new UnitOfMeasure
        {
            Id = Ids.New("UNT"),
            Code = normalized,
            Name = name.Trim(),
            Symbol = string.IsNullOrWhiteSpace(symbol) ? normalized.ToLowerInvariant() : symbol.Trim(),
            IsActive = true
        };
        _db.Units.Add(unit);
        await Save(ct);
        return ApiResponse.Ok(new { id = unit.Id, code = unit.Code, name = unit.Name, symbol = unit.Symbol, isActive = unit.IsActive });
    }

    public async Task<object> UpdateUnitAsync(string id, string name, string? symbol, bool? isActive, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        var unit = await _db.Units.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new AppException(404, "Unit not found");
        if (!string.IsNullOrWhiteSpace(name)) unit.Name = name.Trim();
        if (symbol != null) unit.Symbol = symbol.Trim();
        if (isActive.HasValue) unit.IsActive = isActive.Value;
        await Save(ct);
        return ApiResponse.Ok(new { id = unit.Id, code = unit.Code, name = unit.Name, symbol = unit.Symbol, isActive = unit.IsActive });
    }

    public async Task<object> ListUnitConversionsAsync(string? materialId, CancellationToken ct)
    {
        var query = _db.UnitConversions
            .Include(c => c.FromUnit)
            .Include(c => c.ToUnit)
            .AsNoTracking()
            .AsQueryable();
        if (!string.IsNullOrWhiteSpace(materialId))
        {
            query = query.Where(c => c.MaterialId == null || c.MaterialId == materialId);
        }

        var items = await query.ToListAsync(ct);
        return ApiResponse.Ok(items.Select(c => new
        {
            id = c.Id,
            materialId = c.MaterialId,
            fromUnitId = c.FromUnitId,
            fromUnitCode = c.FromUnit?.Code ?? "",
            toUnitId = c.ToUnitId,
            toUnitCode = c.ToUnit?.Code ?? "",
            conversionFactor = c.ConversionFactor,
            description = c.Description,
            isActive = c.IsActive
        }));
    }

    public async Task<object> CreateUnitConversionAsync(
        string fromUnitId, string toUnitId, decimal conversionFactor, string? materialId, string? description, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        var from = await _db.Units.FirstOrDefaultAsync(u => u.Id == fromUnitId, ct)
            ?? throw new AppException(400, "From unit not found");
        var to = await _db.Units.FirstOrDefaultAsync(u => u.Id == toUnitId, ct)
            ?? throw new AppException(400, "To unit not found");
        if (conversionFactor <= 0) throw new AppException(400, "Conversion factor must be positive");

        var row = new UnitConversion
        {
            Id = Ids.New("CNV"),
            MaterialId = materialId,
            FromUnitId = from.Id,
            ToUnitId = to.Id,
            ConversionFactor = conversionFactor,
            Description = description,
            IsActive = true
        };
        _db.UnitConversions.Add(row);
        await Save(ct);
        return ApiResponse.Ok(new
        {
            id = row.Id,
            materialId = row.MaterialId,
            fromUnitId = row.FromUnitId,
            fromUnitCode = from.Code,
            toUnitId = row.ToUnitId,
            toUnitCode = to.Code,
            conversionFactor = row.ConversionFactor,
            description = row.Description,
            isActive = row.IsActive
        });
    }

    public async Task<object> ListMaterialsAsync(string? search, string? categoryId, string? status, CancellationToken ct)
    {
        var query = _db.Materials.Include(m => m.Category).Include(m => m.BaseUnit).AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            query = query.Where(m => m.NormalizedItemCode.Contains(term) || m.Name.ToUpper().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(categoryId) && categoryId != "ALL")
        {
            query = query.Where(m => m.CategoryId == categoryId);
        }

        if (status == "Active") query = query.Where(m => m.IsActive);
        if (status == "Inactive") query = query.Where(m => !m.IsActive);

        var items = await query.OrderBy(m => m.ItemCode).ToListAsync(ct);
        return ApiResponse.Ok(items.Select(MapMaterial).ToList());
    }

    public async Task<object> GetMaterialAsync(string id, CancellationToken ct)
    {
        var m = await _db.Materials.Include(x => x.Category).Include(x => x.BaseUnit)
            .FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new AppException(404, $"Material with ID '{id}' was not found");
        return ApiResponse.Ok(MapMaterial(m));
    }

    public async Task<object> CreateMaterialAsync(CreateMaterialRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        if (string.IsNullOrWhiteSpace(req.ItemCode)) throw new AppException(400, "ItemCode is required");
        if (string.IsNullOrWhiteSpace(req.Name)) throw new AppException(400, "Material Name is required");
        var code = req.ItemCode.Trim().ToUpperInvariant();
        if (await _db.Materials.AnyAsync(m => m.NormalizedItemCode == code, ct))
        {
            throw new AppException(409, "A material with this ItemCode already exists");
        }

        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == req.CategoryId && c.IsActive, ct)
            ?? throw new AppException(400, "Specified Category does not exist or is inactive");
        var unit = await _db.Units.FirstOrDefaultAsync(u => u.Id == req.BaseUnitId && u.IsActive, ct)
            ?? throw new AppException(400, "Specified Base Unit does not exist or is inactive");
        if (req.MinimumStockLevel < 0) throw new AppException(400, "Minimum stock level must be a non-negative decimal");
        if (req.ReorderLevel < req.MinimumStockLevel)
        {
            throw new AppException(400, "Reorder level must be greater than or equal to minimum stock level");
        }

        var material = new Material
        {
            Id = Ids.New("MAT"),
            ItemCode = req.ItemCode.Trim(),
            NormalizedItemCode = code,
            Name = req.Name.Trim(),
            Description = req.Description,
            Specification = req.Specification,
            CategoryId = category.Id,
            BaseUnitId = unit.Id,
            MinimumStockLevel = req.MinimumStockLevel,
            ReorderLevel = req.ReorderLevel,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow,
            CreatedByUserId = _me.UserId,
            Category = category,
            BaseUnit = unit
        };
        _db.Materials.Add(material);
        After(c => _live.PublishAsync("document.changed", new { documentType = "Material", id = material.Id, status = "Active", targetRoute = "/materials" }, null, null, ct: c));
        await Save(ct);
        return ApiResponse.Ok(MapMaterial(material));
    }

    public async Task<object> UpdateMaterialAsync(string id, UpdateMaterialRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        var material = await _db.Materials.Include(m => m.Category).Include(m => m.BaseUnit)
            .FirstOrDefaultAsync(m => m.Id == id, ct) ?? throw new AppException(404, $"Material with ID '{id}' was not found");
        if (string.IsNullOrWhiteSpace(req.Name)) throw new AppException(400, "Material Name is required");
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == req.CategoryId && c.IsActive, ct)
            ?? throw new AppException(400, "Specified Category does not exist or is inactive");
        var unit = await _db.Units.FirstOrDefaultAsync(u => u.Id == req.BaseUnitId && u.IsActive, ct)
            ?? throw new AppException(400, "Specified Base Unit does not exist or is inactive");
        if (req.MinimumStockLevel < 0) throw new AppException(400, "Minimum stock level must be a non-negative decimal");
        if (req.ReorderLevel < req.MinimumStockLevel)
        {
            throw new AppException(400, "Reorder level must be greater than or equal to minimum stock level");
        }

        material.Name = req.Name.Trim();
        material.Description = req.Description;
        material.Specification = req.Specification;
        material.CategoryId = category.Id;
        material.BaseUnitId = unit.Id;
        material.MinimumStockLevel = req.MinimumStockLevel;
        material.ReorderLevel = req.ReorderLevel;
        material.UpdatedAtUtc = DateTime.UtcNow;
        material.UpdatedByUserId = _me.UserId;
        material.Category = category;
        material.BaseUnit = unit;
        await Save(ct);
        return ApiResponse.Ok(MapMaterial(material));
    }

    public async Task<object> PatchMaterialStatusAsync(string id, bool isActive, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        var material = await _db.Materials.Include(m => m.Category).Include(m => m.BaseUnit)
            .FirstOrDefaultAsync(m => m.Id == id, ct) ?? throw new AppException(404, $"Material with ID '{id}' was not found");
        material.IsActive = isActive;
        material.UpdatedAtUtc = DateTime.UtcNow;
        await Save(ct);
        return ApiResponse.Ok(new { id = material.Id, isActive = material.IsActive });
    }

    public async Task<object> ListProjectsAsync(CancellationToken ct)
    {
        var projects = await _db.Projects.AsNoTracking().Where(p => p.IsActive).OrderBy(p => p.Code).ToListAsync(ct);
        var filtered = projects.Where(p => _me.CanAccessProject(p.Id)).ToList();
        return ApiResponse.Ok(filtered.Select(p => new
        {
            id = p.Id,
            code = p.Code,
            name = p.Name,
            location = p.Location,
            projectManagerId = p.ProjectManagerId,
            projectManagerName = p.ProjectManagerName,
            isActive = p.IsActive,
            startDate = p.StartDate?.ToString("yyyy-MM-dd"),
            targetCompletionDate = p.TargetCompletionDate?.ToString("yyyy-MM-dd")
        }));
    }

    public async Task<object> CreateProjectAsync(CreateProjectRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        if (string.IsNullOrWhiteSpace(req.Code) || string.IsNullOrWhiteSpace(req.Name))
        {
            throw new AppException(400, "Project code and name are required");
        }

        var code = req.Code.Trim().ToUpperInvariant();
        if (await _db.Projects.AnyAsync(p => p.Code == code, ct)) throw new AppException(409, "Project code already exists");
        var project = new Project
        {
            Id = Ids.New("PRJ"),
            Code = code,
            Name = req.Name.Trim(),
            Location = req.Location?.Trim() ?? "",
            ProjectManagerId = req.ProjectManagerId,
            ProjectManagerName = req.ProjectManagerName?.Trim() ?? "",
            IsActive = true,
            StartDate = req.StartDate,
            TargetCompletionDate = req.TargetCompletionDate
        };
        _db.Projects.Add(project);
        await Save(ct);
        return ApiResponse.Ok(new
        {
            id = project.Id,
            code = project.Code,
            name = project.Name,
            location = project.Location,
            projectManagerId = project.ProjectManagerId,
            projectManagerName = project.ProjectManagerName,
            isActive = project.IsActive,
            startDate = project.StartDate?.ToString("yyyy-MM-dd"),
            targetCompletionDate = project.TargetCompletionDate?.ToString("yyyy-MM-dd")
        });
    }

    public async Task<object> UpdateProjectAsync(string id, CreateProjectRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new AppException(404, "Project not found");
        if (!string.IsNullOrWhiteSpace(req.Name)) project.Name = req.Name.Trim();
        if (req.Location != null) project.Location = req.Location.Trim();
        project.ProjectManagerId = req.ProjectManagerId;
        if (req.ProjectManagerName != null) project.ProjectManagerName = req.ProjectManagerName.Trim();
        project.StartDate = req.StartDate;
        project.TargetCompletionDate = req.TargetCompletionDate;
        await Save(ct);
        return ApiResponse.Ok(new
        {
            id = project.Id,
            code = project.Code,
            name = project.Name,
            location = project.Location,
            projectManagerId = project.ProjectManagerId,
            projectManagerName = project.ProjectManagerName,
            isActive = project.IsActive,
            startDate = project.StartDate?.ToString("yyyy-MM-dd"),
            targetCompletionDate = project.TargetCompletionDate?.ToString("yyyy-MM-dd")
        });
    }

    public async Task<object> PatchProjectStatusAsync(string id, bool isActive, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new AppException(404, "Project not found");
        project.IsActive = isActive;
        await Save(ct);
        return ApiResponse.Ok(new { id = project.Id, isActive = project.IsActive });
    }

    public async Task<object> ListWarehousesAsync(CancellationToken ct)
    {
        var warehouses = await _db.Warehouses.Include(w => w.Project).AsNoTracking()
            .Where(w => w.IsActive).OrderBy(w => w.Code).ToListAsync(ct);
        var balances = await _db.Balances.AsNoTracking().ToListAsync(ct);
        var filtered = warehouses.Where(w => _me.CanAccessLocation(w.ProjectId, w.Id)).ToList();
        return ApiResponse.Ok(filtered.Select(w => new
        {
            id = w.Id,
            code = w.Code,
            name = w.Name,
            type = w.WarehouseType,
            projectId = w.ProjectId,
            projectName = w.Project?.Name ?? "",
            location = w.Location,
            isActive = w.IsActive,
            skuCount = balances.Count(b => b.WarehouseId == w.Id && b.QuantityOnHand > 0)
        }));
    }

    public async Task<object> CreateWarehouseAsync(CreateWarehouseRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        if (string.IsNullOrWhiteSpace(req.Code) || string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.ProjectId))
        {
            throw new AppException(400, "Warehouse code, name, and project are required");
        }

        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == req.ProjectId, ct)
            ?? throw new AppException(400, "Project not found");
        var code = req.Code.Trim().ToUpperInvariant();
        if (await _db.Warehouses.AnyAsync(w => w.Code == code, ct)) throw new AppException(409, "Warehouse code already exists");
        var wh = new Warehouse
        {
            Id = Ids.New("WH"),
            Code = code,
            Name = req.Name.Trim(),
            WarehouseType = string.IsNullOrWhiteSpace(req.Type) ? "Project Site Store" : req.Type.Trim(),
            ProjectId = project.Id,
            Location = req.Location?.Trim() ?? project.Location,
            IsActive = true,
            Project = project
        };
        _db.Warehouses.Add(wh);
        await Save(ct);
        return ApiResponse.Ok(new
        {
            id = wh.Id,
            code = wh.Code,
            name = wh.Name,
            type = wh.WarehouseType,
            projectId = wh.ProjectId,
            projectName = project.Name,
            location = wh.Location,
            isActive = wh.IsActive,
            skuCount = 0
        });
    }

    public async Task<object> UpdateWarehouseAsync(string id, CreateWarehouseRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        var wh = await _db.Warehouses.Include(w => w.Project).FirstOrDefaultAsync(w => w.Id == id, ct)
            ?? throw new AppException(404, "Warehouse not found");
        if (!string.IsNullOrWhiteSpace(req.Name)) wh.Name = req.Name.Trim();
        if (!string.IsNullOrWhiteSpace(req.Type)) wh.WarehouseType = req.Type.Trim();
        if (req.Location != null) wh.Location = req.Location.Trim();
        if (!string.IsNullOrWhiteSpace(req.ProjectId) && req.ProjectId != wh.ProjectId)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == req.ProjectId, ct)
                ?? throw new AppException(400, "Project not found");
            wh.ProjectId = project.Id;
            wh.Project = project;
        }

        await Save(ct);
        return ApiResponse.Ok(new
        {
            id = wh.Id,
            code = wh.Code,
            name = wh.Name,
            type = wh.WarehouseType,
            projectId = wh.ProjectId,
            projectName = wh.Project?.Name ?? "",
            location = wh.Location,
            isActive = wh.IsActive,
            skuCount = await _db.Balances.CountAsync(b => b.WarehouseId == wh.Id && b.QuantityOnHand > 0, ct)
        });
    }

    public async Task<object> PatchWarehouseStatusAsync(string id, bool isActive, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "InventoryManager");
        var wh = await _db.Warehouses.FirstOrDefaultAsync(w => w.Id == id, ct)
            ?? throw new AppException(404, "Warehouse not found");
        wh.IsActive = isActive;
        await Save(ct);
        return ApiResponse.Ok(new { id = wh.Id, isActive = wh.IsActive });
    }

    public async Task<object> ListSuppliersAsync(string? search, string? status, CancellationToken ct)
    {
        var query = _db.Suppliers.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            query = query.Where(s => s.NormalizedSupplierCode.Contains(term) || s.Name.ToUpper().Contains(term));
        }

        if (status == "Active") query = query.Where(s => s.IsActive);
        if (status == "Inactive") query = query.Where(s => !s.IsActive);
        var items = await query.OrderBy(s => s.Name).ToListAsync(ct);
        return ApiResponse.Ok(items.Select(MapSupplier).ToList());
    }

    public async Task<object> GetSupplierAsync(string id, CancellationToken ct)
    {
        var s = await _db.Suppliers.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new AppException(404, "Supplier not found");
        return ApiResponse.Ok(MapSupplier(s));
    }

    public async Task<object> CreateSupplierAsync(CreateSupplierRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "ProcurementOfficer");
        if (string.IsNullOrWhiteSpace(req.SupplierCode) || string.IsNullOrWhiteSpace(req.Name))
        {
            throw new AppException(400, "Supplier code and name are required");
        }

        var code = req.SupplierCode.Trim().ToUpperInvariant();
        if (await _db.Suppliers.AnyAsync(s => s.NormalizedSupplierCode == code, ct))
        {
            throw new AppException(409, "Supplier code already exists");
        }

        var supplier = new Supplier
        {
            Id = Ids.New("SUP"),
            SupplierCode = req.SupplierCode.Trim(),
            NormalizedSupplierCode = code,
            Name = req.Name.Trim(),
            ContactPerson = req.ContactPerson?.Trim() ?? "",
            Phone = req.Phone?.Trim() ?? "",
            Email = req.Email?.Trim() ?? "",
            Address = req.Address?.Trim() ?? "",
            TaxReference = req.TaxReference,
            PaymentTerms = req.PaymentTerms,
            Notes = req.Notes,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow,
            CreatedByUserId = _me.UserId
        };
        _db.Suppliers.Add(supplier);
        await Save(ct);
        return ApiResponse.Ok(MapSupplier(supplier));
    }

    public async Task<object> UpdateSupplierAsync(string id, CreateSupplierRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "ProcurementOfficer");
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new AppException(404, "Supplier not found");
        if (!string.IsNullOrWhiteSpace(req.Name)) supplier.Name = req.Name.Trim();
        supplier.ContactPerson = req.ContactPerson?.Trim() ?? supplier.ContactPerson;
        supplier.Phone = req.Phone?.Trim() ?? supplier.Phone;
        supplier.Email = req.Email?.Trim() ?? supplier.Email;
        supplier.Address = req.Address?.Trim() ?? supplier.Address;
        supplier.TaxReference = req.TaxReference;
        supplier.PaymentTerms = req.PaymentTerms;
        supplier.Notes = req.Notes;
        supplier.UpdatedAtUtc = DateTime.UtcNow;
        supplier.UpdatedByUserId = _me.UserId;
        await Save(ct);
        return ApiResponse.Ok(MapSupplier(supplier));
    }

    public async Task<object> PatchSupplierStatusAsync(string id, bool isActive, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin", "ProcurementOfficer");
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new AppException(404, "Supplier not found");
        supplier.IsActive = isActive;
        supplier.UpdatedAtUtc = DateTime.UtcNow;
        await Save(ct);
        return ApiResponse.Ok(new { id = supplier.Id, isActive = supplier.IsActive });
    }

    public async Task<object> GetSettingsAsync(CancellationToken ct)
    {
        var s = await Settings(ct);
        return ApiResponse.Ok(new
        {
            valuationPolicy = s.ValuationPolicy,
            valuationDescription = s.ValuationDescription,
            negativeStockAllowed = s.NegativeStockAllowed,
            selfApprovalAllowed = s.SelfApprovalAllowed,
            requireGrnInspectionBeforePosting = s.RequireGrnInspectionBeforePosting,
            jwtExpirySeconds = s.JwtExpirySeconds,
            currency = s.Currency,
            auditTrailRetentionDays = s.AuditTrailRetentionDays,
            prefixRequisition = s.PrefixRequisition,
            prefixPurchaseOrder = s.PrefixPurchaseOrder,
            prefixGrn = s.PrefixGrn,
            prefixIssue = s.PrefixIssue,
            prefixReturn = s.PrefixReturn,
            prefixTransfer = s.PrefixTransfer,
            prefixStock = s.PrefixStock,
            prefixQuotation = s.PrefixQuotation
        });
    }

    public async Task<object> UpdateSettingsAsync(UpdateSettingsRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin");
        var s = await Settings(ct);
        if (req.ValuationDescription != null) s.ValuationDescription = req.ValuationDescription;
        if (req.NegativeStockAllowed.HasValue) s.NegativeStockAllowed = req.NegativeStockAllowed.Value;
        if (req.SelfApprovalAllowed.HasValue) s.SelfApprovalAllowed = req.SelfApprovalAllowed.Value;
        if (req.RequireGrnInspectionBeforePosting.HasValue) s.RequireGrnInspectionBeforePosting = req.RequireGrnInspectionBeforePosting.Value;
        if (req.JwtExpirySeconds.HasValue) s.JwtExpirySeconds = req.JwtExpirySeconds.Value;
        if (!string.IsNullOrWhiteSpace(req.Currency)) s.Currency = req.Currency.Trim();
        if (req.AuditTrailRetentionDays.HasValue) s.AuditTrailRetentionDays = req.AuditTrailRetentionDays.Value;
        if (!string.IsNullOrWhiteSpace(req.PrefixRequisition)) s.PrefixRequisition = req.PrefixRequisition.Trim();
        if (!string.IsNullOrWhiteSpace(req.PrefixPurchaseOrder)) s.PrefixPurchaseOrder = req.PrefixPurchaseOrder.Trim();
        if (!string.IsNullOrWhiteSpace(req.PrefixGrn)) s.PrefixGrn = req.PrefixGrn.Trim();
        if (!string.IsNullOrWhiteSpace(req.PrefixIssue)) s.PrefixIssue = req.PrefixIssue.Trim();
        if (!string.IsNullOrWhiteSpace(req.PrefixReturn)) s.PrefixReturn = req.PrefixReturn.Trim();
        if (!string.IsNullOrWhiteSpace(req.PrefixTransfer)) s.PrefixTransfer = req.PrefixTransfer.Trim();
        if (!string.IsNullOrWhiteSpace(req.PrefixStock)) s.PrefixStock = req.PrefixStock.Trim();
        if (!string.IsNullOrWhiteSpace(req.PrefixQuotation)) s.PrefixQuotation = req.PrefixQuotation.Trim();
        await Save(ct);
        return await GetSettingsAsync(ct);
    }

    private static object MapMaterial(Material m) => new
    {
        id = m.Id,
        itemCode = m.ItemCode,
        normalizedItemCode = m.NormalizedItemCode,
        name = m.Name,
        description = m.Description,
        specification = m.Specification,
        categoryId = m.CategoryId,
        categoryName = m.Category?.Name ?? "",
        baseUnitId = m.BaseUnitId,
        baseUnitName = m.BaseUnit?.Name ?? "",
        minimumStockLevel = m.MinimumStockLevel,
        reorderLevel = m.ReorderLevel,
        isActive = m.IsActive,
        createdAtUtc = m.CreatedAtUtc.ToString("o"),
        updatedAtUtc = m.UpdatedAtUtc?.ToString("o"),
        createdByUserId = m.CreatedByUserId,
        updatedByUserId = m.UpdatedByUserId
    };

    private static object MapSupplier(Supplier s) => new
    {
        id = s.Id,
        supplierCode = s.SupplierCode,
        normalizedSupplierCode = s.NormalizedSupplierCode,
        name = s.Name,
        contactPerson = s.ContactPerson,
        phone = s.Phone,
        email = s.Email,
        address = s.Address,
        taxReference = s.TaxReference,
        paymentTerms = s.PaymentTerms,
        notes = s.Notes,
        isActive = s.IsActive,
        createdAtUtc = s.CreatedAtUtc.ToString("o"),
        updatedAtUtc = s.UpdatedAtUtc?.ToString("o"),
        createdByUserId = s.CreatedByUserId,
        updatedByUserId = s.UpdatedByUserId
    };
}

public record CreateMaterialRequest(
    string ItemCode,
    string Name,
    string? Description,
    string? Specification,
    string CategoryId,
    string BaseUnitId,
    decimal MinimumStockLevel,
    decimal ReorderLevel);

public record UpdateMaterialRequest(
    string Name,
    string? Description,
    string? Specification,
    string CategoryId,
    string BaseUnitId,
    decimal MinimumStockLevel,
    decimal ReorderLevel);

public record CreateProjectRequest(
    string? Code,
    string? Name,
    string? Location,
    string? ProjectManagerId,
    string? ProjectManagerName,
    DateOnly? StartDate,
    DateOnly? TargetCompletionDate);

public record CreateWarehouseRequest(
    string? Code,
    string? Name,
    string? Type,
    string? ProjectId,
    string? Location);

public record CreateSupplierRequest(
    string? SupplierCode,
    string? Name,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Address,
    string? TaxReference,
    string? PaymentTerms,
    string? Notes);

public record UpdateSettingsRequest(
    string? ValuationDescription,
    bool? NegativeStockAllowed,
    bool? SelfApprovalAllowed,
    bool? RequireGrnInspectionBeforePosting,
    int? JwtExpirySeconds,
    string? Currency,
    int? AuditTrailRetentionDays,
    string? PrefixRequisition,
    string? PrefixPurchaseOrder,
    string? PrefixGrn,
    string? PrefixIssue,
    string? PrefixReturn,
    string? PrefixTransfer,
    string? PrefixStock,
    string? PrefixQuotation);
