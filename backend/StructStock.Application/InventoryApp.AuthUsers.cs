using Microsoft.EntityFrameworkCore;
using StructStock.Domain;
using StructStock.Infrastructure;

namespace StructStock.Application;

public partial class InventoryApp
{
    public async Task<LoginResult> LoginAsync(string? usernameOrEmail, string? password, string? clientIp, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(usernameOrEmail) || string.IsNullOrWhiteSpace(password))
        {
            throw new AppException(400, "Username/Email and password are required");
        }

        var identifier = usernameOrEmail.Trim().ToUpperInvariant();
        var trackerKey = $"{clientIp ?? "ip"}:{identifier}";
        var now = DateTime.UtcNow;
        var tracker = await _db.LoginAttempts.FirstOrDefaultAsync(x => x.TrackerKey == trackerKey, ct);
        if (tracker?.LockedUntilUtc is { } locked && locked > now)
        {
            var wait = (int)Math.Ceiling((locked - now).TotalSeconds);
            throw new AppException(429, $"Too many failed login attempts. Please wait {wait} seconds.");
        }

        // Identity UserManager + custom stores over dbo.AppUser (existing PBKDF2 hashes).
        var user = await _userManager.FindByNameAsync(identifier)
                   ?? await _userManager.FindByEmailAsync(identifier);

        if (user == null || !await _userManager.CheckPasswordAsync(user, password))
        {
            tracker ??= new LoginAttempt { TrackerKey = trackerKey };
            if (_db.Entry(tracker).State == EntityState.Detached)
            {
                _db.LoginAttempts.Add(tracker);
            }

            tracker.FailCount += 1;
            if (tracker.FailCount >= 5)
            {
                tracker.LockedUntilUtc = now.AddMinutes(1);
            }

            await _db.SaveChangesAsync(ct);
            throw new AppException(401, "Invalid username/email or password");
        }

        if (!user.IsActive)
        {
            throw new AppException(403, "This account has been disabled");
        }

