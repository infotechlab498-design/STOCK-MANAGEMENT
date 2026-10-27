namespace ConstructionStock.Domain.Entities;

public enum RequisitionStatus
{
    Draft,
    Submitted,
    Approved,
    Rejected,
    ReturnedForCorrection
}

public enum RequisitionPriority
{
    Low,
    Medium,
    High,
    Urgent
}

public enum RequisitionAuditAction
{
    DraftCreated,
    Updated,
    Submitted,
    Approved,
    Rejected,
    ReturnedForCorrection
}

/// <summary>
/// Site-wise Material Requisition domain entity for construction works.
/// Tracks requests, line items, priority, required date, and complete approval audit trail.
/// </summary>
public class MaterialRequisition
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Formatted human-readable number (e.g. MR-2026-0001).
    /// </summary>
    public string RequisitionNumber { get; set; } = string.Empty;

    // Project boundary scoping
    public string ProjectId { get; set; } = string.Empty;
    public string ProjectCode { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;

    // Requester information (server-derived from authenticated token)
    public string RequesterUserId { get; set; } = string.Empty;
    public string RequesterName { get; set; } = string.Empty;
    public string RequesterRole { get; set; } = string.Empty;

    // Scheduling and justification
    public DateTime RequiredDate { get; set; }
    public RequisitionPriority Priority { get; set; } = RequisitionPriority.Medium;
    public string Purpose { get; set; } = string.Empty;
    public string? WorkActivity { get; set; }
    public string? SiteLocationDetail { get; set; }

    // Workflow state
    public RequisitionStatus Status { get; set; } = RequisitionStatus.Draft;
    public string? RejectionReason { get; set; }
    public string? CorrectionNotes { get; set; }

    // Final approval metadata
    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }

    // Navigation properties
    public List<RequisitionItem> Items { get; set; } = new();
    public List<RequisitionApprovalEntry> ApprovalHistory { get; set; } = new();
}

/// <summary>
/// Requisition line item specifying material, quantity, and unit of measure.
/// Stock availability is explicitly isolated as a future integration point.
/// </summary>
public class RequisitionItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequisitionId { get; set; }

    public string MaterialId { get; set; } = string.Empty;
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialName { get; set; } = string.Empty;

    public string CategoryId { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;

    public decimal RequestedQuantity { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string UnitCode { get; set; } = string.Empty;

    public string? Remarks { get; set; }

    /// <summary>
    /// Explicitly indicates that real-time stock balances are not yet connected in this MVP phase.
    /// Prevents fictitious figures from being displayed.
    /// </summary>
    public string StockAvailabilityNote { get; set; } = "Not yet connected (Future Integration Point)";
}

/// <summary>
/// Immutable audit log entry recording every transition in the requisition lifecycle.
/// </summary>
public class RequisitionApprovalEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RequisitionId { get; set; }

    public string ActorUserId { get; set; } = string.Empty;
    public string ActorName { get; set; } = string.Empty;
    public string ActorRole { get; set; } = string.Empty;

    public RequisitionAuditAction Action { get; set; }
    public string? Comments { get; set; }
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}
