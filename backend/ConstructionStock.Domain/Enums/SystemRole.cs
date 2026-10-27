namespace ConstructionStock.Domain.Enums;

/// <summary>
/// Enterprise system roles for Construction Stock Management System.
/// Enforced via policy-based authorization handlers and database foreign keys.
/// </summary>
public enum SystemRole
{
    SuperAdmin = 1,
    InventoryManager = 2,
    ProjectManager = 3,
    ProcurementOfficer = 4,
    Storekeeper = 5,
    AccountsOfficer = 6,
    Viewer = 7
}

public static class SystemRoleNames
{
    public const string SuperAdmin = "SuperAdmin";
    public const string InventoryManager = "InventoryManager";
    public const string ProjectManager = "ProjectManager";
    public const string ProcurementOfficer = "ProcurementOfficer";
    public const string Storekeeper = "Storekeeper";
    public const string AccountsOfficer = "AccountsOfficer";
    public const string Viewer = "Viewer";

    public static readonly string[] AllRoles =
    [
        SuperAdmin,
        InventoryManager,
        ProjectManager,
        ProcurementOfficer,
        Storekeeper,
        AccountsOfficer,
        Viewer
    ];
}
