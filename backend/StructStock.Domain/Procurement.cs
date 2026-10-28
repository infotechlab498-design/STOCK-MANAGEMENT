namespace StructStock.Domain;

public class Requisition
{
    public string Id { get; set; } = "";
    public string RequisitionNumber { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string RequesterUserId { get; set; } = "";
    public string RequesterName { get; set; } = "";
    public string RequesterRole { get; set; } = "";
    public DateOnly RequiredDate { get; set; }
    public string Priority { get; set; } = "Medium";
    public string Purpose { get; set; } = "";
    public string? WorkActivity { get; set; }
    public string? SiteLocationDetail { get; set; }
    public string Status { get; set; } = "Draft";
    public string? RejectionReason { get; set; }
    public string? CorrectionNotes { get; set; }
    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public Project? Project { get; set; }
    public List<RequisitionLine> Lines { get; set; } = new();
    public List<RequisitionAudit> Audits { get; set; } = new();
}

public class RequisitionLine
{
    public string Id { get; set; } = "";
    public string RequisitionId { get; set; } = "";
    public string MaterialId { get; set; } = "";
    public decimal RequestedQuantity { get; set; }
    public string? Remarks { get; set; }
    public Requisition? Requisition { get; set; }
    public Material? Material { get; set; }
}

public class RequisitionAudit
{
    public string Id { get; set; } = "";
    public string RequisitionId { get; set; } = "";
    public string ActorUserId { get; set; } = "";
    public string ActorName { get; set; } = "";
    public string ActorRole { get; set; } = "";
    public string Action { get; set; } = "";
    public string? Comments { get; set; }
    public DateTime TimestampUtc { get; set; }
}

public class PurchaseOrder
{
    public string Id { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public string SupplierId { get; set; } = "";
    public string? RequisitionId { get; set; }
    public string ProjectId { get; set; } = "";
    public string DeliveryLocation { get; set; } = "";
    public DateOnly OrderDate { get; set; }
    public DateOnly ExpectedDeliveryDate { get; set; }
    public string Currency { get; set; } = "USD";
    public string PaymentTerms { get; set; } = "";
    public string? Notes { get; set; }
    public string Status { get; set; } = "Draft";
    public decimal Subtotal { get; set; }
    public decimal ItemsDiscount { get; set; }
    public decimal HeaderDiscount { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Freight { get; set; }
    public decimal GrandTotal { get; set; }
    public string? RejectionReason { get; set; }
    public string? CancellationReason { get; set; }
    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public string? IssuedByUserId { get; set; }
    public string? IssuedByName { get; set; }
    public DateTime? IssuedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public string CreatedByUserId { get; set; } = "";
    public string CreatedByName { get; set; } = "";
    public Supplier? Supplier { get; set; }
    public Project? Project { get; set; }
    public Requisition? Requisition { get; set; }
    public List<PurchaseOrderLine> Lines { get; set; } = new();
    public List<PurchaseOrderAudit> Audits { get; set; } = new();
}

public class PurchaseOrderLine
{
    public string Id { get; set; } = "";
    public string PurchaseOrderId { get; set; } = "";
    public string MaterialId { get; set; } = "";
    public string? RequisitionLineId { get; set; }
    public decimal OrderedQuantity { get; set; }
    public decimal ReceivedQuantity { get; set; }
    public decimal UnitRate { get; set; }
    public decimal LineDiscount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal LineTotal { get; set; }
    public string? Notes { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
    public Material? Material { get; set; }
}

public class PurchaseOrderAudit
{
    public string Id { get; set; } = "";
    public string PurchaseOrderId { get; set; } = "";
    public string ActorUserId { get; set; } = "";
    public string ActorName { get; set; } = "";
    public string ActorRole { get; set; } = "";
    public string Action { get; set; } = "";
    public string? Comments { get; set; }
    public DateTime TimestampUtc { get; set; }
}

public class Quotation
{
    public string Id { get; set; } = "";
    public string QuotationReference { get; set; } = "";
    public string SupplierId { get; set; } = "";
    public DateOnly QuoteDate { get; set; }
    public DateOnly ValidUntil { get; set; }
    public string Currency { get; set; } = "USD";
    public string PaymentTerms { get; set; } = "";
    public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public Supplier? Supplier { get; set; }
    public List<QuotationLine> Lines { get; set; } = new();
}

public class QuotationLine
{
    public string Id { get; set; } = "";
    public string QuotationId { get; set; } = "";
    public string MaterialId { get; set; } = "";
    public decimal QuotedQuantity { get; set; }
    public decimal UnitRate { get; set; }
    public decimal Discount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal EstimatedFreight { get; set; }
    public decimal LineTotal { get; set; }
    public Quotation? Quotation { get; set; }
    public Material? Material { get; set; }
}

public class GoodsReceipt
{
    public string Id { get; set; } = "";
    public string GrnNumber { get; set; } = "";
    public string PurchaseOrderId { get; set; } = "";
    public string SupplierId { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string WarehouseId { get; set; } = "";
    public string StorageLocation { get; set; } = "";
    public DateOnly GrnDate { get; set; }
    public DateTime ReceivedAtUtc { get; set; }
    public string DeliveryChallanNumber { get; set; } = "";
    public DateOnly? DeliveryChallanDate { get; set; }
    public string? VehicleNumber { get; set; }
    public string? DeliveredBy { get; set; }
    public string Status { get; set; } = "Draft";
    public bool ChallanMatchesPO { get; set; }
    public bool VehicleUnloadedSafely { get; set; }
    public bool PhysicallyCounted { get; set; }
    public bool PackagingIntact { get; set; }
    public bool BatchTestCertsProvided { get; set; }
    public string? TestCertificateNumber { get; set; }
    public bool MaterialsMeetSpecs { get; set; }
    public bool BinTagsAttached { get; set; }
    public string InspectionRemarks { get; set; } = "";
    public bool DiscrepancyIdentified { get; set; }
    public bool DebitNoteRequired { get; set; }
    public string? DebitNoteReason { get; set; }
    public decimal TotalDeliveredQuantity { get; set; }
    public decimal TotalAcceptedQuantity { get; set; }
    public decimal TotalRejectedQuantity { get; set; }
    public decimal TotalDamagedQuantity { get; set; }
    public decimal TotalShortQuantity { get; set; }
    public decimal TotalAcceptedValue { get; set; }
    public string? GeneralRemarks { get; set; }
    public string? RejectionReason { get; set; }
    public string? CorrectionNotes { get; set; }
    public string ReceivedByUserId { get; set; } = "";
    public string ReceivedByName { get; set; } = "";
    public string? InspectedByUserId { get; set; }
    public string? InspectedByName { get; set; }
    public DateTime? InspectedAtUtc { get; set; }
    public string? ApprovedByUserId { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public string? PostedByUserId { get; set; }
    public string? PostedByName { get; set; }
    public DateTime? PostedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }
    public Supplier? Supplier { get; set; }
    public Project? Project { get; set; }
    public Warehouse? Warehouse { get; set; }
    public List<GoodsReceiptLine> Lines { get; set; } = new();
    public List<GoodsReceiptAudit> Audits { get; set; } = new();
}

public class GoodsReceiptLine
{
    public string Id { get; set; } = "";
    public string GoodsReceiptId { get; set; } = "";
    public string PurchaseOrderLineId { get; set; } = "";
    public string MaterialId { get; set; } = "";
    public decimal OrderedQuantity { get; set; }
    public decimal PreviouslyReceivedQuantity { get; set; }
    public decimal DeliveredQuantity { get; set; }
    public decimal AcceptedQuantity { get; set; }
    public decimal RejectedQuantity { get; set; }
    public decimal DamagedQuantity { get; set; }
    public decimal ShortQuantity { get; set; }
    public string? Remarks { get; set; }
    public string StorageLocation { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public decimal TotalAcceptedAmount { get; set; }
    public GoodsReceipt? GoodsReceipt { get; set; }
    public PurchaseOrderLine? PurchaseOrderLine { get; set; }
    public Material? Material { get; set; }
}

public class GoodsReceiptAudit
{
    public string Id { get; set; } = "";
    public string GoodsReceiptId { get; set; } = "";
    public string ActorUserId { get; set; } = "";
    public string ActorName { get; set; } = "";
    public string ActorRole { get; set; } = "";
    public string Action { get; set; } = "";
    public string Comments { get; set; } = "";
    public DateTime TimestampUtc { get; set; }
}

public class ReceiptLedger
{
    public string Id { get; set; } = "";
    public string GoodsReceiptId { get; set; } = "";
    public string GoodsReceiptLineId { get; set; } = "";
    public string PurchaseOrderId { get; set; } = "";
    public string SupplierId { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string WarehouseId { get; set; } = "";
    public string MaterialId { get; set; } = "";
    public decimal AcceptedQuantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalAmount { get; set; }
    public string StorageLocation { get; set; } = "";
    public string DeliveryChallanNumber { get; set; } = "";
    public DateTime PostedAtUtc { get; set; }
    public string PostedByUserId { get; set; } = "";
    public string PostedByName { get; set; } = "";
    public bool ReconciledWithInventoryLedger { get; set; }
}
