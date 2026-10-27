# Inventory Valuation & Stock Movement Policy
## Construction Stock Management System

### 1. Weighted-Average Costing (WAC) Principle
All inventory is valued using a **continuous moving weighted-average unit cost policy**. Financial computations use strict decimal precision (`decimal(18,4)` in C# and SQL Server). Floating-point data types (`float`, `double`) are strictly prohibited to prevent financial truncation and balance drift.

---

### 2. Transaction Valuation Rules by Movement Type

| Movement Type | Quantity Direction | Valuation Applied | WAC Effect |
| :--- | :--- | :--- | :--- |
| **Opening Balance** | `+ Positive` | Specified unit opening rate | Establishes initial WAC and valuation |
| **Goods Received Note (GRN)** | `+ Positive` | Purchase Order / Invoice rate | **Recalculates WAC** via weighted formula |
| **Material Issue to Work** | `- Negative` | Current warehouse WAC | Quantity decreases; **WAC remains unchanged** |
| **Site Return (Unused)** | `+ Positive` | Original issue unit cost | **Recalculates WAC** with returned batch |
| **Transfer Out (Dispatch)** | `- Negative` | Source warehouse WAC | Transferred to *In-Transit* account at source WAC |
| **Transfer In (Receipt)** | `+ Positive` | Dispatched source WAC | **Recalculates WAC** at destination warehouse |
| **Stock Adjustment (+/-)** | `+/- Delta` | Current WAC or verified cost | Audited ledger entry with approved variance |

---

### 3. WAC Mathematical Formula (GRN Receipt)
When new quantity $Q_{in}$ arrives at unit cost $C_{in}$, and existing warehouse balance is $Q_{old}$ at current average cost $WAC_{old}$:

$$\text{New WAC} = \frac{(Q_{old} \times WAC_{old}) + (Q_{in} \times C_{in})}{Q_{old} + Q_{in}}$$

- If $Q_{old} \le 0$ (initial stock or empty location), $\text{New WAC} = C_{in}$.
- Result is rounded to 4 decimal places for cost records and 2 decimal places for financial reporting.

---

### 4. Authoritative Ledger & Zero In-Place Edits
1. The **`StockLedgerEntry`** table is the authoritative, append-only history of physical inventory.
2. Balances in **`StockBalance`** are cached projections verified against ledger sums.
3. No posted transaction may be deleted or modified in place.
4. Corrections require an explicit **Controlled Reversal** or **Stock Adjustment** entry with supervisor authorization and audit reason.
5. All ledger entries record UTC timestamps, user identity, project ID, and warehouse ID.
