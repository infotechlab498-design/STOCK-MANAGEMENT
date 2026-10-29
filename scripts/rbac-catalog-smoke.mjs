/** Lightweight catalog assertions (no TS loader required). */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Parse ROLE_PERMISSIONS from source via dynamic tsx import
const { can, rolesFor } = await import('../src/security/rolePermissions.ts');

const assert = (cond, msg) => {
  if (!cond) {
    console.error('FAIL', msg);
    process.exitCode = 1;
  } else {
    console.log('OK', msg);
  }
};

assert(!can(['ProcurementOfficer'], 'nav.admin.users'), 'Proc no users');
assert(!can(['ProcurementOfficer'], 'nav.inventory.ledger'), 'Proc no ledger');
assert(!can(['ProcurementOfficer'], 'nav.procurement.po.approve'), 'Proc no PO approve');
assert(can(['ProcurementOfficer'], 'nav.procurement.po.write'), 'Proc PO write');
assert(can(['ProcurementOfficer'], 'nav.master.materials.view'), 'Proc materials view');
assert(!can(['ProcurementOfficer'], 'nav.master.materials.write'), 'Proc no materials write');

assert(!can(['InventoryManager'], 'nav.procurement.po.write'), 'IM no PO write');
assert(!can(['InventoryManager'], 'nav.admin.users'), 'IM no users');
assert(can(['InventoryManager'], 'nav.receiving.grn.write'), 'IM GRN write');
assert(can(['InventoryManager'], 'nav.reports.valuation'), 'IM valuation');

assert(!can(['Storekeeper'], 'nav.procurement.po.write'), 'SK no PO write');
assert(!can(['Storekeeper'], 'nav.reports.valuation'), 'SK no valuation');
assert(can(['Storekeeper'], 'nav.inventory.issues.write'), 'SK issue write');

assert(can(['ProjectManager'], 'nav.procurement.po.approve'), 'PM PO approve');
assert(can(['ProjectManager'], 'nav.reports.valuation'), 'PM valuation');
assert(!can(['ProjectManager'], 'nav.master.materials.write'), 'PM no master write');
assert(!can(['ProjectManager'], 'nav.admin.users'), 'PM no users');

assert(can(['AccountsOfficer'], 'nav.reports.valuation'), 'Acct valuation');
assert(can(['AccountsOfficer'], 'nav.inventory.ledger'), 'Acct ledger');
assert(can(['AccountsOfficer'], 'nav.receiving.grn.post'), 'Acct GRN post');
assert(!can(['AccountsOfficer'], 'nav.inventory.issues.write'), 'Acct no issue write');
assert(!can(['AccountsOfficer'], 'nav.master.warehouses'), 'Acct no warehouses');

assert(can(['Viewer'], 'nav.inventory.stock'), 'Viewer stock');
assert(can(['Auditor'], 'nav.inventory.stock'), 'Auditor stock');

const poWrite = rolesFor('nav.procurement.po.write');
assert(
  poWrite.includes('SuperAdmin') &&
    poWrite.includes('ProcurementOfficer') &&
    !poWrite.includes('InventoryManager'),
  'PO write roles',
);
const users = rolesFor('nav.admin.users');
assert(users.length === 1 && users[0] === 'SuperAdmin', 'Users SA only');
const val = rolesFor('nav.reports.valuation');
assert(
  val.includes('ProjectManager') &&
    val.includes('AccountsOfficer') &&
    !val.includes('Storekeeper') &&
    !val.includes('ProcurementOfficer'),
  'Valuation roles',
);

console.log('Catalog smoke done');
