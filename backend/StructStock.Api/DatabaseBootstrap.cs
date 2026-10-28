using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using StructStock.Infrastructure;

namespace StructStock.Api;

public static class DatabaseBootstrap
{
    public static async Task EnsureDatabaseAsync(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var apply = config.GetValue("Database:ApplyScriptsOnStartup", false);
        if (!apply) return;

        var cs = config.GetConnectionString("SqlServer")
                 ?? throw new InvalidOperationException("ConnectionStrings:SqlServer is required");
        var dbPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "database"));
        var builder = new SqlConnectionStringBuilder(cs) { InitialCatalog = "master" };
        await using (var master = new SqlConnection(builder.ConnectionString))
        {
            await master.OpenAsync();
            await using var cmd = master.CreateCommand();
            cmd.CommandText = "IF DB_ID(N'StructStock') IS NULL CREATE DATABASE StructStock;";
            await cmd.ExecuteNonQueryAsync();
        }

        foreach (var file in new[] { "001_schema.sql", "002_seed.sql", "003_indexes.sql" })
        {
            var path = Path.Combine(dbPath, file);
            if (!File.Exists(path)) continue;
            var script = await File.ReadAllTextAsync(path);
            await ExecuteBatchesAsync(cs, script);
        }

        // Ensure passwords match demo credentials even if seed hashes drift
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await EnsureDemoPasswordsAsync(db);
    }

    private static async Task EnsureDemoPasswordsAsync(AppDbContext db)
    {
        var demos = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["admin"] = "Admin@2026!Stock",
            ["inv.manager"] = "Manager@2026!Inv",
            ["pm.metro"] = "Project@2026!Metro",
            ["store.north"] = "Store@2026!Keeper",
            ["procurement"] = "Procure@2026!Officer",
            ["accounts"] = "Accounts@2026!Valuation",
            ["auditor"] = "Viewer@2026!Audit",
            ["site.auditor"] = "Auditor@2026!Review",
            ["disabled.user"] = "Disabled@2026!Test"
        };

        var users = await db.Users.ToListAsync();
        var changed = false;
        foreach (var user in users)
        {
            if (!demos.TryGetValue(user.Username, out var password)) continue;
            if (!PasswordHasher.Verify(password, user.PasswordHash))
            {
                user.PasswordHash = PasswordHasher.Hash(password);
                changed = true;
            }
        }

        if (changed) await db.SaveChangesAsync();
    }

    private static async Task ExecuteBatchesAsync(string connectionString, string script)
    {
        var batches = System.Text.RegularExpressions.Regex.Split(script, @"^\s*GO\s*$",
            System.Text.RegularExpressions.RegexOptions.Multiline | System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync();
        foreach (var batch in batches)
        {
            var sql = batch.Trim();
            if (string.IsNullOrWhiteSpace(sql)) continue;
            // Skip CREATE DATABASE when already connected to StructStock
            if (sql.Contains("CREATE DATABASE StructStock", StringComparison.OrdinalIgnoreCase)) continue;
            await using var cmd = conn.CreateCommand();
            cmd.CommandTimeout = 120;
            cmd.CommandText = sql;
            try
            {
                await cmd.ExecuteNonQueryAsync();
            }
            catch (SqlException ex) when (ex.Number is 2714 or 1913 or 2627 or 2601)
            {
                // object already exists / duplicate key — safe for re-run
            }
        }
    }
}
