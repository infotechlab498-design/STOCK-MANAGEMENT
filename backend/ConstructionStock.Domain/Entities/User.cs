namespace ConstructionStock.Domain.Entities;

/// <summary>
/// User identity entity.
/// Passwords must always be hashed with strong salt before persisting.
/// Plaintext passwords and hashes are never exposed via DTOs.
/// </summary>
public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Username { get; set; } = string.Empty;
    public string NormalizedUsername { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;
    public string NormalizedEmail { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    /// <summary>
    /// PBKDF2/Argon2 password hash with cryptographic salt.
    /// Internal only - never returned in API payloads.
    /// </summary>
    public string PasswordHash { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
    public DateTime? LastLoginAtUtc { get; set; }

    // Concurrency check token
    public byte[] RowVersion { get; set; } = [];

    // Navigation properties
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<UserProjectScope> ProjectScopes { get; set; } = new List<UserProjectScope>();
    public ICollection<UserWarehouseScope> WarehouseScopes { get; set; } = new List<UserWarehouseScope>();
}
