using ConstructionStock.Application.Materials;
using ConstructionStock.Application.Repositories;
using ConstructionStock.Domain.Entities;
using ConstructionStock.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ConstructionStock.Api.Controllers;

[ApiController]
[Route("api/material-categories")]
[Authorize]
public class MaterialCategoriesController : ControllerBase
{
    private readonly ICategoryRepository _categoryRepository;

    public MaterialCategoriesController(ICategoryRepository categoryRepository)
    {
        _categoryRepository = categoryRepository;
    }

    /// <summary>
    /// Lists all material categories.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<MaterialCategoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCategories(CancellationToken cancellationToken)
    {
        var categories = await _categoryRepository.GetAllAsync(cancellationToken);
        var dtos = categories.Select(c => new MaterialCategoryDto(c.Id, c.Code, c.Name, c.Description, c.IsActive)).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Creates a new material category.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = $"{SystemRoleNames.SuperAdmin},{SystemRoleNames.InventoryManager}")]
    [ProducesResponseType(typeof(MaterialCategoryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCategory([FromBody] CreateMaterialCategoryDto dto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Code))
        {
            return BadRequest(new { message = "Category Code and Name are required" });
        }

        var category = new MaterialCategory
        {
            Id = Guid.NewGuid(),
            Code = dto.Code.Trim().ToUpperInvariant(),
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        var created = await _categoryRepository.CreateAsync(category, cancellationToken);
        var resultDto = new MaterialCategoryDto(created.Id, created.Code, created.Name, created.Description, created.IsActive);
        return CreatedAtAction(nameof(GetCategories), new { id = created.Id }, resultDto);
    }
}

[ApiController]
[Route("api/units")]
[Authorize]
public class UnitsController : ControllerBase
{
    private readonly IUnitRepository _unitRepository;

    public UnitsController(IUnitRepository unitRepository)
    {
        _unitRepository = unitRepository;
    }

    /// <summary>
    /// Lists all standard units of measure.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<UnitOfMeasureDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnits(CancellationToken cancellationToken)
    {
        var units = await _unitRepository.GetAllAsync(cancellationToken);
        var dtos = units.Select(u => new UnitOfMeasureDto(u.Id, u.Code, u.Name, u.Symbol, u.IsActive)).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Retrieves unit conversion rules, optionally filtered by material ID.
    /// </summary>
    [HttpGet("conversions")]
    [ProducesResponseType(typeof(List<UnitConversionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetConversions([FromQuery] Guid? materialId, CancellationToken cancellationToken)
    {
        var conversions = await _unitRepository.GetConversionsAsync(materialId, cancellationToken);
        var dtos = conversions.Select(c => new UnitConversionDto(
            c.Id,
            c.MaterialId,
            c.FromUnitId,
            c.FromUnitCode,
            c.ToUnitId,
            c.ToUnitCode,
            c.ConversionFactor,
            c.Description
        )).ToList();
        return Ok(dtos);
    }
}
