using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using StructStock.Domain;

namespace StructStock.Infrastructure.Identity;

/// <summary>
/// Non-destructive Identity user store mapped to existing dbo.AppUser / UserRole / Role.
/// </summary>
public sealed class AppUserStore :
    IUserStore<AppUser>,
    IUserPasswordStore<AppUser>,
    IUserEmailStore<AppUser>,
    IUserRoleStore<AppUser>,
    IUserSecurityStampStore<AppUser>
{
    private readonly AppDbContext _db;

    public AppUserStore(AppDbContext db) => _db = db;

    public void Dispose() { }

    public async Task<IdentityResult> CreateAsync(AppUser user, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (string.IsNullOrWhiteSpace(user.Id))
        {
            user.Id = $"USR-{Guid.NewGuid():N}"[..16].ToUpperInvariant();
        }

        user.NormalizedUsername = (user.NormalizedUsername.Length > 0
            ? user.NormalizedUsername
            : user.Username).ToUpperInvariant();
        user.NormalizedEmail = (user.NormalizedEmail.Length > 0
            ? user.NormalizedEmail
            : user.Email).ToUpperInvariant();
        if (user.CreatedAtUtc == default)
        {
            user.CreatedAtUtc = DateTime.UtcNow;
        }

        _db.Users.Add(user);
        await _db.SaveChangesAsync(cancellationToken);
        return IdentityResult.Success;
    }

    public async Task<IdentityResult> UpdateAsync(AppUser user, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        user.UpdatedAtUtc = DateTime.UtcNow;
        _db.Users.Update(user);
        await _db.SaveChangesAsync(cancellationToken);
        return IdentityResult.Success;
    }

    public async Task<IdentityResult> DeleteAsync(AppUser user, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _db.Users.Remove(user);
        await _db.SaveChangesAsync(cancellationToken);
        return IdentityResult.Success;
    }

    public Task<AppUser?> FindByIdAsync(string userId, CancellationToken cancellationToken) =>
        _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

    public Task<AppUser?> FindByNameAsync(string normalizedUserName, CancellationToken cancellationToken) =>
        _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.ProjectScopes)
            .Include(u => u.WarehouseScopes)
            .FirstOrDefaultAsync(u => u.NormalizedUsername == normalizedUserName, cancellationToken);

    public Task<string> GetUserIdAsync(AppUser user, CancellationToken cancellationToken) =>
        Task.FromResult(user.Id);

    public Task<string?> GetUserNameAsync(AppUser user, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(user.Username);

    public Task SetUserNameAsync(AppUser user, string? userName, CancellationToken cancellationToken)
    {
        user.Username = userName ?? "";
        return Task.CompletedTask;
    }

    public Task<string?> GetNormalizedUserNameAsync(AppUser user, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(user.NormalizedUsername);

    public Task SetNormalizedUserNameAsync(AppUser user, string? normalizedName, CancellationToken cancellationToken)
    {
        user.NormalizedUsername = normalizedName ?? "";
        return Task.CompletedTask;
    }

    public Task SetPasswordHashAsync(AppUser user, string? passwordHash, CancellationToken cancellationToken)
    {
        user.PasswordHash = passwordHash ?? "";
        return Task.CompletedTask;
    }

    public Task<string?> GetPasswordHashAsync(AppUser user, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(user.PasswordHash);

    public Task<bool> HasPasswordAsync(AppUser user, CancellationToken cancellationToken) =>
        Task.FromResult(!string.IsNullOrWhiteSpace(user.PasswordHash));

    public Task SetEmailAsync(AppUser user, string? email, CancellationToken cancellationToken)
    {
        user.Email = email ?? "";
        return Task.CompletedTask;
    }

    public Task<string?> GetEmailAsync(AppUser user, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(user.Email);

    public Task<bool> GetEmailConfirmedAsync(AppUser user, CancellationToken cancellationToken) =>
        Task.FromResult(true);

    public Task SetEmailConfirmedAsync(AppUser user, bool confirmed, CancellationToken cancellationToken) =>
        Task.CompletedTask;

    public Task<AppUser?> FindByEmailAsync(string normalizedEmail, CancellationToken cancellationToken) =>
        _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.ProjectScopes)
            .Include(u => u.WarehouseScopes)
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

    public Task<string?> GetNormalizedEmailAsync(AppUser user, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(user.NormalizedEmail);

    public Task SetNormalizedEmailAsync(AppUser user, string? normalizedEmail, CancellationToken cancellationToken)
    {
        user.NormalizedEmail = normalizedEmail ?? "";
        return Task.CompletedTask;
    }

    public async Task AddToRoleAsync(AppUser user, string roleName, CancellationToken cancellationToken)
    {
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == roleName || r.Name.ToUpper() == roleName.ToUpper(), cancellationToken)
                   ?? throw new InvalidOperationException($"Role '{roleName}' was not found.");
        if (await _db.UserRoles.AnyAsync(ur => ur.UserId == user.Id && ur.RoleId == role.Id, cancellationToken))
        {
            return;
        }

        _db.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveFromRoleAsync(AppUser user, string roleName, CancellationToken cancellationToken)
    {
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == roleName || r.Name.ToUpper() == roleName.ToUpper(), cancellationToken);
        if (role == null) return;
        var link = await _db.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == user.Id && ur.RoleId == role.Id, cancellationToken);
        if (link == null) return;
        _db.UserRoles.Remove(link);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IList<string>> GetRolesAsync(AppUser user, CancellationToken cancellationToken)
    {
        return await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.UserId == user.Id)
            .Join(_db.Roles, ur => ur.RoleId, r => r.Id, (_, r) => r.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> IsInRoleAsync(AppUser user, string roleName, CancellationToken cancellationToken)
    {
        var roles = await GetRolesAsync(user, cancellationToken);
        return roles.Any(r => string.Equals(r, roleName, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<IList<AppUser>> GetUsersInRoleAsync(string roleName, CancellationToken cancellationToken)
    {
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name.ToUpper() == roleName.ToUpper(), cancellationToken);
        if (role == null) return Array.Empty<AppUser>();
        return await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.RoleId == role.Id)
            .Join(_db.Users, ur => ur.UserId, u => u.Id, (_, u) => u)
            .ToListAsync(cancellationToken);
    }

    // Existing schema has no SecurityStamp column — derive a stable stamp from the password hash.
    public Task SetSecurityStampAsync(AppUser user, string stamp, CancellationToken cancellationToken) =>
        Task.CompletedTask;

    public Task<string?> GetSecurityStampAsync(AppUser user, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(string.IsNullOrEmpty(user.PasswordHash) ? user.Id : user.PasswordHash);
}
