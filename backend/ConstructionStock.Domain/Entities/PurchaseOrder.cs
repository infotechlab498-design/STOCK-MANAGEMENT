namespace ConstructionStock.Domain.Entities;

public enum PurchaseOrderStatus
{
    Draft,
    PendingApproval,
    Approved,
    Issued,
    PartiallyReceived,
    FullyReceived,
    Cancelled,
    Rejected
}

public enum PurchaseOrderAuditAction
{
    DraftCreated,
    Updated,
    Submitted,
    Approved,
    Rejected,
    Issued,
    Cancelled
}

/// <summary>
/// Legally binding commercial purchase order entity.
/// Tracks supplier contract, delivery milestones, financial lines, ordered/received/outstanding quantities,
/// and complete chronological audit log.
/// </summary>
public class PurchaseOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Human readable unique PO numbering series (e.g. PO-2026-0001).
    /// </summary>
    public string PoNumber { get; set; } = string.Empty;

    // Supplier reference & historical snapshot
    public string SupplierId { get; set; } = string.Empty;
    public string SupplierCode { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;
    public string SupplierContact { get; set; } = string.Empty;

    // Optional linked Requisition reference
    public string? RequisitionId { get; set; }
    public string? RequisitionNumber { get; set; }

    // Project boundary & delivery location
    public string ProjectId { get; set; } = string.Empty;
    public string ProjectCode { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public string DeliveryLocation { get; set; } = string.Empty;

    // Commercial schedule
    public DateTime OrderDate { get; set; } = DateTime.UtcNow;
    public DateTime ExpectedDeliveryDate { get; set; }
    public string Currency { get; set; } = "USD";
    public string PaymentTerms { get; set; } = "Net 30 Days";
    public string? Notes { get; set; }

    // Workflow state
    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Draft;
    public string? RejectionReason { get; set; }
    public string? CancellationReason { get; set; }

    // Financial totals (computed with strict decimal precision)
    public decimal Subtotal { get; set; }
    public decimal ItemsDiscount { get; set; }
    public decimal HeaderDiscount { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Freight { get; set; }
    public decimal GrandTotal { get; set; }

    // Audit and signatures
    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }

    public string? IssuedByUserId { get; set; }
    public string? IssuedByName { get; set; }
    public DateTime? IssuedAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
    public string CreatedByUserId { get; set; } = string.Empty;
    public string CreatedByName { get; set; } = string.Empty;

    // Navigation collections
    public List<PurchaseOrderItem> Items { get; set; } = new();
    public List<PurchaseOrderApprovalEntry> ApprovalHistory { get; set; } = new();
}

/// <summary>
/// Purchase order line item capturing ordered, received, and outstanding quantities.
/// Received quantity strictly defaults to 0 pending GRN integration in Prompt 8.
/// </summary>
public class PurchaseOrderItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ParentPoId { get; set; }

    public string MaterialId { get; set; } = string.Empty;
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialName { get; set; } = string.Empty;
    public string? Specification { get; set; }

    public string UnitId { get; set; } = string.Empty;
    public string UnitCode { get; set; } = string.Empty;

    /// <summary>
    /// Optional foreign key to original RequisitionItem to enforce allocation limits and prevent over-ordering.
    /// </summary>
    public string? RequisitionItemId { get; set; }

    public decimal OrderedQuantity { get; set; }
    public decimal ReceivedQuantity { get; set; } = 0m;
    public decimal OutstandingQuantity => OrderedQuantity - ReceivedQuantity;

    public decimal UnitRate { get; set; }
    public decimal LineDiscount { get; set; } = 0m;
    public decimal TaxRate { get; set; } = 0m;
    public decimal TaxAmount { get; set; } = 0m;
    public decimal LineTotal { get; set; }

    public string? Notes { get; set; }
}

/// <summary>
/// Chronological audit entry for every state transition in the PO lifecycle.
/// </summary>
public class PurchaseOrderApprovalEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string PoId { get; set; } = string.Empty;

    public string ActorUserId { get; set; } = string.Empty;
    public string ActorName { get; set; } = string.Empty;
    public string ActorRole { get; set; } = string.Empty;

    public PurchaseOrderAuditAction Action { get; set; }
    public string? Comments { get; set; }
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}
