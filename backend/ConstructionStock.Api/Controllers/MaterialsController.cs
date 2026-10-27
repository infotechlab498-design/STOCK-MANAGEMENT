using ConstructionStock.Application.Materials;
using ConstructionStock.Application.Repositories;
using ConstructionStock.Domain.Entities;
using ConstructionStock.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ConstructionStock.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MaterialsController : ControllerBase
{
    private readonly IMaterialRepository _materialRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly IUnitRepository _unitRepository;

    public MaterialsController(
        IMaterialRepository materialRepository,
        ICategoryRepository categoryRepository,
        IUnitRepository unitRepository)
    {
        _materialRepository = materialRepository;
        _categoryRepository = categoryRepository;
        _unitRepository = unitRepository;
    }

    /// <summary>
    /// Retrieves materials with search, category filter, and active status filter.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<MaterialDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMaterials(
        [FromQuery] string? search,
        [FromQuery] Guid? categoryId,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        bool? isActive = status?.ToUpperInvariant() switch
        {
            "ACTIVE" => true,
            "INACTIVE" => false,
            _ => null
        };

        var materials = await _materialRepository.GetAllAsync(search, categoryId, isActive, cancellationToken);

        var dtos = materials.Select(m => new MaterialDto(
            m.Id,
            m.ItemCode,
            m.Name,
            m.Description,
            m.Specification,
            m.CategoryId,
            m.CategoryName,
            m.BaseUnitId,
            m.BaseUnitName,
            m.MinimumStockLevel,
            m.ReorderLevel,
            m.IsActive,
            m.CreatedAtUtc,
            m.UpdatedAtUtc,
            m.CreatedByUserId,
            m.UpdatedByUserId
        )).ToList();

        return Ok(dtos);
    }

    /// <summary>
    /// Retrieves a single material by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(MaterialDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMaterialById(Guid id, CancellationToken cancellationToken)
    {
        var material = await _materialRepository.GetByIdAsync(id, cancellationToken);
        if (material == null)
        {
            return NotFound(new { message = $"Material with ID '{id}' was not found" });
        }

        return Ok(new MaterialDto(
            material.Id,
            material.ItemCode,
            material.Name,
            material.Description,
            material.Specification,
            material.CategoryId,
            material.CategoryName,
            material.BaseUnitId,
            material.BaseUnitName,
            material.MinimumStockLevel,
            material.ReorderLevel,
            material.IsActive,
            material.CreatedAtUtc,
            material.UpdatedAtUtc,
            material.CreatedByUserId,
            material.UpdatedByUserId
        ));
    }

    /// <summary>
    /// Creates a new Material record.
    /// Enforces unique ItemCode (returns 409 Conflict if duplicate) and valid stock levels.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = $"{SystemRoleNames.SuperAdmin},{SystemRoleNames.InventoryManager},{SystemRoleNames.ProcurementOfficer}")]
    [ProducesResponseType(typeof(MaterialDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateMaterial([FromBody] CreateMaterialDto dto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.ItemCode) || string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "ItemCode and Name are required" });
        }

        if (dto.MinimumStockLevel < 0)
        {
            return BadRequest(new { message = "Minimum stock level cannot be negative" });
        }

        if (dto.ReorderLevel < dto.MinimumStockLevel)
        {
            return BadRequest(new { message = "Reorder level must be greater than or equal to minimum stock level" });
        }

        var trimmedCode = dto.ItemCode.Trim();
        if (await _materialRepository.IsItemCodeTakenAsync(trimmedCode, null, cancellationToken))
        {
            return Conflict(new { message = $"Material with ItemCode '{trimmedCode}' already exists." });
        }

        var category = await _categoryRepository.GetByIdAsync(dto.CategoryId, cancellationToken);
        if (category == null || !category.IsActive)
        {
            return BadRequest(new { message = "Specified Category does not exist or is inactive" });
        }

        var unit = await _unitRepository.GetByIdAsync(dto.BaseUnitId, cancellationToken);
        if (unit == null || !unit.IsActive)
        {
            return BadRequest(new { message = "Specified Unit of Measure does not exist or is inactive" });
        }

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        var material = new Material
        {
            Id = Guid.NewGuid(),
            ItemCode = trimmedCode,
            NormalizedItemCode = trimmedCode.ToUpperInvariant(),
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            Specification = dto.Specification?.Trim(),
            CategoryId = category.Id,
            CategoryName = category.Name,
            BaseUnitId = unit.Id,
            BaseUnitName = unit.Name,
            MinimumStockLevel = dto.MinimumStockLevel,
            ReorderLevel = dto.ReorderLevel,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow,
            CreatedByUserId = userId
        };

        var created = await _materialRepository.CreateAsync(material, cancellationToken);

        var resultDto = new MaterialDto(
            created.Id,
            created.ItemCode,
            created.Name,
            created.Description,
            created.Specification,
            created.CategoryId,
            created.CategoryName,
            created.BaseUnitId,
            created.BaseUnitName,
            created.MinimumStockLevel,
            created.ReorderLevel,
            created.IsActive,
            created.CreatedAtUtc,
            created.UpdatedAtUtc,
            created.CreatedByUserId,
            created.UpdatedByUserId
        );

        return CreatedAtAction(nameof(GetMaterialById), new { id = created.Id }, resultDto);
    }

    /// <summary>
    /// Updates an existing Material record.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = $"{SystemRoleNames.SuperAdmin},{SystemRoleNames.InventoryManager},{SystemRoleNames.ProcurementOfficer}")]
    [ProducesResponseType(typeof(MaterialDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateMaterial(Guid id, [FromBody] UpdateMaterialDto dto, CancellationToken cancellationToken)
    {
        var existing = await _materialRepository.GetByIdAsync(id, cancellationToken);
        if (existing == null)
        {
            return NotFound(new { message = $"Material with ID '{id}' was not found" });
        }

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new { message = "Name is required" });
        }

        if (dto.MinimumStockLevel < 0)
        {
            return BadRequest(new { message = "Minimum stock level cannot be negative" });
        }

        if (dto.ReorderLevel < dto.MinimumStockLevel)
        {
            return BadRequest(new { message = "Reorder level must be greater than or equal to minimum stock level" });
        }

        var category = await _categoryRepository.GetByIdAsync(dto.CategoryId, cancellationToken);
        if (category == null || !category.IsActive)
        {
            return BadRequest(new { message = "Specified Category does not exist or is inactive" });
        }

        var unit = await _unitRepository.GetByIdAsync(dto.BaseUnitId, cancellationToken);
        if (unit == null || !unit.IsActive)
        {
            return BadRequest(new { message = "Specified Unit of Measure does not exist or is inactive" });
        }

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        existing.Name = dto.Name.Trim();
        existing.Description = dto.Description?.Trim();
        existing.Specification = dto.Specification?.Trim();
        existing.CategoryId = category.Id;
        existing.CategoryName = category.Name;
        existing.BaseUnitId = unit.Id;
        existing.BaseUnitName = unit.Name;
        existing.MinimumStockLevel = dto.MinimumStockLevel;
        existing.ReorderLevel = dto.ReorderLevel;
        existing.UpdatedAtUtc = DateTime.UtcNow;
        existing.UpdatedByUserId = userId;

        var updated = await _materialRepository.UpdateAsync(existing, cancellationToken);

        return Ok(new MaterialDto(
            updated.Id,
            updated.ItemCode,
            updated.Name,
            updated.Description,
            updated.Specification,
            updated.CategoryId,
            updated.CategoryName,
            updated.BaseUnitId,
            updated.BaseUnitName,
            updated.MinimumStockLevel,
            updated.ReorderLevel,
            updated.IsActive,
            updated.CreatedAtUtc,
            updated.UpdatedAtUtc,
            updated.CreatedByUserId,
            updated.UpdatedByUserId
        ));
    }

    /// <summary>
    /// Activates or deactivates a material record.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    [Authorize(Roles = $"{SystemRoleNames.SuperAdmin},{SystemRoleNames.InventoryManager}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateMaterialStatus(Guid id, [FromBody] UpdateMaterialStatusDto dto, CancellationToken cancellationToken)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var success = await _materialRepository.UpdateStatusAsync(id, dto.IsActive, userId, cancellationToken);
        if (!success)
        {
            return NotFound(new { message = $"Material with ID '{id}' was not found" });
        }

        return Ok(new { id, isActive = dto.IsActive, message = $"Material {(dto.IsActive ? "activated" : "deactivated")} successfully" });
    }
}
