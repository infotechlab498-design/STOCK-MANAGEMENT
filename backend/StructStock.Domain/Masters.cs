namespace StructStock.Domain;

public class Role
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public List<UserRole> UserRoles { get; set; } = new();
}

public class AppUser
{
    public string Id { get; set; } = "";
    public string Username { get; set; } = "";
    public string NormalizedUsername { get; set; } = "";
    public string Email { get; set; } = "";
    public string NormalizedEmail { get; set; } = "";
    public string FullName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public DateTime? LastLoginAtUtc { get; set; }
    public List<UserRole> UserRoles { get; set; } = new();
    public List<UserProjectScope> ProjectScopes { get; set; } = new();
    public List<UserWarehouseScope> WarehouseScopes { get; set; } = new();
}

public class UserRole
{
    public string UserId { get; set; } = "";
    public string RoleId { get; set; } = "";
    public AppUser? User { get; set; }
    public Role? Role { get; set; }
}

public class UserProjectScope
{
    public string UserId { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public AppUser? User { get; set; }
    public Project? Project { get; set; }
}

public class UserWarehouseScope
{
    public string UserId { get; set; } = "";
    public string WarehouseId { get; set; } = "";
    public AppUser? User { get; set; }
    public Warehouse? Warehouse { get; set; }
}

public class LoginAttempt
{
    public string TrackerKey { get; set; } = "";
    public int FailCount { get; set; }
    public DateTime? LockedUntilUtc { get; set; }
}

public class MaterialCategory
{
    public string Id { get; set; } = "";
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UnitOfMeasure
{
    public string Id { get; set; } = "";
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Symbol { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

public class UnitConversion
{
    public string Id { get; set; } = "";
    public string? MaterialId { get; set; }
    public string FromUnitId { get; set; } = "";
    public string ToUnitId { get; set; } = "";
    public decimal ConversionFactor { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public Material? Material { get; set; }
    public UnitOfMeasure? FromUnit { get; set; }
    public UnitOfMeasure? ToUnit { get; set; }
}

public class Project
{
    public string Id { get; set; } = "";
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Location { get; set; } = "";
    public string? ProjectManagerId { get; set; }
    public string ProjectManagerName { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateOnly? StartDate { get; set; }
    public DateOnly? TargetCompletionDate { get; set; }
}

public class Warehouse
{
    public string Id { get; set; } = "";
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string WarehouseType { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string Location { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public Project? Project { get; set; }
}

public class Material
{
    public string Id { get; set; } = "";
    public string ItemCode { get; set; } = "";
    public string NormalizedItemCode { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Specification { get; set; }
    public string CategoryId { get; set; } = "";
    public string BaseUnitId { get; set; } = "";
    public decimal MinimumStockLevel { get; set; }
    public decimal ReorderLevel { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public string? CreatedByUserId { get; set; }
    public string? UpdatedByUserId { get; set; }
    public MaterialCategory? Category { get; set; }
    public UnitOfMeasure? BaseUnit { get; set; }
}

public class Supplier
{
    public string Id { get; set; } = "";
    public string SupplierCode { get; set; } = "";
    public string NormalizedSupplierCode { get; set; } = "";
    public string Name { get; set; } = "";
    public string ContactPerson { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Email { get; set; } = "";
    public string Address { get; set; } = "";
    public string? TaxReference { get; set; }
    public string? PaymentTerms { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public string? CreatedByUserId { get; set; }
    public string? UpdatedByUserId { get; set; }
}

public class SystemSetting
{
    public string Id { get; set; } = "SETTINGS";
    public string ValuationPolicy { get; set; } = "WEIGHTED_AVERAGE_COST";
    public string ValuationDescription { get; set; } = "";
    public bool NegativeStockAllowed { get; set; }
    public bool SelfApprovalAllowed { get; set; }
    public bool RequireGrnInspectionBeforePosting { get; set; } = true;
    public int JwtExpirySeconds { get; set; } = 3600;
    public string Currency { get; set; } = "USD";
    public int AuditTrailRetentionDays { get; set; } = 3650;
    public string PrefixRequisition { get; set; } = "MR";
    public string PrefixPurchaseOrder { get; set; } = "PO";
    public string PrefixGrn { get; set; } = "GRN";
    public string PrefixIssue { get; set; } = "MIV";
    public string PrefixReturn { get; set; } = "MRN";
    public string PrefixTransfer { get; set; } = "STN";
    public string PrefixStock { get; set; } = "STK";
    public string PrefixQuotation { get; set; } = "QT";
}

public class NumberSeries
{
    public string Prefix { get; set; } = "";
    public int CurrentYear { get; set; }
    public int LastNumber { get; set; }
}
