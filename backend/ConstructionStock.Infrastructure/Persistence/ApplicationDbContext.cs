using ConstructionStock.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ConstructionStock.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<UserProjectScope> UserProjectScopes => Set<UserProjectScope>();
    public DbSet<UserWarehouseScope> UserWarehouseScopes => Set<UserWarehouseScope>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<StockBalance> StockBalances => Set<StockBalance>();
    public DbSet<StockLedgerEntry> StockLedgerEntries => Set<StockLedgerEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User Configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.Property(u => u.Username).HasMaxLength(100).IsRequired();
            entity.Property(u => u.NormalizedUsername).HasMaxLength(100).IsRequired();
            entity.Property(u => u.Email).HasMaxLength(256).IsRequired();
            entity.Property(u => u.NormalizedEmail).HasMaxLength(256).IsRequired();
            entity.Property(u => u.FullName).HasMaxLength(200).IsRequired();
            entity.Property(u => u.PasswordHash).HasMaxLength(512).IsRequired();
            entity.Property(u => u.RowVersion).IsRowVersion();

            entity.HasIndex(u => u.NormalizedEmail).IsUnique();
            entity.HasIndex(u => u.NormalizedUsername).IsUnique();
        });

        // Role Configuration
        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Name).HasMaxLength(100).IsRequired();
            entity.Property(r => r.NormalizedName).HasMaxLength(100).IsRequired();
            entity.Property(r => r.Description).HasMaxLength(300);

            entity.HasIndex(r => r.NormalizedName).IsUnique();
        });

        // UserRole Composite Key & FKs
        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasKey(ur => new { ur.UserId, ur.RoleId });
            entity.HasOne(ur => ur.User)
                  .WithMany(u => u.UserRoles)
                  .HasForeignKey(ur => ur.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(ur => ur.Role)
                  .WithMany(r => r.UserRoles)
                  .HasForeignKey(ur => ur.RoleId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // UserProjectScope Composite Key
        modelBuilder.Entity<UserProjectScope>(entity =>
        {
            entity.HasKey(ups => new { ups.UserId, ups.ProjectId });
            entity.HasOne(ups => ups.User)
                  .WithMany(u => u.ProjectScopes)
                  .HasForeignKey(ups => ups.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(ups => ups.Project)
                  .WithMany(p => p.UserScopes)
                  .HasForeignKey(ups => ups.ProjectId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // UserWarehouseScope Composite Key
        modelBuilder.Entity<UserWarehouseScope>(entity =>
        {
            entity.HasKey(uws => new { uws.UserId, uws.WarehouseId });
            entity.HasOne(uws => uws.User)
                  .WithMany(u => u.WarehouseScopes)
                  .HasForeignKey(uws => uws.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(uws => uws.Warehouse)
                  .WithMany(w => w.UserScopes)
                  .HasForeignKey(uws => uws.WarehouseId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Precision configurations for Inventory
        modelBuilder.Entity<StockLedgerEntry>(entity =>
        {
            entity.Property(e => e.Quantity).HasPrecision(18, 4);
            entity.Property(e => e.UnitCost).HasPrecision(18, 4);
            entity.Property(e => e.TotalValue).HasPrecision(18, 4);
            entity.Property(e => e.BalanceQuantityAfter).HasPrecision(18, 4);
            entity.Property(e => e.WeightedAverageCostAfter).HasPrecision(18, 4);
            entity.Property(e => e.TotalValuationAfter).HasPrecision(18, 4);
        });

        modelBuilder.Entity<StockBalance>(entity =>
        {
            entity.Property(b => b.QuantityOnHand).HasPrecision(18, 4);
            entity.Property(b => b.QuantityReserved).HasPrecision(18, 4);
            entity.Property(b => b.QuantityInTransit).HasPrecision(18, 4);
            entity.Property(b => b.WeightedAverageCost).HasPrecision(18, 4);
            entity.Property(b => b.RowVersion).IsRowVersion();
        });
    }
}