        // Reload navigations for JWT claims / profile mapping.
        user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.ProjectScopes)
            .Include(u => u.WarehouseScopes)
            .FirstAsync(u => u.Id == user.Id, ct);

        if (tracker != null)
        {
            _db.LoginAttempts.Remove(tracker);
        }

        user.LastLoginAtUtc = now;
        await _db.SaveChangesAsync(ct);

        return new LoginResult(user, MapUser(user), now.AddHours(1));
    }

    public record LoginResult(AppUser User, object Profile, DateTime ExpiresAtUtc);

    public Task<object> LogoutAsync(CancellationToken ct) =>
        Task.FromResult(ApiResponse.Ok((object?)null, "Signed out"));

    public async Task<object> GetMeAsync(CancellationToken ct)
    {
        var user = await LoadUser(_me.UserId, ct) ?? throw new AppException(404, "User not found");
        return ApiResponse.Ok(MapUser(user));
    }

    public async Task<object> ListRolesAsync(CancellationToken ct)
    {
        var roles = await _db.Roles.AsNoTracking().OrderBy(r => r.Name)
            .Select(r => new { id = r.Id, name = r.Name, description = r.Description })
            .ToListAsync(ct);
        return ApiResponse.Ok(roles);
    }

    public async Task<object> ListUsersAsync(string? search, string? role, string? status, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin");
        var query = _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.ProjectScopes)
            .Include(u => u.WarehouseScopes)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            query = query.Where(u =>
                u.NormalizedUsername.Contains(term) ||
                u.NormalizedEmail.Contains(term) ||
                u.FullName.ToUpper().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(role) && role != "ALL")
        {
            query = query.Where(u => u.UserRoles.Any(ur => ur.Role!.Name == role));
        }

        if (status == "Active") query = query.Where(u => u.IsActive);
        if (status == "Inactive") query = query.Where(u => !u.IsActive);

        var users = await query.OrderBy(u => u.FullName).ToListAsync(ct);
        return ApiResponse.Ok(users.Select(MapUser).ToList());
    }

    public async Task<object> GetUserAsync(string id, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin");
        var user = await LoadUser(id, ct) ?? throw new AppException(404, "User not found");
        return ApiResponse.Ok(MapUser(user));
    }

    public async Task<object> CreateUserAsync(CreateUserRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin");
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Email) ||
            string.IsNullOrWhiteSpace(req.FullName) || string.IsNullOrWhiteSpace(req.Password))
        {
            throw new AppException(400, "Username, email, full name, and password are required");
        }

        if (req.Roles == null || req.Roles.Count == 0)
        {
            throw new AppException(400, "At least one role is required");
        }

        var normUser = req.Username.Trim().ToUpperInvariant();
        var normEmail = req.Email.Trim().ToUpperInvariant();
        if (await _db.Users.AnyAsync(u => u.NormalizedUsername == normUser || u.NormalizedEmail == normEmail, ct))
        {
            throw new AppException(400, "Username or email already exists");
        }

        var roles = await _db.Roles.Where(r => req.Roles.Contains(r.Name)).ToListAsync(ct);
        if (roles.Count != req.Roles.Distinct().Count())
        {
            throw new AppException(400, "One or more roles are invalid");
        }

        var user = new AppUser
        {
            Id = Ids.New("USR"),
            Username = req.Username.Trim(),
            NormalizedUsername = normUser,
            Email = req.Email.Trim(),
            NormalizedEmail = normEmail,
            FullName = req.FullName.Trim(),
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };
        user.PasswordHash = _userManager.PasswordHasher.HashPassword(user, req.Password);
        foreach (var role in roles)
        {
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id, Role = role });
        }

        foreach (var projectId in (req.ProjectScopes ?? new()).Distinct())
        {
            user.ProjectScopes.Add(new UserProjectScope { UserId = user.Id, ProjectId = projectId });
        }

        foreach (var warehouseId in (req.WarehouseScopes ?? new()).Distinct())
        {
            user.WarehouseScopes.Add(new UserWarehouseScope { UserId = user.Id, WarehouseId = warehouseId });
        }

        _db.Users.Add(user);
        await Save(ct);
        return ApiResponse.Ok(MapUser(user), "User created");
    }

    public async Task<object> UpdateUserAsync(string id, UpdateUserRequest req, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin");
        var user = await LoadUser(id, ct) ?? throw new AppException(404, $"User with ID '{id}' was not found");
        if (!string.IsNullOrWhiteSpace(req.FullName)) user.FullName = req.FullName.Trim();
        if (!string.IsNullOrWhiteSpace(req.Email))
        {
            var normEmail = req.Email.Trim().ToUpperInvariant();
            if (await _db.Users.AnyAsync(u => u.Id != id && u.NormalizedEmail == normEmail, ct))
            {
                throw new AppException(400, "Email already exists");
            }

            user.Email = req.Email.Trim();
            user.NormalizedEmail = normEmail;
        }

        if (!string.IsNullOrWhiteSpace(req.Password))
        {
            user.PasswordHash = _userManager.PasswordHasher.HashPassword(user, req.Password);
        }

        if (req.Roles != null)
        {
            var roles = await _db.Roles.Where(r => req.Roles.Contains(r.Name)).ToListAsync(ct);
            if (roles.Count != req.Roles.Distinct().Count())
            {
                throw new AppException(400, "One or more roles are invalid");
            }

            _db.UserRoles.RemoveRange(user.UserRoles);
            user.UserRoles = roles.Select(r => new UserRole { UserId = user.Id, RoleId = r.Id, Role = r }).ToList();
        }

        if (req.ProjectScopes != null)
        {
            _db.UserProjectScopes.RemoveRange(user.ProjectScopes);
            user.ProjectScopes = req.ProjectScopes.Distinct()
                .Select(p => new UserProjectScope { UserId = user.Id, ProjectId = p }).ToList();
        }

        if (req.WarehouseScopes != null)
        {
            _db.UserWarehouseScopes.RemoveRange(user.WarehouseScopes);
            user.WarehouseScopes = req.WarehouseScopes.Distinct()
                .Select(w => new UserWarehouseScope { UserId = user.Id, WarehouseId = w }).ToList();
        }

        user.UpdatedAtUtc = DateTime.UtcNow;
        await Save(ct);
        return ApiResponse.Ok(MapUser(user), "User updated");
    }

    public async Task<object> PatchUserStatusAsync(string id, bool isActive, string? reason, CancellationToken ct)
    {
        _me.RequireRole("SuperAdmin");
        var user = await LoadUser(id, ct) ?? throw new AppException(404, $"User with ID '{id}' was not found");
        if (user.Id == _me.UserId && !isActive)
        {
            throw new AppException(400, "You cannot deactivate your own account");
        }

        user.IsActive = isActive;
        user.UpdatedAtUtc = DateTime.UtcNow;
        await Save(ct);
        return ApiResponse.Ok(new { id = user.Id, isActive = user.IsActive }, reason ?? (isActive ? "Activated" : "Deactivated"));
    }

    private async Task<AppUser?> LoadUser(string id, CancellationToken ct) =>
        await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.ProjectScopes)
            .Include(u => u.WarehouseScopes)
            .FirstOrDefaultAsync(u => u.Id == id, ct);

    private static object MapUser(AppUser user) => new
    {
        id = user.Id,
        username = user.Username,
        email = user.Email,
        fullName = user.FullName,
        isActive = user.IsActive,
        roles = user.UserRoles.Select(r => r.Role?.Name ?? "").Where(n => n != "").ToList(),
        projectScopes = user.ProjectScopes.Select(p => p.ProjectId).ToList(),
        warehouseScopes = user.WarehouseScopes.Select(w => w.WarehouseId).ToList(),
        createdAtUtc = user.CreatedAtUtc.ToString("o"),
        updatedAtUtc = user.UpdatedAtUtc?.ToString("o"),
        lastLoginAtUtc = user.LastLoginAtUtc?.ToString("o")
    };
}

public record CreateUserRequest(
    string Username,
    string Email,
    string FullName,
    string Password,
    List<string> Roles,
    List<string>? ProjectScopes,
    List<string>? WarehouseScopes);

public record UpdateUserRequest(
    string? FullName,
    string? Email,
    string? Password,
    List<string>? Roles,
    List<string>? ProjectScopes,
    List<string>? WarehouseScopes);
