using StructStock.Domain;

namespace StructStock.Application;

public class CurrentUserState : ICurrentUser
{
    public bool IsAuthenticated { get; private set; }
    public string UserId { get; private set; } = "";
    public string FullName { get; private set; } = "";
    public string Email { get; private set; } = "";
    public string Username { get; private set; } = "";
    public IReadOnlyList<string> Roles { get; private set; } = Array.Empty<string>();
    public IReadOnlyList<string> ProjectScopes { get; private set; } = Array.Empty<string>();
    public IReadOnlyList<string> WarehouseScopes { get; private set; } = Array.Empty<string>();

    public string PrimaryRole => Roles.FirstOrDefault() ?? "";
    public bool IsGlobal => HasRole("SuperAdmin", "InventoryManager", "AccountsOfficer");

    public void Set(
        string userId,
        string fullName,
        string email,
        string username,
        IEnumerable<string> roles,
        IEnumerable<string> projectScopes,
        IEnumerable<string> warehouseScopes)
    {
        IsAuthenticated = true;
        UserId = userId;
        FullName = fullName;
        Email = email;
        Username = username;
        Roles = roles.ToList();
        ProjectScopes = projectScopes.ToList();
        WarehouseScopes = warehouseScopes.ToList();
    }

    public void Clear()
    {
        IsAuthenticated = false;
        UserId = FullName = Email = Username = "";
        Roles = Array.Empty<string>();
        ProjectScopes = Array.Empty<string>();
        WarehouseScopes = Array.Empty<string>();
    }

    public bool HasRole(params string[] roles) =>
        roles.Length == 0 || Roles.Any(r => roles.Contains(r, StringComparer.OrdinalIgnoreCase));

    public void RequireRole(params string[] roles)
    {
        if (!IsAuthenticated)
        {
            throw new AppException(401, "Unauthorized");
        }

        if (!HasRole(roles))
        {
            throw new AppException(403, $"Forbidden: Requires one of [{string.Join(", ", roles)}] role");
        }
    }

    public bool CanAccessProject(string? projectId)
    {
        if (!IsAuthenticated) return false;
        if (string.IsNullOrWhiteSpace(projectId)) return true;
        if (IsGlobal) return true;
        return ProjectScopes.Contains("*") || ProjectScopes.Contains(projectId);
    }

    public bool CanAccessWarehouse(string? warehouseId)
    {
        if (!IsAuthenticated) return false;
        if (string.IsNullOrWhiteSpace(warehouseId)) return true;
        if (IsGlobal) return true;
        return WarehouseScopes.Contains("*") || WarehouseScopes.Contains(warehouseId);
    }

    public bool CanAccessLocation(string? projectId, string? warehouseId)
    {
        if (!IsAuthenticated) return false;
        if (IsGlobal) return true;
        var hasProject = string.IsNullOrWhiteSpace(projectId) || CanAccessProject(projectId);
        var hasWarehouse = string.IsNullOrWhiteSpace(warehouseId) || CanAccessWarehouse(warehouseId);
        if (HasRole("Storekeeper") && hasWarehouse)
        {
            return true;
        }

        return hasProject && hasWarehouse;
    }
}
