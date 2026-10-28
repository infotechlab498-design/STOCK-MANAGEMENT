using Microsoft.EntityFrameworkCore;
using StructStock.Domain;

namespace StructStock.Infrastructure;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<UserProjectScope> UserProjectScopes => Set<UserProjectScope>();
    public DbSet<UserWarehouseScope> UserWarehouseScopes => Set<UserWarehouseScope>();
    public DbSet<LoginAttempt> LoginAttempts => Set<LoginAttempt>();
    public DbSet<MaterialCategory> Categories => Set<MaterialCategory>();
    public DbSet<UnitOfMeasure> Units => Set<UnitOfMeasure>();
    public DbSet<UnitConversion> UnitConversions => Set<UnitConversion>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<SystemSetting> Settings => Set<SystemSetting>();
    public DbSet<NumberSeries> NumberSeries => Set<NumberSeries>();
    public DbSet<Requisition> Requisitions => Set<Requisition>();
    public DbSet<RequisitionLine> RequisitionLines => Set<RequisitionLine>();
    public DbSet<RequisitionAudit> RequisitionAudits => Set<RequisitionAudit>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderLine> PurchaseOrderLines => Set<PurchaseOrderLine>();
    public DbSet<PurchaseOrderAudit> PurchaseOrderAudits => Set<PurchaseOrderAudit>();
    public DbSet<Quotation> Quotations => Set<Quotation>();
    public DbSet<QuotationLine> QuotationLines => Set<QuotationLine>();
    public DbSet<GoodsReceipt> GoodsReceipts => Set<GoodsReceipt>();
    public DbSet<GoodsReceiptLine> GoodsReceiptLines => Set<GoodsReceiptLine>();
    public DbSet<GoodsReceiptAudit> GoodsReceiptAudits => Set<GoodsReceiptAudit>();
    public DbSet<ReceiptLedger> ReceiptLedgers => Set<ReceiptLedger>();
    public DbSet<InventoryBalance> Balances => Set<InventoryBalance>();
    public DbSet<StockLedgerEntry> Ledger => Set<StockLedgerEntry>();
    public DbSet<MaterialIssue> MaterialIssues => Set<MaterialIssue>();
    public DbSet<MaterialIssueLine> MaterialIssueLines => Set<MaterialIssueLine>();
    public DbSet<MaterialIssueAudit> MaterialIssueAudits => Set<MaterialIssueAudit>();
    public DbSet<MaterialReturn> MaterialReturns => Set<MaterialReturn>();
    public DbSet<MaterialReturnLine> MaterialReturnLines => Set<MaterialReturnLine>();
    public DbSet<MaterialReturnAudit> MaterialReturnAudits => Set<MaterialReturnAudit>();
    public DbSet<StockTransfer> StockTransfers => Set<StockTransfer>();
    public DbSet<StockTransferLine> StockTransferLines => Set<StockTransferLine>();
    public DbSet<StockTransferAudit> StockTransferAudits => Set<StockTransferAudit>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationRecipientUser> NotificationRecipientUsers => Set<NotificationRecipientUser>();
    public DbSet<NotificationRecipientRole> NotificationRecipientRoles => Set<NotificationRecipientRole>();
    public DbSet<NotificationRead> NotificationReads => Set<NotificationRead>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        foreach (var property in modelBuilder.Model.GetEntityTypes().SelectMany(t => t.GetProperties()))
        {
            if (property.ClrType == typeof(decimal) || property.ClrType == typeof(decimal?))
            {
                property.SetPrecision(18);
                property.SetScale(4);
            }
        }

        foreach (var fk in modelBuilder.Model.GetEntityTypes().SelectMany(t => t.GetForeignKeys()))
        {
            fk.DeleteBehavior = DeleteBehavior.Restrict;
        }

        modelBuilder.Entity<AppUser>().ToTable("AppUser");
        modelBuilder.Entity<Role>().ToTable("Role");
        modelBuilder.Entity<UserRole>().ToTable("UserRole").HasKey(x => new { x.UserId, x.RoleId });
        modelBuilder.Entity<UserProjectScope>().ToTable("UserProjectScope").HasKey(x => new { x.UserId, x.ProjectId });
        modelBuilder.Entity<UserWarehouseScope>().ToTable("UserWarehouseScope").HasKey(x => new { x.UserId, x.WarehouseId });
        modelBuilder.Entity<LoginAttempt>().ToTable("LoginAttempt").HasKey(x => x.TrackerKey);
        modelBuilder.Entity<NumberSeries>().ToTable("NumberSeries").HasKey(x => x.Prefix);
        modelBuilder.Entity<SystemSetting>().ToTable("SystemSetting");
        modelBuilder.Entity<MaterialCategory>().ToTable("MaterialCategory");
        modelBuilder.Entity<UnitOfMeasure>().ToTable("UnitOfMeasure");
        modelBuilder.Entity<UnitConversion>().ToTable("UnitConversion");
        modelBuilder.Entity<Project>().ToTable("Project");
        modelBuilder.Entity<Warehouse>().ToTable("Warehouse");
        modelBuilder.Entity<Material>().ToTable("Material");
        modelBuilder.Entity<Supplier>().ToTable("Supplier");
        modelBuilder.Entity<Requisition>().ToTable("Requisition");
        modelBuilder.Entity<RequisitionLine>().ToTable("RequisitionLine");
        modelBuilder.Entity<RequisitionAudit>().ToTable("RequisitionAudit");
        modelBuilder.Entity<PurchaseOrder>().ToTable("PurchaseOrder");
        modelBuilder.Entity<PurchaseOrderLine>().ToTable("PurchaseOrderLine");
        modelBuilder.Entity<PurchaseOrderAudit>().ToTable("PurchaseOrderAudit");
        modelBuilder.Entity<Quotation>().ToTable("Quotation");
        modelBuilder.Entity<QuotationLine>().ToTable("QuotationLine");
        modelBuilder.Entity<GoodsReceipt>().ToTable("GoodsReceipt");
        modelBuilder.Entity<GoodsReceiptLine>().ToTable("GoodsReceiptLine");
        modelBuilder.Entity<GoodsReceiptAudit>().ToTable("GoodsReceiptAudit");
        modelBuilder.Entity<ReceiptLedger>().ToTable("ReceiptLedger");
        modelBuilder.Entity<InventoryBalance>().ToTable("InventoryBalance");
        modelBuilder.Entity<MaterialIssue>().ToTable("MaterialIssue");
        modelBuilder.Entity<MaterialIssueLine>().ToTable("MaterialIssueLine");
        modelBuilder.Entity<MaterialIssueAudit>().ToTable("MaterialIssueAudit");
        modelBuilder.Entity<MaterialReturn>().ToTable("MaterialReturn");
        modelBuilder.Entity<MaterialReturnLine>().ToTable("MaterialReturnLine");
        modelBuilder.Entity<MaterialReturnAudit>().ToTable("MaterialReturnAudit");
        modelBuilder.Entity<StockTransfer>().ToTable("StockTransfer");
        modelBuilder.Entity<StockTransferLine>().ToTable("StockTransferLine");
        modelBuilder.Entity<StockTransferAudit>().ToTable("StockTransferAudit");
        modelBuilder.Entity<Notification>().ToTable("Notification");
        modelBuilder.Entity<NotificationRecipientUser>().ToTable("NotificationRecipientUser");
        modelBuilder.Entity<NotificationRecipientRole>().ToTable("NotificationRecipientRole");
        modelBuilder.Entity<NotificationRead>().ToTable("NotificationRead");

        modelBuilder.Entity<StockLedgerEntry>().ToTable("StockLedger");
        modelBuilder.Entity<InventoryBalance>().Property(x => x.RowVersion).IsRowVersion();
        modelBuilder.Entity<Warehouse>().Property(x => x.WarehouseType).HasColumnName("WarehouseType");
        modelBuilder.Entity<Quotation>().Property(x => x.QuoteDate).HasColumnName("QuoteDate");

        modelBuilder.Entity<StockTransfer>()
            .HasOne(x => x.SourceWarehouse).WithMany().HasForeignKey(x => x.SourceWarehouseId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<StockTransfer>()
            .HasOne(x => x.DestinationWarehouse).WithMany().HasForeignKey(x => x.DestinationWarehouseId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<StockTransfer>()
            .HasOne(x => x.SourceProject).WithMany().HasForeignKey(x => x.SourceProjectId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<StockTransfer>()
            .HasOne(x => x.DestinationProject).WithMany().HasForeignKey(x => x.DestinationProjectId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Requisition>().HasMany(x => x.Lines).WithOne(x => x.Requisition!).HasForeignKey(x => x.RequisitionId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Requisition>().HasMany(x => x.Audits).WithOne().HasForeignKey(x => x.RequisitionId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PurchaseOrder>().HasMany(x => x.Lines).WithOne(x => x.PurchaseOrder!).HasForeignKey(x => x.PurchaseOrderId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PurchaseOrder>().HasMany(x => x.Audits).WithOne().HasForeignKey(x => x.PurchaseOrderId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Quotation>().HasMany(x => x.Lines).WithOne(x => x.Quotation!).HasForeignKey(x => x.QuotationId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<GoodsReceipt>().HasMany(x => x.Lines).WithOne(x => x.GoodsReceipt!).HasForeignKey(x => x.GoodsReceiptId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<GoodsReceipt>().HasMany(x => x.Audits).WithOne().HasForeignKey(x => x.GoodsReceiptId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<MaterialIssue>().HasMany(x => x.Lines).WithOne(x => x.MaterialIssue!).HasForeignKey(x => x.MaterialIssueId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<MaterialIssue>().HasMany(x => x.Audits).WithOne().HasForeignKey(x => x.MaterialIssueId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<MaterialReturn>().HasMany(x => x.Lines).WithOne(x => x.MaterialReturn!).HasForeignKey(x => x.MaterialReturnId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<MaterialReturn>().HasMany(x => x.Audits).WithOne().HasForeignKey(x => x.MaterialReturnId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<StockTransfer>().HasMany(x => x.Lines).WithOne(x => x.StockTransfer!).HasForeignKey(x => x.StockTransferId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<StockTransfer>().HasMany(x => x.Audits).WithOne().HasForeignKey(x => x.StockTransferId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Notification>().HasMany(x => x.RecipientUsers).WithOne().HasForeignKey(x => x.NotificationId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Notification>().HasMany(x => x.RecipientRoles).WithOne().HasForeignKey(x => x.NotificationId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Notification>().HasMany(x => x.Reads).WithOne().HasForeignKey(x => x.NotificationId).OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<NotificationRecipientUser>().HasKey(x => new { x.NotificationId, x.UserId });
        modelBuilder.Entity<NotificationRecipientRole>().HasKey(x => new { x.NotificationId, x.RoleName });
        modelBuilder.Entity<NotificationRead>().HasKey(x => new { x.NotificationId, x.UserId });
    }
}
