using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace StructStock.Api.Realtime;

[Authorize]
public class InventoryHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst("sub")?.Value
            ?? Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
        }

        foreach (var role in Context.User?.FindAll("role").Select(c => c.Value)
                     ?? Context.User?.Claims.Where(c => c.Type == "roles").SelectMany(ParseRoles) ?? Array.Empty<string>())
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"role:{role}");
        }

        await base.OnConnectedAsync();
    }

    private static IEnumerable<string> ParseRoles(System.Security.Claims.Claim claim)
    {
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<string[]>(claim.Value) ?? Array.Empty<string>();
        }
        catch
        {
            return new[] { claim.Value };
        }
    }
}
