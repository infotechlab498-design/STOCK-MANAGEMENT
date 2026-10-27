namespace ConstructionStock.Domain.Entities;

/// <summary>
/// Construction material vendor / trade supplier entity.
/// Maintains commercial contact information, tax identification, payment terms, and status.
/// </summary>
public class Supplier
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Unique vendor identification code (case-insensitive, e.g. SUP-APEX).
    /// </summary>
    public string SupplierCode { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? TaxReference { get; set; }
    public string? PaymentTerms { get; set; }
    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
    public string? CreatedByUserId { get; set; }
    public string? UpdatedByUserId { get; set; }

    // Navigation collection
    public List<PurchaseOrder> PurchaseOrders { get; set; } = new();
}
