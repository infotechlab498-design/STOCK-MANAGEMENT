using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using StructStock.Application;
using StructStock.Infrastructure;

namespace StructStock.Api.Realtime;

public class LiveEventsPublisher : ILiveEvents
{
    private readonly IHubContext<InventoryHub> _hub;
    private readonly IServiceScopeFactory _scopes;

    public LiveEventsPublisher(IHubContext<InventoryHub> hub, IServiceScopeFactory scopes)
    {
        _hub = hub;
        _scopes = scopes;
    }

    public async Task PublishAsync(
        string kind,
        object payload,
        string? projectId,
        string? warehouseId,
        string? secondaryProjectId = null,
        string? secondaryWarehouseId = null,
        CancellationToken ct = default)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var users = await db.Users.AsNoTracking()
            .Include(u => u.UserRoles).ThenInclude(r => r.Role)
            .Include(u => u.ProjectScopes)
            .Include(u => u.WarehouseScopes)
            .Where(u => u.IsActive)
            .ToListAsync(ct);

        var targets = users.Where(u =>
        {
            var roles = u.UserRoles.Select(r => r.Role?.Name ?? "").ToList();
            var global = roles.Any(r => r is "SuperAdmin" or "InventoryManager" or "AccountsOfficer");
            if (global) return true;
            var projects = u.ProjectScopes.Select(p => p.ProjectId).ToHashSet();
            var warehouses = u.WarehouseScopes.Select(w => w.WarehouseId).ToHashSet();
            bool Ok(string? p, string? w)
            {
                if (string.IsNullOrEmpty(p) && string.IsNullOrEmpty(w)) return true;
                var hasP = string.IsNullOrEmpty(p) || projects.Contains(p) || projects.Contains("*");
                var hasW = string.IsNullOrEmpty(w) || warehouses.Contains(w) || warehouses.Contains("*");
                if (roles.Contains("Storekeeper") && hasW) return true;
                return hasP && hasW;
            }

            return Ok(projectId, warehouseId) || Ok(secondaryProjectId, secondaryWarehouseId);
        }).Select(u => u.Id).Distinct().ToList();

        foreach (var userId in targets)
        {
            await _hub.Clients.Group($"user:{userId}").SendAsync(kind, payload, ct);
        }
    }
}
