using System.Security.Claims;
using System.Text.Json;
using StructStock.Application;

namespace StructStock.Api.Auth;

public class CurrentUserAccessor
{
    private readonly CurrentUserState _state;
    private readonly IHttpContextAccessor _http;

    public CurrentUserAccessor(CurrentUserState state, IHttpContextAccessor http)
    {
        _state = state;
        _http = http;
    }

    public void SyncFromHttpContext()
    {
        var user = _http.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            _state.Clear();
            return;
        }

        string Claim(string type) =>
            user.FindFirstValue(type)
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? "";

        var sub = user.FindFirstValue(JwtRegisteredClaimNames.Sub)
                  ?? user.FindFirstValue("sub")
                  ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? "";

        var roles = ReadList(user, "roles")
            .Concat(user.FindAll(ClaimTypes.Role).Select(c => c.Value))
            .Concat(user.FindAll("role").Select(c => c.Value))
            .Where(r => !string.IsNullOrWhiteSpace(r) && !r.TrimStart().StartsWith('['))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Also accept a single JSON-array roles claim.
        if (roles.Count == 0)
        {
            roles = ReadList(user, "roles").ToList();
        }

        _state.Set(
            sub,
            Claim("fullName"),
            Claim("email") is { Length: > 0 } email ? email : Claim(ClaimTypes.Email),
            Claim("username"),
            roles,
            ReadList(user, "projectScopes"),
            ReadList(user, "warehouseScopes"));
    }

    private static IEnumerable<string> ReadList(ClaimsPrincipal user, string type)
    {
        var values = user.FindAll(type).Select(c => c.Value).ToList();
        if (values.Count == 1 && values[0].TrimStart().StartsWith('['))
        {
            try
            {
                return JsonSerializer.Deserialize<string[]>(values[0]) ?? Array.Empty<string>();
            }
            catch
            {
                return values;
            }
        }

        return values;
    }
}

// Alias for JWT claim name constant without pulling package into every file
file static class JwtRegisteredClaimNames
{
    public const string Sub = "sub";
}
