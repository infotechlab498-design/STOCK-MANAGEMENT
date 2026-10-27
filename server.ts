import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'construction_stock_jwt_secure_key_2026_enterprise_audit_token';
const JWT_ISSUER = 'https://constructcorp.internal';
const JWT_AUDIENCE = 'https://constructstock.app';

// Local JSON Storage Directory (Outside build output, protected from static serving)
const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json());

// --------------------------------------------------------------------------
// Cryptographic Helpers (PBKDF2 SHA-256, 100,000 iterations)
// --------------------------------------------------------------------------
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), 100000, 32, 'sha256').toString('base64');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, expectedHash] = storedHash.split(':');
    if (!salt || !expectedHash) return false;
    const actualHash = crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), 100000, 32, 'sha256');
    const expectedBuf = Buffer.from(expectedHash, 'base64');
    return crypto.timingSafeEqual(actualHash, expectedBuf);
  } catch {
    return false;
  }
}

// --------------------------------------------------------------------------
// JWT Signing & Verification (HMAC-SHA256, RFC 7519)
// --------------------------------------------------------------------------
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString();
}

interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  fullName: string;
  roles: string[];
  projectScopes: string[];
  warehouseScopes: string[];
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

function generateJwt(user: UserRecord): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    roles: user.roles,
    projectScopes: user.projectScopes,
    warehouseScopes: user.warehouseScopes,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + 3600, // 1 hour expiry
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const sigBuf = Buffer.from(signatureB64);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: JwtPayload = JSON.parse(base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) return null;

    return payload;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// In-Memory Database Models & Seed Data
// --------------------------------------------------------------------------
export interface UserRecord {
  id: string;
  username: string;
  normalizedUsername: string;
  email: string;
  normalizedEmail: string;
  fullName: string;
  passwordHash: string;
  isActive: boolean;
  roles: string[];
  projectScopes: string[];
  warehouseScopes: string[];
  createdAtUtc: string;
  updatedAtUtc?: string;
  lastLoginAtUtc?: string;
}

export interface RoleRecord {
  id: string;
  name: string;
  description: string;
}

const enterpriseRoles: RoleRecord[] = [
  { id: 'ROL-01', name: 'SuperAdmin', description: 'User administration, system governance, and master configuration' },
  { id: 'ROL-02', name: 'InventoryManager', description: 'Organization-wide inventory visibility and stock control operations' },
  { id: 'ROL-03', name: 'ProjectManager', description: 'Access limited to assigned projects and requisition approvals' },
  { id: 'ROL-04', name: 'ProcurementOfficer', description: 'Supplier registry, purchase orders, and procurement management' },
  { id: 'ROL-05', name: 'Storekeeper', description: 'Permitted warehouse receiving, material issues, and transfer dispatch' },
  { id: 'ROL-06', name: 'AccountsOfficer', description: 'Inventory cost analysis, weighted-average valuation, and ledger audit' },
  { id: 'ROL-07', name: 'Viewer', description: 'Read-only access to permitted reports and stock ledger statements' },
];

const enterpriseUsers: UserRecord[] = [
  {
    id: 'USR-ADMIN-01',
    username: 'admin',
    normalizedUsername: 'ADMIN',
    email: 'admin@constructcorp.com',
    normalizedEmail: 'ADMIN@CONSTRUCTCORP.COM',
    fullName: 'Alexander Vance',
    passwordHash: hashPassword('Admin@2026!Stock'),
    isActive: true,
    roles: ['SuperAdmin', 'InventoryManager'],
    projectScopes: ['PRJ-101', 'PRJ-102', 'PRJ-103'],
    warehouseScopes: ['WH-01', 'WH-02', 'WH-03'],
    createdAtUtc: '2026-01-15T08:00:00Z',
  },
  {
    id: 'USR-MGR-02',
    username: 'inv.manager',
    normalizedUsername: 'INV.MANAGER',
    email: 'inv.manager@constructcorp.com',
    normalizedEmail: 'INV.MANAGER@CONSTRUCTCORP.COM',
    fullName: 'Elena Rostova',
    passwordHash: hashPassword('Manager@2026!Inv'),
    isActive: true,
    roles: ['InventoryManager'],
    projectScopes: ['PRJ-101', 'PRJ-102', 'PRJ-103'],
    warehouseScopes: ['WH-01', 'WH-02', 'WH-03'],
    createdAtUtc: '2026-02-01T09:30:00Z',
  },
  {
    id: 'USR-PM-03',
    username: 'pm.metro',
    normalizedUsername: 'PM.METRO',
    email: 'pm.metro@constructcorp.com',
    normalizedEmail: 'PM.METRO@CONSTRUCTCORP.COM',
    fullName: 'David Sterling',
    passwordHash: hashPassword('Project@2026!Metro'),
    isActive: true,
    roles: ['ProjectManager'],
    projectScopes: ['PRJ-101'],
    warehouseScopes: ['WH-01', 'WH-02'],
    createdAtUtc: '2026-02-10T11:00:00Z',
  },
  {
    id: 'USR-STR-04',
    username: 'store.north',
    normalizedUsername: 'STORE.NORTH',
    email: 'store.north@constructcorp.com',
    normalizedEmail: 'STORE.NORTH@CONSTRUCTCORP.COM',
    fullName: 'Marcus Vance',
    passwordHash: hashPassword('Store@2026!Keeper'),
    isActive: true,
    roles: ['Storekeeper'],
    projectScopes: ['PRJ-101'],
    warehouseScopes: ['WH-02'],
    createdAtUtc: '2026-02-15T14:15:00Z',
  },
  {
    id: 'USR-PROC-05',
    username: 'procurement',
    normalizedUsername: 'PROCUREMENT',
    email: 'procurement@constructcorp.com',
    normalizedEmail: 'PROCUREMENT@CONSTRUCTCORP.COM',
    fullName: 'Samantha Lee',
    passwordHash: hashPassword('Procure@2026!Officer'),
    isActive: true,
    roles: ['ProcurementOfficer'],
    projectScopes: ['PRJ-101', 'PRJ-102'],
    warehouseScopes: ['WH-01', 'WH-02'],
    createdAtUtc: '2026-03-01T10:00:00Z',
  },
  {
    id: 'USR-ACCT-06',
    username: 'accounts',
    normalizedUsername: 'ACCOUNTS',
    email: 'accounts@constructcorp.com',
    normalizedEmail: 'ACCOUNTS@CONSTRUCTCORP.COM',
    fullName: 'Richard Hayes',
    passwordHash: hashPassword('Accounts@2026!Valuation'),
    isActive: true,
    roles: ['AccountsOfficer'],
    projectScopes: ['PRJ-101', 'PRJ-102', 'PRJ-103'],
    warehouseScopes: ['WH-01', 'WH-02', 'WH-03'],
    createdAtUtc: '2026-03-05T08:45:00Z',
  },
  {
    id: 'USR-VIEW-07',
    username: 'auditor',
    normalizedUsername: 'AUDITOR',
    email: 'auditor@constructcorp.com',
    normalizedEmail: 'AUDITOR@CONSTRUCTCORP.COM',
    fullName: 'Claire Bennett',
    passwordHash: hashPassword('Viewer@2026!Audit'),
    isActive: true,
    roles: ['Viewer'],
    projectScopes: ['PRJ-101'],
    warehouseScopes: ['WH-02'],
    createdAtUtc: '2026-03-10T13:00:00Z',
  },
  {
    id: 'USR-DIS-08',
    username: 'disabled.user',
    normalizedUsername: 'DISABLED.USER',
    email: 'disabled.user@constructcorp.com',
    normalizedEmail: 'DISABLED.USER@CONSTRUCTCORP.COM',
    fullName: 'Deactivated Personnel',
    passwordHash: hashPassword('Disabled@2026!Test'),
    isActive: false, // Disabled account for testing
    roles: ['Viewer'],
    projectScopes: ['PRJ-101'],
    warehouseScopes: ['WH-02'],
    createdAtUtc: '2026-01-01T00:00:00Z',
  },
];

