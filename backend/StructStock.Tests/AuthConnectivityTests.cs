using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace StructStock.Tests;

public class AuthConnectivityTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public AuthConnectivityTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(_ => { });
    }

    [Fact]
    public async Task Health_And_Db_Endpoints_Succeed()
    {
        var client = _factory.CreateClient();
        var health = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, health.StatusCode);

        var db = await client.GetAsync("/health/db");
        Assert.Equal(HttpStatusCode.OK, db.StatusCode);
        using var doc = JsonDocument.Parse(await db.Content.ReadAsStringAsync());
        Assert.Equal("ok", doc.RootElement.GetProperty("status").GetString());
        Assert.True(doc.RootElement.GetProperty("canConnect").GetBoolean());
    }

    [Fact]
    public async Task Login_Returns_AccessToken_And_Identity_Password_Works()
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            usernameOrEmail = "admin@constructcorp.com",
            password = "Admin@2026!Stock"
        });
        Assert.True(login.IsSuccessStatusCode, await login.Content.ReadAsStringAsync());
        using var doc = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
        var data = doc.RootElement.GetProperty("data");
        Assert.True(data.TryGetProperty("accessToken", out var tokenEl));
        var token = tokenEl.GetString();
        Assert.False(string.IsNullOrWhiteSpace(token));

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var me = await client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    [Fact]
    public async Task Invalid_Login_Is_Unauthorized()
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            usernameOrEmail = "admin",
            password = "wrong-password"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact]
    public async Task Disabled_User_Is_Forbidden()
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            usernameOrEmail = "disabled.user",
            password = "Disabled@2026!Test"
        });
        Assert.Equal(HttpStatusCode.Forbidden, login.StatusCode);
    }

    [Fact]
    public async Task Protected_Routes_Require_Jwt()
    {
        var client = _factory.CreateClient();
        var materials = await client.GetAsync("/api/v1/materials");
        Assert.Equal(HttpStatusCode.Unauthorized, materials.StatusCode);

        var projects = await client.GetAsync("/api/v1/projects");
        Assert.Equal(HttpStatusCode.Unauthorized, projects.StatusCode);
    }

    [Fact]
    public async Task SignalR_Negotiate_Requires_Auth_Or_Accepts_Token()
    {
        var client = _factory.CreateClient();
        var anon = await client.PostAsync("/hubs/inventory/negotiate?negotiateVersion=1", null);
        Assert.True(
            anon.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.OK,
            $"Unexpected negotiate status without token: {anon.StatusCode}");

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            usernameOrEmail = "admin",
            password = "Admin@2026!Stock"
        });
        using var doc = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
        var token = doc.RootElement.GetProperty("data").GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var negotiate = await client.PostAsync("/hubs/inventory/negotiate?negotiateVersion=1", null);
        Assert.True(negotiate.IsSuccessStatusCode, await negotiate.Content.ReadAsStringAsync());
    }
}
