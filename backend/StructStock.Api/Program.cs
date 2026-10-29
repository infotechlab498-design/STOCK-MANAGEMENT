using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StructStock.Api;
using StructStock.Api.Auth;
using StructStock.Api.Realtime;
using StructStock.Application;
using StructStock.Domain;
using StructStock.Infrastructure;
using StructStock.Infrastructure.Identity;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("SqlServer")));
builder.Services.AddStructStockIdentity();
builder.Services.AddScoped<CurrentUserState>();
builder.Services.AddScoped<ICurrentUser>(sp => sp.GetRequiredService<CurrentUserState>());
builder.Services.AddScoped<CurrentUserAccessor>();
builder.Services.AddScoped<InventoryApp>();
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddSingleton<ILiveEvents, LiveEventsPublisher>();
builder.Services.AddSignalR();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyHeader().AllowAnyMethod().AllowCredentials()
        .SetIsOriginAllowed(_ => true)));

var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? "construction_stock_jwt_secure_key_2026_enterprise_audit_token";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "https://constructcorp.internal";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "https://constructstock.app";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            NameClaimType = "sub",
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.Use(async (ctx, next) =>
{
    var accessor = ctx.RequestServices.GetRequiredService<CurrentUserAccessor>();
    accessor.SyncFromHttpContext();
    await next();
});
app.UseAuthorization();

app.Use(async (ctx, next) =>
{
    try
    {
        await next();
    }
    catch (AppException ex)
    {
        ctx.Response.StatusCode = ex.Status;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsJsonAsync(ApiResponse.Fail(ex.Message));
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Unhandled error");
        ctx.Response.StatusCode = 500;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsJsonAsync(ApiResponse.Fail("Internal server error"));
    }
});

var v1 = app.MapGroup("/api/v1");
v1.MapStructStockApi();
var v0 = app.MapGroup("/api");
v0.MapStructStockApi();

app.MapHub<InventoryHub>("/hubs/inventory");

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/health/db", async (AppDbContext db, CancellationToken ct) =>
{
    try
    {
        var canConnect = await db.Database.CanConnectAsync(ct);
        if (!canConnect)
        {
            return Results.Json(new { status = "unhealthy", database = "unreachable" }, statusCode: 503);
        }

        var userCount = await db.Users.AsNoTracking().CountAsync(ct);
        var settingsPresent = await db.Settings.AsNoTracking().AnyAsync(ct);
        return Results.Ok(new
        {
            status = "ok",
            database = "StructStock",
            canConnect = true,
            users = userCount,
            settingsPresent
        });
    }
    catch (Exception)
    {
        return Results.Json(new { status = "unhealthy", database = "error" }, statusCode: 503);
    }
});

if (args.Contains("seed-json"))
{
    await DatabaseBootstrap.EnsureDatabaseAsync(app);
    using var scope = app.Services.CreateScope();
    var importer = new JsonSeedImporter(
        scope.ServiceProvider.GetRequiredService<AppDbContext>(),
        Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "..", "data")));
    await importer.ImportAsync();
    return;
}

await DatabaseBootstrap.EnsureDatabaseAsync(app);
app.Run();

public partial class Program;
