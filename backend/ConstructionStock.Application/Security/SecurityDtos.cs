namespace ConstructionStock.Application.Security;

public record LoginRequestDto(
    string UsernameOrEmail,
    string Password
);

public record LoginResponseDto(
    string AccessToken,
    int ExpiresInSeconds,
    UserProfileDto User
);

public record UserProfileDto(
    Guid Id,
    string Username,
    string Email,
    string FullName,
    bool IsActive,
    IReadOnlyList<string> Roles,
    IReadOnlyList<ProjectScopeSummaryDto> ProjectScopes,
    IReadOnlyList<WarehouseScopeSummaryDto> WarehouseScopes,
    DateTime? LastLoginAtUtc
);

public record ProjectScopeSummaryDto(
    Guid ProjectId,
    string ProjectCode,
    string ProjectName
);

public record WarehouseScopeSummaryDto(
    Guid WarehouseId,
    string WarehouseCode,
    string WarehouseName,
    Guid ProjectId
);

public record CreateUserDto(
    string Username,
    string Email,
    string FullName,
    string Password,
    IReadOnlyList<string> Roles,
    IReadOnlyList<Guid>? ProjectIds,
    IReadOnlyList<Guid>? WarehouseIds
);

public record UpdateUserDto(
    string FullName,
    string Email,
    IReadOnlyList<string> Roles,
    IReadOnlyList<Guid>? ProjectIds,
    IReadOnlyList<Guid>? WarehouseIds
);

public record UpdateUserStatusDto(
    bool IsActive,
    string? Reason
);

public record RoleDto(
    Guid Id,
    string Name,
    string Description,
    int UserCount
);
