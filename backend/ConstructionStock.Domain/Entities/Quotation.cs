namespace ConstructionStock.Domain.Entities;

/// <summary>
/// Lightweight quotation record for vendor pricing and rate comparison.
/// </summary>
public class Quotation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string QuotationReference { get; set; } = string.Empty;

    public string SupplierId { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;

    public DateTime Date { get; set; } = DateTime.UtcNow;
    public DateTime ValidUntil { get; set; }
    public string Currency { get; set; } = "USD";
    public string PaymentTerms { get; set; } = "Net 30 Days";
    public string? Notes { get; set; }

    public List<QuotationItem> Items { get; set; } = new();
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class QuotationItem
{
    public string MaterialId { get; set; } = string.Empty;
    public string MaterialCode { get; set; } = string.Empty;
    public string MaterialName { get; set; } = string.Empty;
    public string UnitCode { get; set; } = string.Empty;

    public decimal QuotedQuantity { get; set; }
    public decimal UnitRate { get; set; }
    public decimal Discount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal EstimatedFreight { get; set; }
    public decimal LineTotal { get; set; }
}
