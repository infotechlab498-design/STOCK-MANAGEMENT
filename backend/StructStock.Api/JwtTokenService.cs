using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
// ClaimTypes lives in System.Security.Claims (imported above)
using Microsoft.IdentityModel.Tokens;
using StructStock.Domain;

namespace StructStock.Api;

public class JwtTokenService
{
    private readonly IConfiguration _config;

    public JwtTokenService(IConfiguration config) => _config = config;

    public (string Token, DateTime ExpiresAtUtc) Create(AppUser user)
    {
        var secret = _config["Jwt:Secret"] ?? "construction_stock_jwt_secure_key_2026_enterprise_audit_token";
        var issuer = _config["Jwt:Issuer"] ?? "https://constructcorp.internal";
        var audience = _config["Jwt:Audience"] ?? "https://constructstock.app";
        var lifetime = int.TryParse(_config["Jwt:ExpirySeconds"], out var sec) ? sec : 3600;
        var expires = DateTime.UtcNow.AddSeconds(lifetime);

        var roles = user.UserRoles.Select(r => r.Role?.Name ?? "").Where(n => n != "").ToList();
        var projects = user.ProjectScopes.Select(p => p.ProjectId).ToList();
        var warehouses = user.WarehouseScopes.Select(w => w.WarehouseId).ToList();

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(ClaimTypes.NameIdentifier, user.Id),
            new("email", user.Email),
            new(ClaimTypes.Email, user.Email),
            new("username", user.Username),
            new("fullName", user.FullName),
            new("roles", JsonSerializer.Serialize(roles)),
            new("projectScopes", JsonSerializer.Serialize(projects)),
            new("warehouseScopes", JsonSerializer.Serialize(warehouses))
        };
        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
            claims.Add(new Claim("role", role));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(issuer, audience, claims, expires: expires, signingCredentials: creds);
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
