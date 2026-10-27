using ConstructionStock.Application.Security;
using ConstructionStock.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ConstructionStock.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IConfiguration _configuration;

    public AuthController(ApplicationDbContext dbContext, IConfiguration configuration)
    {
        _dbContext = dbContext;
        _configuration = configuration;
    }

    /// <summary>
    /// Authenticates a user with email/username and password.
    /// Returns a short-lived signed JWT and profile summary.
    /// Returns generic "Invalid credentials" error to avoid user enumeration.
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.UsernameOrEmail) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Unauthorized(new { message = "Invalid email or password" });
        }

        var normalized = request.UsernameOrEmail.Trim().ToUpperInvariant();

        var user = await _dbContext.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.ProjectScopes).ThenInclude(ps => ps.Project)
            .Include(u => u.WarehouseScopes).ThenInclude(ws => ws.Warehouse)
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalized || u.NormalizedUsername == normalized, cancellationToken);

        // Constant time comparison prevention & user enumeration protection
        if (user == null || !VerifyPasswordHash(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid email or password" });
        }

        // Active account enforcement
        if (!user.IsActive)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Account is inactive. Contact your system administrator." });
        }

        user.LastLoginAtUtc = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var projectScopes = user.ProjectScopes.Select(ps => new ProjectScopeSummaryDto(ps.ProjectId, ps.Project.Code, ps.Project.Name)).ToList();
        var warehouseScopes = user.WarehouseScopes.Select(ws => new WarehouseScopeSummaryDto(ws.WarehouseId, ws.Warehouse.Code, ws.Warehouse.Name, ws.Warehouse.ProjectId)).ToList();

        var token = GenerateJwtToken(user, roles);

        var profile = new UserProfileDto(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.IsActive,
            roles,
            projectScopes,
            warehouseScopes,
            user.LastLoginAtUtc
        );

        return Ok(new LoginResponseDto(token, 3600, profile));
    }

    /// <summary>
    /// Returns the authenticated user's current profile, roles, and project/warehouse scopes.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(UserProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetCurrentUser(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var user = await _dbContext.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.ProjectScopes).ThenInclude(ps => ps.Project)
            .Include(u => u.WarehouseScopes).ThenInclude(ws => ws.Warehouse)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null || !user.IsActive)
        {
            return Unauthorized(new { message = "Session invalid or user inactive" });
        }

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var projectScopes = user.ProjectScopes.Select(ps => new ProjectScopeSummaryDto(ps.ProjectId, ps.Project.Code, ps.Project.Name)).ToList();
        var warehouseScopes = user.WarehouseScopes.Select(ws => new WarehouseScopeSummaryDto(ws.WarehouseId, ws.Warehouse.Code, ws.Warehouse.Name, ws.Warehouse.ProjectId)).ToList();

        return Ok(new UserProfileDto(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.IsActive,
            roles,
            projectScopes,
            warehouseScopes,
            user.LastLoginAtUtc
        ));
    }

    /// <summary>
    /// Explicit session termination. Invalidate token client-side and clear cookies.
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        // Client deletes in-memory / session token. Server clears auth cookies if applicable.
        Response.Cookies.Delete("X-Access-Token");
        return Ok(new { message = "Logged out successfully" });
    }

    private static bool VerifyPasswordHash(string password, string storedHash)
    {
        // PBKDF2 verification using System.Security.Cryptography.Rfc2898DeriveBytes
        if (string.IsNullOrEmpty(storedHash)) return false;
        var parts = storedHash.Split(':');
        if (parts.Length != 2) return false;
        var salt = Convert.FromBase64String(parts[0]);
        var hash = Convert.FromBase64String(parts[1]);
        using var pbkdf2 = new System.Security.Cryptography.Rfc2898DeriveBytes(password, salt, 100_000, System.Security.Cryptography.HashAlgorithmName.SHA256);
        var key = pbkdf2.GetBytes(32);
        return System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(key, hash);
    }

    private string GenerateJwtToken(User user, List<string> roles)
    {
        var jwtSecret = _configuration["Jwt:SecretKey"] ?? Environment.GetEnvironmentVariable("JWT_SECRET") ?? "FallbackSecureSuperKeyConstructionStock2026";
        var key = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtSecret));
        var creds = new Microsoft.IdentityModel.Tokens.SigningCredentials(key, Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new("fullName", user.FullName)
        };

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var token = new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"] ?? "https://constructcorp.internal",
            audience: _configuration["Jwt:Audience"] ?? "https://constructstock.app",
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(60),
            signingCredentials: creds
        );

        return new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token);
    }
}
