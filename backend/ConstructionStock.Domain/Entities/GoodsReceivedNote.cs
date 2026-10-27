namespace ConstructionStock.Domain.Entities;

public enum GrnStatus
{
    Draft,
    SubmittedForInspection,
    Inspected,
    Approved,
    Posted,
    Rejected,
    ReturnedForCorrection,
    Cancelled
}

public enum GrnAuditAction
{
    DraftCreated,
    Updated,
    SubmittedForInspection,
    Inspected,
    Approved,
    Rejected,
    ReturnedForCorrection,
    Posted,
    Cancelled
}

/// <summary>
/// Conforms to Standard Operating Procedure SCM-F-01 Rev 1.0.
/// Physical inspection checklist and quality sign-off attributes.
/// </summary>
public class InspectionChecklist
{
    public bool ChallanMatchesPo { get; set; } = true;
    public bool VehicleUnloadedSafely { get; set; } = true;
    public bool PhysicallyCounted { get; set; } = true;
    public bool PackagingIntact { get; set; } = true;
    public bool BatchTestCertsProvided { get; set; } = false;
    public string? TestCertificateNumber { get; set; }
    public bool MaterialsMeetSpecs { get; set; } = true;
    public bool BinTagsAttached { get; set; } = true;
    public string InspectionRemarks { get; set; } = string.Empty;
    public bool DiscrepancyIdentified { get; set; } = false;
    public bool DebitNoteRequired { get; set; } = false;
    public string? DebitNoteReason { get; set; }
}

public class GrnAuditEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string GrnId { get; set; } = string.Empty;
    public string ActorUserId { get; set; } = string.Empty;
    public string ActorName { get; set; } = string.Empty;
    public string ActorRole { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Comments { get; set; } = string.Empty;
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Legally binding commercial Goods Received Note (GRN) entity.
/// Records physical intake, discrepancy tracking, QA inspection (SCM-F-01),
/// and durable receipt ledger integration.
/// </summary>
public class GoodsReceivedNote
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Sequential human-readable reference number (e.g. GRN-2026-0001).
    /// </summary>
    public string GrnNumber { get; set; } = string.Empty;

    // PO Reference
    public string PurchaseOrderId { get; set; } = string.Empty;
    public string PurchaseOrderNumber { get; set; } = string.Empty;

    // Supplier Reference
    public string SupplierId { get; set; } = string.Empty;
    public string SupplierCode { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;

    // Project & Warehouse Boundary
    public string ProjectId { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public string WarehouseId { get; set; } = string.Empty;
    public string WarehouseName { get; set; } = string.Empty;
    public string StorageLocation { get; set; } = string.Empty;

    // Dates & Delivery Documents
    public string GrnDate { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd");
    public DateTime ReceivedAtUtc { get; set; } = DateTime.UtcNow;
    public string DeliveryChallanNumber { get; set; } = string.Empty;
    public string DeliveryChallanDate { get; set; } = string.Empty;
    public string VehicleNumber { get; set; } = string.Empty;
    public string DeliveredBy { get; set; } = string.Empty;

    // State & Inspection
    public GrnStatus Status { get; set; } = GrnStatus.Draft;
    public InspectionChecklist InspectionChecklist { get; set; } = new();

    // Items
    public List<GoodsReceivedItem> Items { get; set; } = new();

    // Summaries
    public decimal TotalDeliveredQuantity { get; set; }
    public decimal TotalAcceptedQuantity { get; set; }
    public decimal TotalRejectedQuantity { get; set; }
    public decimal TotalDamagedQuantity { get; set; }
    public decimal TotalShortQuantity { get; set; }
    public decimal TotalAcceptedValue { get; set; }

    // Remarks & Correction
    public string? GeneralRemarks { get; set; }
    public string? RejectionReason { get; set; }
    public string? CorrectionNotes { get; set; }

    // Audit Trail
    public List<GrnAuditEntry> AuditTrail { get; set; } = new();

    // Actor Sign-offs
    public string ReceivedByUserId { get; set; } = string.Empty;
    public string ReceivedByName { get; set; } = string.Empty;

    public string? InspectedByUserId { get; set; }
    public string? InspectedByName { get; set; }
    public DateTime? InspectedAtUtc { get; set; }

    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }

    public string? PostedByUserId { get; set; }
    public string? PostedByName { get; set; }
    public DateTime? PostedAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
