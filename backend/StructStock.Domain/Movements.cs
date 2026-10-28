namespace StructStock.Domain;

public class InventoryBalance
{
    public string Id { get; set; } = "";
    public string MaterialId { get; set; } = "";
    public string WarehouseId { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public decimal QuantityOnHand { get; set; }
    public decimal QuantityReserved { get; set; }
    public decimal QuantityAvailable { get; set; }
    public decimal QuantityInTransit { get; set; }
    public decimal WeightedAverageCost { get; set; }
    public decimal InventoryValue { get; set; }
    public int Version { get; set; }
    public DateTime LastUpdatedUtc { get; set; }
    public byte[] RowVersion { get; set; } = null!;
    public Material? Material { get; set; }
    public Warehouse? Warehouse { get; set; }
    public Project? Project { get; set; }
}

public class StockLedgerEntry
{
    public string Id { get; set; } = "";
    public string ReferenceNumber { get; set; } = "";
    public string TransactionType { get; set; } = "";
    public string SourceDocumentType { get; set; } = "";
    public string SourceDocumentId { get; set; } = "";
    public string SourceDocumentNumber { get; set; } = "";
    public string SourceLineId { get; set; } = "";
    public string MaterialId { get; set; } = "";
    public string WarehouseId { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public decimal QuantityIn { get; set; }
    public decimal QuantityOut { get; set; }
    public decimal SignedQuantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal TransactionValue { get; set; }
    public decimal BalanceQuantityAfter { get; set; }
    public decimal WeightedAverageCostAfter { get; set; }
    public decimal TotalValuationAfter { get; set; }
    public string? BatchNumber { get; set; }
    public string IdempotencyKey { get; set; } = "";
    public DateOnly TransactionDate { get; set; }
    public DateTime TimestampUtc { get; set; }
    public string CreatedByUserId { get; set; } = "";
    public string CreatedByName { get; set; } = "";
    public string? Remarks { get; set; }
    public Material? Material { get; set; }
    public Warehouse? Warehouse { get; set; }
    public Project? Project { get; set; }
}

public class MaterialIssue
{
    public string Id { get; set; } = "";
    public string IssueNumber { get; set; } = "";
    public string RequisitionId { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string WarehouseId { get; set; } = "";
    public DateOnly IssueDate { get; set; }
    public string Status { get; set; } = "Draft";
    public string Purpose { get; set; } = "";
    public string? WorkActivity { get; set; }
    public string ReceivedByPerson { get; set; } = "";
    public string? RejectionReason { get; set; }
    public string? CorrectionNotes { get; set; }
    public string? Remarks { get; set; }
    public string CreatedByUserId { get; set; } = "";
    public string CreatedByName { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public string? SubmittedByUserId { get; set; }
    public string? SubmittedByName { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public string? PostedByUserId { get; set; }
    public string? PostedByName { get; set; }
    public DateTime? PostedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public Requisition? Requisition { get; set; }
    public Project? Project { get; set; }
    public Warehouse? Warehouse { get; set; }
    public List<MaterialIssueLine> Lines { get; set; } = new();
    public List<MaterialIssueAudit> Audits { get; set; } = new();
}

public class MaterialIssueLine
{
    public string Id { get; set; } = "";
    public string MaterialIssueId { get; set; } = "";
    public string RequisitionLineId { get; set; } = "";
    public string MaterialId { get; set; } = "";
    public decimal RequestedQuantity { get; set; }
    public decimal PreviouslyFulfilledQuantity { get; set; }
    public decimal QuantityToIssue { get; set; }
    public decimal? ActualIssuedQuantity { get; set; }
    public decimal? UnitCost { get; set; }
    public decimal? TotalIssuedAmount { get; set; }
    public string? StorageLocation { get; set; }
    public string? Remarks { get; set; }
    public string? StockLedgerEntryId { get; set; }
    public MaterialIssue? MaterialIssue { get; set; }
    public Material? Material { get; set; }
    public RequisitionLine? RequisitionLine { get; set; }
}

public class MaterialIssueAudit
{
    public string Id { get; set; } = "";
    public string MaterialIssueId { get; set; } = "";
    public string ActorUserId { get; set; } = "";
    public string ActorName { get; set; } = "";
    public string ActorRole { get; set; } = "";
    public string Action { get; set; } = "";
    public string? Comments { get; set; }
    public DateTime TimestampUtc { get; set; }
}

public class MaterialReturn
{
    public string Id { get; set; } = "";
    public string ReturnNumber { get; set; } = "";
    public string MaterialIssueId { get; set; } = "";
    public string RequisitionId { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string WarehouseId { get; set; } = "";
    public DateOnly ReturnDate { get; set; }
    public string ReturnedByPerson { get; set; } = "";
    public string Reason { get; set; } = "";
    public string Status { get; set; } = "Draft";
    public string? RejectionReason { get; set; }
    public string? Remarks { get; set; }
    public string CreatedByUserId { get; set; } = "";
    public string CreatedByName { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public string? InspectedByUserId { get; set; }
    public string? InspectedByName { get; set; }
    public DateTime? InspectedAtUtc { get; set; }
    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public string? PostedByUserId { get; set; }
    public string? PostedByName { get; set; }
    public DateTime? PostedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public MaterialIssue? MaterialIssue { get; set; }
    public Project? Project { get; set; }
    public Warehouse? Warehouse { get; set; }
    public List<MaterialReturnLine> Lines { get; set; } = new();
    public List<MaterialReturnAudit> Audits { get; set; } = new();
}

public class MaterialReturnLine
{
    public string Id { get; set; } = "";
    public string MaterialReturnId { get; set; } = "";
    public string MaterialIssueLineId { get; set; } = "";
    public string MaterialId { get; set; } = "";
    public decimal IssuedQuantity { get; set; }
    public decimal PreviouslyReturnedQuantity { get; set; }
    public decimal ReturnedQuantity { get; set; }
    public string Condition { get; set; } = "ReusableGood";
    public string Disposition { get; set; } = "ReturnToUsableStock";
    public decimal UnitCost { get; set; }
    public decimal TotalReturnAmount { get; set; }
    public string? InspectionNotes { get; set; }
    public string? StockLedgerEntryId { get; set; }
    public MaterialReturn? MaterialReturn { get; set; }
    public MaterialIssueLine? MaterialIssueLine { get; set; }
    public Material? Material { get; set; }
}

public class MaterialReturnAudit
{
    public string Id { get; set; } = "";
    public string MaterialReturnId { get; set; } = "";
    public string ActorUserId { get; set; } = "";
    public string ActorName { get; set; } = "";
    public string ActorRole { get; set; } = "";
    public string Action { get; set; } = "";
    public string? Comments { get; set; }
    public DateTime TimestampUtc { get; set; }
}

public class StockTransfer
{
    public string Id { get; set; } = "";
    public string TransferNumber { get; set; } = "";
    public string SourceWarehouseId { get; set; } = "";
    public string SourceProjectId { get; set; } = "";
    public string DestinationWarehouseId { get; set; } = "";
    public string DestinationProjectId { get; set; } = "";
    public DateOnly RequestDate { get; set; }
    public DateOnly? PlannedDispatchDate { get; set; }
    public DateOnly? ActualDispatchDate { get; set; }
    public DateOnly? ExpectedArrivalDate { get; set; }
    public DateOnly? ActualReceiptDate { get; set; }
    public string Purpose { get; set; } = "";
    public string? TransferReason { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? VehicleNumber { get; set; }
    public string? DriverName { get; set; }
    public string? DispatchReference { get; set; }
    public string Priority { get; set; } = "Medium";
    public string Status { get; set; } = "Draft";
    public string DiscrepancyStatus { get; set; } = "None";
    public string PostingJournalStatus { get; set; } = "None";
    public string? RejectionReason { get; set; }
    public string? CorrectionNotes { get; set; }
    public string? CancellationReason { get; set; }
    public string? Remarks { get; set; }
    public string CreatedByUserId { get; set; } = "";
    public string CreatedByName { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public string? SubmittedByUserId { get; set; }
    public string? SubmittedByName { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public string? DispatchedByUserId { get; set; }
    public string? DispatchedByName { get; set; }
    public DateTime? DispatchedAtUtc { get; set; }
    public string? ReceivedByUserId { get; set; }
    public string? ReceivedByName { get; set; }
    public DateTime? ReceivedAtUtc { get; set; }
    public string? InspectedByUserId { get; set; }
    public string? InspectedByName { get; set; }
    public DateTime? InspectedAtUtc { get; set; }
    public string? CompletedByUserId { get; set; }
    public string? CompletedByName { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string? CancelledByUserId { get; set; }
    public string? CancelledByName { get; set; }
    public DateTime? CancelledAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public Warehouse? SourceWarehouse { get; set; }
    public Warehouse? DestinationWarehouse { get; set; }
    public Project? SourceProject { get; set; }
    public Project? DestinationProject { get; set; }
    public List<StockTransferLine> Lines { get; set; } = new();
    public List<StockTransferAudit> Audits { get; set; } = new();
}

public class StockTransferLine
{
    public string Id { get; set; } = "";
    public string StockTransferId { get; set; } = "";
    public string MaterialId { get; set; } = "";
    public decimal RequestedQuantity { get; set; }
    public decimal ApprovedQuantity { get; set; }
    public decimal DispatchedQuantity { get; set; }
    public decimal ReceivedGoodQuantity { get; set; }
    public decimal DamagedQuantity { get; set; }
    public decimal ShortQuantity { get; set; }
    public decimal DisputedQuantity { get; set; }
    public decimal RemainingInTransitQuantity { get; set; }
    public decimal UnitCostAtDispatch { get; set; }
    public decimal TotalDispatchedAmount { get; set; }
    public string? SourceStockLedgerEntryId { get; set; }
    public string? DestinationStockLedgerEntryId { get; set; }
    public string? DiscrepancyReason { get; set; }
    public string? InspectionNotes { get; set; }
    public string? EvidenceReferences { get; set; }
    public string ResolutionStatus { get; set; } = "None";
    public string? ResolutionAction { get; set; }
    public string? ResolutionNotes { get; set; }
    public string? ResolvedByUserId { get; set; }
    public string? ResolvedByName { get; set; }
    public DateTime? ResolvedAtUtc { get; set; }
    public StockTransfer? StockTransfer { get; set; }
    public Material? Material { get; set; }
}

public class StockTransferAudit
{
    public string Id { get; set; } = "";
    public string StockTransferId { get; set; } = "";
    public string ActorUserId { get; set; } = "";
    public string ActorName { get; set; } = "";
    public string ActorRole { get; set; } = "";
    public string Action { get; set; } = "";
    public string? Comments { get; set; }
    public DateTime TimestampUtc { get; set; }
}

public class Notification
{
    public string Id { get; set; } = "";
    public string EventKey { get; set; } = "";
    public string Category { get; set; } = "";
    public string EventType { get; set; } = "";
    public string Severity { get; set; } = "Info";
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string SourceDocumentType { get; set; } = "";
    public string SourceDocumentId { get; set; } = "";
    public string SourceDocumentNumber { get; set; } = "";
    public string TargetRoute { get; set; } = "";
    public string? ProjectId { get; set; }
    public string? WarehouseId { get; set; }
    public string? SecondaryProjectId { get; set; }
    public string? SecondaryWarehouseId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public List<NotificationRecipientUser> RecipientUsers { get; set; } = new();
    public List<NotificationRecipientRole> RecipientRoles { get; set; } = new();
    public List<NotificationRead> Reads { get; set; } = new();
}

public class NotificationRecipientUser
{
    public string NotificationId { get; set; } = "";
    public string UserId { get; set; } = "";
}

public class NotificationRecipientRole
{
    public string NotificationId { get; set; } = "";
    public string RoleName { get; set; } = "";
}

public class NotificationRead
{
    public string NotificationId { get; set; } = "";
    public string UserId { get; set; } = "";
    public DateTime ReadAtUtc { get; set; }
}
