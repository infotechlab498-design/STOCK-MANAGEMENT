using ConstructionStock.Domain.Entities;

namespace ConstructionStock.Application.Repositories;

public interface IRequisitionRepository
{
    Task<IReadOnlyList<MaterialRequisition>> GetAllAsync(
        string? search = null,
        RequisitionStatus? status = null,
        string? projectId = null,
        IReadOnlyList<string>? allowedProjectIds = null,
        CancellationToken cancellationToken = default);

    Task<MaterialRequisition?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<MaterialRequisition?> GetByRequisitionNumberAsync(string requisitionNumber, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<MaterialRequisition>> GetPendingApprovalsAsync(IReadOnlyList<string>? allowedProjectIds = null, CancellationToken cancellationToken = default);

    Task<MaterialRequisition> CreateDraftAsync(MaterialRequisition requisition, CancellationToken cancellationToken = default);
    Task<MaterialRequisition> UpdateDraftAsync(MaterialRequisition requisition, CancellationToken cancellationToken = default);
    Task<MaterialRequisition> SubmitAsync(Guid id, string actorUserId, string actorName, string actorRole, string? comments = null, CancellationToken cancellationToken = default);
    Task<MaterialRequisition> ApproveAsync(Guid id, string approverUserId, string approverName, string approverRole, string? comments = null, CancellationToken cancellationToken = default);
    Task<MaterialRequisition> RejectAsync(Guid id, string approverUserId, string approverName, string approverRole, string reason, CancellationToken cancellationToken = default);
    Task<MaterialRequisition> ReturnForCorrectionAsync(Guid id, string reviewerUserId, string reviewerName, string reviewerRole, string correctionNotes, CancellationToken cancellationToken = default);
    Task<bool> DeleteDraftAsync(Guid id, string actorUserId, CancellationToken cancellationToken = default);
}

public interface IProjectRepository
{
    Task<IReadOnlyList<object>> GetAllAsync(IReadOnlyList<string>? userProjectScopes = null, CancellationToken cancellationToken = default);
    Task<object?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
}