// In-Memory Rate Limiting Tracker
interface FailedAttemptTracker {
  count: number;
  lockedUntil?: number;
}
const failedAttempts = new Map<string, FailedAttemptTracker>();

// --------------------------------------------------------------------------
// Auth Middleware
// --------------------------------------------------------------------------
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid authorization token',
      timestampUtc: new Date().toISOString(),
    });
  }

  const token = authHeader.substring(7);
  const payload = verifyJwt(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Token is expired or invalid',
      timestampUtc: new Date().toISOString(),
    });
  }

  const user = enterpriseUsers.find((u) => u.id === payload.sub);
  if (!user || !user.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Account is inactive or has been disabled',
      timestampUtc: new Date().toISOString(),
    });
  }

  req.user = payload;
  next();
}

function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Requires one of [${allowedRoles.join(', ')}] role`,
        timestampUtc: new Date().toISOString(),
      });
    }

    next();
  };
}

// --------------------------------------------------------------------------
// Setup API Routes
// --------------------------------------------------------------------------
function setupApiRoutes(router: express.Router) {
  // POST /api/auth/login
  router.post('/auth/login', (req: Request, res: Response) => {
    const { usernameOrEmail, password } = req.body || {};

    if (!usernameOrEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/Email and password are required',
        timestampUtc: new Date().toISOString(),
      });
    }

    const identifier = String(usernameOrEmail).trim().toUpperCase();
    const trackerKey = `${req.ip || 'ip'}:${identifier}`;
    const now = Date.now();
    const tracker = failedAttempts.get(trackerKey) || { count: 0 };

    if (tracker.lockedUntil && tracker.lockedUntil > now) {
      const waitSeconds = Math.ceil((tracker.lockedUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts. Please wait ${waitSeconds} seconds.`,
        timestampUtc: new Date().toISOString(),
      });
    }

    const user = enterpriseUsers.find(
      (u) => u.normalizedEmail === identifier || u.normalizedUsername === identifier
    );

    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      tracker.count += 1;
      if (tracker.count >= 5) {
        tracker.lockedUntil = now + 60000; // 1-minute lock
      }
      failedAttempts.set(trackerKey, tracker);

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        timestampUtc: new Date().toISOString(),
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Contact your system administrator.',
        timestampUtc: new Date().toISOString(),
      });
    }

    // Reset failed tracker upon successful login
    failedAttempts.delete(trackerKey);
    user.lastLoginAtUtc = new Date().toISOString();

    const token = generateJwt(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: token,
        expiresInSeconds: 3600,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          isActive: user.isActive,
          roles: user.roles,
          projectScopes: user.projectScopes,
          warehouseScopes: user.warehouseScopes,
          lastLoginAtUtc: user.lastLoginAtUtc,
        },
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // POST /api/auth/logout
  router.post('/auth/logout', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      data: null,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/auth/me
  router.get('/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const user = enterpriseUsers.find((u) => u.id === req.user?.sub);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        isActive: user.isActive,
        roles: user.roles,
        projectScopes: user.projectScopes,
        warehouseScopes: user.warehouseScopes,
        lastLoginAtUtc: user.lastLoginAtUtc,
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/roles
  router.get('/roles', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const rolesWithCounts = enterpriseRoles.map((r) => ({
      ...r,
      userCount: enterpriseUsers.filter((u) => u.roles.includes(r.name)).length,
    }));

    return res.status(200).json({
      success: true,
      data: rolesWithCounts,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/users
  router.get('/users', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager']), (req: AuthenticatedRequest, res: Response) => {
    const { search, role, status } = req.query;

    let filtered = [...enterpriseUsers];

    if (search && typeof search === 'string') {
      const term = search.trim().toUpperCase();
      filtered = filtered.filter(
        (u) =>
          u.normalizedEmail.includes(term) ||
          u.normalizedUsername.includes(term) ||
          u.fullName.toUpperCase().includes(term)
      );
    }

    if (role && typeof role === 'string' && role !== 'ALL') {
      filtered = filtered.filter((u) => u.roles.includes(role));
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      const isActive = status === 'ACTIVE';
      filtered = filtered.filter((u) => u.isActive === isActive);
    }

    const safeUsers = filtered.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.fullName,
      isActive: u.isActive,
      roles: u.roles,
      projectScopes: u.projectScopes,
      warehouseScopes: u.warehouseScopes,
      createdAtUtc: u.createdAtUtc,
      updatedAtUtc: u.updatedAtUtc,
      lastLoginAtUtc: u.lastLoginAtUtc,
    }));

    return res.status(200).json({
      success: true,
      data: safeUsers,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/users/:id
  router.get('/users/:id', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager']), (req: AuthenticatedRequest, res: Response) => {
    const user = enterpriseUsers.find((u) => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with ID '${req.params.id}' was not found`,
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        isActive: user.isActive,
        roles: user.roles,
        projectScopes: user.projectScopes,
        warehouseScopes: user.warehouseScopes,
        createdAtUtc: user.createdAtUtc,
        updatedAtUtc: user.updatedAtUtc,
        lastLoginAtUtc: user.lastLoginAtUtc,
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // POST /api/users (Create User)
  router.post('/users', authMiddleware, requireRole(['SuperAdmin']), (req: AuthenticatedRequest, res: Response) => {
    const { username, email, fullName, password, roles, projectScopes, warehouseScopes } = req.body || {};

    if (!username || !email || !fullName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, full name, and password are required',
        timestampUtc: new Date().toISOString(),
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters in length',
        timestampUtc: new Date().toISOString(),
      });
    }

    const normalizedEmail = String(email).trim().toUpperCase();
    const normalizedUsername = String(username).trim().toUpperCase();

    if (enterpriseUsers.some((u) => u.normalizedEmail === normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists',
        timestampUtc: new Date().toISOString(),
      });
    }

    if (enterpriseUsers.some((u) => u.normalizedUsername === normalizedUsername)) {
      return res.status(400).json({
        success: false,
        message: 'A user with this username already exists',
        timestampUtc: new Date().toISOString(),
      });
    }

    const assignedRoles: string[] = Array.isArray(roles) && roles.length > 0 ? roles : ['Viewer'];

    // Guard: Prevent privilege escalation (only SuperAdmin can create a SuperAdmin)
    const isCallerSuperAdmin = req.user?.roles.includes('SuperAdmin');
    if (assignedRoles.includes('SuperAdmin') && !isCallerSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only an active Super Admin may assign the Super Admin role',
        timestampUtc: new Date().toISOString(),
      });
    }

    const newUser: UserRecord = {
      id: `USR-${Date.now().toString(36).toUpperCase()}`,
      username: String(username).trim(),
      normalizedUsername,
      email: String(email).trim(),
      normalizedEmail,
      fullName: String(fullName).trim(),
      passwordHash: hashPassword(String(password)),
      isActive: true,
      roles: assignedRoles,
      projectScopes: Array.isArray(projectScopes) ? projectScopes : ['PRJ-101'],
      warehouseScopes: Array.isArray(warehouseScopes) ? warehouseScopes : ['WH-01'],
      createdAtUtc: new Date().toISOString(),
    };

    enterpriseUsers.unshift(newUser);

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        isActive: newUser.isActive,
        roles: newUser.roles,
        projectScopes: newUser.projectScopes,
        warehouseScopes: newUser.warehouseScopes,
        createdAtUtc: newUser.createdAtUtc,
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // PUT /api/users/:id (Update User)
  router.put('/users/:id', authMiddleware, requireRole(['SuperAdmin']), (req: AuthenticatedRequest, res: Response) => {
    const user = enterpriseUsers.find((u) => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        timestampUtc: new Date().toISOString(),
      });
    }

    const { fullName, email, roles, projectScopes, warehouseScopes } = req.body || {};

    if (email) {
      const normalizedEmail = String(email).trim().toUpperCase();
      if (enterpriseUsers.some((u) => u.id !== user.id && u.normalizedEmail === normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Email address is already in use by another user',
          timestampUtc: new Date().toISOString(),
        });
      }
      user.email = String(email).trim();
      user.normalizedEmail = normalizedEmail;
    }

    if (fullName) {
      user.fullName = String(fullName).trim();
    }

    if (Array.isArray(roles)) {
      const wasSuperAdmin = user.roles.includes('SuperAdmin');
      const willBeSuperAdmin = roles.includes('SuperAdmin');

      if (wasSuperAdmin && !willBeSuperAdmin) {
        const otherActiveSuperAdmins = enterpriseUsers.filter(
          (u) => u.id !== user.id && u.isActive && u.roles.includes('SuperAdmin')
        ).length;

        if (otherActiveSuperAdmins === 0) {
          return res.status(400).json({
            success: false,
            message: 'Cannot revoke Super Admin role from the last active Super Admin',
            timestampUtc: new Date().toISOString(),
          });
        }
      }

      user.roles = roles;
    }

    if (Array.isArray(projectScopes)) {
      user.projectScopes = projectScopes;
    }

    if (Array.isArray(warehouseScopes)) {
      user.warehouseScopes = warehouseScopes;
    }

    user.updatedAtUtc = new Date().toISOString();

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        isActive: user.isActive,
        roles: user.roles,
        projectScopes: user.projectScopes,
        warehouseScopes: user.warehouseScopes,
        updatedAtUtc: user.updatedAtUtc,
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // PATCH /api/users/:id/status (Activate / Deactivate User)
  router.patch('/users/:id/status', authMiddleware, requireRole(['SuperAdmin']), (req: AuthenticatedRequest, res: Response) => {
    const user = enterpriseUsers.find((u) => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        timestampUtc: new Date().toISOString(),
      });
    }

    const { isActive } = req.body || {};
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Field isActive must be a boolean',
        timestampUtc: new Date().toISOString(),
      });
    }

    // Security guard: Prevent deactivating the last active Super Admin
    if (!isActive && user.roles.includes('SuperAdmin')) {
      const otherActiveSuperAdmins = enterpriseUsers.filter(
        (u) => u.id !== user.id && u.isActive && u.roles.includes('SuperAdmin')
      ).length;

      if (otherActiveSuperAdmins === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last active Super Admin account',
          timestampUtc: new Date().toISOString(),
        });
      }
    }

    user.isActive = isActive;
    user.updatedAtUtc = new Date().toISOString();

    return res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: user.id,
        isActive: user.isActive,
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // ========================================================================
  // MATERIAL MASTER & LOCAL JSON STORAGE ENGINE
  // ========================================================================

  interface MaterialRecord {
    id: string;
    itemCode: string;
    normalizedItemCode: string;
    name: string;
    description?: string;
    specification?: string;
    categoryId: string;
    categoryName: string;
    baseUnitId: string;
    baseUnitName: string;
    minimumStockLevel: number;
    reorderLevel: number;
    isActive: boolean;
    createdAtUtc: string;
    updatedAtUtc?: string;
    createdByUserId?: string;
    updatedByUserId?: string;
  }

  interface CategoryRecord {
    id: string;
    code: string;
    name: string;
    description?: string;
    isActive: boolean;
  }

  interface UnitRecord {
    id: string;
    code: string;
    name: string;
    symbol: string;
    isActive: boolean;
  }

  interface UnitConversionRecord {
    id: string;
    materialId?: string;
    fromUnitId: string;
    fromUnitCode: string;
    toUnitId: string;
    toUnitCode: string;
    conversionFactor: number;
    description?: string;
    isActive: boolean;
  }

  const materialsFile = path.join(DATA_DIR, 'materials.json');
  const categoriesFile = path.join(DATA_DIR, 'categories.json');
  const unitsFile = path.join(DATA_DIR, 'units.json');
  const conversionsFile = path.join(DATA_DIR, 'unit_conversions.json');

  // Atomic file writer
  function writeJsonAtomic(filePath: string, data: any) {
    const tempFile = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, filePath);
  }

  // Safe JSON reader with corruption guard
  function readJsonSafe<T>(filePath: string, initialDefault: T): T {
    if (!fs.existsSync(filePath)) {
      writeJsonAtomic(filePath, initialDefault);
      return initialDefault;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim()) return initialDefault;
    try {
      return JSON.parse(content) as T;
    } catch (err) {
      console.error(`[Storage Error] Malformed JSON in ${filePath}. Refusing to overwrite.`, err);
      throw new Error(`Corrupted storage in ${path.basename(filePath)}`);
    }
  }

  // Initial Reference Seed Data
  const defaultCategories: CategoryRecord[] = [
    { id: 'CAT-STEEL', code: 'STEEL', name: 'Structural Steel & Rebar', description: 'Deformed reinforcement rebar, wire mesh, I-beams', isActive: true },
    { id: 'CAT-CEMENT', code: 'CEMENT', name: 'Cement & Binders', description: 'Ordinary Portland Cement, Sulfate Resistant, Hydrated Lime', isActive: true },
    { id: 'CAT-SAND', code: 'SAND', name: 'Sand & Fine Aggregates', description: 'Washed river sand, plaster sand, concrete sand', isActive: true },
    { id: 'CAT-CRUSH', code: 'CRUSH', name: 'Crushed Aggregates & Gravel', description: '10mm, 20mm, 40mm sub-base graded gravel', isActive: true },
    { id: 'CAT-BRICKS', code: 'BRICKS', name: 'Bricks & Masonry Blocks', description: 'Red clay bricks, hollow concrete blocks, autoclaved aerated concrete (AAC)', isActive: true },
    { id: 'CAT-TILES', code: 'TILES', name: 'Tiles & Ceramics', description: 'Vitrified floor tiles, glazed wall tiles, pavers', isActive: true },
    { id: 'CAT-MARBLE', code: 'MARBLE', name: 'Marble & Granite', description: 'Granite counter slabs, polished marble tiles, thresholds', isActive: true },
    { id: 'CAT-ELECTRICAL', code: 'ELECTRICAL', name: 'Electrical & Conduits', description: 'Cables, PVC conduit pipes, switchgear, distribution panels', isActive: true },
    { id: 'CAT-PLUMBING', code: 'PLUMBING', name: 'Plumbing & Drainage', description: 'uPVC drainage pipes, PPR water pipes, valves, fittings', isActive: true },
    { id: 'CAT-PAINT', code: 'PAINT', name: 'Paints & Waterproofing', description: 'Acrylic emulsion, primer, bituminous sealant membranes', isActive: true },
    { id: 'CAT-TOOLS', code: 'TOOLS', name: 'Site Tools & Consumables', description: 'Diamond blades, steel trowels, shovels, PPE consumables', isActive: true },
    { id: 'CAT-OTHER', code: 'OTHER', name: 'Other Construction Materials', description: 'Shuttering plywood, formwork ties, rebar spacers', isActive: true },
  ];

  const defaultUnits: UnitRecord[] = [
    { id: 'UNT-PCS', code: 'PCS', name: 'Piece', symbol: 'pcs', isActive: true },
    { id: 'UNT-BAG', code: 'BAG', name: 'Bag (50kg standard)', symbol: 'bag', isActive: true },
    { id: 'UNT-KG', code: 'KG', name: 'Kilogram', symbol: 'kg', isActive: true },
    { id: 'UNT-MT', code: 'MT', name: 'Metric Tonne', symbol: 'MT', isActive: true },
    { id: 'UNT-L', code: 'L', name: 'Litre', symbol: 'L', isActive: true },
    { id: 'UNT-M', code: 'M', name: 'Meter', symbol: 'm', isActive: true },
    { id: 'UNT-SQM', code: 'SQM', name: 'Square Meter', symbol: 'm²', isActive: true },
    { id: 'UNT-CUM', code: 'CUM', name: 'Cubic Meter', symbol: 'm³', isActive: true },
  ];

  const defaultConversions: UnitConversionRecord[] = [
    { id: 'CNV-1', fromUnitId: 'UNT-MT', fromUnitCode: 'MT', toUnitId: 'UNT-KG', toUnitCode: 'KG', conversionFactor: 1000, description: '1 Metric Tonne = 1,000 Kilograms', isActive: true },
    { id: 'CNV-2', fromUnitId: 'UNT-BAG', fromUnitCode: 'BAG', toUnitId: 'UNT-KG', toUnitCode: 'KG', conversionFactor: 50, description: '1 Standard Bag = 50 Kilograms', isActive: true },
  ];

  const defaultMaterials: MaterialRecord[] = [
    {
      id: 'MAT-STEEL-01',
      itemCode: 'STEEL-REBAR-T16',
      normalizedItemCode: 'STEEL-REBAR-T16',
      name: 'High-Tensile Deformed Rebar 16mm',
      description: 'Hot-rolled thermo-mechanically treated reinforcement rebar',
      specification: 'Grade 500B / BS 4449, 12m standard lengths',
      categoryId: 'CAT-STEEL',
      categoryName: 'Structural Steel & Rebar',
      baseUnitId: 'UNT-MT',
      baseUnitName: 'Metric Tonne',
      minimumStockLevel: 10.0,
      reorderLevel: 25.0,
      isActive: true,
      createdAtUtc: '2026-01-20T08:00:00Z',
    },
    {
      id: 'MAT-CEM-02',
      itemCode: 'CEM-OPC-50KG',
      normalizedItemCode: 'CEM-OPC-50KG',
      name: 'Ordinary Portland Cement (CEM I 42.5N)',
      description: 'High early-strength general structural construction cement',
      specification: 'BS EN 197-1, 50kg moisture-resistant packaging',
      categoryId: 'CAT-CEMENT',
      categoryName: 'Cement & Binders',
      baseUnitId: 'UNT-BAG',
      baseUnitName: 'Bag (50kg standard)',
      minimumStockLevel: 200.0,
      reorderLevel: 350.0,
      isActive: true,
      createdAtUtc: '2026-01-22T09:30:00Z',
    },
    {
      id: 'MAT-AGG-03',
      itemCode: 'AGG-CRUSH-20MM',
      normalizedItemCode: 'AGG-CRUSH-20MM',
      name: 'Crushed Coarse Aggregate 20mm',
      description: 'Graded crushed blue granite for structural concrete mixes',
      specification: 'ASTM C33, washed, flakiness index < 25%',
      categoryId: 'CAT-CRUSH',
      categoryName: 'Crushed Aggregates & Gravel',
      baseUnitId: 'UNT-MT',
      baseUnitName: 'Metric Tonne',
      minimumStockLevel: 40.0,
      reorderLevel: 60.0,
      isActive: true,
      createdAtUtc: '2026-02-01T11:00:00Z',
    },
    {
      id: 'MAT-PIPE-04',
      itemCode: 'PIPE-PVC-110MM',
      normalizedItemCode: 'PIPE-PVC-110MM',
      name: 'Heavy Duty PVC Drainage Pipe 110mm x 6m',
      description: 'Underground foul drainage and stormwater pipe',
      specification: 'SN8 stiffness rating, push-fit rubber ring joint, 6.0m length',
      categoryId: 'CAT-PLUMBING',
      categoryName: 'Plumbing & Drainage',
      baseUnitId: 'UNT-PCS',
      baseUnitName: 'Piece',
      minimumStockLevel: 50.0,
      reorderLevel: 100.0,
      isActive: true,
      createdAtUtc: '2026-02-10T14:15:00Z',
    },
    {
      id: 'MAT-BRK-05',
      itemCode: 'BRK-RED-CLAY-01',
      normalizedItemCode: 'BRK-RED-CLAY-01',
      name: 'Red Clay Facing Bricks 215x102x65mm',
      description: 'High compressive strength kiln-fired building bricks',
      specification: 'BS EN 771-1, compressive strength >= 35 N/mm²',
      categoryId: 'CAT-BRICKS',
      categoryName: 'Bricks & Masonry Blocks',
      baseUnitId: 'UNT-PCS',
      baseUnitName: 'Piece',
      minimumStockLevel: 5000.0,
      reorderLevel: 12000.0,
      isActive: true,
      createdAtUtc: '2026-02-15T10:00:00Z',
    },
  ];

  // Initialize storage files if missing
  readJsonSafe(categoriesFile, defaultCategories);
  readJsonSafe(unitsFile, defaultUnits);
  readJsonSafe(conversionsFile, defaultConversions);
  readJsonSafe(materialsFile, defaultMaterials);

  // --- API: Material Categories ---
  router.get('/material-categories', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const categories = readJsonSafe<CategoryRecord[]>(categoriesFile, defaultCategories);
    return res.status(200).json({
      success: true,
      data: categories,
      timestampUtc: new Date().toISOString(),
    });
  });

  router.post('/material-categories', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager']), (req: AuthenticatedRequest, res: Response) => {
    const { code, name, description } = req.body || {};
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Category Code and Name are required' });
    }
    const categories = readJsonSafe<CategoryRecord[]>(categoriesFile, defaultCategories);
    const newCat: CategoryRecord = {
      id: `CAT-${Date.now().toString(36).toUpperCase()}`,
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      description: description ? String(description).trim() : undefined,
      isActive: true,
    };
    categories.push(newCat);
    writeJsonAtomic(categoriesFile, categories);
    return res.status(201).json({ success: true, data: newCat, timestampUtc: new Date().toISOString() });
  });

  // --- API: Units of Measure ---
  router.get('/units', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const units = readJsonSafe<UnitRecord[]>(unitsFile, defaultUnits);
    return res.status(200).json({
      success: true,
      data: units,
      timestampUtc: new Date().toISOString(),
    });
  });

  // --- API: Unit Conversions ---
  router.get('/unit-conversions', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { materialId } = req.query;
    let conversions = readJsonSafe<UnitConversionRecord[]>(conversionsFile, defaultConversions);
    if (materialId && typeof materialId === 'string') {
      conversions = conversions.filter((c) => !c.materialId || c.materialId === materialId);
    }
    return res.status(200).json({
      success: true,
      data: conversions,
      timestampUtc: new Date().toISOString(),
    });
  });

  // Support /units/conversions alias
  router.get('/units/conversions', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { materialId } = req.query;
    let conversions = readJsonSafe<UnitConversionRecord[]>(conversionsFile, defaultConversions);
    if (materialId && typeof materialId === 'string') {
      conversions = conversions.filter((c) => !c.materialId || c.materialId === materialId);
    }
    return res.status(200).json({
      success: true,
      data: conversions,
      timestampUtc: new Date().toISOString(),
    });
  });

  // --- API: Materials List (GET /api/materials) ---
  router.get('/materials', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { search, categoryId, status } = req.query;
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);

    let filtered = [...materials];

    if (search && typeof search === 'string') {
      const term = search.trim().toUpperCase();
      filtered = filtered.filter(
        (m) =>
          m.normalizedItemCode.includes(term) ||
          m.name.toUpperCase().includes(term) ||
          (m.specification && m.specification.toUpperCase().includes(term))
      );
    }

    if (categoryId && typeof categoryId === 'string' && categoryId !== 'ALL') {
      filtered = filtered.filter((m) => m.categoryId === categoryId);
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      const isActive = status === 'ACTIVE';
      filtered = filtered.filter((m) => m.isActive === isActive);
    }

    filtered.sort((a, b) => a.itemCode.localeCompare(b.itemCode));

    return res.status(200).json({
      success: true,
      data: filtered,
      timestampUtc: new Date().toISOString(),
    });
  });

  // --- API: Material by ID (GET /api/materials/:id) ---
  router.get('/materials/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);
    const material = materials.find((m) => m.id === req.params.id);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: `Material with ID '${req.params.id}' was not found`,
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: material,
      timestampUtc: new Date().toISOString(),
    });
  });

  // --- API: Create Material (POST /api/materials) ---
  router.post('/materials', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const {
      itemCode,
      name,
      description,
      specification,
      categoryId,
      baseUnitId,
      minimumStockLevel,
      reorderLevel,
    } = req.body || {};

    if (!itemCode || !String(itemCode).trim()) {
      return res.status(400).json({ success: false, message: 'ItemCode is required' });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Material Name is required' });
    }

    const trimmedCode = String(itemCode).trim();
    const normalizedCode = trimmedCode.toUpperCase();

    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);

    // Business rule: Duplicate ItemCode must return HTTP 409 Conflict
    if (materials.some((m) => m.normalizedItemCode === normalizedCode)) {
      return res.status(409).json({
        success: false,
        message: `Material with ItemCode '${trimmedCode}' already exists. Item codes must be unique.`,
        timestampUtc: new Date().toISOString(),
      });
    }

    const categories = readJsonSafe<CategoryRecord[]>(categoriesFile, defaultCategories);
    const category = categories.find((c) => c.id === categoryId);
    if (!category || !category.isActive) {
      return res.status(400).json({ success: false, message: 'Specified Category does not exist or is inactive' });
    }

    const units = readJsonSafe<UnitRecord[]>(unitsFile, defaultUnits);
    const unit = units.find((u) => u.id === baseUnitId);
    if (!unit || !unit.isActive) {
      return res.status(400).json({ success: false, message: 'Specified Base Unit does not exist or is inactive' });
    }

    const minStock = Number(minimumStockLevel);
    const reorder = Number(reorderLevel);

    if (isNaN(minStock) || minStock < 0) {
      return res.status(400).json({ success: false, message: 'Minimum stock level must be a non-negative decimal' });
    }

    if (isNaN(reorder) || reorder < minStock) {
      return res.status(400).json({ success: false, message: 'Reorder level must be greater than or equal to minimum stock level' });
    }

    const newMaterial: MaterialRecord = {
      id: `MAT-${Date.now().toString(36).toUpperCase()}`,
      itemCode: trimmedCode,
      normalizedItemCode: normalizedCode,
      name: String(name).trim(),
      description: description ? String(description).trim() : undefined,
      specification: specification ? String(specification).trim() : undefined,
      categoryId: category.id,
      categoryName: category.name,
      baseUnitId: unit.id,
      baseUnitName: unit.name,
      minimumStockLevel: minStock,
      reorderLevel: reorder,
      isActive: true,
      createdAtUtc: new Date().toISOString(),
      createdByUserId: req.user?.sub,
    };

    materials.push(newMaterial);
    writeJsonAtomic(materialsFile, materials);

    return res.status(201).json({
      success: true,
      message: 'Material master created successfully',
      data: newMaterial,
      timestampUtc: new Date().toISOString(),
    });
  });

  // --- API: Update Material (PUT /api/materials/:id) ---
  router.put('/materials/:id', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);
    const material = materials.find((m) => m.id === req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: `Material with ID '${req.params.id}' was not found` });
    }

    const {
      name,
      description,
      specification,
      categoryId,
      baseUnitId,
      minimumStockLevel,
      reorderLevel,
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Material Name is required' });
    }

    const categories = readJsonSafe<CategoryRecord[]>(categoriesFile, defaultCategories);
    const category = categories.find((c) => c.id === categoryId);
    if (!category || !category.isActive) {
      return res.status(400).json({ success: false, message: 'Specified Category does not exist or is inactive' });
    }

    const units = readJsonSafe<UnitRecord[]>(unitsFile, defaultUnits);
    const unit = units.find((u) => u.id === baseUnitId);
    if (!unit || !unit.isActive) {
      return res.status(400).json({ success: false, message: 'Specified Base Unit does not exist or is inactive' });
    }

    const minStock = Number(minimumStockLevel);
    const reorder = Number(reorderLevel);

    if (isNaN(minStock) || minStock < 0) {
      return res.status(400).json({ success: false, message: 'Minimum stock level must be a non-negative decimal' });
    }

    if (isNaN(reorder) || reorder < minStock) {
      return res.status(400).json({ success: false, message: 'Reorder level must be greater than or equal to minimum stock level' });
    }

    material.name = String(name).trim();
    material.description = description ? String(description).trim() : undefined;
    material.specification = specification ? String(specification).trim() : undefined;
    material.categoryId = category.id;
    material.categoryName = category.name;
    material.baseUnitId = unit.id;
    material.baseUnitName = unit.name;
    material.minimumStockLevel = minStock;
    material.reorderLevel = reorder;
    material.updatedAtUtc = new Date().toISOString();
    material.updatedByUserId = req.user?.sub;

    writeJsonAtomic(materialsFile, materials);

    return res.status(200).json({
      success: true,
      message: 'Material updated successfully',
      data: material,
      timestampUtc: new Date().toISOString(),
    });
  });

  // --- API: Update Material Status (PATCH /api/materials/:id/status) ---
  router.patch('/materials/:id/status', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager']), (req: AuthenticatedRequest, res: Response) => {
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);
    const material = materials.find((m) => m.id === req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: `Material with ID '${req.params.id}' was not found` });
    }

    const { isActive } = req.body || {};
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Field isActive must be a boolean' });
    }

    material.isActive = isActive;
    material.updatedAtUtc = new Date().toISOString();
    material.updatedByUserId = req.user?.sub;

    writeJsonAtomic(materialsFile, materials);

    return res.status(200).json({
      success: true,
      message: `Material ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: material.id,
        isActive: material.isActive,
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // ========================================================================
  // MATERIAL REQUISITIONS & SITE APPROVAL WORKFLOW
  // ========================================================================
  interface ProjectRecord {
    id: string;
    code: string;
    name: string;
    location: string;
    projectManagerId: string;
    projectManagerName: string;
    isActive: boolean;
    startDate?: string;
    targetCompletionDate?: string;
  }

  type RequisitionStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'ReturnedForCorrection';
  type RequisitionPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

  interface RequisitionItemRecord {
    id: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    categoryId: string;
    categoryName: string;
    requestedQuantity: number;
    unitId: string;
    unitCode: string;
    remarks?: string;
    stockAvailabilityNote: string;
  }

  interface ApprovalHistoryRecord {
    id: string;
    requisitionId: string;
    actorUserId: string;
    actorName: string;
    actorRole: string;
    action: 'DraftCreated' | 'Updated' | 'Submitted' | 'Approved' | 'Rejected' | 'ReturnedForCorrection';
    comments?: string;
    timestampUtc: string;
  }

  interface RequisitionRecord {
    id: string;
    requisitionNumber: string;
    projectId: string;
    projectCode: string;
    projectName: string;
    requesterUserId: string;
    requesterName: string;
    requesterRole: string;
    requiredDate: string;
    priority: RequisitionPriority;
    purpose: string;
    workActivity?: string;
    siteLocationDetail?: string;
    status: RequisitionStatus;
    items: RequisitionItemRecord[];
    approvalHistory: ApprovalHistoryRecord[];
    rejectionReason?: string;
    correctionNotes?: string;
    approvedByUserId?: string;
    approvedByName?: string;
    approvedAtUtc?: string;
    createdAtUtc: string;
    updatedAtUtc?: string;
  }

  const projectsFile = path.join(DATA_DIR, 'projects.json');
  const requisitionsFile = path.join(DATA_DIR, 'requisitions.json');

  const defaultProjects: ProjectRecord[] = [
    {
      id: 'PRJ-101',
      code: 'PRJ-METRO',
      name: 'Metro Rail Line 3 Extension',
      location: 'North Industrial Sector, Corridor B',
      projectManagerId: 'USR-PM-03',
      projectManagerName: 'David Sterling',
      isActive: true,
      startDate: '2026-01-10',
      targetCompletionDate: '2027-12-31'
    },
    {
      id: 'PRJ-102',
      code: 'PRJ-HARBOR',
      name: 'Harbor Commercial Docklands',
      location: 'East Waterfront District, Berth 4',
      projectManagerId: 'USR-ADMIN-01',
      projectManagerName: 'Alexander Vance',
      isActive: true,
      startDate: '2026-02-01',
      targetCompletionDate: '2028-06-30'
    },
    {
      id: 'PRJ-103',
      code: 'PRJ-TOWER',
      name: 'Skyline Corporate Towers',
      location: 'Central Business District, Plot 12',
      projectManagerId: 'USR-ADMIN-01',
      projectManagerName: 'Alexander Vance',
      isActive: true,
      startDate: '2025-11-15',
      targetCompletionDate: '2027-08-31'
    }
  ];

  function canUserAccessProject(user: JwtPayload, projectId: string): boolean {
    if (user.roles.includes('SuperAdmin') || user.roles.includes('InventoryManager')) {
      return true;
    }
    if (user.projectScopes.includes('*') || user.projectScopes.includes(projectId)) {
      return true;
    }
    return false;
  }

  function generateNextRequisitionNumber(requisitions: RequisitionRecord[]): string {
    const currentYear = new Date().getFullYear();
    const prefix = `MR-${currentYear}-`;
    const yearReqs = requisitions.filter(r => r.requisitionNumber && r.requisitionNumber.startsWith(prefix));
    let maxSeq = 0;
    for (const r of yearReqs) {
      const parts = r.requisitionNumber.split('-');
      if (parts.length === 3) {
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
    const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
    return `${prefix}${nextSeq}`;
  }

  // --- API: List Projects (GET /api/projects) ---
  router.get('/projects', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const projects = readJsonSafe<ProjectRecord[]>(projectsFile, defaultProjects);
    const user = req.user!;
    const accessibleProjects = projects.filter(p => p.isActive && canUserAccessProject(user, p.id));

    return res.status(200).json({
      success: true,
      data: accessibleProjects,
      timestampUtc: new Date().toISOString(),
    });
  });

  // --- API: List Requisitions with filters and pagination (GET /api/requisitions) ---
  router.get('/requisitions', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const user = req.user!;
    const { search, status, projectId, page = '1', pageSize = '20' } = req.query;

    let filtered = requisitions.filter(r => {
      // Must be in user's project scopes OR created by user OR user is SuperAdmin/InventoryManager
      const canAccess = canUserAccessProject(user, r.projectId) || r.requesterUserId === user.sub;
      return canAccess;
    });

    if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
      filtered = filtered.filter(r => r.projectId === projectId);
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      filtered = filtered.filter(r => r.status === status);
    }

    if (search && typeof search === 'string') {
      const term = search.trim().toUpperCase();
      filtered = filtered.filter(r =>
        r.requisitionNumber.toUpperCase().includes(term) ||
        r.projectName.toUpperCase().includes(term) ||
        r.projectCode.toUpperCase().includes(term) ||
        r.requesterName.toUpperCase().includes(term) ||
        r.purpose.toUpperCase().includes(term) ||
        (r.workActivity && r.workActivity.toUpperCase().includes(term)) ||
        r.items.some(i => i.materialName.toUpperCase().includes(term) || i.materialCode.toUpperCase().includes(term))
      );
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());

    const pageIndex = Math.max(1, parseInt(page as string, 10) || 1);
    const size = Math.max(1, parseInt(pageSize as string, 10) || 20);
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / size);
    const paged = filtered.slice((pageIndex - 1) * size, pageIndex * size);

    return res.status(200).json({
      success: true,
      data: {
        items: paged,
        pageIndex,
        pageSize: size,
        totalCount,
        totalPages,
        hasPreviousPage: pageIndex > 1,
        hasNextPage: pageIndex < totalPages,
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // --- API: Pending Approval Inbox (GET /api/approvals/inbox) ---
  router.get('/approvals/inbox', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const user = req.user!;

    const pendingApprovals = requisitions.filter(r =>
      r.status === 'Submitted' && canUserAccessProject(user, r.projectId)
    );

    pendingApprovals.sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());

    return res.status(200).json({
      success: true,
      data: pendingApprovals,
      timestampUtc: new Date().toISOString(),
    });
  });

  // --- API: Get Single Requisition (GET /api/requisitions/:id) ---
  router.get('/requisitions/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const user = req.user!;
    const requisition = requisitions.find(r => r.id === req.params.id || r.requisitionNumber === req.params.id);

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: `Material requisition with ID or Number '${req.params.id}' was not found`,
        timestampUtc: new Date().toISOString(),
      });
    }

    if (!canUserAccessProject(user, requisition.projectId) && requisition.requesterUserId !== user.sub) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view requisitions for this project site',
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: requisition,
      timestampUtc: new Date().toISOString(),
    });
  });

  // --- API: Create Requisition Draft (POST /api/requisitions) ---
  router.post('/requisitions', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const projects = readJsonSafe<ProjectRecord[]>(projectsFile, defaultProjects);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);
    const user = req.user!;

    const {
      projectId,
      requiredDate,
      priority = 'Medium',
      purpose,
      workActivity,
      siteLocationDetail,
      items = [],
      submitImmediately = false,
      initialComments
    } = req.body || {};

    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Project selection is required' });
    }

    const project = projects.find(p => p.id === projectId && p.isActive);
    if (!project) {
      return res.status(400).json({ success: false, message: `Active project with ID '${projectId}' was not found` });
    }

    if (!canUserAccessProject(user, projectId)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You are not authorized to create material requisitions for project '${project.name}'`
      });
    }

    if (!requiredDate || isNaN(Date.parse(requiredDate))) {
      return res.status(400).json({ success: false, message: 'Valid required date is required' });
    }

    if (!purpose || String(purpose).trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Requisition purpose / justification is required (minimum 3 characters)' });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items must be an array of requested materials' });
    }

    if (submitImmediately && items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cannot submit a requisition without at least one material line item' });
    }

    // Validate and build items
    const parsedItems: RequisitionItemRecord[] = [];
    const seenMaterialIds = new Set<string>();

    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      if (!it.materialId) {
        return res.status(400).json({ success: false, message: `Line item #${idx + 1}: Material ID is required` });
      }

      if (seenMaterialIds.has(it.materialId)) {
        return res.status(400).json({
          success: false,
          message: `Line item #${idx + 1}: Duplicate material detected. Please adjust the quantity on the existing line instead of adding duplicate items.`
        });
      }
      seenMaterialIds.add(it.materialId);

      const material = materials.find(m => m.id === it.materialId && m.isActive);
      if (!material) {
        return res.status(400).json({
          success: false,
          message: `Line item #${idx + 1}: Material '${it.materialId}' is invalid or deactivated in the Material Master`
        });
      }

      const qty = parseFloat(it.requestedQuantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Line item #${idx + 1} (${material.name}): Requested quantity must be a positive number greater than 0`
        });
      }

      parsedItems.push({
        id: `RQI-${crypto.randomBytes(4).toString('hex')}`,
        materialId: material.id,
        materialCode: material.itemCode,
        materialName: material.name,
        categoryId: material.categoryId,
        categoryName: material.categoryName,
        requestedQuantity: qty,
        unitId: material.baseUnitId,
        unitCode: material.baseUnitName,
        remarks: it.remarks ? String(it.remarks).trim() : undefined,
        stockAvailabilityNote: 'Not yet connected (Future Integration Point)',
      });
    }

    const newReqNumber = generateNextRequisitionNumber(requisitions);
    const newId = `REQ-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const initialStatus: RequisitionStatus = submitImmediately ? 'Submitted' : 'Draft';
    const nowUtc = new Date().toISOString();

    const history: ApprovalHistoryRecord[] = [
      {
        id: `HIS-${crypto.randomBytes(4).toString('hex')}`,
        requisitionId: newId,
        actorUserId: user.sub,
        actorName: user.fullName,
        actorRole: user.roles[0] || 'User',
        action: 'DraftCreated',
        comments: initialComments ? String(initialComments).trim() : 'Requisition draft created.',
        timestampUtc: nowUtc,
      }
    ];

    if (submitImmediately) {
      history.push({
        id: `HIS-${crypto.randomBytes(4).toString('hex')}`,
        requisitionId: newId,
        actorUserId: user.sub,
        actorName: user.fullName,
        actorRole: user.roles[0] || 'User',
        action: 'Submitted',
        comments: 'Submitted directly for Project Manager approval review.',
        timestampUtc: nowUtc,
      });
    }

    const newRequisition: RequisitionRecord = {
      id: newId,
      requisitionNumber: newReqNumber,
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      requesterUserId: user.sub,
      requesterName: user.fullName,
      requesterRole: user.roles[0] || 'User',
      requiredDate: String(requiredDate).substring(0, 10),
      priority: ['Low', 'Medium', 'High', 'Urgent'].includes(priority) ? priority : 'Medium',
      purpose: String(purpose).trim(),
      workActivity: workActivity ? String(workActivity).trim() : undefined,
      siteLocationDetail: siteLocationDetail ? String(siteLocationDetail).trim() : undefined,
      status: initialStatus,
      items: parsedItems,
      approvalHistory: history,
      createdAtUtc: nowUtc,
      updatedAtUtc: nowUtc,
    };

    requisitions.push(newRequisition);
    writeJsonAtomic(requisitionsFile, requisitions);

    return res.status(201).json({
      success: true,
      message: `Material requisition ${newReqNumber} created successfully in ${initialStatus} state`,
      data: newRequisition,
      timestampUtc: nowUtc,
    });
  });

  // --- API: Update Requisition (PUT /api/requisitions/:id) ---
  router.put('/requisitions/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const projects = readJsonSafe<ProjectRecord[]>(projectsFile, defaultProjects);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);
    const user = req.user!;

    const requisition = requisitions.find(r => r.id === req.params.id);
    if (!requisition) {
      return res.status(404).json({ success: false, message: `Requisition with ID '${req.params.id}' was not found` });
    }

    if (requisition.status !== 'Draft' && requisition.status !== 'ReturnedForCorrection') {
      return res.status(400).json({
        success: false,
        message: `Cannot edit requisition in status '${requisition.status}'. Only requisitions in 'Draft' or 'ReturnedForCorrection' state can be updated.`
      });
    }

    const isRequester = requisition.requesterUserId === user.sub;
    const isSuperAdmin = user.roles.includes('SuperAdmin');
    if (!isRequester && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit requisitions that you created'
      });
    }

    const {
      projectId,
      requiredDate,
      priority,
      purpose,
      workActivity,
      siteLocationDetail,
      items,
      updateComments
    } = req.body || {};

    if (projectId && projectId !== requisition.projectId) {
      const project = projects.find(p => p.id === projectId && p.isActive);
      if (!project) {
        return res.status(400).json({ success: false, message: `Project with ID '${projectId}' is not active or not found` });
      }
      if (!canUserAccessProject(user, projectId)) {
        return res.status(403).json({ success: false, message: 'Forbidden: You do not have access to the target project' });
      }
      requisition.projectId = project.id;
      requisition.projectCode = project.code;
      requisition.projectName = project.name;
    }

    if (requiredDate) {
      if (isNaN(Date.parse(requiredDate))) {
        return res.status(400).json({ success: false, message: 'Valid required date is required' });
      }
      requisition.requiredDate = String(requiredDate).substring(0, 10);
    }

    if (purpose) {
      if (String(purpose).trim().length < 3) {
        return res.status(400).json({ success: false, message: 'Purpose must be at least 3 characters' });
      }
      requisition.purpose = String(purpose).trim();
    }

    if (priority && ['Low', 'Medium', 'High', 'Urgent'].includes(priority)) {
      requisition.priority = priority;
    }

    if (workActivity !== undefined) {
      requisition.workActivity = workActivity ? String(workActivity).trim() : undefined;
    }

    if (siteLocationDetail !== undefined) {
      requisition.siteLocationDetail = siteLocationDetail ? String(siteLocationDetail).trim() : undefined;
    }

    if (Array.isArray(items)) {
      const parsedItems: RequisitionItemRecord[] = [];
      const seenMaterialIds = new Set<string>();

      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        if (!it.materialId) {
          return res.status(400).json({ success: false, message: `Line #${idx + 1}: Material ID is required` });
        }
        if (seenMaterialIds.has(it.materialId)) {
          return res.status(400).json({ success: false, message: `Line #${idx + 1}: Duplicate material detected in requisition.` });
        }
        seenMaterialIds.add(it.materialId);

        const material = materials.find(m => m.id === it.materialId && m.isActive);
        if (!material) {
          return res.status(400).json({ success: false, message: `Line #${idx + 1}: Material '${it.materialId}' not found or inactive` });
        }

        const qty = parseFloat(it.requestedQuantity);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ success: false, message: `Line #${idx + 1}: Requested quantity must be greater than 0` });
        }

        parsedItems.push({
          id: it.id || `RQI-${crypto.randomBytes(4).toString('hex')}`,
          materialId: material.id,
          materialCode: material.itemCode,
          materialName: material.name,
          categoryId: material.categoryId,
          categoryName: material.categoryName,
          requestedQuantity: qty,
          unitId: material.baseUnitId,
          unitCode: material.baseUnitName,
          remarks: it.remarks ? String(it.remarks).trim() : undefined,
          stockAvailabilityNote: 'Not yet connected (Future Integration Point)',
        });
      }
      requisition.items = parsedItems;
    }

    const nowUtc = new Date().toISOString();
    requisition.updatedAtUtc = nowUtc;

    requisition.approvalHistory.push({
      id: `HIS-${crypto.randomBytes(4).toString('hex')}`,
      requisitionId: requisition.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'User',
      action: 'Updated',
      comments: updateComments ? String(updateComments).trim() : 'Requisition details updated.',
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(requisitionsFile, requisitions);

    return res.status(200).json({
      success: true,
      message: 'Requisition updated successfully',
      data: requisition,
      timestampUtc: nowUtc,
    });
  });

  // --- API: Submit Requisition (POST /api/requisitions/:id/submit) ---
  router.post('/requisitions/:id/submit', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const user = req.user!;

    const requisition = requisitions.find(r => r.id === req.params.id);
    if (!requisition) {
      return res.status(404).json({ success: false, message: `Requisition '${req.params.id}' was not found` });
    }

    if (requisition.status === 'Submitted') {
      return res.status(400).json({ success: false, message: 'Requisition has already been submitted and is currently pending approval' });
    }

    if (requisition.status === 'Approved' || requisition.status === 'Rejected') {
      return res.status(400).json({ success: false, message: `Cannot submit a requisition in terminal status '${requisition.status}'` });
    }

    const isRequester = requisition.requesterUserId === user.sub;
    const isSuperAdmin = user.roles.includes('SuperAdmin');
    if (!isRequester && !isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only the original requester can submit this requisition' });
    }

    if (!requisition.items || requisition.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cannot submit a requisition with no line items. Please add materials first.' });
    }

    const { comments } = req.body || {};
    const nowUtc = new Date().toISOString();

    requisition.status = 'Submitted';
    requisition.correctionNotes = undefined;
    requisition.updatedAtUtc = nowUtc;

    requisition.approvalHistory.push({
      id: `HIS-${crypto.randomBytes(4).toString('hex')}`,
      requisitionId: requisition.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'User',
      action: 'Submitted',
      comments: comments ? String(comments).trim() : 'Submitted for Project Manager approval review.',
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(requisitionsFile, requisitions);

    return res.status(200).json({
      success: true,
      message: `Requisition ${requisition.requisitionNumber} submitted for approval`,
      data: requisition,
      timestampUtc: nowUtc,
    });
  });

  // --- API: Approve Requisition (POST /api/requisitions/:id/approve) ---
  router.post('/requisitions/:id/approve', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const user = req.user!;

    const requisition = requisitions.find(r => r.id === req.params.id);
    if (!requisition) {
      return res.status(404).json({ success: false, message: `Requisition '${req.params.id}' was not found` });
    }

    if (!canUserAccessProject(user, requisition.projectId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have approval authority over this project site',
        timestampUtc: new Date().toISOString(),
      });
    }

    // Strict Self-Approval Restriction
    if (requisition.requesterUserId === user.sub && !user.roles.includes('SuperAdmin')) {
      return res.status(403).json({
        success: false,
        message: 'Policy Violation: Requesters cannot approve their own material requisitions. Approval requires independent Project Manager or executive review.',
        timestampUtc: new Date().toISOString(),
      });
    }

    if (requisition.status !== 'Submitted') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve requisition in '${requisition.status}' state. Only 'Submitted' requisitions can be approved.`
      });
    }

    const { comments } = req.body || {};
    const nowUtc = new Date().toISOString();

    requisition.status = 'Approved';
    requisition.approvedByUserId = user.sub;
    requisition.approvedByName = user.fullName;
    requisition.approvedAtUtc = nowUtc;
    requisition.updatedAtUtc = nowUtc;

    requisition.approvalHistory.push({
      id: `HIS-${crypto.randomBytes(4).toString('hex')}`,
      requisitionId: requisition.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles.find(r => ['SuperAdmin', 'ProjectManager', 'InventoryManager'].includes(r)) || user.roles[0],
      action: 'Approved',
      comments: comments ? String(comments).trim() : 'Requisition approved for site fulfillment.',
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(requisitionsFile, requisitions);

    return res.status(200).json({
      success: true,
      message: `Requisition ${requisition.requisitionNumber} has been approved`,
      data: requisition,
      timestampUtc: nowUtc,
    });
  });

  // --- API: Reject Requisition (POST /api/requisitions/:id/reject) ---
  router.post('/requisitions/:id/reject', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const user = req.user!;

    const requisition = requisitions.find(r => r.id === req.params.id);
    if (!requisition) {
      return res.status(404).json({ success: false, message: `Requisition '${req.params.id}' was not found` });
    }

    if (!canUserAccessProject(user, requisition.projectId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have authority over this project site'
      });
    }

    if (requisition.status !== 'Submitted') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject requisition in '${requisition.status}' state. Only pending 'Submitted' requisitions can be rejected.`
      });
    }

    const { reason, comments } = req.body || {};
    const rejectionReason = String(reason || comments || '').trim();

    if (!rejectionReason || rejectionReason.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is mandatory. Please provide a clear explanation for the site requester.'
      });
    }

    const nowUtc = new Date().toISOString();
    requisition.status = 'Rejected';
    requisition.rejectionReason = rejectionReason;
    requisition.updatedAtUtc = nowUtc;

    requisition.approvalHistory.push({
      id: `HIS-${crypto.randomBytes(4).toString('hex')}`,
      requisitionId: requisition.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles.find(r => ['SuperAdmin', 'ProjectManager', 'InventoryManager'].includes(r)) || user.roles[0],
      action: 'Rejected',
      comments: rejectionReason,
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(requisitionsFile, requisitions);

    return res.status(200).json({
      success: true,
      message: `Requisition ${requisition.requisitionNumber} has been rejected`,
      data: requisition,
      timestampUtc: nowUtc,
    });
  });

  // --- API: Return for Correction (POST /api/requisitions/:id/return-for-correction) ---
  router.post('/requisitions/:id/return-for-correction', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const user = req.user!;

    const requisition = requisitions.find(r => r.id === req.params.id);
    if (!requisition) {
      return res.status(404).json({ success: false, message: `Requisition '${req.params.id}' was not found` });
    }

    if (!canUserAccessProject(user, requisition.projectId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have authority over this project site'
      });
    }

    if (requisition.status !== 'Submitted') {
      return res.status(400).json({
        success: false,
        message: `Cannot return requisition in '${requisition.status}' state. Only pending 'Submitted' requisitions can be returned for correction.`
      });
    }

    const { notes, comments, correctionNotes } = req.body || {};
    const feedback = String(notes || comments || correctionNotes || '').trim();

    if (!feedback || feedback.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Correction notes are mandatory. Detail what needs to be revised by the requester.'
      });
    }

    const nowUtc = new Date().toISOString();
    requisition.status = 'ReturnedForCorrection';
    requisition.correctionNotes = feedback;
    requisition.updatedAtUtc = nowUtc;

    requisition.approvalHistory.push({
      id: `HIS-${crypto.randomBytes(4).toString('hex')}`,
      requisitionId: requisition.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles.find(r => ['SuperAdmin', 'ProjectManager', 'InventoryManager'].includes(r)) || user.roles[0],
      action: 'ReturnedForCorrection',
      comments: feedback,
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(requisitionsFile, requisitions);

    return res.status(200).json({
      success: true,
      message: `Requisition ${requisition.requisitionNumber} returned for correction`,
      data: requisition,
      timestampUtc: nowUtc,
    });
  });

  // --- API: Delete Draft Requisition (DELETE /api/requisitions/:id) ---
  router.delete('/requisitions/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const user = req.user!;

    const index = requisitions.findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: `Requisition '${req.params.id}' was not found` });
    }

    const requisition = requisitions[index];
    if (requisition.status !== 'Draft' && requisition.status !== 'ReturnedForCorrection') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete requisition in '${requisition.status}' state. Only 'Draft' or 'ReturnedForCorrection' can be removed.`
      });
    }

    if (requisition.requesterUserId !== user.sub && !user.roles.includes('SuperAdmin')) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only delete drafts created by your user account' });
    }

    requisitions.splice(index, 1);
    writeJsonAtomic(requisitionsFile, requisitions);

    return res.status(200).json({
      success: true,
      message: `Requisition ${requisition.requisitionNumber} deleted successfully`,
      data: null,
      timestampUtc: new Date().toISOString(),
    });
  });
}

// Mount router on both `/api` and `/api/v1` for maximum client compatibility
const apiRouter = express.Router();
setupApiRoutes(apiRouter);
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// --------------------------------------------------------------------------
// Vite Middleware / Static Serving
// --------------------------------------------------------------------------
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ConstructionStock] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ConstructionStock] Server start error:', err);
});
