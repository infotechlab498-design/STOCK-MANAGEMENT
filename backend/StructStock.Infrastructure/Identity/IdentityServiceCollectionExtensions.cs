using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using StructStock.Domain;

namespace StructStock.Infrastructure.Identity;

public static class IdentityServiceCollectionExtensions
{
    /// <summary>
    /// Registers ASP.NET Core Identity Core against existing AppUser/Role tables (no AspNet* schema).
    /// </summary>
    public static IdentityBuilder AddStructStockIdentity(this IServiceCollection services)
    {
        var builder = services
            .AddIdentityCore<AppUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.Lockout.AllowedForNewUsers = false;
            })
            .AddRoles<Role>()
            .AddUserStore<AppUserStore>()
            .AddRoleStore<AppRoleStore>();

        // Override default Identity hasher with StructStock PBKDF2 (salt:hash) format.
        services.AddScoped<IPasswordHasher<AppUser>, CompatPasswordHasher>();
        return builder;
    }
}
