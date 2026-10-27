using System.Security.Claims;
using ConstructionStock.Domain.Enums;
using ConstructionStock.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace ConstructionStock.Api.Authorization;

public class ProjectScopeRequirement : IAuthorizationRequirement
{
    public string ProjectIdRouteParameterName { get; }

    public ProjectScopeRequirement(string routeParameterName = "projectId")
    {
        ProjectIdRouteParameterName = routeParameterName;
    }
}

public class ProjectScopeHandler : AuthorizationHandler<ProjectScopeRequirement>
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public ProjectScopeHandler(ApplicationDbContext dbContext, IHttpContextAccessor httpContextAccessor)
    {
        _dbContext = dbContext;
        _httpContextAccessor = httpContextAccessor;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, ProjectScopeRequirement requirement)
    {
        // Super Admin & Inventory Manager have organization-wide visibility
        if (context.User.IsInRole(SystemRoleNames.SuperAdmin) || context.User.IsInRole(SystemRoleNames.InventoryManager))
        {
            context.Succeed(requirement);
            return;
        }

        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null) return;

        if (!httpContext.Request.RouteValues.TryGetValue(requirement.ProjectIdRouteParameterName, out var routeVal) ||
            routeVal == null ||
            !Guid.TryParse(routeVal.ToString(), out var targetProjectId))
        {
            return;
        }

        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId)) return;

        var hasScope = await _dbContext.UserProjectScopes
            .AnyAsync(ps => ps.UserId == userId && ps.ProjectId == targetProjectId);

        if (hasScope)
        {
            context.Succeed(requirement);
        }
    }
}
