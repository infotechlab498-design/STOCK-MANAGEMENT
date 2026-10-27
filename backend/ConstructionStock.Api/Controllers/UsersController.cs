using ConstructionStock.Application.Security;
using ConstructionStock.Domain.Entities;
using ConstructionStock.Domain.Enums;
using ConstructionStock.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ConstructionStock.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = SystemRoleNames.SuperAdmin)]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;

    public UsersController(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Lists users with optional role and search filters.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<UserProfileDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUsers([FromQuery] string? search, [FromQuery] string? role, CancellationToken cancellationToken)
    {
        var query = _dbContext.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.ProjectScopes).ThenInclude(ps => ps.Project)
            .Include(u => u.WarehouseScopes).ThenInclude(ws => ws.Warehouse)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            query = query.Where(u => u.NormalizedEmail.Contains(term) ||
                                     u.NormalizedUsername.Contains(term) ||
                                     u.FullName.ToUpper().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(role))
        {
            query = query.Where(u => u.UserRoles.Any(ur => ur.Role.Name == role));
        }

        var users = await query
            .OrderByDescending(u => u.CreatedAtUtc)
            .Select(u => new UserProfileDto(
                u.Id,
                u.Username,
                u.Email,
                u.FullName,
                u.IsActive,
                u.UserRoles.Select(ur => ur.Role.Name).ToList(),
                u.ProjectScopes.Select(ps => new ProjectScopeSummaryDto(ps.ProjectId, ps.Project.Code, ps.Project.Name)).ToList(),
                u.WarehouseScopes.Select(ws => new WarehouseScopeSummaryDto(ws.WarehouseId, ws.Warehouse.Code, ws.Warehouse.Name, ws.Warehouse.ProjectId)).ToList(),
                u.LastLoginAtUtc
            ))
            .ToListAsync(cancellationToken);

        return Ok(users);
    }

    /// <summary>
    /// Gets a single user by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(UserProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUserById(Guid id, CancellationToken cancellationToken)
    {
        var user = await _dbContext.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.ProjectScopes).ThenInclude(ps => ps.Project)
            .Include(u => u.WarehouseScopes).ThenInclude(ws => ws.Warehouse)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user == null)
        {
            return NotFound(new { message = $"User with ID '{id}' was not found" });
        }

        return Ok(new UserProfileDto(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.IsActive,
            user.UserRoles.Select(ur => ur.Role.Name).ToList(),
            user.ProjectScopes.Select(ps => new ProjectScopeSummaryDto(ps.ProjectId, ps.Project.Code, ps.Project.Name)).ToList(),
            user.WarehouseScopes.Select(ws => new WarehouseScopeSummaryDto(ws.WarehouseId, ws.Warehouse.Code, ws.Warehouse.Name, ws.Warehouse.ProjectId)).ToList(),
            user.LastLoginAtUtc
        ));
    }

    /// <summary>
    /// Creates a new user with verified role assignments and scopes.
    /// Prevents privilege escalation: non-SuperAdmin cannot grant SuperAdmin role.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(UserProfileDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
        {
            return BadRequest(new { message = "Username, email, and password are required" });
        }

        if (dto.Password.Length < 8)
        {
            return BadRequest(new { message = "Password must be at least 8 characters in length" });
        }

        var normalizedEmail = dto.Email.Trim().ToUpperInvariant();
        var normalizedUsername = dto.Username.Trim().ToUpperInvariant();

        if (await _dbContext.Users.AnyAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken))
        {
            return BadRequest(new { message = "A user with this email address already exists" });
        }

        if (await _dbContext.Users.AnyAsync(u => u.NormalizedUsername == normalizedUsername, cancellationToken))
        {
            return BadRequest(new { message = "A user with this username already exists" });
        }

        var currentUserIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        Guid.TryParse(currentUserIdStr, out var currentUserId);
        var isCallerSuperAdmin = User.IsInRole(SystemRoleNames.SuperAdmin);

        // Security requirement: Prevent privilege escalation
        if (dto.Roles.Contains(SystemRoleNames.SuperAdmin) && !isCallerSuperAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only an active Super Admin may assign the Super Admin role" });
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = dto.Username.Trim(),
            NormalizedUsername = normalizedUsername,
            Email = dto.Email.Trim(),
            NormalizedEmail = normalizedEmail,
            FullName = dto.FullName.Trim(),
            PasswordHash = HashPassword(dto.Password),
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        // Attach valid roles
        foreach (var roleName in dto.Roles.Distinct())
        {
            var role = await _dbContext.Roles.FirstOrDefaultAsync(r => r.Name == roleName, cancellationToken);
            if (role != null)
            {
                user.UserRoles.Add(new UserRole
                {
                    UserId = user.Id,
                    RoleId = role.Id,
                    AssignedAtUtc = DateTime.UtcNow,
                    AssignedByUserId = currentUserId
                });
            }
        }

        // Attach Project scopes
        if (dto.ProjectIds != null)
        {
            foreach (var pid in dto.ProjectIds.Distinct())
            {
                user.ProjectScopes.Add(new UserProjectScope
                {
                    UserId = user.Id,
                    ProjectId = pid,
                    AssignedAtUtc = DateTime.UtcNow,
                    AssignedByUserId = currentUserId
                });
            }
        }

        // Attach Warehouse scopes
        if (dto.WarehouseIds != null)
        {
            foreach (var wid in dto.WarehouseIds.Distinct())
            {
                user.WarehouseScopes.Add(new UserWarehouseScope
                {
                    UserId = user.Id,
                    WarehouseId = wid,
                    AssignedAtUtc = DateTime.UtcNow,
                    AssignedByUserId = currentUserId
                });
            }
        }

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, new { id = user.Id, message = "User created successfully" });
    }

    /// <summary>
    /// Updates user details, assigned roles, and scopes.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserDto dto, CancellationToken cancellationToken)
    {
        var user = await _dbContext.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.ProjectScopes)
            .Include(u => u.WarehouseScopes)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        var normalizedEmail = dto.Email.Trim().ToUpperInvariant();
        if (await _dbContext.Users.AnyAsync(u => u.Id != id && u.NormalizedEmail == normalizedEmail, cancellationToken))
        {
            return BadRequest(new { message = "Email is already taken by another user" });
        }

        // Prevent removing Super Admin if user is the last active Super Admin
        var isTargetCurrentlySuperAdmin = user.UserRoles.Any(ur => ur.Role.Name == SystemRoleNames.SuperAdmin);
        var willBeSuperAdmin = dto.Roles.Contains(SystemRoleNames.SuperAdmin);

        if (isTargetCurrentlySuperAdmin && !willBeSuperAdmin)
        {
            var totalActiveSuperAdmins = await _dbContext.UserRoles
                .CountAsync(ur => ur.Role.Name == SystemRoleNames.SuperAdmin && ur.User.IsActive && ur.UserId != id, cancellationToken);

            if (totalActiveSuperAdmins == 0)
            {
                return BadRequest(new { message = "Cannot remove the Super Admin role from the last active Super Admin" });
            }
        }

        user.FullName = dto.FullName.Trim();
        user.Email = dto.Email.Trim();
        user.NormalizedEmail = normalizedEmail;
        user.UpdatedAtUtc = DateTime.UtcNow;

        // Sync Roles
        user.UserRoles.Clear();
        foreach (var roleName in dto.Roles.Distinct())
        {
            var role = await _dbContext.Roles.FirstOrDefaultAsync(r => r.Name == roleName, cancellationToken);
            if (role != null)
            {
                user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id, AssignedAtUtc = DateTime.UtcNow });
            }
        }

        // Sync Project Scopes
        user.ProjectScopes.Clear();
        if (dto.ProjectIds != null)
        {
            foreach (var pid in dto.ProjectIds.Distinct())
            {
                user.ProjectScopes.Add(new UserProjectScope { UserId = user.Id, ProjectId = pid, AssignedAtUtc = DateTime.UtcNow });
            }
        }

        // Sync Warehouse Scopes
        user.WarehouseScopes.Clear();
        if (dto.WarehouseIds != null)
        {
            foreach (var wid in dto.WarehouseIds.Distinct())
            {
                user.WarehouseScopes.Add(new UserWarehouseScope { UserId = user.Id, WarehouseId = wid, AssignedAtUtc = DateTime.UtcNow });
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "User updated successfully" });
    }

    /// <summary>
    /// Activates or disables a user account.
    /// Prevents disabling the last active Super Admin.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateUserStatus(Guid id, [FromBody] UpdateUserStatusDto dto, CancellationToken cancellationToken)
    {
        var user = await _dbContext.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        // Guard: Prevent disabling the last active Super Admin
        if (!dto.IsActive && user.UserRoles.Any(ur => ur.Role.Name == SystemRoleNames.SuperAdmin))
        {
            var otherActiveSuperAdmins = await _dbContext.UserRoles
                .CountAsync(ur => ur.Role.Name == SystemRoleNames.SuperAdmin && ur.User.IsActive && ur.UserId != id, cancellationToken);

            if (otherActiveSuperAdmins == 0)
            {
                return BadRequest(new { message = "Cannot deactivate the last active Super Admin account" });
            }
        }

        user.IsActive = dto.IsActive;
        user.UpdatedAtUtc = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { message = $"User {(dto.IsActive ? "activated" : "deactivated")} successfully", isActive = user.IsActive });
    }

    private static string HashPassword(string password)
    {
        var salt = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
        using var pbkdf2 = new System.Security.Cryptography.Rfc2898DeriveBytes(password, salt, 100_000, System.Security.Cryptography.HashAlgorithmName.SHA256);
        var hash = pbkdf2.GetBytes(32);
        return $"{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }
}
