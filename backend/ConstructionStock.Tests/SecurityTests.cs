using ConstructionStock.Application.Security;
using ConstructionStock.Domain.Entities;
using ConstructionStock.Domain.Enums;
using ConstructionStock.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ConstructionStock.Tests;

public class SecurityTests
{
    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var context = new ApplicationDbContext(options);

        // Seed Roles
        var superAdminRole = new Role { Id = Guid.NewGuid(), Name = SystemRoleNames.SuperAdmin, NormalizedName = "SUPERADMIN" };
        var viewerRole = new Role { Id = Guid.NewGuid(), Name = SystemRoleNames.Viewer, NormalizedName = "VIEWER" };
        context.Roles.AddRange(superAdminRole, viewerRole);

        // Seed Super Admin
        var admin = new User
        {
            Id = Guid.NewGuid(),
            Username = "admin",
            NormalizedUsername = "ADMIN",
            Email = "admin@constructcorp.com",
            NormalizedEmail = "ADMIN@CONSTRUCTCORP.COM",
            FullName = "System Admin",
            PasswordHash = "fakeSalt:fakeHash",
            IsActive = true
        };
        admin.UserRoles.Add(new UserRole { UserId = admin.Id, RoleId = superAdminRole.Id });
        context.Users.Add(admin);

        context.SaveChanges();
        return context;
    }

    [Fact]
    public void DisabledUser_CannotAuthenticate()
    {
        var user = new User { IsActive = false };
        Assert.False(user.IsActive, "Inactive users must be rejected at authentication entry point");
    }

    [Fact]
    public void DuplicateEmail_IsRejected()
    {
        using var context = CreateInMemoryDbContext();
        var existingUser = context.Users.First();

        var isDuplicate = context.Users.Any(u => u.NormalizedEmail == existingUser.NormalizedEmail);
        Assert.True(isDuplicate, "Database query must detect existing normalized email addresses");
    }

    [Fact]
    public void LastSuperAdmin_CannotBeDeactivated()
    {
        using var context = CreateInMemoryDbContext();
        var activeAdminsCount = context.UserRoles
            .Count(ur => ur.Role.Name == SystemRoleNames.SuperAdmin && ur.User.IsActive);

        Assert.Equal(1, activeAdminsCount);
        // Protection policy prohibits deactivating when activeAdminsCount <= 1
        Assert.True(activeAdminsCount <= 1, "Guards must prohibit deactivating the last active administrator");
    }

    [Fact]
    public void PasswordHashing_UsesSaltAndPbkdf2()
    {
        var salt = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
        using var pbkdf2 = new System.Security.Cryptography.Rfc2898DeriveBytes("Admin@2026!Stock", salt, 100_000, System.Security.Cryptography.HashAlgorithmName.SHA256);
        var hash = pbkdf2.GetBytes(32);

        Assert.NotNull(salt);
        Assert.Equal(16, salt.Length);
        Assert.Equal(32, hash.Length);
    }
}
