using Microsoft.AspNetCore.Identity;
using StructStock.Domain;

namespace StructStock.Infrastructure.Identity;

/// <summary>
/// Bridges ASP.NET Core Identity password APIs to the existing StructStock
/// PBKDF2 format (base64Salt:base64Hash). No password rehash / table rewrite.
/// </summary>
public sealed class CompatPasswordHasher : IPasswordHasher<AppUser>
{
    public string HashPassword(AppUser user, string password) =>
        PasswordHasher.Hash(password);

    public PasswordVerificationResult VerifyHashedPassword(AppUser user, string hashedPassword, string providedPassword)
    {
        if (string.IsNullOrWhiteSpace(hashedPassword) || string.IsNullOrWhiteSpace(providedPassword))
        {
            return PasswordVerificationResult.Failed;
        }

        return PasswordHasher.Verify(providedPassword, hashedPassword)
            ? PasswordVerificationResult.Success
            : PasswordVerificationResult.Failed;
    }
}
