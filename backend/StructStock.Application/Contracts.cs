namespace StructStock.Application;

public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    string UserId { get; }
    string FullName { get; }
    string Email { get; }
    string Username { get; }
    IReadOnlyList<string> Roles { get; }
    IReadOnlyList<string> ProjectScopes { get; }
    IReadOnlyList<string> WarehouseScopes { get; }
    string PrimaryRole { get; }
    bool IsGlobal { get; }
    bool HasRole(params string[] roles);
    void RequireRole(params string[] roles);
    bool CanAccessProject(string? projectId);
    bool CanAccessWarehouse(string? warehouseId);
    bool CanAccessLocation(string? projectId, string? warehouseId);
}

public interface ILiveEvents
{
    Task PublishAsync(string kind, object payload, string? projectId, string? warehouseId, string? secondaryProjectId = null, string? secondaryWarehouseId = null, CancellationToken ct = default);
}

public static class ApiResponse
{
    public static object Ok(object? data, string? message = null) => new
    {
        success = true,
        message,
        data,
        timestampUtc = DateTime.UtcNow.ToString("o")
    };

    public static object Fail(string message) => new
    {
        success = false,
        message,
        timestampUtc = DateTime.UtcNow.ToString("o")
    };
}
