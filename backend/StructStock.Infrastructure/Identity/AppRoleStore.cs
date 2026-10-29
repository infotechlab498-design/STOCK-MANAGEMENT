using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using StructStock.Domain;

namespace StructStock.Infrastructure.Identity;

public sealed class AppRoleStore : IRoleStore<Role>
{
    private readonly AppDbContext _db;

    public AppRoleStore(AppDbContext db) => _db = db;

    public void Dispose() { }

    public async Task<IdentityResult> CreateAsync(Role role, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (string.IsNullOrWhiteSpace(role.Id))
        {
            role.Id = $"ROL-{Guid.NewGuid():N}"[..12].ToUpperInvariant();
        }

        _db.Roles.Add(role);
        await _db.SaveChangesAsync(cancellationToken);
        return IdentityResult.Success;
    }

    public async Task<IdentityResult> UpdateAsync(Role role, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _db.Roles.Update(role);
        await _db.SaveChangesAsync(cancellationToken);
        return IdentityResult.Success;
    }

    public async Task<IdentityResult> DeleteAsync(Role role, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _db.Roles.Remove(role);
        await _db.SaveChangesAsync(cancellationToken);
        return IdentityResult.Success;
    }

    public Task<string> GetRoleIdAsync(Role role, CancellationToken cancellationToken) =>
        Task.FromResult(role.Id);

    public Task<string?> GetRoleNameAsync(Role role, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(role.Name);

    public Task SetRoleNameAsync(Role role, string? roleName, CancellationToken cancellationToken)
    {
        role.Name = roleName ?? "";
        return Task.CompletedTask;
    }

    public Task<string?> GetNormalizedRoleNameAsync(Role role, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(role.Name.ToUpperInvariant());

    public Task SetNormalizedRoleNameAsync(Role role, string? normalizedName, CancellationToken cancellationToken) =>
        Task.CompletedTask;

    public Task<Role?> FindByIdAsync(string roleId, CancellationToken cancellationToken) =>
        _db.Roles.FirstOrDefaultAsync(r => r.Id == roleId, cancellationToken);

    public Task<Role?> FindByNameAsync(string normalizedRoleName, CancellationToken cancellationToken) =>
        _db.Roles.FirstOrDefaultAsync(r => r.Name.ToUpper() == normalizedRoleName, cancellationToken);
}
