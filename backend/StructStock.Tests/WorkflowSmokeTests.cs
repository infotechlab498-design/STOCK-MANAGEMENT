using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace StructStock.Tests;

public class WorkflowSmokeTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public WorkflowSmokeTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(_ => { });
    }

    [Fact]
    public async Task Login_And_List_Materials_Works()
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            usernameOrEmail = "admin",
            password = "Admin@2026!Stock"
        });

        Assert.True(login.IsSuccessStatusCode, await login.Content.ReadAsStringAsync());
        using var loginDoc = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
        var data = loginDoc.RootElement.GetProperty("data");
        var token = data.TryGetProperty("accessToken", out var at) ? at.GetString() : data.GetProperty("token").GetString();
        Assert.False(string.IsNullOrWhiteSpace(token));
        Assert.True(data.TryGetProperty("accessToken", out _), "Login must return accessToken for the React client");

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var materials = await client.GetAsync("/api/v1/materials");
        Assert.True(materials.IsSuccessStatusCode, await materials.Content.ReadAsStringAsync());

        var settings = await client.GetAsync("/api/v1/settings");
        Assert.True(settings.IsSuccessStatusCode, await settings.Content.ReadAsStringAsync());

        var dashboard = await client.GetAsync("/api/v1/dashboard/summary");
        Assert.True(dashboard.IsSuccessStatusCode, await dashboard.Content.ReadAsStringAsync());
    }
}
