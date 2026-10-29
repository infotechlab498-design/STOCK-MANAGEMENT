using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using StructStock.Application;
using StructStock.Domain;

namespace StructStock.Api;

public static class ApiRoutes
{
    public static RouteGroupBuilder MapStructStockApi(this RouteGroupBuilder api)
    {
        api.MapPost("/auth/login", async (HttpRequest req, InventoryApp app, JwtTokenService jwt, CancellationToken ct) =>
        {
            var body = await ReadBody(req);
            var login = await app.LoginAsync(Str(body, "usernameOrEmail"), Str(body, "password"), req.HttpContext.Connection.RemoteIpAddress?.ToString(), ct);
            var (token, expires) = jwt.Create(login.User);
            var expiresInSeconds = Math.Max(1, (int)Math.Ceiling((expires - DateTime.UtcNow).TotalSeconds));
            // React client expects accessToken + expiresInSeconds; keep token for tests/compat.
            return Results.Ok(ApiResponse.Ok(new
            {
                accessToken = token,
                token,
                expiresInSeconds,
                expiresAtUtc = expires.ToString("o"),
                user = login.Profile
            }));
        });

        api.MapPost("/auth/logout", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.LogoutAsync(ct))).RequireAuthorization();
        api.MapGet("/auth/me", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.GetMeAsync(ct))).RequireAuthorization();
        api.MapGet("/roles", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.ListRolesAsync(ct))).RequireAuthorization();

        api.MapGet("/users", async (string? search, string? role, string? status, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListUsersAsync(search, role, status, ct))).RequireAuthorization();
        api.MapGet("/users/{id}", async (string id, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.GetUserAsync(id, ct))).RequireAuthorization();
        api.MapPost("/users", async (HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Created($"/api/v1/users", await app.CreateUserAsync(new CreateUserRequest(
                Str(b, "username")!, Str(b, "email")!, Str(b, "fullName")!, Str(b, "password")!,
                StrList(b, "roles"), StrList(b, "projectScopes"), StrList(b, "warehouseScopes")), ct));
        }).RequireAuthorization();
        api.MapPut("/users/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.UpdateUserAsync(id, new UpdateUserRequest(
                Str(b, "fullName"), Str(b, "email"), Str(b, "password"),
                b.TryGetProperty("roles", out _) ? StrList(b, "roles") : null,
                b.TryGetProperty("projectScopes", out _) ? StrList(b, "projectScopes") : null,
                b.TryGetProperty("warehouseScopes", out _) ? StrList(b, "warehouseScopes") : null), ct));
        }).RequireAuthorization();
        api.MapPatch("/users/{id}/status", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.PatchUserStatusAsync(id, Bool(b, "isActive"), Str(b, "reason"), ct));
        }).RequireAuthorization();

        // Masters
        api.MapGet("/material-categories", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.ListCategoriesAsync(ct))).RequireAuthorization();
        api.MapPost("/material-categories", async (HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.CreateCategoryAsync(Str(b, "code")!, Str(b, "name")!, Str(b, "description"), ct));
        }).RequireAuthorization();
        api.MapPut("/material-categories/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.UpdateCategoryAsync(id, Str(b, "name")!, Str(b, "description"), b.TryGetProperty("isActive", out var a) ? a.GetBoolean() : null, ct));
        }).RequireAuthorization();

        api.MapGet("/units", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.ListUnitsAsync(ct))).RequireAuthorization();
        api.MapPost("/units", async (HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.CreateUnitAsync(Str(b, "code")!, Str(b, "name")!, Str(b, "symbol") ?? "", ct));
        }).RequireAuthorization();
        api.MapPut("/units/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.UpdateUnitAsync(id, Str(b, "name")!, Str(b, "symbol"), b.TryGetProperty("isActive", out var a) ? a.GetBoolean() : null, ct));
        }).RequireAuthorization();
        api.MapGet("/unit-conversions", async (string? materialId, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListUnitConversionsAsync(materialId, ct))).RequireAuthorization();
        api.MapGet("/units/conversions", async (string? materialId, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListUnitConversionsAsync(materialId, ct))).RequireAuthorization();
        api.MapPost("/unit-conversions", async (HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.CreateUnitConversionAsync(Str(b, "fromUnitId")!, Str(b, "toUnitId")!, Dec(b, "conversionFactor"), Str(b, "materialId"), Str(b, "description"), ct));
        }).RequireAuthorization();

        api.MapGet("/materials", async (string? search, string? categoryId, string? status, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListMaterialsAsync(search, categoryId, status, ct))).RequireAuthorization();
        api.MapGet("/materials/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.GetMaterialAsync(id, ct))).RequireAuthorization();
        api.MapPost("/materials", async (HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.CreateMaterialAsync(new CreateMaterialRequest(
                Str(b, "itemCode")!, Str(b, "name")!, Str(b, "description"), Str(b, "specification"),
                Str(b, "categoryId")!, Str(b, "baseUnitId")!, Dec(b, "minimumStockLevel"), Dec(b, "reorderLevel")), ct));
        }).RequireAuthorization();
        api.MapPut("/materials/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.UpdateMaterialAsync(id, new UpdateMaterialRequest(
                Str(b, "name")!, Str(b, "description"), Str(b, "specification"),
                Str(b, "categoryId")!, Str(b, "baseUnitId")!, Dec(b, "minimumStockLevel"), Dec(b, "reorderLevel")), ct));
        }).RequireAuthorization();
        api.MapPatch("/materials/{id}/status", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.PatchMaterialStatusAsync(id, Bool(b, "isActive"), ct));
        }).RequireAuthorization();

        api.MapGet("/projects", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.ListProjectsAsync(ct))).RequireAuthorization();
        api.MapPost("/projects", async (HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.CreateProjectAsync(ReadProject(b), ct));
        }).RequireAuthorization();
        api.MapPut("/projects/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.UpdateProjectAsync(id, ReadProject(b), ct));
        }).RequireAuthorization();
        api.MapPatch("/projects/{id}/status", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.PatchProjectStatusAsync(id, Bool(b, "isActive"), ct));
        }).RequireAuthorization();

        api.MapGet("/warehouses", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.ListWarehousesAsync(ct))).RequireAuthorization();
        api.MapPost("/warehouses", async (HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.CreateWarehouseAsync(new CreateWarehouseRequest(Str(b, "code"), Str(b, "name"), Str(b, "type") ?? Str(b, "warehouseType"), Str(b, "projectId"), Str(b, "location")), ct));
        }).RequireAuthorization();
        api.MapPut("/warehouses/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.UpdateWarehouseAsync(id, new CreateWarehouseRequest(Str(b, "code"), Str(b, "name"), Str(b, "type") ?? Str(b, "warehouseType"), Str(b, "projectId"), Str(b, "location")), ct));
        }).RequireAuthorization();
        api.MapPatch("/warehouses/{id}/status", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.PatchWarehouseStatusAsync(id, Bool(b, "isActive"), ct));
        }).RequireAuthorization();

        api.MapGet("/settings", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.GetSettingsAsync(ct))).RequireAuthorization();
        api.MapPut("/settings", async (HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.UpdateSettingsAsync(new UpdateSettingsRequest(
                Str(b, "valuationDescription"),
                OptBool(b, "negativeStockAllowed"), OptBool(b, "selfApprovalAllowed"), OptBool(b, "requireGrnInspectionBeforePosting"),
                OptInt(b, "jwtExpirySeconds"), Str(b, "currency"), OptInt(b, "auditTrailRetentionDays"),
                Str(b, "prefixRequisition"), Str(b, "prefixPurchaseOrder"), Str(b, "prefixGrn"),
                Str(b, "prefixIssue"), Str(b, "prefixReturn"), Str(b, "prefixTransfer"),
                Str(b, "prefixStock"), Str(b, "prefixQuotation")), ct));
        }).RequireAuthorization();

        api.MapGet("/suppliers", async (string? search, string? status, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListSuppliersAsync(search, status, ct))).RequireAuthorization();
        api.MapGet("/suppliers/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.GetSupplierAsync(id, ct))).RequireAuthorization();
        api.MapGet("/suppliers/{id}/purchase-orders", async (string id, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.GetSupplierPurchaseOrdersAsync(id, ct))).RequireAuthorization();
        api.MapPost("/suppliers", async (HttpRequest req, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.CreateSupplierAsync(await ReadSupplier(req), ct))).RequireAuthorization();
        api.MapPut("/suppliers/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.UpdateSupplierAsync(id, await ReadSupplier(req), ct))).RequireAuthorization();
        api.MapPatch("/suppliers/{id}/status", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.PatchSupplierStatusAsync(id, Bool(b, "isActive"), ct));
        }).RequireAuthorization();

        MapWorkflowRoutes(api);
        return api;
    }

    private static void MapWorkflowRoutes(RouteGroupBuilder api)
    {
        api.MapGet("/requisitions", async (string? search, string? status, string? projectId, int? page, int? pageSize, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListRequisitionsAsync(search, status, projectId, page, pageSize, ct))).RequireAuthorization();
        api.MapGet("/approvals/inbox", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.ApprovalsInboxAsync(ct))).RequireAuthorization();
        api.MapGet("/requisitions/approved-for-po", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.ApprovedRequisitionsForPoAsync(ct))).RequireAuthorization();
        api.MapGet("/requisitions/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.GetRequisitionAsync(id, ct))).RequireAuthorization();
        api.MapGet("/requisitions/{id}/fulfillment", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.GetRequisitionFulfillmentAsync(id, ct))).RequireAuthorization();
        api.MapPost("/requisitions", async (HttpRequest req, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.CreateRequisitionAsync(await ReadRequisition(req), ct))).RequireAuthorization();
        api.MapPut("/requisitions/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.UpdateRequisitionAsync(id, await ReadRequisition(req), ct))).RequireAuthorization();
        api.MapPost("/requisitions/{id}/submit", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.SubmitRequisitionAsync(id, ct))).RequireAuthorization();
        api.MapPost("/requisitions/{id}/approve", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.ApproveRequisitionAsync(id, Str(b, "comments"), ct));
        }).RequireAuthorization();
        api.MapPost("/requisitions/{id}/reject", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.RejectRequisitionAsync(id, Str(b, "reason") ?? Str(b, "comments"), ct));
        }).RequireAuthorization();
        api.MapPost("/requisitions/{id}/return-for-correction", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.ReturnRequisitionAsync(id, Str(b, "notes") ?? Str(b, "comments"), ct));
        }).RequireAuthorization();
        api.MapDelete("/requisitions/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.DeleteRequisitionAsync(id, ct))).RequireAuthorization();

        api.MapGet("/purchase-orders", async (string? search, string? status, string? projectId, string? supplierId, int? page, int? pageSize, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListPurchaseOrdersAsync(search, status, projectId, supplierId, page, pageSize, ct))).RequireAuthorization();
        api.MapGet("/purchase-orders/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.GetPurchaseOrderAsync(id, ct))).RequireAuthorization();
        api.MapGet("/purchase-orders/{id}/history", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.PurchaseOrderHistoryAsync(id, ct))).RequireAuthorization();
        api.MapGet("/purchase-orders/{id}/receipts", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.PoReceiptsAsync(id, ct))).RequireAuthorization();
        api.MapGet("/pending-deliveries", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.PendingDeliveriesAsync(ct))).RequireAuthorization();
        api.MapPost("/purchase-orders", async (HttpRequest req, InventoryApp app, CancellationToken ct) => Results.Ok(await app.CreatePurchaseOrderAsync(await ReadPo(req), ct))).RequireAuthorization();
        api.MapPut("/purchase-orders/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) => Results.Ok(await app.UpdatePurchaseOrderAsync(id, await ReadPo(req), ct))).RequireAuthorization();
        api.MapPost("/purchase-orders/{id}/submit", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.SubmitPurchaseOrderAsync(id, ct))).RequireAuthorization();
        api.MapPost("/purchase-orders/{id}/approve", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.ApprovePurchaseOrderAsync(id, Str(b, "comments"), ct));
        }).RequireAuthorization();
        api.MapPost("/purchase-orders/{id}/reject", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.RejectPurchaseOrderAsync(id, Str(b, "reason"), ct));
        }).RequireAuthorization();
        api.MapPost("/purchase-orders/{id}/issue", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.IssuePurchaseOrderAsync(id, ct))).RequireAuthorization();
        api.MapPost("/purchase-orders/{id}/cancel", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.CancelPurchaseOrderAsync(id, Str(b, "reason"), ct));
        }).RequireAuthorization();

        api.MapGet("/quotations", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.ListQuotationsAsync(ct))).RequireAuthorization();
        api.MapGet("/quotations/compare", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.CompareQuotationsAsync(ct))).RequireAuthorization();
        api.MapPost("/quotations", async (HttpRequest req, InventoryApp app, CancellationToken ct) => Results.Ok(await app.CreateQuotationAsync(await ReadQuotation(req), ct))).RequireAuthorization();

        api.MapGet("/grns", async (string? search, string? status, string? projectId, int? page, int? pageSize, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListGrnsAsync(search, status, projectId, page, pageSize, ct))).RequireAuthorization();
        api.MapGet("/grns/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.GetGrnAsync(id, ct))).RequireAuthorization();
        api.MapGet("/grns/{id}/history", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.GrnHistoryAsync(id, ct))).RequireAuthorization();
        api.MapPost("/grns", async (HttpRequest req, InventoryApp app, CancellationToken ct) => Results.Ok(await app.CreateGrnAsync(await ReadGrn(req), ct))).RequireAuthorization();
        api.MapPut("/grns/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) => Results.Ok(await app.UpdateGrnAsync(id, await ReadGrn(req), ct))).RequireAuthorization();
        api.MapPost("/grns/{id}/submit", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.SubmitGrnAsync(id, ct))).RequireAuthorization();
        api.MapPost("/grns/{id}/inspect", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.InspectGrnAsync(id, ReadChecklist(b), ct));
        }).RequireAuthorization();
        api.MapPost("/grns/{id}/approve", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.ApproveGrnAsync(id, Str(b, "comments"), ct));
        }).RequireAuthorization();
        api.MapPost("/grns/{id}/reject", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.RejectGrnAsync(id, Str(b, "reason"), ct));
        }).RequireAuthorization();
        api.MapPost("/grns/{id}/return-for-correction", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.ReturnGrnAsync(id, Str(b, "notes"), ct));
        }).RequireAuthorization();
        api.MapPost("/grns/{id}/post", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.PostGrnAsync(id, ct))).RequireAuthorization();
        api.MapPost("/api/grns/{id}/post", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.PostGrnAsync(id, ct))).RequireAuthorization();

        api.MapGet("/inventory/balances", async (string? search, string? projectId, string? warehouseId, string? materialId, string? status, int? page, int? pageSize, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListBalancesAsync(search, projectId, warehouseId, materialId, status, page, pageSize, ct))).RequireAuthorization();
        api.MapGet("/inventory/balances/{materialId}", async (string materialId, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.GetBalancesForMaterialAsync(materialId, ct))).RequireAuthorization();
        api.MapGet("/inventory/ledger", async (string? search, string? projectId, string? warehouseId, string? materialId, string? transactionType, int? page, int? pageSize, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListLedgerAsync(search, projectId, warehouseId, materialId, transactionType, page, pageSize, ct))).RequireAuthorization();
        api.MapGet("/inventory/ledger/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.GetLedgerEntryAsync(id, ct))).RequireAuthorization();
        api.MapGet("/inventory/valuation", async (string? projectId, string? warehouseId, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ValuationAsync(projectId, warehouseId, ct))).RequireAuthorization();
        api.MapGet("/inventory/reconciliation", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.ReconciliationAsync(ct))).RequireAuthorization();
        api.MapPost("/inventory/reconciliation/recover", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.RecoverBalancesAsync(ct))).RequireAuthorization();
        api.MapGet("/inventory/in-transit", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.InTransitInventoryAsync(ct))).RequireAuthorization();
        api.MapPut("/inventory/ledger/{id}", () => Results.Json(ApiResponse.Fail("Ledger entries are append-only"), statusCode: 405)).RequireAuthorization();
        api.MapPut("/inventory/balances/{id}", () => Results.Json(ApiResponse.Fail("Balances are projections; use reconciliation recover"), statusCode: 405)).RequireAuthorization();
        api.MapDelete("/inventory/ledger/{id}", () => Results.Json(ApiResponse.Fail("Ledger entries are append-only"), statusCode: 405)).RequireAuthorization();
        api.MapDelete("/inventory/balances/{id}", () => Results.Json(ApiResponse.Fail("Balances cannot be deleted"), statusCode: 405)).RequireAuthorization();

        MapMovementRoutes(api);
        MapReportRoutes(api);
    }

    private static void MapMovementRoutes(RouteGroupBuilder api)
    {
        api.MapGet("/material-issues", async (string? status, string? projectId, int? page, int? pageSize, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListIssuesAsync(status, projectId, page, pageSize, ct))).RequireAuthorization();
        api.MapGet("/material-issues/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.GetIssueAsync(id, ct))).RequireAuthorization();
        api.MapGet("/material-issues/{id}/history", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.IssueHistoryAsync(id, ct))).RequireAuthorization();
        api.MapPost("/material-issues", async (HttpRequest req, InventoryApp app, CancellationToken ct) => Results.Ok(await app.CreateIssueAsync(await ReadIssue(req), ct))).RequireAuthorization();
        api.MapPut("/material-issues/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) => Results.Ok(await app.UpdateIssueAsync(id, await ReadIssue(req), ct))).RequireAuthorization();
        api.MapPost("/material-issues/{id}/submit", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.SubmitIssueAsync(id, ct))).RequireAuthorization();
        api.MapPost("/material-issues/{id}/approve", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.ApproveIssueAsync(id, Str(b, "comments"), ct));
        }).RequireAuthorization();
        api.MapPost("/material-issues/{id}/reject", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.RejectIssueAsync(id, Str(b, "reason"), ct));
        }).RequireAuthorization();
        api.MapPost("/material-issues/{id}/return-for-correction", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.ReturnIssueAsync(id, Str(b, "notes"), ct));
        }).RequireAuthorization();
        api.MapPost("/material-issues/{id}/post", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.PostIssueAsync(id, ct))).RequireAuthorization();
        api.MapDelete("/material-issues/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.DeleteIssueAsync(id, ct))).RequireAuthorization();

        api.MapGet("/material-returns", async (string? status, string? projectId, int? page, int? pageSize, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListReturnsAsync(status, projectId, page, pageSize, ct))).RequireAuthorization();
        api.MapGet("/material-returns/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.GetReturnAsync(id, ct))).RequireAuthorization();
        api.MapGet("/material-returns/{id}/history", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.ReturnHistoryAsync(id, ct))).RequireAuthorization();
        api.MapPost("/material-returns", async (HttpRequest req, InventoryApp app, CancellationToken ct) => Results.Ok(await app.CreateReturnAsync(await ReadReturn(req), ct))).RequireAuthorization();
        api.MapPut("/material-returns/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) => Results.Ok(await app.UpdateReturnAsync(id, await ReadReturn(req), ct))).RequireAuthorization();
        api.MapPost("/material-returns/{id}/inspect", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.InspectReturnAsync(id, ct))).RequireAuthorization();
        api.MapPost("/material-returns/{id}/approve", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.ApproveReturnAsync(id, ct))).RequireAuthorization();
        api.MapPost("/material-returns/{id}/post", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.PostReturnAsync(id, ct))).RequireAuthorization();
        api.MapDelete("/material-returns/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.DeleteReturnAsync(id, ct))).RequireAuthorization();

        api.MapGet("/stock-transfers", async (string? status, int? page, int? pageSize, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListTransfersAsync(status, page, pageSize, ct))).RequireAuthorization();
        api.MapGet("/stock-transfers/discrepancies", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.DiscrepanciesAsync(ct))).RequireAuthorization();
        api.MapGet("/stock-transfers/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.GetTransferAsync(id, ct))).RequireAuthorization();
        api.MapGet("/stock-transfers/{id}/history", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.TransferHistoryAsync(id, ct))).RequireAuthorization();
        api.MapGet("/stock-transfers/{id}/reconciliation", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.TransferReconciliationAsync(id, ct))).RequireAuthorization();
        api.MapPost("/stock-transfers", async (HttpRequest req, InventoryApp app, CancellationToken ct) => Results.Ok(await app.CreateTransferAsync(await ReadTransfer(req), ct))).RequireAuthorization();
        api.MapPut("/stock-transfers/{id}", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) => Results.Ok(await app.UpdateTransferAsync(id, await ReadTransfer(req), ct))).RequireAuthorization();
        api.MapPost("/stock-transfers/{id}/submit", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.SubmitTransferAsync(id, ct))).RequireAuthorization();
        api.MapPost("/stock-transfers/{id}/approve", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.ApproveTransferAsync(id, ct))).RequireAuthorization();
        api.MapPost("/stock-transfers/{id}/reject", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.RejectTransferAsync(id, Str(b, "reason"), ct));
        }).RequireAuthorization();
        api.MapPost("/stock-transfers/{id}/return-for-correction", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.ReturnTransferAsync(id, Str(b, "notes"), ct));
        }).RequireAuthorization();
        api.MapPost("/stock-transfers/{id}/cancel", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.CancelTransferAsync(id, Str(b, "reason"), ct));
        }).RequireAuthorization();
        api.MapPost("/stock-transfers/{id}/dispatch", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.DispatchTransferAsync(id, new TransferDispatchRequest(Str(b, "vehicleNumber"), Str(b, "driverName"), Str(b, "dispatchReference")), ct));
        }).RequireAuthorization();
        api.MapPost("/stock-transfers/{id}/receive", async (string id, HttpRequest req, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ReceiveTransferAsync(id, await ReadTransferReceive(req), ct))).RequireAuthorization();
        api.MapPost("/stock-transfers/{id}/inspect", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.InspectTransferAsync(id, ct))).RequireAuthorization();
        api.MapPost("/stock-transfers/{id}/complete", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.CompleteTransferAsync(id, ct))).RequireAuthorization();
        api.MapPost("/stock-transfers/{id}/discrepancies/{lineId}/resolve", async (string id, string lineId, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var b = await ReadBody(req);
            return Results.Ok(await app.ResolveDiscrepancyAsync(id, lineId, new ResolveDiscrepancyRequest(Str(b, "resolutionAction"), Str(b, "resolutionNotes")), ct));
        }).RequireAuthorization();
        api.MapDelete("/stock-transfers/{id}", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.DeleteTransferAsync(id, ct))).RequireAuthorization();
    }

    private static void MapReportRoutes(RouteGroupBuilder api)
    {
        api.MapGet("/notifications", async (int? page, int? pageSize, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.ListNotificationsAsync(page, pageSize, ct))).RequireAuthorization();
        api.MapGet("/notifications/unread-count", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.UnreadNotificationCountAsync(ct))).RequireAuthorization();
        api.MapPost("/notifications/{id}/read", async (string id, InventoryApp app, CancellationToken ct) => Results.Ok(await app.MarkNotificationReadAsync(id, ct))).RequireAuthorization();
        api.MapPost("/notifications/read-all", async (InventoryApp app, CancellationToken ct) => Results.Ok(await app.MarkAllNotificationsReadAsync(ct))).RequireAuthorization();
        api.MapGet("/dashboard/summary", async (string? projectId, string? warehouseId, string? fromDate, string? toDate, InventoryApp app, CancellationToken ct) =>
            Results.Ok(await app.DashboardSummaryAsync(projectId, warehouseId, fromDate, toDate, ct))).RequireAuthorization();
        api.MapGet("/reports/{reportType}", async (string reportType, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var filters = req.Query.ToDictionary(k => k.Key, v => (string?)v.Value.ToString());
            return Results.Ok(await app.GetReportAsync(reportType, filters, ct));
        }).RequireAuthorization();
        api.MapGet("/reports/{reportType}/export", async (string reportType, HttpRequest req, InventoryApp app, CancellationToken ct) =>
        {
            var filters = req.Query.ToDictionary(k => k.Key, v => (string?)v.Value.ToString());
            var (fileName, csv) = await app.ExportReportCsvAsync(reportType, filters, ct);
            return Results.File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", fileName);
        }).RequireAuthorization();
    }

    // ---- helpers ----
    private static async Task<JsonElement> ReadBody(HttpRequest req)
    {
        if (req.ContentLength is null or 0) return JsonDocument.Parse("{}").RootElement.Clone();
        using var doc = await JsonDocument.ParseAsync(req.Body);
        return doc.RootElement.Clone();
    }

    private static string? Str(JsonElement b, string name) =>
        b.TryGetProperty(name, out var p) && p.ValueKind != JsonValueKind.Null ? p.ToString() : null;

    private static bool Bool(JsonElement b, string name) =>
        b.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.True;

    private static bool? OptBool(JsonElement b, string name) =>
        b.TryGetProperty(name, out var p) && p.ValueKind is JsonValueKind.True or JsonValueKind.False ? p.GetBoolean() : null;

    private static int? OptInt(JsonElement b, string name) =>
        b.TryGetProperty(name, out var p) && p.TryGetInt32(out var v) ? v : null;

    private static decimal Dec(JsonElement b, string name) =>
        b.TryGetProperty(name, out var p) && p.TryGetDecimal(out var v) ? v : 0m;

    private static List<string> StrList(JsonElement b, string name)
    {
        if (!b.TryGetProperty(name, out var p) || p.ValueKind != JsonValueKind.Array) return new();
        return p.EnumerateArray().Select(x => x.ToString()).Where(x => !string.IsNullOrWhiteSpace(x)).ToList();
    }

    private static DateOnly Date(JsonElement b, string name)
    {
        var s = Str(b, name);
        return DateOnly.TryParse(s, out var d) ? d : default;
    }

    private static CreateProjectRequest ReadProject(JsonElement b) => new(
        Str(b, "code"), Str(b, "name"), Str(b, "location"), Str(b, "projectManagerId"), Str(b, "projectManagerName"),
        DateOnly.TryParse(Str(b, "startDate"), out var s) ? s : null,
        DateOnly.TryParse(Str(b, "targetCompletionDate"), out var t) ? t : null);

    private static async Task<CreateSupplierRequest> ReadSupplier(HttpRequest req)
    {
        var b = await ReadBody(req);
        return new CreateSupplierRequest(Str(b, "supplierCode"), Str(b, "name"), Str(b, "contactPerson"), Str(b, "phone"),
            Str(b, "email"), Str(b, "address"), Str(b, "taxReference"), Str(b, "paymentTerms"), Str(b, "notes"));
    }

    private static async Task<RequisitionWriteRequest> ReadRequisition(HttpRequest req)
    {
        var b = await ReadBody(req);
        var items = new List<RequisitionItemRequest>();
        if (b.TryGetProperty("items", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            items = arr.EnumerateArray().Select(i => new RequisitionItemRequest(Str(i, "materialId")!, Dec(i, "requestedQuantity"), Str(i, "remarks"))).ToList();
        }

        return new RequisitionWriteRequest(Str(b, "projectId"), Date(b, "requiredDate"), Str(b, "priority"), Str(b, "purpose"),
            Str(b, "workActivity"), Str(b, "siteLocationDetail"), items);
    }

    private static async Task<PoWriteRequest> ReadPo(HttpRequest req)
    {
        var b = await ReadBody(req);
        var items = new List<PoLineRequest>();
        if (b.TryGetProperty("items", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            items = arr.EnumerateArray().Select(i => new PoLineRequest(
                Str(i, "materialId")!, Str(i, "requisitionItemId"), Dec(i, "orderedQuantity"), Dec(i, "unitRate"),
                Dec(i, "lineDiscount"), Dec(i, "taxRate"), Str(i, "notes"))).ToList();
        }

        return new PoWriteRequest(Str(b, "supplierId"), Str(b, "requisitionId"), Str(b, "projectId"), Str(b, "deliveryLocation"),
            Date(b, "orderDate"), Date(b, "expectedDeliveryDate"), Str(b, "currency"), Str(b, "paymentTerms"), Str(b, "notes"),
            Dec(b, "headerDiscount"), Dec(b, "freight"), items);
    }

    private static async Task<QuotationWriteRequest> ReadQuotation(HttpRequest req)
    {
        var b = await ReadBody(req);
        var items = new List<QuotationLineRequest>();
        if (b.TryGetProperty("items", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            items = arr.EnumerateArray().Select(i => new QuotationLineRequest(
                Str(i, "materialId")!, Dec(i, "quotedQuantity"), Dec(i, "unitRate"), Dec(i, "discount"), Dec(i, "taxRate"), Dec(i, "estimatedFreight"))).ToList();
        }

        return new QuotationWriteRequest(Str(b, "supplierId"), Date(b, "date"), Date(b, "validUntil"), Str(b, "currency"), Str(b, "paymentTerms"), Str(b, "notes"), items);
    }

    private static InspectionChecklistRequest? ReadChecklist(JsonElement b)
    {
        var src = b.TryGetProperty("inspectionChecklist", out var c) ? c : b;
        if (src.ValueKind != JsonValueKind.Object) return null;
        return new InspectionChecklistRequest(
            Bool(src, "challanMatchesPO"), Bool(src, "vehicleUnloadedSafely"), Bool(src, "physicallyCounted"),
            Bool(src, "packagingIntact"), Bool(src, "batchTestCertsProvided"), Str(src, "testCertificateNumber"),
            Bool(src, "materialsMeetSpecs"), Bool(src, "binTagsAttached"), Str(src, "inspectionRemarks"),
            Bool(src, "discrepancyIdentified"), Bool(src, "debitNoteRequired"), Str(src, "debitNoteReason"));
    }

    private static async Task<GrnWriteRequest> ReadGrn(HttpRequest req)
    {
        var b = await ReadBody(req);
        var items = new List<GrnLineRequest>();
        if (b.TryGetProperty("items", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            items = arr.EnumerateArray().Select(i => new GrnLineRequest(
                Str(i, "purchaseOrderItemId")!, Dec(i, "deliveredQuantity"), Dec(i, "acceptedQuantity"),
                Dec(i, "rejectedQuantity"), Dec(i, "damagedQuantity"), Dec(i, "shortQuantity"),
                Str(i, "remarks"), Str(i, "storageLocation"))).ToList();
        }

        return new GrnWriteRequest(Str(b, "purchaseOrderId"), Str(b, "warehouseId"), Str(b, "storageLocation"),
            Date(b, "grnDate"), Str(b, "deliveryChallanNumber"),
            DateOnly.TryParse(Str(b, "deliveryChallanDate"), out var d) ? d : null,
            Str(b, "vehicleNumber"), Str(b, "deliveredBy"), Str(b, "generalRemarks"), ReadChecklist(b), items);
    }

    private static async Task<IssueWriteRequest> ReadIssue(HttpRequest req)
    {
        var b = await ReadBody(req);
        var items = new List<IssueLineRequest>();
        if (b.TryGetProperty("items", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            items = arr.EnumerateArray().Select(i => new IssueLineRequest(
                Str(i, "requisitionItemId")!, Dec(i, "previouslyFulfilledQuantity"), Dec(i, "quantityToIssue"),
                Str(i, "storageLocation"), Str(i, "remarks"))).ToList();
        }

        return new IssueWriteRequest(Str(b, "requisitionId"), Str(b, "warehouseId"), Date(b, "issueDate"),
            Str(b, "purpose"), Str(b, "workActivity"), Str(b, "receivedByPerson"), Str(b, "remarks"), items);
    }

    private static async Task<ReturnWriteRequest> ReadReturn(HttpRequest req)
    {
        var b = await ReadBody(req);
        var items = new List<ReturnLineRequest>();
        if (b.TryGetProperty("items", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            items = arr.EnumerateArray().Select(i => new ReturnLineRequest(
                Str(i, "materialIssueItemId")!, Dec(i, "previouslyReturnedQuantity"), Dec(i, "returnedQuantity"),
                Str(i, "condition"), Str(i, "disposition"), Str(i, "inspectionNotes"))).ToList();
        }

        return new ReturnWriteRequest(Str(b, "materialIssueId"), Date(b, "returnDate"), Str(b, "returnedByPerson"), Str(b, "reason"), Str(b, "remarks"), items);
    }

    private static async Task<TransferWriteRequest> ReadTransfer(HttpRequest req)
    {
        var b = await ReadBody(req);
        var items = new List<TransferLineRequest>();
        if (b.TryGetProperty("items", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            items = arr.EnumerateArray().Select(i => new TransferLineRequest(Str(i, "materialId")!, Dec(i, "requestedQuantity"))).ToList();
        }

        return new TransferWriteRequest(Str(b, "sourceWarehouseId"), Str(b, "destinationWarehouseId"), Date(b, "requestDate"),
            DateOnly.TryParse(Str(b, "plannedDispatchDate"), out var p) ? p : null,
            DateOnly.TryParse(Str(b, "expectedArrivalDate"), out var e) ? e : null,
            Str(b, "purpose"), Str(b, "transferReason"), Str(b, "referenceNumber"), Str(b, "priority"), items);
    }

    private static async Task<TransferReceiveRequest> ReadTransferReceive(HttpRequest req)
    {
        var b = await ReadBody(req);
        var items = new List<TransferReceiveLineRequest>();
        if (b.TryGetProperty("items", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            items = arr.EnumerateArray().Select(i => new TransferReceiveLineRequest(
                Str(i, "lineId") ?? Str(i, "id")!, Dec(i, "receivedGoodQuantity"), Dec(i, "damagedQuantity"),
                Dec(i, "shortQuantity"), Str(i, "inspectionNotes"))).ToList();
        }

        return new TransferReceiveRequest(items);
    }
}
