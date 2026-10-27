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
const DATA_DIR = process.env.VERCEL
  ? path.resolve('/tmp', 'data')
  : path.resolve(__dirname, 'data');

let isStorageInitialized = false;

function ensureStorageInitialized() {
  if (isStorageInitialized) return;
  isStorageInitialized = true;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (process.env.VERCEL) {
      const srcDataDir = path.resolve(__dirname, 'data');
      if (fs.existsSync(srcDataDir)) {
        const files = fs.readdirSync(srcDataDir);
        for (const file of files) {
          const destPath = path.join(DATA_DIR, file);
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(path.join(srcDataDir, file), destPath);
          }
        }
      }
    }
  } catch (err) {
    console.error('[ConstructionStock] Error copying seed data to /tmp:', err);
  }
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
  router.use((_req, _res, next) => {
    ensureStorageInitialized();
    ensureReconciled();
    next();
  });

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
    ensureStorageInitialized();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, filePath);
  }

  // Safe JSON reader with corruption guard
  function readJsonSafe<T>(filePath: string, initialDefault: T): T {
    ensureStorageInitialized();
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
    if (!user) return false;
    const dbUser = enterpriseUsers.find((u) => u.id === user.sub);
    const roles = (dbUser ? dbUser.roles : user.roles) || [];
    if (roles.includes('SuperAdmin') || roles.includes('InventoryManager') || roles.includes('AccountsOfficer')) {
      return true;
    }
    const scopes = (dbUser ? dbUser.projectScopes : user.projectScopes) || [];
    return scopes.includes('*') || scopes.includes(projectId);
  }

  function canUserAccessWarehouse(user: JwtPayload, warehouseId: string): boolean {
    if (!user) return false;
    const dbUser = enterpriseUsers.find((u) => u.id === user.sub);
    const roles = (dbUser ? dbUser.roles : user.roles) || [];
    if (roles.includes('SuperAdmin') || roles.includes('InventoryManager') || roles.includes('AccountsOfficer')) {
      return true;
    }
    const scopes = (dbUser ? dbUser.warehouseScopes : user.warehouseScopes) || [];
    return scopes.includes('*') || scopes.includes(warehouseId);
  }

  function canUserAccessLocation(user: JwtPayload, projectId?: string, warehouseId?: string): boolean {
    if (!user) return false;
    const dbUser = enterpriseUsers.find((u) => u.id === user.sub);
    const roles = (dbUser ? dbUser.roles : user.roles) || [];
    if (roles.includes('SuperAdmin') || roles.includes('InventoryManager') || roles.includes('AccountsOfficer')) {
      return true;
    }
    const hasProject = !projectId || canUserAccessProject(user, projectId);
    const hasWarehouse = !warehouseId || canUserAccessWarehouse(user, warehouseId);
    if (roles.includes('Storekeeper') && hasWarehouse) {
      return true;
    }
    return hasProject && hasWarehouse;
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

  // ========================================================================
  // SUPPLIER MANAGEMENT, PURCHASE ORDERS & QUOTATION MODULE (PROMPT 7)
  // ========================================================================

  interface SupplierRecord {
    id: string;
    supplierCode: string;
    normalizedSupplierCode: string;
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    taxReference?: string;
    paymentTerms?: string;
    notes?: string;
    isActive: boolean;
    createdAtUtc: string;
    updatedAtUtc?: string;
    createdByUserId?: string;
    updatedByUserId?: string;
  }

  type PurchaseOrderStatus =
    | 'Draft'
    | 'PendingApproval'
    | 'Approved'
    | 'Issued'
    | 'PartiallyReceived'
    | 'FullyReceived'
    | 'Cancelled'
    | 'Rejected';

  interface PurchaseOrderItemRecord {
    id: string;
    parentPoId: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    specification?: string;
    unitId: string;
    unitCode: string;
    requisitionItemId?: string | null;
    orderedQuantity: number;
    receivedQuantity: number;
    outstandingQuantity: number;
    unitRate: number;
    lineDiscount: number;
    taxRate: number;
    taxAmount: number;
    lineTotal: number;
    notes?: string;
  }

  interface PurchaseOrderApprovalRecord {
    id: string;
    poId: string;
    actorUserId: string;
    actorName: string;
    actorRole: string;
    action: 'DraftCreated' | 'Updated' | 'Submitted' | 'Approved' | 'Rejected' | 'Issued' | 'Cancelled';
    comments?: string;
    timestampUtc: string;
  }

  interface PurchaseOrderRecord {
    id: string;
    poNumber: string;
    supplierId: string;
    supplierCode: string;
    supplierName: string;
    supplierContact: string;
    requisitionId?: string | null;
    requisitionNumber?: string | null;
    projectId: string;
    projectCode: string;
    projectName: string;
    deliveryLocation: string;
    orderDate: string;
    expectedDeliveryDate: string;
    currency: string;
    paymentTerms: string;
    notes?: string;
    status: PurchaseOrderStatus;
    items: PurchaseOrderItemRecord[];
    subtotal: number;
    subTotal?: number;
    orderedQuantity?: number;
    receivedQuantity?: number;
    outstandingQuantity?: number;
    itemsDiscount: number;
    headerDiscount: number;
    totalDiscount: number;
    taxAmount: number;
    freight: number;
    grandTotal: number;
    approvalHistory: PurchaseOrderApprovalRecord[];
    rejectionReason?: string;
    cancellationReason?: string;
    approvedByUserId?: string;
    approvedByName?: string;
    approvedAtUtc?: string;
    issuedByUserId?: string;
    issuedByName?: string;
    issuedAtUtc?: string;
    createdAtUtc: string;
    updatedAtUtc?: string;
    createdByUserId: string;
    createdByName: string;
  }

  interface QuotationRecord {
    id: string;
    quotationReference: string;
    supplierId: string;
    supplierName: string;
    date: string;
    validUntil: string;
    currency: string;
    paymentTerms: string;
    notes?: string;
    items: {
      materialId: string;
      materialCode: string;
      materialName: string;
      unitCode: string;
      quotedQuantity: number;
      unitRate: number;
      discount: number;
      taxRate: number;
      estimatedFreight: number;
      lineTotal: number;
    }[];
    createdAtUtc: string;
  }

  const suppliersFile = path.join(DATA_DIR, 'suppliers.json');
  const purchaseOrdersFile = path.join(DATA_DIR, 'purchase_orders.json');
  const quotationsFile = path.join(DATA_DIR, 'quotations.json');
  const grnsFile = path.join(DATA_DIR, 'grns.json');
  const receiptLedgerFile = path.join(DATA_DIR, 'receipt_ledger.json');
  const stockLedgerFile = path.join(DATA_DIR, 'stock_ledger.json');
  const inventoryBalancesFile = path.join(DATA_DIR, 'inventory_balances.json');

  type GrnStatus =
    | 'Draft'
    | 'SubmittedForInspection'
    | 'Inspected'
    | 'Approved'
    | 'Posted'
    | 'Rejected'
    | 'ReturnedForCorrection'
    | 'Cancelled';

  interface InspectionChecklist {
    challanMatchesPO: boolean;
    vehicleUnloadedSafely: boolean;
    physicallyCounted: boolean;
    packagingIntact: boolean;
    batchTestCertsProvided: boolean;
    testCertificateNumber?: string;
    materialsMeetSpecs: boolean;
    binTagsAttached: boolean;
    inspectionRemarks: string;
    discrepancyIdentified: boolean;
    debitNoteRequired: boolean;
    debitNoteReason?: string;
  }

  interface GoodsReceivedItemRecord {
    id: string;
    purchaseOrderItemId: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    specification?: string;
    unitId?: string;
    unitCode: string;
    orderedQuantity: number;
    previouslyReceivedQuantity: number;
    poOutstandingQuantity: number;
    deliveredQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    damagedQuantity: number;
    shortQuantity: number;
    remarks?: string;
    storageLocation: string;
    unitPrice: number;
    totalAcceptedAmount: number;
  }

  interface GrnAuditEntry {
    id: string;
    grnId: string;
    actorUserId: string;
    actorName: string;
    actorRole: string;
    action: string;
    comments: string;
    timestampUtc: string;
  }

  interface GoodsReceivedNoteRecord {
    id: string;
    grnNumber: string;
    purchaseOrderId: string;
    purchaseOrderNumber: string;
    supplierId: string;
    supplierCode: string;
    supplierName: string;
    projectId: string;
    projectName: string;
    warehouseId: string;
    warehouseName: string;
    storageLocation: string;
    grnDate: string;
    receivedAtUtc: string;
    deliveryChallanNumber: string;
    deliveryChallanDate: string;
    vehicleNumber: string;
    deliveredBy: string;
    status: GrnStatus;
    inspectionChecklist: InspectionChecklist;
    items: GoodsReceivedItemRecord[];
    totalDeliveredQuantity: number;
    totalAcceptedQuantity: number;
    totalRejectedQuantity: number;
    totalDamagedQuantity: number;
    totalShortQuantity: number;
    totalAcceptedValue: number;
    generalRemarks?: string;
    rejectionReason?: string;
    correctionNotes?: string;
    auditTrail: GrnAuditEntry[];
    receivedByUserId: string;
    receivedByName: string;
    inspectedByUserId?: string;
    inspectedByName?: string;
    inspectedAtUtc?: string;
    approvedByUserId?: string;
    approvedByName?: string;
    approvedAtUtc?: string;
    postedByUserId?: string;
    postedByName?: string;
    postedAtUtc?: string;
    createdAtUtc: string;
    updatedAtUtc: string;
  }

  interface ReceiptLedgerRecord {
    id: string;
    grnId: string;
    grnNumber: string;
    purchaseOrderId: string;
    purchaseOrderNumber: string;
    supplierId: string;
    supplierName: string;
    projectId: string;
    warehouseId: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    unitCode: string;
    acceptedQuantity: number;
    unitPrice: number;
    totalAmount: number;
    storageLocation: string;
    deliveryChallanNumber: string;
    postedAtUtc: string;
    postedByUserId: string;
    postedByName: string;
    reconciledWithInventoryLedger: boolean;
  }

  interface StockLedgerRecord {
    id: string;
    referenceNumber: string; // e.g. STK-YYYY-XXXX
    transactionType: 'OpeningBalance' | 'GoodsReceivedNote' | 'MaterialIssue' | 'SiteReturn' | 'TransferOut' | 'TransferIn' | 'StockAdjustment';
    sourceDocumentType: string;
    sourceDocumentId: string;
    sourceDocumentNumber: string;
    sourceLineId: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    unitCode: string;
    warehouseId: string;
    warehouseName: string;
    projectId: string;
    projectName: string;
    quantityIn: number;
    quantityOut: number;
    signedQuantity: number;
    unitCost: number;
    transactionValue: number;
    balanceQuantityAfter: number;
    weightedAverageCostAfter: number;
    totalValuationAfter: number;
    batchNumber?: string;
    idempotencyKey: string;
    transactionDate: string;
    timestampUtc: string;
    createdByUserId: string;
    createdByName: string;
    remarks?: string;
  }

  interface InventoryBalanceRecord {
    id: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    categoryId?: string;
    categoryName?: string;
    unitCode: string;
    warehouseId: string;
    warehouseName: string;
    projectId: string;
    projectName: string;
    quantityOnHand: number;
    quantityReserved: number;
    quantityAvailable: number;
    quantityInTransit: number;
    weightedAverageCost: number;
    inventoryValue: number;
    version: number;
    lastUpdatedUtc: string;
  }

  // MATERIAL ISSUES & SITE CONSUMPTION MODELS
  interface MaterialIssueItemRecord {
    id: string;
    materialIssueId: string;
    requisitionItemId: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    unitCode: string;
    requestedQuantity: number;
    previouslyFulfilledQuantity: number;
    outstandingQuantity: number;
    quantityToIssue: number;
    actualIssuedQuantity?: number;
    previouslyReturnedQuantity?: number;
    unitCost?: number;
    totalIssuedAmount?: number;
    storageLocation?: string;
    remarks?: string;
    stockLedgerEntryId?: string;
  }

  interface MaterialIssueAuditRecord {
    id: string;
    materialIssueId: string;
    actorUserId: string;
    actorName: string;
    actorRole: string;
    action: 'DraftCreated' | 'Updated' | 'Submitted' | 'Approved' | 'Posted' | 'Rejected' | 'ReturnedForCorrection' | 'Cancelled';
    comments?: string;
    timestampUtc: string;
  }

  interface MaterialIssueRecord {
    id: string;
    issueNumber: string; // e.g. MIV-2026-0001
    requisitionId: string;
    requisitionNumber: string;
    projectId: string;
    projectName: string;
    warehouseId: string;
    warehouseName: string;
    issueDate: string; // YYYY-MM-DD
    status: 'Draft' | 'Submitted' | 'Approved' | 'Posted' | 'Rejected' | 'ReturnedForCorrection' | 'Cancelled';
    purpose: string;
    workActivity?: string;
    receivedByPerson: string;
    items: MaterialIssueItemRecord[];
    auditTrail: MaterialIssueAuditRecord[];
    rejectionReason?: string;
    correctionNotes?: string;
    remarks?: string;
    createdByUserId: string;
    createdByName: string;
    createdAtUtc: string;
    submittedByUserId?: string;
    submittedByName?: string;
    submittedAtUtc?: string;
    approvedByUserId?: string;
    approvedByName?: string;
    approvedAtUtc?: string;
    postedByUserId?: string;
    postedByName?: string;
    postedAtUtc?: string;
    updatedAtUtc?: string;
  }

  // MATERIAL RETURNS MODELS
  interface MaterialReturnItemRecord {
    id: string;
    materialReturnId: string;
    materialIssueItemId: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    unitCode: string;
    issuedQuantity: number;
    previouslyReturnedQuantity: number;
    maxReturnableQuantity: number;
    returnedQuantity: number;
    condition: 'ReusableGood' | 'Damaged' | 'UnusableScrap';
    disposition: 'ReturnToUsableStock' | 'QuarantineScrap' | 'SupplierRTV';
    unitCost: number;
    totalReturnAmount: number;
    inspectionNotes?: string;
    stockLedgerEntryId?: string;
  }

  interface MaterialReturnAuditRecord {
    id: string;
    materialReturnId: string;
    actorUserId: string;
    actorName: string;
    actorRole: string;
    action: 'DraftCreated' | 'Updated' | 'Submitted' | 'Inspected' | 'Approved' | 'Posted' | 'Rejected' | 'Cancelled';
    comments?: string;
    timestampUtc: string;
  }

  interface MaterialReturnRecord {
    id: string;
    returnNumber: string; // e.g. MRN-2026-0001
    materialIssueId: string;
    materialIssueNumber: string;
    requisitionId: string;
    requisitionNumber: string;
    projectId: string;
    projectName: string;
    warehouseId: string;
    warehouseName: string;
    returnDate: string;
    returnedByPerson: string;
    reason: string;
    status: 'Draft' | 'Submitted' | 'Inspected' | 'Approved' | 'Posted' | 'Rejected' | 'Cancelled';
    items: MaterialReturnItemRecord[];
    auditTrail: MaterialReturnAuditRecord[];
    rejectionReason?: string;
    remarks?: string;
    createdByUserId: string;
    createdByName: string;
    createdAtUtc: string;
    inspectedByUserId?: string;
    inspectedByName?: string;
    inspectedAtUtc?: string;
    approvedByUserId?: string;
    approvedByName?: string;
    approvedAtUtc?: string;
    postedByUserId?: string;
    postedByName?: string;
    postedAtUtc?: string;
    updatedAtUtc?: string;
  }

  const materialIssuesFile = path.join(DATA_DIR, 'material_issues.json');
  const materialReturnsFile = path.join(DATA_DIR, 'material_returns.json');
  const stockTransfersFile = path.join(DATA_DIR, 'stock_transfers.json');

  // STOCK TRANSFERS & IN-TRANSIT MODELS
  interface StockTransferItemRecord {
    id: string;
    stockTransferId: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    unitCode: string;
    requestedQuantity: number;
    approvedQuantity: number;
    dispatchedQuantity: number;
    receivedGoodQuantity: number;
    damagedQuantity: number;
    shortQuantity: number;
    disputedQuantity: number;
    remainingInTransitQuantity: number;
    unitCostAtDispatch: number;
    totalDispatchedAmount: number;
    sourceStockLedgerEntryId?: string;
    destinationStockLedgerEntryId?: string;
    discrepancyReason?: string;
    inspectionNotes?: string;
    resolutionStatus?: 'Pending' | 'Resolved' | 'None';
    resolutionNotes?: string;
  }

  interface StockTransferAuditRecord {
    id: string;
    stockTransferId: string;
    actorUserId: string;
    actorName: string;
    actorRole: string;
    action:
      | 'DraftCreated'
      | 'Updated'
      | 'Submitted'
      | 'Approved'
      | 'Dispatched'
      | 'PartiallyReceived'
      | 'Received'
      | 'Inspected'
      | 'Completed'
      | 'Rejected'
      | 'ReturnedForCorrection'
      | 'Cancelled'
      | 'DiscrepancyResolved';
    comments?: string;
    timestampUtc: string;
  }

  type TransferStatus =
    | 'Draft'
    | 'Submitted'
    | 'Approved'
    | 'Dispatched'
    | 'PartiallyReceived'
    | 'Received'
    | 'Completed'
    | 'Rejected'
    | 'ReturnedForCorrection'
    | 'Cancelled';

  interface StockTransferRecord {
    id: string;
    transferNumber: string; // e.g. STN-2026-0001
    sourceWarehouseId: string;
    sourceWarehouseName: string;
    sourceProjectId: string;
    sourceProjectName: string;
    destinationWarehouseId: string;
    destinationWarehouseName: string;
    destinationProjectId: string;
    destinationProjectName: string;
    requestDate: string; // YYYY-MM-DD
    plannedDispatchDate?: string;
    actualDispatchDate?: string;
    expectedArrivalDate?: string;
    actualReceiptDate?: string;
    purpose: string;
    transferReason?: string;
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    status: TransferStatus;
    discrepancyStatus?: 'None' | 'PendingReview' | 'Resolved';
    items: StockTransferItemRecord[];
    auditTrail: StockTransferAuditRecord[];
    rejectionReason?: string;
    correctionNotes?: string;
    remarks?: string;
    createdByUserId: string;
    createdByName: string;
    createdAtUtc: string;
    submittedByUserId?: string;
    submittedByName?: string;
    submittedAtUtc?: string;
    approvedByUserId?: string;
    approvedByName?: string;
    approvedAtUtc?: string;
    dispatchedByUserId?: string;
    dispatchedByName?: string;
    dispatchedAtUtc?: string;
    receivedByUserId?: string;
    receivedByName?: string;
    receivedAtUtc?: string;
    completedByUserId?: string;
    completedByName?: string;
    completedAtUtc?: string;
    updatedAtUtc?: string;
  }

  const defaultSuppliers: SupplierRecord[] = [
    {
      id: 'SUP-APEX-01',
      supplierCode: 'SUP-APEX',
      normalizedSupplierCode: 'SUP-APEX',
      name: 'Apex Structural Steel & Rebar Ltd.',
      contactPerson: 'Robert Jenkins',
      phone: '+1 (555) 342-8800',
      email: 'orders@apexsteel.com',
      address: '142 Industrial Way, Sector 4, Metro City',
      taxReference: 'TAX-US-8849201',
      paymentTerms: 'Net 30 Days',
      notes: 'Certified mill distributor for Grade 500B deformed rebar and wire mesh.',
      isActive: true,
      createdAtUtc: '2026-01-10T08:00:00Z',
      createdByUserId: 'USR-ADMIN-01',
    },
    {
      id: 'SUP-HORIZON-02',
      supplierCode: 'SUP-HORIZON',
      normalizedSupplierCode: 'SUP-HORIZON',
      name: 'Horizon Ready-Mix & Aggregates Corp.',
      contactPerson: 'Elena Gomez',
      phone: '+1 (555) 789-2244',
      email: 'supply@horizonaggregates.com',
      address: '88 Quarry Basin Road, North Harbor',
      taxReference: 'TAX-US-6629104',
      paymentTerms: 'Net 15 Days',
      notes: 'Direct quarry operator for washed river sand, 20mm gravel, and CEM I cement.',
      isActive: true,
      createdAtUtc: '2026-01-12T09:30:00Z',
      createdByUserId: 'USR-ADMIN-01',
    },
    {
      id: 'SUP-VULCAN-03',
      supplierCode: 'SUP-VULCAN',
      normalizedSupplierCode: 'SUP-VULCAN',
      name: 'Vulcan Piping & Infrastructure Supplies',
      contactPerson: 'Marcus Sterling',
      phone: '+1 (555) 443-9090',
      email: 'sales@vulcanpipes.com',
      address: '520 Logistics Boulevard, Central Depot',
      taxReference: 'TAX-US-3391820',
      paymentTerms: 'Net 45 Days',
      notes: 'Approved supplier for heavy-duty uPVC and PPR drainage and stormwater piping systems.',
      isActive: true,
      createdAtUtc: '2026-01-18T11:15:00Z',
      createdByUserId: 'USR-ADMIN-01',
    },
  ];

  // Helper: Number formatting and precision
  function round2(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  function round4(num: number): number {
    return Math.round((num + Number.EPSILON) * 10000) / 10000;
  }

  // Helper: Next Stock Ledger Transaction Number generator (e.g. STK-2026-0001)
  function generateNextStockLedgerNumber(entries: StockLedgerRecord[]): string {
    const currentYear = new Date().getFullYear();
    const prefix = `STK-${currentYear}-`;
    const yearEntries = entries.filter((e) => e.referenceNumber && e.referenceNumber.startsWith(prefix));
    let maxSeq = 0;
    for (const e of yearEntries) {
      const parts = e.referenceNumber.split('-');
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

  // Continuous Moving Weighted-Average Costing (WAC) formula per SCM-F-01 policy
  function calculateWeightedAverageCost(
    oldQty: number,
    oldWac: number,
    inQty: number,
    inCost: number
  ): { newQty: number; newWac: number; newVal: number } {
    const prevQty = Math.max(0, oldQty);
    const prevWac = Math.max(0, oldWac);
    const prevVal = round2(prevQty * prevWac);

    const incomingQty = Math.max(0, inQty);
    const incomingCost = Math.max(0, inCost);
    const incomingVal = round2(incomingQty * incomingCost);

    const newQty = round2(prevQty + incomingQty);
    const newVal = round2(prevVal + incomingVal);

    let newWac = incomingCost;
    if (newQty > 0) {
      newWac = round4(newVal / newQty);
    }
    return { newQty, newWac, newVal };
  }

  // Authoritative Inventory Posting Service: Posts accepted GRN lines to Stock Ledger and updates Inventory Balances
  function postGrnToInventoryLedger(
    grn: GoodsReceivedNoteRecord,
    po: PurchaseOrderRecord,
    user: JwtPayload,
    nowUtc: string,
    stockLedger: StockLedgerRecord[],
    inventoryBalances: InventoryBalanceRecord[],
    materials: MaterialRecord[],
    projects: ProjectRecord[]
  ): { success: boolean; error?: string; postedCount: number } {
    // Validate unit costs: Must be strictly positive for all lines with acceptedQuantity > 0
    for (const item of grn.items) {
      if (item.acceptedQuantity > 0) {
        if (!item.unitPrice || item.unitPrice <= 0 || isNaN(item.unitPrice)) {
          return {
            success: false,
            error: `Cannot value inventory posting: Material '${item.materialCode}' (${item.materialName}) has non-positive or invalid unit cost (${item.unitPrice}). A positive valuation rate is required for financial inventory accounting.`,
            postedCount: 0,
          };
        }
      }
    }

    const project = projects.find((p) => p.id === grn.projectId);
    const warehouseName = grn.warehouseName || (grn.warehouseId === 'WH-02' ? 'North Industrial Depot & Yard' : 'Metro Central Staging Yard');
    const projectName = project ? project.name : (grn.projectName || 'Site Project');

    let postedCount = 0;

    for (const item of grn.items) {
      if (item.acceptedQuantity <= 0) continue;

      const idempotencyKey = `GRN_${grn.id}_ITEM_${item.id}`;
      // Idempotency guard: prevent duplicate stock ledger entry
      const alreadyPosted = stockLedger.some((e) => e.idempotencyKey === idempotencyKey);
      if (alreadyPosted) {
        continue;
      }

      // Find location balance
      let balance = inventoryBalances.find(
        (b) => b.materialId === item.materialId && b.warehouseId === grn.warehouseId && b.projectId === grn.projectId
      );

      const prevQty = balance ? balance.quantityOnHand : 0;
      const prevWac = balance ? balance.weightedAverageCost : 0;
      const inQty = item.acceptedQuantity;
      const inCost = item.unitPrice;

      const { newQty, newWac, newVal } = calculateWeightedAverageCost(prevQty, prevWac, inQty, inCost);
      const nextRefNumber = generateNextStockLedgerNumber(stockLedger);
      const material = materials.find((m) => m.id === item.materialId);

      const ledgerEntry: StockLedgerRecord = {
        id: `STK-TXN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`,
        referenceNumber: nextRefNumber,
        transactionType: 'GoodsReceivedNote',
        sourceDocumentType: 'GoodsReceivedNote',
        sourceDocumentId: grn.id,
        sourceDocumentNumber: grn.grnNumber,
        sourceLineId: item.id,
        materialId: item.materialId,
        materialCode: item.materialCode,
        materialName: item.materialName,
        unitCode: item.unitCode,
        warehouseId: grn.warehouseId,
        warehouseName,
        projectId: grn.projectId,
        projectName,
        quantityIn: inQty,
        quantityOut: 0,
        signedQuantity: inQty,
        unitCost: inCost,
        transactionValue: round2(inQty * inCost),
        balanceQuantityAfter: newQty,
        weightedAverageCostAfter: newWac,
        totalValuationAfter: newVal,
        batchNumber: (item as any).batchNumber || grn.inspectionChecklist?.testCertificateNumber || undefined,
        idempotencyKey,
        transactionDate: grn.grnDate || nowUtc.split('T')[0],
        timestampUtc: nowUtc,
        createdByUserId: user.sub,
        createdByName: user.fullName,
        remarks: `Goods receipt intake via ${grn.grnNumber} against PO ${po.poNumber}. Supplier: ${grn.supplierName}. Challan: ${grn.deliveryChallanNumber}.`,
      };

      stockLedger.unshift(ledgerEntry);

      if (balance) {
        balance.quantityOnHand = newQty;
        balance.quantityAvailable = round2(newQty - balance.quantityReserved);
        balance.weightedAverageCost = newWac;
        balance.inventoryValue = newVal;
        balance.lastUpdatedUtc = nowUtc;
        balance.version += 1;
      } else {
        balance = {
          id: `BAL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`,
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          categoryId: material?.categoryId,
          categoryName: material?.categoryName,
          unitCode: item.unitCode,
          warehouseId: grn.warehouseId,
          warehouseName,
          projectId: grn.projectId,
          projectName,
          quantityOnHand: newQty,
          quantityReserved: 0,
          quantityAvailable: newQty,
          quantityInTransit: 0,
          weightedAverageCost: newWac,
          inventoryValue: newVal,
          version: 1,
          lastUpdatedUtc: nowUtc,
        };
        inventoryBalances.push(balance);
      }

      postedCount++;
    }

    return { success: true, postedCount };
  }

  // Authoritative Inventory Posting Service: Posts approved Material Issue lines to Stock Ledger and reduces Inventory Balances
  function postMaterialIssueToStockLedger(
    issue: MaterialIssueRecord,
    user: JwtPayload,
    nowUtc: string,
    stockLedger: StockLedgerRecord[],
    inventoryBalances: InventoryBalanceRecord[],
    requisitions: RequisitionRecord[]
  ): { success: boolean; error?: string; postedCount: number } {
    // 1. Availability Pre-Check
    for (const item of issue.items) {
      if (item.quantityToIssue <= 0) continue;

      const balance = inventoryBalances.find(
        (b) =>
          (b.materialId === item.materialId || b.materialCode === item.materialCode) &&
          b.warehouseId === issue.warehouseId &&
          b.projectId === issue.projectId
      ) || inventoryBalances.find(
        (b) => b.materialId === item.materialId || b.materialCode === item.materialCode
      );

      const availableQty = balance ? (balance.quantityAvailable ?? balance.quantityOnHand ?? 0) : 0;
      if (availableQty < item.quantityToIssue) {
        return {
          success: false,
          error: `Insufficient available stock in warehouse '${issue.warehouseName}' for material '${item.materialCode}' (${item.materialName}). Available stock: ${availableQty} ${item.unitCode}, Requested to issue: ${item.quantityToIssue} ${item.unitCode}.`,
          postedCount: 0,
        };
      }
    }

    let postedCount = 0;

    for (const item of issue.items) {
      if (item.quantityToIssue <= 0) continue;

      const idempotencyKey = `ISSUE_${issue.id}_ITEM_${item.id}`;
      const alreadyPosted = stockLedger.some((e) => e.idempotencyKey === idempotencyKey);
      if (alreadyPosted) {
        continue;
      }

      const balance = inventoryBalances.find(
        (b) =>
          (b.materialId === item.materialId || b.materialCode === item.materialCode) &&
          b.warehouseId === issue.warehouseId &&
          b.projectId === issue.projectId
      ) || inventoryBalances.find(
        (b) => b.materialId === item.materialId || b.materialCode === item.materialCode
      );

      if (!balance || (balance.quantityOnHand ?? 0) < item.quantityToIssue) {
        return {
          success: false,
          error: `Stock check failed during posting: Material '${item.materialCode}' has insufficient stock on hand.`,
          postedCount: 0,
        };
      }

      const prevQty = balance.quantityOnHand;
      const currentWac = balance.weightedAverageCost ?? (balance as any).weightedAverageUnitCost ?? 0;
      const issueQty = item.quantityToIssue;

      const newQty = round2(prevQty - issueQty);
      const newVal = round2(newQty * currentWac);
      const nextRefNumber = generateNextStockLedgerNumber(stockLedger);

      item.actualIssuedQuantity = issueQty;
      item.unitCost = currentWac;
      item.totalIssuedAmount = round2(issueQty * currentWac);

      const ledgerEntry: StockLedgerRecord = {
        id: `STK-TXN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`,
        referenceNumber: nextRefNumber,
        transactionType: 'MaterialIssue',
        sourceDocumentType: 'MaterialIssue',
        sourceDocumentId: issue.id,
        sourceDocumentNumber: issue.issueNumber,
        sourceLineId: item.id,
        materialId: item.materialId,
        materialCode: item.materialCode,
        materialName: item.materialName,
        unitCode: item.unitCode,
        warehouseId: issue.warehouseId,
        warehouseName: issue.warehouseName,
        projectId: issue.projectId,
        projectName: issue.projectName,
        quantityIn: 0,
        quantityOut: issueQty,
        signedQuantity: -issueQty,
        unitCost: currentWac,
        transactionValue: item.totalIssuedAmount,
        balanceQuantityAfter: newQty,
        weightedAverageCostAfter: currentWac,
        totalValuationAfter: newVal,
        idempotencyKey,
        transactionDate: issue.issueDate || nowUtc.split('T')[0],
        timestampUtc: nowUtc,
        createdByUserId: user.sub,
        createdByName: user.fullName,
        remarks: `Material issue dispatch for purpose: ${issue.purpose}. Requisition: ${issue.requisitionNumber}. Receiver: ${issue.receivedByPerson}.`,
      };

      stockLedger.unshift(ledgerEntry);
      item.stockLedgerEntryId = ledgerEntry.id;

      balance.quantityOnHand = newQty;
      balance.quantityAvailable = round2(newQty - balance.quantityReserved);
      balance.inventoryValue = newVal;
      balance.lastUpdatedUtc = nowUtc;
      balance.version += 1;

      postedCount++;
    }

    // 2. Update source requisition fulfillment quantities and overall requisition status
    const req = requisitions.find((r) => r.id === issue.requisitionId || r.requisitionNumber === issue.requisitionNumber);
    if (req) {
      for (const issueItem of issue.items) {
        const reqItem = req.items.find((ri) => ri.id === issueItem.requisitionItemId || ri.materialId === issueItem.materialId);
        if (reqItem) {
          (reqItem as any).issuedQuantity = round2(((reqItem as any).issuedQuantity || 0) + issueItem.quantityToIssue);
          (reqItem as any).outstandingQuantity = round2(Math.max(0, reqItem.requestedQuantity - ((reqItem as any).issuedQuantity || 0)));
        }
      }

      let totalReq = 0;
      let totalIssued = 0;
      for (const ri of req.items) {
        totalReq += ri.requestedQuantity;
        totalIssued += ((ri as any).issuedQuantity || 0);
      }

      if (totalIssued >= totalReq) {
        req.status = 'FullyFulfilled' as any;
      } else if (totalIssued > 0) {
        req.status = 'PartiallyFulfilled' as any;
      }
      req.updatedAtUtc = nowUtc;
    }

    return { success: true, postedCount };
  }

  // Authoritative Inventory Posting Service: Posts approved Material Return lines to Stock Ledger
  function postMaterialReturnToStockLedger(
    returnDoc: MaterialReturnRecord,
    user: JwtPayload,
    nowUtc: string,
    stockLedger: StockLedgerRecord[],
    inventoryBalances: InventoryBalanceRecord[],
    issues: MaterialIssueRecord[],
    materials: MaterialRecord[]
  ): { success: boolean; error?: string; postedCount: number } {
    let postedCount = 0;

    for (const item of returnDoc.items) {
      if (item.returnedQuantity <= 0) continue;

      if (item.condition === 'ReusableGood' && item.disposition === 'ReturnToUsableStock') {
        const idempotencyKey = `RETURN_${returnDoc.id}_ITEM_${item.id}`;
        const alreadyPosted = stockLedger.some((e) => e.idempotencyKey === idempotencyKey);
        if (alreadyPosted) {
          continue;
        }

        let balance = inventoryBalances.find(
          (b) =>
            (b.materialId === item.materialId || b.materialCode === item.materialCode) &&
            b.warehouseId === returnDoc.warehouseId &&
            b.projectId === returnDoc.projectId
        ) || inventoryBalances.find(
          (b) => b.materialId === item.materialId || b.materialCode === item.materialCode
        );

        const prevQty = balance ? balance.quantityOnHand : 0;
        const prevWac = balance ? balance.weightedAverageCost : item.unitCost;
        const inQty = item.returnedQuantity;
        const inCost = item.unitCost;

        const { newQty, newWac, newVal } = calculateWeightedAverageCost(prevQty, prevWac, inQty, inCost);
        const nextRefNumber = generateNextStockLedgerNumber(stockLedger);

        const ledgerEntry: StockLedgerRecord = {
          id: `STK-TXN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`,
          referenceNumber: nextRefNumber,
          transactionType: 'SiteReturn',
          sourceDocumentType: 'MaterialReturn',
          sourceDocumentId: returnDoc.id,
          sourceDocumentNumber: returnDoc.returnNumber,
          sourceLineId: item.id,
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          unitCode: item.unitCode,
          warehouseId: returnDoc.warehouseId,
          warehouseName: returnDoc.warehouseName,
          projectId: returnDoc.projectId,
          projectName: returnDoc.projectName,
          quantityIn: inQty,
          quantityOut: 0,
          signedQuantity: inQty,
          unitCost: inCost,
          transactionValue: round2(inQty * inCost),
          balanceQuantityAfter: newQty,
          weightedAverageCostAfter: newWac,
          totalValuationAfter: newVal,
          idempotencyKey,
          transactionDate: returnDoc.returnDate || nowUtc.split('T')[0],
          timestampUtc: nowUtc,
          createdByUserId: user.sub,
          createdByName: user.fullName,
          remarks: `Material return intake (Condition: ${item.condition}). Reason: ${returnDoc.reason}. Returning person: ${returnDoc.returnedByPerson}.`,
        };

        stockLedger.unshift(ledgerEntry);
        item.stockLedgerEntryId = ledgerEntry.id;

        if (balance) {
          balance.quantityOnHand = newQty;
          balance.quantityAvailable = round2(newQty - balance.quantityReserved);
          balance.weightedAverageCost = newWac;
          balance.inventoryValue = newVal;
          balance.lastUpdatedUtc = nowUtc;
          balance.version += 1;
        } else {
          const material = materials.find((m) => m.id === item.materialId);
          balance = {
            id: `BAL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`,
            materialId: item.materialId,
            materialCode: item.materialCode,
            materialName: item.materialName,
            categoryId: material?.categoryId,
            categoryName: material?.categoryName,
            unitCode: item.unitCode,
            warehouseId: returnDoc.warehouseId,
            warehouseName: returnDoc.warehouseName,
            projectId: returnDoc.projectId,
            projectName: returnDoc.projectName,
            quantityOnHand: newQty,
            quantityReserved: 0,
            quantityAvailable: newQty,
            quantityInTransit: 0,
            weightedAverageCost: newWac,
            inventoryValue: newVal,
            version: 1,
            lastUpdatedUtc: nowUtc,
          };
          inventoryBalances.push(balance);
        }

        postedCount++;
      }
    }

    // Update previously returned quantities on source material issue
    const issue = issues.find((i) => i.id === returnDoc.materialIssueId);
    if (issue) {
      for (const retItem of returnDoc.items) {
        const issueItem = issue.items.find((ii) => ii.id === retItem.materialIssueItemId || ii.materialId === retItem.materialId);
        if (issueItem) {
          issueItem.previouslyReturnedQuantity = round2((issueItem.previouslyReturnedQuantity || 0) + retItem.returnedQuantity);
        }
      }
      issue.updatedAtUtc = nowUtc;
    }

    return { success: true, postedCount };
  }

  // Helper: Next Issue Number generator (e.g. MIV-2026-0001)
  function generateNextIssueNumber(issues: MaterialIssueRecord[]): string {
    const currentYear = new Date().getFullYear();
    const prefix = `MIV-${currentYear}-`;
    const yearIssues = issues.filter((i) => i.issueNumber && i.issueNumber.startsWith(prefix));
    let maxSeq = 0;
    for (const i of yearIssues) {
      const parts = i.issueNumber.split('-');
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

  // Helper: Next Return Number generator (e.g. MRN-2026-0001)
  function generateNextReturnNumber(returns: MaterialReturnRecord[]): string {
    const currentYear = new Date().getFullYear();
    const prefix = `MRN-${currentYear}-`;
    const yearReturns = returns.filter((r) => r.returnNumber && r.returnNumber.startsWith(prefix));
    let maxSeq = 0;
    for (const r of yearReturns) {
      const parts = r.returnNumber.split('-');
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

  // Helper: Next PO Number generator (e.g. PO-2026-0001)
  function generateNextPoNumber(pos: PurchaseOrderRecord[]): string {
    const currentYear = new Date().getFullYear();
    const prefix = `PO-${currentYear}-`;
    const yearPos = pos.filter((p) => p.poNumber && p.poNumber.startsWith(prefix));
    let maxSeq = 0;
    for (const p of yearPos) {
      const parts = p.poNumber.split('-');
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

  // Helper: Calculate already allocated quantity for a requisition line in active POs
  function getAllocatedQuantityForRequisitionItem(
    pos: PurchaseOrderRecord[],
    reqItemId: string,
    excludePoId?: string
  ): number {
    let allocated = 0;
    for (const po of pos) {
      if (po.id === excludePoId || po.status === 'Cancelled' || po.status === 'Rejected') {
        continue;
      }
      for (const item of po.items) {
        if (item.requisitionItemId === reqItemId) {
          allocated += item.orderedQuantity;
        }
      }
    }
    return round2(allocated);
  }

  // ------------------------------------------------------------------------
  // API: SUPPLIERS
  // ------------------------------------------------------------------------

  // GET /api/suppliers
  router.get('/suppliers', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { search, status, page, pageSize } = req.query;
    const suppliers = readJsonSafe<SupplierRecord[]>(suppliersFile, defaultSuppliers);

    let filtered = [...suppliers];

    if (search && typeof search === 'string') {
      const term = search.trim().toUpperCase();
      filtered = filtered.filter(
        (s) =>
          s.normalizedSupplierCode.includes(term) ||
          s.name.toUpperCase().includes(term) ||
          s.contactPerson.toUpperCase().includes(term) ||
          s.email.toUpperCase().includes(term)
      );
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      const isActive = status === 'ACTIVE';
      filtered = filtered.filter((s) => s.isActive === isActive);
    }

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    if (page && pageSize) {
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
        },
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: filtered,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/suppliers/:id
  router.get('/suppliers/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const suppliers = readJsonSafe<SupplierRecord[]>(suppliersFile, defaultSuppliers);
    const supplier = suppliers.find((s) => s.id === req.params.id || s.supplierCode === req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: `Supplier with ID or Code '${req.params.id}' was not found`,
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: supplier,
      timestampUtc: new Date().toISOString(),
    });
  });

  // POST /api/suppliers
  router.post('/suppliers', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const {
      supplierCode,
      code,
      name,
      contactPerson,
      phone,
      email,
      address,
      taxReference,
      paymentTerms,
      notes,
    } = req.body || {};

    const codeInput = supplierCode || code;
    if (!codeInput || !String(codeInput).trim()) {
      return res.status(400).json({ success: false, message: 'Supplier code is required' });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Supplier legal/business name is required' });
    }

    if (!contactPerson || !String(contactPerson).trim()) {
      return res.status(400).json({ success: false, message: 'Contact person is required' });
    }

    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const emailTrimmed = String(email).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    if (!address || !String(address).trim()) {
      return res.status(400).json({ success: false, message: 'Business address is required' });
    }

    const trimmedCode = String(codeInput).trim();
    const normalizedCode = trimmedCode.toUpperCase();

    const suppliers = readJsonSafe<SupplierRecord[]>(suppliersFile, defaultSuppliers);

    if (suppliers.some((s) => s.normalizedSupplierCode === normalizedCode)) {
      return res.status(409).json({
        success: false,
        message: `Supplier with code '${trimmedCode}' already exists. Supplier codes must be unique.`,
        timestampUtc: new Date().toISOString(),
      });
    }

    const nowUtc = new Date().toISOString();
    const newSupplier: SupplierRecord = {
      id: `SUP-${Date.now().toString(36).toUpperCase()}`,
      supplierCode: trimmedCode,
      normalizedSupplierCode: normalizedCode,
      name: String(name).trim(),
      contactPerson: String(contactPerson).trim(),
      phone: String(phone).trim(),
      email: emailTrimmed,
      address: String(address).trim(),
      taxReference: taxReference ? String(taxReference).trim() : undefined,
      paymentTerms: paymentTerms ? String(paymentTerms).trim() : 'Net 30 Days',
      notes: notes ? String(notes).trim() : undefined,
      isActive: true,
      createdAtUtc: nowUtc,
      createdByUserId: req.user?.sub,
    };

    suppliers.push(newSupplier);
    writeJsonAtomic(suppliersFile, suppliers);

    return res.status(201).json({
      success: true,
      message: `Supplier '${newSupplier.name}' created successfully`,
      data: newSupplier,
      timestampUtc: nowUtc,
    });
  });

  // PUT /api/suppliers/:id
  router.put('/suppliers/:id', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const suppliers = readJsonSafe<SupplierRecord[]>(suppliersFile, defaultSuppliers);
    const supplier = suppliers.find((s) => s.id === req.params.id);

    if (!supplier) {
      return res.status(404).json({ success: false, message: `Supplier '${req.params.id}' was not found` });
    }

    const {
      name,
      contactPerson,
      phone,
      email,
      address,
      taxReference,
      paymentTerms,
      notes,
    } = req.body || {};

    if (name) {
      if (!String(name).trim()) return res.status(400).json({ success: false, message: 'Supplier name cannot be empty' });
      supplier.name = String(name).trim();
    }

    if (contactPerson) {
      if (!String(contactPerson).trim()) return res.status(400).json({ success: false, message: 'Contact person cannot be empty' });
      supplier.contactPerson = String(contactPerson).trim();
    }

    if (phone) {
      if (!String(phone).trim()) return res.status(400).json({ success: false, message: 'Phone cannot be empty' });
      supplier.phone = String(phone).trim();
    }

    if (email) {
      const emailTrimmed = String(email).trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        return res.status(400).json({ success: false, message: 'Invalid email address' });
      }
      supplier.email = emailTrimmed;
    }

    if (address) {
      supplier.address = String(address).trim();
    }

    if (taxReference !== undefined) {
      supplier.taxReference = taxReference ? String(taxReference).trim() : undefined;
    }

    if (paymentTerms !== undefined) {
      supplier.paymentTerms = paymentTerms ? String(paymentTerms).trim() : undefined;
    }

    if (notes !== undefined) {
      supplier.notes = notes ? String(notes).trim() : undefined;
    }

    supplier.updatedAtUtc = new Date().toISOString();
    supplier.updatedByUserId = req.user?.sub;

    writeJsonAtomic(suppliersFile, suppliers);

    return res.status(200).json({
      success: true,
      message: 'Supplier updated successfully',
      data: supplier,
      timestampUtc: supplier.updatedAtUtc,
    });
  });

  // PATCH /api/suppliers/:id/status
  router.patch('/suppliers/:id/status', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const suppliers = readJsonSafe<SupplierRecord[]>(suppliersFile, defaultSuppliers);
    const supplier = suppliers.find((s) => s.id === req.params.id);

    if (!supplier) {
      return res.status(404).json({ success: false, message: `Supplier '${req.params.id}' was not found` });
    }

    const { isActive, status } = req.body || {};
    let resolvedActive: boolean | undefined = undefined;
    if (typeof isActive === 'boolean') {
      resolvedActive = isActive;
    } else if (typeof status === 'string') {
      resolvedActive = status.toUpperCase() === 'ACTIVE';
    }

    if (resolvedActive === undefined) {
      return res.status(400).json({ success: false, message: "Field 'isActive' (boolean) or 'status' ('Active'|'Inactive') is required" });
    }

    supplier.isActive = resolvedActive;
    supplier.updatedAtUtc = new Date().toISOString();
    supplier.updatedByUserId = req.user?.sub;

    writeJsonAtomic(suppliersFile, suppliers);

    return res.status(200).json({
      success: true,
      message: `Supplier '${supplier.name}' ${resolvedActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        ...supplier,
        status: supplier.isActive ? 'Active' : 'Inactive',
      },
      timestampUtc: supplier.updatedAtUtc,
    });
  });

  // GET /api/suppliers/:id/purchase-orders
  router.get('/suppliers/:id/purchase-orders', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;

    const supplierOrders = purchaseOrders.filter(
      (po) => (po.supplierId === req.params.id || po.supplierCode === req.params.id) && canUserAccessProject(user, po.projectId)
    );

    supplierOrders.sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());

    return res.status(200).json({
      success: true,
      data: supplierOrders,
      timestampUtc: new Date().toISOString(),
    });
  });

  // ------------------------------------------------------------------------
  // API: PURCHASE ORDERS
  // ------------------------------------------------------------------------

  // GET /api/requisitions/approved-for-po
  // Helper to retrieve approved requisitions with available unallocated lines for PO creation
  router.get('/requisitions/approved-for-po', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;

    const approvedRequisitions = requisitions.filter(
      (r) => r.status === 'Approved' && canUserAccessProject(user, r.projectId)
    );

    const eligible = approvedRequisitions.map((reqRecord) => {
      const itemsWithAllocations = reqRecord.items.map((item) => {
        const allocated = getAllocatedQuantityForRequisitionItem(purchaseOrders, item.id);
        const unallocated = Math.max(0, round2(item.requestedQuantity - allocated));
        return {
          ...item,
          allocatedQuantity: allocated,
          unallocatedQuantity: unallocated,
          isFullyAllocated: unallocated <= 0,
        };
      });

      return {
        id: reqRecord.id,
        requisitionNumber: reqRecord.requisitionNumber,
        projectId: reqRecord.projectId,
        projectCode: reqRecord.projectCode,
        projectName: reqRecord.projectName,
        requiredDate: reqRecord.requiredDate,
        purpose: reqRecord.purpose,
        approvedByName: reqRecord.approvedByName,
        approvedAtUtc: reqRecord.approvedAtUtc,
        items: itemsWithAllocations,
        hasAvailableLines: itemsWithAllocations.some((i) => i.unallocatedQuantity > 0),
      };
    });

    return res.status(200).json({
      success: true,
      data: eligible,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/purchase-orders
  router.get('/purchase-orders', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;
    const { search, status, supplierId, projectId, page = '1', pageSize = '20' } = req.query;

    let filtered = purchaseOrders.filter((po) => canUserAccessProject(user, po.projectId));

    if (supplierId && typeof supplierId === 'string' && supplierId !== 'ALL') {
      filtered = filtered.filter((po) => po.supplierId === supplierId);
    }

    if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
      filtered = filtered.filter((po) => po.projectId === projectId);
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      filtered = filtered.filter((po) => po.status === status);
    }

    if (search && typeof search === 'string') {
      const term = search.trim().toUpperCase();
      filtered = filtered.filter(
        (po) =>
          po.poNumber.toUpperCase().includes(term) ||
          po.supplierName.toUpperCase().includes(term) ||
          po.supplierCode.toUpperCase().includes(term) ||
          po.projectName.toUpperCase().includes(term) ||
          (po.requisitionNumber && po.requisitionNumber.toUpperCase().includes(term)) ||
          po.items.some(
            (i) => i.materialName.toUpperCase().includes(term) || i.materialCode.toUpperCase().includes(term)
          )
      );
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());

    const pageIndex = Math.max(1, parseInt(page as string, 10) || 1);
    const size = Math.max(1, parseInt(pageSize as string, 10) || 20);
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / size);
    const paged = filtered.slice((pageIndex - 1) * size, pageIndex * size);

    // Compute summary metrics for dashboards
    const metrics = {
      totalCount,
      totalCommittedValue: round2(filtered.reduce((sum, po) => sum + (po.status !== 'Cancelled' ? po.grandTotal : 0), 0)),
      pendingApprovalCount: filtered.filter((po) => po.status === 'PendingApproval').length,
      approvedCount: filtered.filter((po) => po.status === 'Approved').length,
      issuedCount: filtered.filter((po) => po.status === 'Issued').length,
    };

    return res.status(200).json({
      success: true,
      data: {
        items: paged,
        pageIndex,
        pageSize: size,
        totalCount,
        totalPages,
        metrics,
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/purchase-orders/:id
  router.get('/purchase-orders/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;

    const po = purchaseOrders.find((p) => p.id === req.params.id || p.poNumber === req.params.id);
    if (!po) {
      return res.status(404).json({
        success: false,
        message: `Purchase Order '${req.params.id}' was not found`,
        timestampUtc: new Date().toISOString(),
      });
    }

    if (!canUserAccessProject(user, po.projectId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have access to purchase orders for this project site',
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: po,
      timestampUtc: new Date().toISOString(),
    });
  });

  // POST /api/purchase-orders (Create PO)
  router.post('/purchase-orders', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const suppliers = readJsonSafe<SupplierRecord[]>(suppliersFile, defaultSuppliers);
    const projects = readJsonSafe<ProjectRecord[]>(projectsFile, defaultProjects);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const user = req.user!;

    const {
      supplierId,
      projectId,
      deliveryLocation,
      orderDate,
      expectedDeliveryDate,
      paymentTerms,
      notes,
      requisitionId,
      items,
      freight = 0,
      headerDiscount = 0,
      submitImmediately = false,
      initialComments,
    } = req.body || {};

    if (!supplierId) {
      return res.status(400).json({ success: false, message: 'Supplier selection is required' });
    }

    const supplier = suppliers.find((s) => s.id === supplierId && s.isActive);
    if (!supplier) {
      return res.status(400).json({ success: false, message: `Active supplier with ID '${supplierId}' was not found` });
    }

    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Project selection is required' });
    }

    const project = projects.find((p) => p.id === projectId && p.isActive);
    if (!project) {
      return res.status(400).json({ success: false, message: `Active project with ID '${projectId}' was not found` });
    }

    if (!canUserAccessProject(user, projectId)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You are not authorized for project '${project.name}'`,
      });
    }

    if (!expectedDeliveryDate || isNaN(Date.parse(expectedDeliveryDate))) {
      return res.status(400).json({ success: false, message: 'Valid expected delivery date is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Purchase order must have at least one line item' });
    }

    // Validate Requisition Integration if linked
    let linkedRequisition: RequisitionRecord | null = null;
    if (requisitionId) {
      linkedRequisition = requisitions.find((r) => r.id === requisitionId || r.requisitionNumber === requisitionId) || null;
      if (!linkedRequisition) {
        return res.status(400).json({ success: false, message: `Requisition '${requisitionId}' was not found` });
      }

      // Backend Rule: Must be in Approved status!
      if (linkedRequisition.status !== 'Approved') {
        return res.status(400).json({
          success: false,
          message: `Cannot create purchase order from requisition '${linkedRequisition.requisitionNumber}'. Requisition status is '${linkedRequisition.status}', but must be 'Approved'.`,
        });
      }

      if (linkedRequisition.projectId !== project.id) {
        return res.status(400).json({
          success: false,
          message: `Requisition '${linkedRequisition.requisitionNumber}' belongs to project '${linkedRequisition.projectName}', not '${project.name}'.`,
        });
      }
    } else {
      // Company workflow rule: Standalone PO requires business justification/notes
      if (!notes || String(notes).trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: 'Standalone purchase orders without a source requisition require a procurement justification / order notes (minimum 5 characters).',
        });
      }
    }

    // Process and validate line items
    const parsedItems: PurchaseOrderItemRecord[] = [];
    const seenMaterialIds = new Set<string>();

    for (let idx = 0; idx < items.length; idx++) {
      const line = items[idx];
      if (!line.materialId) {
        return res.status(400).json({ success: false, message: `Line #${idx + 1}: Material selection is required` });
      }

      if (seenMaterialIds.has(line.materialId)) {
        return res.status(400).json({
          success: false,
          message: `Line #${idx + 1}: Duplicate material detected. Combine quantities on a single line item.`,
        });
      }
      seenMaterialIds.add(line.materialId);

      const material = materials.find((m) => m.id === line.materialId && m.isActive);
      if (!material) {
        return res.status(400).json({
          success: false,
          message: `Line #${idx + 1}: Material '${line.materialId}' is invalid or inactive`,
        });
      }

      const orderedQty = parseFloat(line.orderedQuantity);
      if (isNaN(orderedQty) || orderedQty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Line #${idx + 1} (${material.name}): Ordered quantity must be a positive number greater than 0`,
        });
      }

      const unitRate = parseFloat(line.unitRate);
      if (isNaN(unitRate) || unitRate < 0) {
        return res.status(400).json({
          success: false,
          message: `Line #${idx + 1} (${material.name}): Unit rate must be a non-negative decimal`,
        });
      }

      // Check Requisition allocation limits if line references requisition
      if (linkedRequisition && line.requisitionItemId) {
        const reqItem = linkedRequisition.items.find((ri) => ri.id === line.requisitionItemId);
        if (!reqItem) {
          return res.status(400).json({
            success: false,
            message: `Line #${idx + 1}: Requisition item '${line.requisitionItemId}' does not exist on requisition '${linkedRequisition.requisitionNumber}'`,
          });
        }

        const alreadyAllocated = getAllocatedQuantityForRequisitionItem(purchaseOrders, reqItem.id);
        const unallocated = round2(reqItem.requestedQuantity - alreadyAllocated);

        if (orderedQty > unallocated) {
          return res.status(400).json({
            success: false,
            message: `Cannot order ${orderedQty} ${reqItem.unitCode} of '${material.name}'. Only ${unallocated} ${reqItem.unitCode} remains unallocated on approved requisition '${linkedRequisition.requisitionNumber}' (Requested: ${reqItem.requestedQuantity}, Already ordered: ${alreadyAllocated}).`,
          });
        }
      }

      const lineDiscount = Math.max(0, parseFloat(line.lineDiscount) || 0);
      const taxRate = Math.max(0, parseFloat(line.taxRate) || 0);

      const lineSubtotal = round2(orderedQty * unitRate);
      if (lineDiscount > lineSubtotal) {
        return res.status(400).json({
          success: false,
          message: `Line #${idx + 1}: Line discount ($${lineDiscount}) cannot exceed line subtotal ($${lineSubtotal})`,
        });
      }

      const taxable = round2(lineSubtotal - lineDiscount);
      const lineTaxAmount = round2(taxable * (taxRate / 100));
      const lineTotal = round2(taxable + lineTaxAmount);

      parsedItems.push({
        id: `POI-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
        parentPoId: '', // set below
        materialId: material.id,
        materialCode: material.itemCode,
        materialName: material.name,
        specification: material.specification,
        unitId: material.baseUnitId,
        unitCode: material.baseUnitName,
        requisitionItemId: line.requisitionItemId || null,
        orderedQuantity: orderedQty,
        receivedQuantity: 0, // Strictly 0 until GRN workflow
        outstandingQuantity: orderedQty,
        unitRate: round2(unitRate),
        lineDiscount: round2(lineDiscount),
        taxRate: round2(taxRate),
        taxAmount: lineTaxAmount,
        lineTotal,
        notes: line.notes ? String(line.notes).trim() : undefined,
      });
    }

    // Calculate totals server-side
    const subtotal = round2(parsedItems.reduce((acc, it) => acc + round2(it.orderedQuantity * it.unitRate), 0));
    const itemsDiscount = round2(parsedItems.reduce((acc, it) => acc + it.lineDiscount, 0));
    const headerDisc = Math.max(0, parseFloat(headerDiscount) || 0);
    const totalDiscount = round2(itemsDiscount + headerDisc);
    const taxAmount = round2(parsedItems.reduce((acc, it) => acc + it.taxAmount, 0));
    const freightAmount = Math.max(0, parseFloat(freight) || 0);
    const grandTotal = round2(subtotal - totalDiscount + taxAmount + freightAmount);

    const newPoNumber = generateNextPoNumber(purchaseOrders);
    const newPoId = `PO-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`;
    const initialStatus: PurchaseOrderStatus = submitImmediately ? 'PendingApproval' : 'Draft';
    const nowUtc = new Date().toISOString();

    parsedItems.forEach((it) => (it.parentPoId = newPoId));

    const history: PurchaseOrderApprovalRecord[] = [
      {
        id: `PO-HIS-${crypto.randomBytes(4).toString('hex')}`,
        poId: newPoId,
        actorUserId: user.sub,
        actorName: user.fullName,
        actorRole: user.roles[0] || 'User',
        action: 'DraftCreated',
        comments: initialComments ? String(initialComments).trim() : 'Purchase order draft created.',
        timestampUtc: nowUtc,
      },
    ];

    if (submitImmediately) {
      history.push({
        id: `PO-HIS-${crypto.randomBytes(4).toString('hex')}`,
        poId: newPoId,
        actorUserId: user.sub,
        actorName: user.fullName,
        actorRole: user.roles[0] || 'User',
        action: 'Submitted',
        comments: 'Purchase order submitted for review and approval.',
        timestampUtc: nowUtc,
      });
    }

    const newPo: PurchaseOrderRecord = {
      id: newPoId,
      poNumber: newPoNumber,
      supplierId: supplier.id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.name,
      supplierContact: `${supplier.contactPerson} (${supplier.email})`,
      requisitionId: linkedRequisition ? linkedRequisition.id : null,
      requisitionNumber: linkedRequisition ? linkedRequisition.requisitionNumber : null,
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      deliveryLocation: deliveryLocation ? String(deliveryLocation).trim() : 'Site Central Staging Yard',
      orderDate: orderDate ? String(orderDate).substring(0, 10) : nowUtc.substring(0, 10),
      expectedDeliveryDate: String(expectedDeliveryDate).substring(0, 10),
      currency: 'USD',
      paymentTerms: paymentTerms ? String(paymentTerms).trim() : (supplier.paymentTerms || 'Net 30 Days'),
      notes: notes ? String(notes).trim() : undefined,
      status: initialStatus,
      items: parsedItems,
      subtotal,
      subTotal: subtotal,
      orderedQuantity: round2(parsedItems.reduce((acc, it) => acc + it.orderedQuantity, 0)),
      receivedQuantity: 0,
      outstandingQuantity: round2(parsedItems.reduce((acc, it) => acc + it.outstandingQuantity, 0)),
      itemsDiscount,
      headerDiscount: headerDisc,
      totalDiscount,
      taxAmount,
      freight: freightAmount,
      grandTotal,
      approvalHistory: history,
      createdAtUtc: nowUtc,
      updatedAtUtc: nowUtc,
      createdByUserId: user.sub,
      createdByName: user.fullName,
    };

    purchaseOrders.push(newPo);
    writeJsonAtomic(purchaseOrdersFile, purchaseOrders);

    return res.status(201).json({
      success: true,
      message: `Purchase order ${newPoNumber} created successfully in ${initialStatus} state`,
      data: newPo,
      timestampUtc: nowUtc,
    });
  });

  // PUT /api/purchase-orders/:id (Update Draft PO)
  router.put('/purchase-orders/:id', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const suppliers = readJsonSafe<SupplierRecord[]>(suppliersFile, defaultSuppliers);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const user = req.user!;

    const po = purchaseOrders.find((p) => p.id === req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: `Purchase Order '${req.params.id}' was not found` });
    }

    if (po.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot update Purchase Order in status '${po.status}'. Only 'Draft' purchase orders can be edited.`,
      });
    }

    if (!canUserAccessProject(user, po.projectId)) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have access to this project site' });
    }

    const {
      supplierId,
      deliveryLocation,
      orderDate,
      expectedDeliveryDate,
      paymentTerms,
      notes,
      items,
      freight,
      headerDiscount,
      updateComments,
    } = req.body || {};

    if (supplierId && supplierId !== po.supplierId) {
      const supplier = suppliers.find((s) => s.id === supplierId && s.isActive);
      if (!supplier) {
        return res.status(400).json({ success: false, message: `Supplier '${supplierId}' is invalid or inactive` });
      }
      po.supplierId = supplier.id;
      po.supplierCode = supplier.supplierCode;
      po.supplierName = supplier.name;
      po.supplierContact = `${supplier.contactPerson} (${supplier.email})`;
    }

    if (deliveryLocation) {
      po.deliveryLocation = String(deliveryLocation).trim();
    }

    if (orderDate) {
      po.orderDate = String(orderDate).substring(0, 10);
    }

    if (expectedDeliveryDate) {
      po.expectedDeliveryDate = String(expectedDeliveryDate).substring(0, 10);
    }

    if (paymentTerms) {
      po.paymentTerms = String(paymentTerms).trim();
    }

    if (notes !== undefined) {
      po.notes = notes ? String(notes).trim() : undefined;
    }

    if (Array.isArray(items)) {
      if (items.length === 0) {
        return res.status(400).json({ success: false, message: 'Purchase Order must have at least one line item' });
      }

      let linkedRequisition: RequisitionRecord | null = null;
      if (po.requisitionId) {
        linkedRequisition = requisitions.find((r) => r.id === po.requisitionId) || null;
      }

      const parsedItems: PurchaseOrderItemRecord[] = [];
      const seenMaterialIds = new Set<string>();

      for (let idx = 0; idx < items.length; idx++) {
        const line = items[idx];
        if (!line.materialId) {
          return res.status(400).json({ success: false, message: `Line #${idx + 1}: Material is required` });
        }
        if (seenMaterialIds.has(line.materialId)) {
          return res.status(400).json({ success: false, message: `Line #${idx + 1}: Duplicate material in PO lines` });
        }
        seenMaterialIds.add(line.materialId);

        const material = materials.find((m) => m.id === line.materialId && m.isActive);
        if (!material) {
          return res.status(400).json({ success: false, message: `Line #${idx + 1}: Material '${line.materialId}' invalid or inactive` });
        }

        const orderedQty = parseFloat(line.orderedQuantity);
        if (isNaN(orderedQty) || orderedQty <= 0) {
          return res.status(400).json({ success: false, message: `Line #${idx + 1}: Quantity must be greater than 0` });
        }

        const unitRate = parseFloat(line.unitRate);
        if (isNaN(unitRate) || unitRate < 0) {
          return res.status(400).json({ success: false, message: `Line #${idx + 1}: Unit rate must be non-negative` });
        }

        if (linkedRequisition && line.requisitionItemId) {
          const reqItem = linkedRequisition.items.find((ri) => ri.id === line.requisitionItemId);
          if (reqItem) {
            const alreadyAllocated = getAllocatedQuantityForRequisitionItem(purchaseOrders, reqItem.id, po.id);
            const unallocated = round2(reqItem.requestedQuantity - alreadyAllocated);
            if (orderedQty > unallocated) {
              return res.status(400).json({
                success: false,
                message: `Cannot order ${orderedQty} ${reqItem.unitCode} of '${material.name}'. Remaining unallocated: ${unallocated} ${reqItem.unitCode}.`,
              });
            }
          }
        }

        const lineDiscount = Math.max(0, parseFloat(line.lineDiscount) || 0);
        const taxRate = Math.max(0, parseFloat(line.taxRate) || 0);
        const lineSubtotal = round2(orderedQty * unitRate);
        const taxable = round2(lineSubtotal - lineDiscount);
        const lineTaxAmount = round2(taxable * (taxRate / 100));
        const lineTotal = round2(taxable + lineTaxAmount);

        parsedItems.push({
          id: line.id || `POI-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
          parentPoId: po.id,
          materialId: material.id,
          materialCode: material.itemCode,
          materialName: material.name,
          specification: material.specification,
          unitId: material.baseUnitId,
          unitCode: material.baseUnitName,
          requisitionItemId: line.requisitionItemId || null,
          orderedQuantity: orderedQty,
          receivedQuantity: 0,
          outstandingQuantity: orderedQty,
          unitRate: round2(unitRate),
          lineDiscount: round2(lineDiscount),
          taxRate: round2(taxRate),
          taxAmount: lineTaxAmount,
          lineTotal,
          notes: line.notes ? String(line.notes).trim() : undefined,
        });
      }

      po.items = parsedItems;
    }

    if (freight !== undefined) {
      po.freight = Math.max(0, parseFloat(freight) || 0);
    }

    if (headerDiscount !== undefined) {
      po.headerDiscount = Math.max(0, parseFloat(headerDiscount) || 0);
    }

    // Recompute financials
    po.subtotal = round2(po.items.reduce((acc, it) => acc + round2(it.orderedQuantity * it.unitRate), 0));
    po.itemsDiscount = round2(po.items.reduce((acc, it) => acc + it.lineDiscount, 0));
    po.totalDiscount = round2(po.itemsDiscount + po.headerDiscount);
    po.taxAmount = round2(po.items.reduce((acc, it) => acc + it.taxAmount, 0));
    po.grandTotal = round2(po.subtotal - po.totalDiscount + po.taxAmount + po.freight);

    const nowUtc = new Date().toISOString();
    po.updatedAtUtc = nowUtc;

    po.approvalHistory.push({
      id: `PO-HIS-${crypto.randomBytes(4).toString('hex')}`,
      poId: po.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'User',
      action: 'Updated',
      comments: updateComments ? String(updateComments).trim() : 'Purchase order draft revised.',
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(purchaseOrdersFile, purchaseOrders);

    return res.status(200).json({
      success: true,
      message: `Purchase order ${po.poNumber} updated successfully`,
      data: po,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/purchase-orders/:id/submit
  router.post('/purchase-orders/:id/submit', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;

    const po = purchaseOrders.find((p) => p.id === req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: `Purchase Order '${req.params.id}' was not found` });
    }

    if (po.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit Purchase Order in status '${po.status}'. Only 'Draft' orders can be submitted.`,
      });
    }

    if (!po.items || po.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cannot submit a purchase order with no line items' });
    }

    const { comments } = req.body || {};
    const nowUtc = new Date().toISOString();

    po.status = 'PendingApproval';
    po.updatedAtUtc = nowUtc;

    po.approvalHistory.push({
      id: `PO-HIS-${crypto.randomBytes(4).toString('hex')}`,
      poId: po.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'User',
      action: 'Submitted',
      comments: comments ? String(comments).trim() : 'Submitted for Project Manager review and approval.',
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(purchaseOrdersFile, purchaseOrders);

    return res.status(200).json({
      success: true,
      message: `Purchase Order ${po.poNumber} submitted for approval`,
      data: po,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/purchase-orders/:id/approve
  router.post('/purchase-orders/:id/approve', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;

    const po = purchaseOrders.find((p) => p.id === req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: `Purchase Order '${req.params.id}' was not found` });
    }

    if (!canUserAccessProject(user, po.projectId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have approval authority over this project site',
      });
    }

    // Policy Rule: Prevent Self-Approval (creator cannot approve their own PO unless SuperAdmin)
    if (po.createdByUserId === user.sub && !user.roles.includes('SuperAdmin')) {
      return res.status(403).json({
        success: false,
        message: 'Policy Violation: Requesters / Procurement officers cannot approve their own purchase orders. Requires independent Project Manager or executive approval.',
      });
    }

    if (po.status !== 'PendingApproval') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve Purchase Order in status '${po.status}'. Only 'PendingApproval' orders can be approved.`,
      });
    }

    const { comments } = req.body || {};
    const nowUtc = new Date().toISOString();

    po.status = 'Approved';
    po.approvedByUserId = user.sub;
    po.approvedByName = user.fullName;
    po.approvedAtUtc = nowUtc;
    po.updatedAtUtc = nowUtc;

    po.approvalHistory.push({
      id: `PO-HIS-${crypto.randomBytes(4).toString('hex')}`,
      poId: po.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles.find((r) => ['SuperAdmin', 'ProjectManager', 'InventoryManager'].includes(r)) || user.roles[0],
      action: 'Approved',
      comments: comments ? String(comments).trim() : 'Purchase Order approved for vendor issuance.',
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(purchaseOrdersFile, purchaseOrders);

    return res.status(200).json({
      success: true,
      message: `Purchase Order ${po.poNumber} has been approved`,
      data: po,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/purchase-orders/:id/reject
  router.post('/purchase-orders/:id/reject', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;

    const po = purchaseOrders.find((p) => p.id === req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: `Purchase Order '${req.params.id}' was not found` });
    }

    if (!canUserAccessProject(user, po.projectId)) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have authority over this project site' });
    }

    if (po.status !== 'PendingApproval') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject Purchase Order in '${po.status}' state. Only pending 'PendingApproval' orders can be rejected.`,
      });
    }

    const { reason, comments } = req.body || {};
    const rejectionReason = String(reason || comments || '').trim();

    if (!rejectionReason || rejectionReason.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is mandatory (minimum 3 characters). Please detail why the order was rejected.',
      });
    }

    const nowUtc = new Date().toISOString();
    po.status = 'Rejected';
    po.rejectionReason = rejectionReason;
    po.updatedAtUtc = nowUtc;

    po.approvalHistory.push({
      id: `PO-HIS-${crypto.randomBytes(4).toString('hex')}`,
      poId: po.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles.find((r) => ['SuperAdmin', 'ProjectManager', 'InventoryManager'].includes(r)) || user.roles[0],
      action: 'Rejected',
      comments: rejectionReason,
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(purchaseOrdersFile, purchaseOrders);

    return res.status(200).json({
      success: true,
      message: `Purchase Order ${po.poNumber} has been rejected`,
      data: po,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/purchase-orders/:id/issue
  router.post('/purchase-orders/:id/issue', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;

    const po = purchaseOrders.find((p) => p.id === req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: `Purchase Order '${req.params.id}' was not found` });
    }

    if (!canUserAccessProject(user, po.projectId)) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have access to this project site' });
    }

    if (po.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: `Cannot issue Purchase Order in status '${po.status}'. Only 'Approved' purchase orders can be issued to vendors.`,
      });
    }

    const { comments } = req.body || {};
    const nowUtc = new Date().toISOString();

    po.status = 'Issued';
    po.issuedByUserId = user.sub;
    po.issuedByName = user.fullName;
    po.issuedAtUtc = nowUtc;
    po.updatedAtUtc = nowUtc;

    po.approvalHistory.push({
      id: `PO-HIS-${crypto.randomBytes(4).toString('hex')}`,
      poId: po.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'User',
      action: 'Issued',
      comments: comments ? String(comments).trim() : `Purchase Order formally issued and dispatched to supplier ${po.supplierName}.`,
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(purchaseOrdersFile, purchaseOrders);

    return res.status(200).json({
      success: true,
      message: `Purchase Order ${po.poNumber} has been issued to supplier ${po.supplierName}`,
      data: po,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/purchase-orders/:id/cancel
  router.post('/purchase-orders/:id/cancel', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;

    const po = purchaseOrders.find((p) => p.id === req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: `Purchase Order '${req.params.id}' was not found` });
    }

    if (!canUserAccessProject(user, po.projectId)) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have authority over this project site' });
    }

    if (po.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Purchase Order is already cancelled' });
    }

    if (po.status === 'FullyReceived') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a fully received purchase order' });
    }

    const { reason, comments } = req.body || {};
    const cancellationReason = String(reason || comments || '').trim();

    if (!cancellationReason || cancellationReason.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is mandatory (minimum 3 characters). Please specify why this order is cancelled.',
      });
    }

    const nowUtc = new Date().toISOString();
    po.status = 'Cancelled';
    po.cancellationReason = cancellationReason;
    po.updatedAtUtc = nowUtc;

    po.approvalHistory.push({
      id: `PO-HIS-${crypto.randomBytes(4).toString('hex')}`,
      poId: po.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'User',
      action: 'Cancelled',
      comments: cancellationReason,
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(purchaseOrdersFile, purchaseOrders);

    return res.status(200).json({
      success: true,
      message: `Purchase Order ${po.poNumber} has been cancelled`,
      data: po,
      timestampUtc: nowUtc,
    });
  });

  // GET /api/purchase-orders/:id/history
  router.get('/purchase-orders/:id/history', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;

    const po = purchaseOrders.find((p) => p.id === req.params.id || p.poNumber === req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: `Purchase Order '${req.params.id}' was not found` });
    }

    if (!canUserAccessProject(user, po.projectId)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access denied to this project site' });
    }

    return res.status(200).json({
      success: true,
      data: po.approvalHistory,
      timestampUtc: new Date().toISOString(),
    });
  });

  // ------------------------------------------------------------------------
  // API: QUOTATIONS & RATE COMPARISONS (LIGHTWEIGHT MVP)
  // ------------------------------------------------------------------------

  // GET /api/quotations
  router.get('/quotations', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const quotations = readJsonSafe<QuotationRecord[]>(quotationsFile, []);
    return res.status(200).json({
      success: true,
      data: quotations,
      timestampUtc: new Date().toISOString(),
    });
  });

  // POST /api/quotations
  router.post('/quotations', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const { quotationReference, supplierId, date, validUntil, paymentTerms, items, notes } = req.body || {};
    const suppliers = readJsonSafe<SupplierRecord[]>(suppliersFile, defaultSuppliers);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);
    const quotations = readJsonSafe<QuotationRecord[]>(quotationsFile, []);

    if (!quotationReference || !String(quotationReference).trim()) {
      return res.status(400).json({ success: false, message: 'Quotation reference number is required' });
    }

    const supplier = suppliers.find((s) => s.id === supplierId && s.isActive);
    if (!supplier) {
      return res.status(400).json({ success: false, message: 'Valid active supplier is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Quotation must include at least one material line' });
    }

    const parsedItems = items.map((it: any) => {
      const material = materials.find((m) => m.id === it.materialId);
      const quotedQty = parseFloat(it.quotedQuantity) || 1;
      const rate = parseFloat(it.unitRate) || 0;
      const disc = parseFloat(it.discount) || 0;
      const tax = parseFloat(it.taxRate) || 0;
      const freight = parseFloat(it.estimatedFreight) || 0;
      const taxable = Math.max(0, quotedQty * rate - disc);
      const lineTotal = round2(taxable + taxable * (tax / 100) + freight);

      return {
        materialId: material?.id || it.materialId,
        materialCode: material?.itemCode || it.materialCode || 'MAT',
        materialName: material?.name || it.materialName || 'Material',
        unitCode: material?.baseUnitName || it.unitCode || 'Unit',
        quotedQuantity: quotedQty,
        unitRate: rate,
        discount: disc,
        taxRate: tax,
        estimatedFreight: freight,
        lineTotal,
      };
    });

    const nowUtc = new Date().toISOString();
    const newQuotation: QuotationRecord = {
      id: `QT-${Date.now().toString(36).toUpperCase()}`,
      quotationReference: String(quotationReference).trim(),
      supplierId: supplier.id,
      supplierName: supplier.name,
      date: date ? String(date).substring(0, 10) : nowUtc.substring(0, 10),
      validUntil: validUntil ? String(validUntil).substring(0, 10) : nowUtc.substring(0, 10),
      currency: 'USD',
      paymentTerms: paymentTerms ? String(paymentTerms).trim() : (supplier.paymentTerms || 'Net 30 Days'),
      notes: notes ? String(notes).trim() : undefined,
      items: parsedItems,
      createdAtUtc: nowUtc,
    };

    quotations.push(newQuotation);
    writeJsonAtomic(quotationsFile, quotations);

    return res.status(201).json({
      success: true,
      message: 'Quotation registered successfully',
      data: newQuotation,
      timestampUtc: nowUtc,
    });
  });

  // GET /api/quotations/compare
  router.get('/quotations/compare', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    const quotations = readJsonSafe<QuotationRecord[]>(quotationsFile, []);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);

    // Group comparisons by material
    const materialMap = new Map<string, {
      materialId: string;
      materialCode: string;
      materialName: string;
      unitCode: string;
      quotes: {
        quotationId: string;
        quotationReference: string;
        supplierId: string;
        supplierName: string;
        validUntil: string;
        quotedQuantity: number;
        unitRate: number;
        discount: number;
        taxRate: number;
        estimatedFreight: number;
        lineTotal: number;
        effectiveUnitCost: number;
      }[];
    }>();

    for (const mat of materials) {
      if (!mat.isActive) continue;
      materialMap.set(mat.id, {
        materialId: mat.id,
        materialCode: mat.itemCode,
        materialName: mat.name,
        unitCode: mat.baseUnitName,
        quotes: [],
      });
    }

    for (const qt of quotations) {
      for (const item of qt.items) {
        let entry = materialMap.get(item.materialId);
        if (!entry) {
          entry = {
            materialId: item.materialId,
            materialCode: item.materialCode,
            materialName: item.materialName,
            unitCode: item.unitCode,
            quotes: [],
          };
          materialMap.set(item.materialId, entry);
        }

        const effectiveUnitCost = item.quotedQuantity > 0 ? round2(item.lineTotal / item.quotedQuantity) : item.unitRate;

        entry.quotes.push({
          quotationId: qt.id,
          quotationReference: qt.quotationReference,
          supplierId: qt.supplierId,
          supplierName: qt.supplierName,
          validUntil: qt.validUntil,
          quotedQuantity: item.quotedQuantity,
          unitRate: item.unitRate,
          discount: item.discount,
          taxRate: item.taxRate,
          estimatedFreight: item.estimatedFreight,
          lineTotal: item.lineTotal,
          effectiveUnitCost,
        });
      }
    }

    // Filter to materials that actually have at least 1 quote and sort quotes lowest effective cost first
    const comparisonResults = Array.from(materialMap.values())
      .filter((m) => m.quotes.length > 0)
      .map((m) => {
        m.quotes.sort((a, b) => a.effectiveUnitCost - b.effectiveUnitCost);
        return {
          ...m,
          lowestRateSupplier: m.quotes[0]?.supplierName || 'N/A',
          lowestEffectiveRate: m.quotes[0]?.effectiveUnitCost || 0,
        };
      });

    return res.status(200).json({
      success: true,
      data: comparisonResults,
      timestampUtc: new Date().toISOString(),
    });
  });

  // ------------------------------------------------------------------------
  // API: GOODS RECEIVED NOTES (GRN) & RECEIPT CONTROL
  // ------------------------------------------------------------------------

  // GET /api/grns (List GRNs with filters & pagination)
  router.get('/grns', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const {
      search,
      purchaseOrderId,
      supplierId,
      warehouseId,
      projectId,
      status,
      startDate,
      endDate,
      page,
      pageSize,
    } = req.query;

    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const user = req.user!;

    let filtered = grns.filter((g) => canUserAccessProject(user, g.projectId));

    if (purchaseOrderId && typeof purchaseOrderId === 'string' && purchaseOrderId !== 'ALL') {
      filtered = filtered.filter((g) => g.purchaseOrderId === purchaseOrderId || g.purchaseOrderNumber === purchaseOrderId);
    }

    if (supplierId && typeof supplierId === 'string' && supplierId !== 'ALL') {
      filtered = filtered.filter((g) => g.supplierId === supplierId);
    }

    if (warehouseId && typeof warehouseId === 'string' && warehouseId !== 'ALL') {
      filtered = filtered.filter((g) => g.warehouseId === warehouseId);
    }

    if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
      filtered = filtered.filter((g) => g.projectId === projectId);
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      filtered = filtered.filter((g) => g.status === status);
    }

    if (startDate && typeof startDate === 'string') {
      filtered = filtered.filter((g) => g.grnDate >= startDate);
    }

    if (endDate && typeof endDate === 'string') {
      filtered = filtered.filter((g) => g.grnDate <= endDate);
    }

    if (search && typeof search === 'string') {
      const term = search.trim().toUpperCase();
      filtered = filtered.filter(
        (g) =>
          g.grnNumber.toUpperCase().includes(term) ||
          g.purchaseOrderNumber.toUpperCase().includes(term) ||
          g.supplierName.toUpperCase().includes(term) ||
          g.deliveryChallanNumber.toUpperCase().includes(term) ||
          g.vehicleNumber.toUpperCase().includes(term) ||
          g.items.some(
            (i) => i.materialName.toUpperCase().includes(term) || i.materialCode.toUpperCase().includes(term)
          )
      );
    }

    filtered.sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());

    const pageIndex = Math.max(1, parseInt(page as string, 10) || 1);
    const size = Math.max(1, parseInt(pageSize as string, 10) || 20);
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / size);
    const paged = filtered.slice((pageIndex - 1) * size, pageIndex * size);

    const metrics = {
      totalCount,
      draftCount: filtered.filter((g) => g.status === 'Draft').length,
      pendingInspectionCount: filtered.filter((g) => g.status === 'SubmittedForInspection').length,
      inspectedCount: filtered.filter((g) => g.status === 'Inspected').length,
      approvedCount: filtered.filter((g) => g.status === 'Approved').length,
      postedCount: filtered.filter((g) => g.status === 'Posted').length,
      totalAcceptedValue: round2(
        filtered
          .filter((g) => g.status !== 'Cancelled' && g.status !== 'Rejected')
          .reduce((sum, g) => sum + (g.totalAcceptedValue || 0), 0)
      ),
    };

    return res.status(200).json({
      success: true,
      data: {
        items: paged,
        pageIndex,
        pageSize: size,
        totalCount,
        totalPages,
        metrics,
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/grns/:id (Retrieve single GRN)
  router.get('/grns/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const user = req.user!;

    const grn = grns.find((g) => g.id === req.params.id || g.grnNumber === req.params.id);
    if (!grn) {
      return res.status(404).json({
        success: false,
        message: `Goods Received Note '${req.params.id}' was not found`,
        timestampUtc: new Date().toISOString(),
      });
    }

    if (!canUserAccessProject(user, grn.projectId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have access to goods receipts for this project site',
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: grn,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/grns/:id/history (Audit Trail)
  router.get('/grns/:id/history', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const user = req.user!;

    const grn = grns.find((g) => g.id === req.params.id || g.grnNumber === req.params.id);
    if (!grn) {
      return res.status(404).json({
        success: false,
        message: `Goods Received Note '${req.params.id}' was not found`,
        timestampUtc: new Date().toISOString(),
      });
    }

    if (!canUserAccessProject(user, grn.projectId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have access to this project site',
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: grn.auditTrail,
      timestampUtc: new Date().toISOString(),
    });
  });

  // POST /api/grns (Create Draft GRN against issued PO)
  router.post('/grns', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;

    const {
      purchaseOrderId,
      warehouseId,
      warehouseName,
      storageLocation,
      deliveryChallanNumber,
      deliveryChallanDate,
      vehicleNumber,
      deliveredBy,
      grnDate,
      generalRemarks,
      items,
      inspectionChecklist,
    } = req.body || {};

    if (!purchaseOrderId || !String(purchaseOrderId).trim()) {
      return res.status(400).json({ success: false, message: 'Purchase Order ID is required' });
    }

    const po = purchaseOrders.find((p) => p.id === purchaseOrderId || p.poNumber === purchaseOrderId);
    if (!po) {
      return res.status(404).json({
        success: false,
        message: `Purchase Order '${purchaseOrderId}' was not found`,
      });
    }

    if (!canUserAccessProject(user, po.projectId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have authority to receive goods for this project site',
      });
    }

    if (po.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot create a Goods Received Note against a cancelled Purchase Order',
      });
    }

    if (po.status === 'FullyReceived') {
      return res.status(400).json({
        success: false,
        message: 'Cannot create a Goods Received Note against a fully received Purchase Order. All items have been received.',
      });
    }

    if (po.status !== 'Issued' && po.status !== 'PartiallyReceived') {
      return res.status(400).json({
        success: false,
        message: `Cannot receive goods against Purchase Order in status '${po.status}'. The order must be 'Issued' or 'PartiallyReceived'.`,
      });
    }

    if (!deliveryChallanNumber || !String(deliveryChallanNumber).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Supplier delivery challan / waybill number is mandatory for audit verification',
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one line item must be included in the Goods Received Note',
      });
    }

    // Process line items against PO items
    const processedItems: GoodsReceivedItemRecord[] = [];
    let totalDelivered = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalDamaged = 0;
    let totalShort = 0;
    let totalValue = 0;

    for (const rawItem of items) {
      const poItem = po.items.find(
        (pi) => pi.id === rawItem.purchaseOrderItemId || pi.materialId === rawItem.materialId
      );

      if (!poItem) {
        return res.status(400).json({
          success: false,
          message: `Line item does not match any valid purchase order line in ${po.poNumber}`,
        });
      }

      const delivered = Math.max(0, parseFloat(rawItem.deliveredQuantity) || 0);
      const accepted = rawItem.acceptedQuantity !== undefined
        ? Math.max(0, parseFloat(rawItem.acceptedQuantity) || 0)
        : delivered;
      const rejected = Math.max(0, parseFloat(rawItem.rejectedQuantity) || 0);
      const damaged = Math.max(0, parseFloat(rawItem.damagedQuantity) || 0);
      const short = Math.max(0, parseFloat(rawItem.shortQuantity) || 0);

      // Invariant: delivered = accepted + rejected
      if (Math.abs(delivered - (accepted + rejected)) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Validation Error on item ${poItem.materialCode}: Delivered quantity (${delivered}) must exactly equal accepted (${accepted}) plus rejected (${rejected}).`,
        });
      }

      // Over-receipt prevention policy
      const remainingOutstanding = poItem.outstandingQuantity;
      if (accepted > remainingOutstanding) {
        return res.status(400).json({
          success: false,
          message: `Over-Receipt Violation: Accepted quantity (${accepted}) exceeds purchase order outstanding balance (${remainingOutstanding}) for material '${poItem.materialName}' (${poItem.materialCode}).`,
        });
      }

      const unitPrice = poItem.unitRate;
      const totalAcceptedAmount = round2(accepted * unitPrice);

      totalDelivered = round2(totalDelivered + delivered);
      totalAccepted = round2(totalAccepted + accepted);
      totalRejected = round2(totalRejected + rejected);
      totalDamaged = round2(totalDamaged + damaged);
      totalShort = round2(totalShort + short);
      totalValue = round2(totalValue + totalAcceptedAmount);

      processedItems.push({
        id: `GRI-${crypto.randomBytes(4).toString('hex')}`,
        purchaseOrderItemId: poItem.id,
        materialId: poItem.materialId,
        materialCode: poItem.materialCode,
        materialName: poItem.materialName,
        specification: poItem.specification,
        unitId: poItem.unitId,
        unitCode: poItem.unitCode,
        orderedQuantity: poItem.orderedQuantity,
        previouslyReceivedQuantity: poItem.receivedQuantity,
        poOutstandingQuantity: remainingOutstanding,
        deliveredQuantity: delivered,
        acceptedQuantity: accepted,
        rejectedQuantity: rejected,
        damagedQuantity: damaged,
        shortQuantity: short,
        remarks: rawItem.remarks ? String(rawItem.remarks).trim() : undefined,
        storageLocation: rawItem.storageLocation
          ? String(rawItem.storageLocation).trim()
          : (storageLocation ? String(storageLocation).trim() : po.deliveryLocation || 'Bay 1 Staging Yard'),
        unitPrice,
        totalAcceptedAmount,
      });
    }

    // Auto-generate sequential GRN number: GRN-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const yearPrefix = `GRN-${currentYear}-`;
    const yearGrns = grns.filter((g) => g.grnNumber && g.grnNumber.startsWith(yearPrefix));
    let nextSeq = 1;
    if (yearGrns.length > 0) {
      const seqs = yearGrns.map((g) => {
        const numPart = g.grnNumber.substring(yearPrefix.length);
        const parsed = parseInt(numPart, 10);
        return isNaN(parsed) ? 0 : parsed;
      });
      nextSeq = Math.max(...seqs) + 1;
    }
    const grnNumber = `${yearPrefix}${nextSeq.toString().padStart(4, '0')}`;

    const nowUtc = new Date().toISOString();
    const effectiveWarehouseId = warehouseId || (user.warehouseScopes[0] || 'WH-01');
    const effectiveWarehouseName = warehouseName || 'Metro Central Staging Yard';

    const defaultChecklist: InspectionChecklist = {
      challanMatchesPO: inspectionChecklist?.challanMatchesPO ?? true,
      vehicleUnloadedSafely: inspectionChecklist?.vehicleUnloadedSafely ?? true,
      physicallyCounted: inspectionChecklist?.physicallyCounted ?? true,
      packagingIntact: inspectionChecklist?.packagingIntact ?? true,
      batchTestCertsProvided: inspectionChecklist?.batchTestCertsProvided ?? false,
      testCertificateNumber: inspectionChecklist?.testCertificateNumber ? String(inspectionChecklist.testCertificateNumber).trim() : undefined,
      materialsMeetSpecs: inspectionChecklist?.materialsMeetSpecs ?? true,
      binTagsAttached: inspectionChecklist?.binTagsAttached ?? true,
      inspectionRemarks: inspectionChecklist?.inspectionRemarks ? String(inspectionChecklist.inspectionRemarks).trim() : '',
      discrepancyIdentified: inspectionChecklist?.discrepancyIdentified ?? (totalRejected > 0 || totalDamaged > 0 || totalShort > 0),
      debitNoteRequired: inspectionChecklist?.debitNoteRequired ?? false,
      debitNoteReason: inspectionChecklist?.debitNoteReason ? String(inspectionChecklist.debitNoteReason).trim() : undefined,
    };

    const newGrn: GoodsReceivedNoteRecord = {
      id: `GRN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`,
      grnNumber,
      purchaseOrderId: po.id,
      purchaseOrderNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierCode: po.supplierCode,
      supplierName: po.supplierName,
      projectId: po.projectId,
      projectName: po.projectName,
      warehouseId: effectiveWarehouseId,
      warehouseName: effectiveWarehouseName,
      storageLocation: storageLocation ? String(storageLocation).trim() : po.deliveryLocation,
      grnDate: grnDate ? String(grnDate).trim() : nowUtc.substring(0, 10),
      receivedAtUtc: nowUtc,
      deliveryChallanNumber: String(deliveryChallanNumber).trim(),
      deliveryChallanDate: deliveryChallanDate ? String(deliveryChallanDate).trim() : nowUtc.substring(0, 10),
      vehicleNumber: vehicleNumber ? String(vehicleNumber).trim() : 'N/A',
      deliveredBy: deliveredBy ? String(deliveredBy).trim() : 'Carrier Representative',
      status: 'Draft',
      inspectionChecklist: defaultChecklist,
      items: processedItems,
      totalDeliveredQuantity: totalDelivered,
      totalAcceptedQuantity: totalAccepted,
      totalRejectedQuantity: totalRejected,
      totalDamagedQuantity: totalDamaged,
      totalShortQuantity: totalShort,
      totalAcceptedValue: totalValue,
      generalRemarks: generalRemarks ? String(generalRemarks).trim() : undefined,
      auditTrail: [
        {
          id: `GA-${crypto.randomBytes(4).toString('hex')}`,
          grnId: '',
          actorUserId: user.sub,
          actorName: user.fullName,
          actorRole: user.roles[0] || 'Storekeeper',
          action: 'DraftCreated',
          comments: `Goods Received Note draft created against ${po.poNumber}. Delivery Challan: ${deliveryChallanNumber}.`,
          timestampUtc: nowUtc,
        },
      ],
      receivedByUserId: user.sub,
      receivedByName: user.fullName,
      createdAtUtc: nowUtc,
      updatedAtUtc: nowUtc,
    };

    newGrn.auditTrail[0].grnId = newGrn.id;
    grns.unshift(newGrn);
    writeJsonAtomic(grnsFile, grns);

    return res.status(201).json({
      success: true,
      message: `Goods Received Note ${newGrn.grnNumber} created in Draft status`,
      data: newGrn,
      timestampUtc: nowUtc,
    });
  });

  // PUT /api/grns/:id (Update Draft or Returned GRN)
  router.put('/grns/:id', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;

    const grn = grns.find((g) => g.id === req.params.id);
    if (!grn) {
      return res.status(404).json({ success: false, message: `Goods Received Note '${req.params.id}' was not found` });
    }

    if (grn.status !== 'Draft' && grn.status !== 'ReturnedForCorrection') {
      return res.status(400).json({
        success: false,
        message: `Cannot edit Goods Received Note in status '${grn.status}'. Only 'Draft' or 'ReturnedForCorrection' can be modified.`,
      });
    }

    const po = purchaseOrders.find((p) => p.id === grn.purchaseOrderId);
    if (!po) {
      return res.status(400).json({ success: false, message: 'Associated Purchase Order not found' });
    }

    const {
      warehouseId,
      warehouseName,
      storageLocation,
      deliveryChallanNumber,
      deliveryChallanDate,
      vehicleNumber,
      deliveredBy,
      grnDate,
      generalRemarks,
      items,
      inspectionChecklist,
    } = req.body || {};

    if (deliveryChallanNumber) grn.deliveryChallanNumber = String(deliveryChallanNumber).trim();
    if (deliveryChallanDate) grn.deliveryChallanDate = String(deliveryChallanDate).trim();
    if (vehicleNumber) grn.vehicleNumber = String(vehicleNumber).trim();
    if (deliveredBy) grn.deliveredBy = String(deliveredBy).trim();
    if (warehouseId) grn.warehouseId = String(warehouseId).trim();
    if (warehouseName) grn.warehouseName = String(warehouseName).trim();
    if (storageLocation) grn.storageLocation = String(storageLocation).trim();
    if (grnDate) grn.grnDate = String(grnDate).trim();
    if (generalRemarks !== undefined) grn.generalRemarks = generalRemarks ? String(generalRemarks).trim() : undefined;

    if (items && Array.isArray(items) && items.length > 0) {
      const updatedItems: GoodsReceivedItemRecord[] = [];
      let totalDelivered = 0;
      let totalAccepted = 0;
      let totalRejected = 0;
      let totalDamaged = 0;
      let totalShort = 0;
      let totalValue = 0;

      for (const rawItem of items) {
        const poItem = po.items.find(
          (pi) => pi.id === rawItem.purchaseOrderItemId || pi.materialId === rawItem.materialId
        );
        if (!poItem) continue;

        const delivered = Math.max(0, parseFloat(rawItem.deliveredQuantity) || 0);
        const accepted = rawItem.acceptedQuantity !== undefined
          ? Math.max(0, parseFloat(rawItem.acceptedQuantity) || 0)
          : delivered;
        const rejected = Math.max(0, parseFloat(rawItem.rejectedQuantity) || 0);
        const damaged = Math.max(0, parseFloat(rawItem.damagedQuantity) || 0);
        const short = Math.max(0, parseFloat(rawItem.shortQuantity) || 0);

        if (Math.abs(delivered - (accepted + rejected)) > 0.01) {
          return res.status(400).json({
            success: false,
            message: `Validation Error on item ${poItem.materialCode}: Delivered quantity (${delivered}) must equal accepted (${accepted}) + rejected (${rejected}).`,
          });
        }

        if (accepted > poItem.outstandingQuantity) {
          return res.status(400).json({
            success: false,
            message: `Over-Receipt Violation: Accepted quantity (${accepted}) exceeds PO outstanding balance (${poItem.outstandingQuantity}) for '${poItem.materialName}'.`,
          });
        }

        const unitPrice = poItem.unitRate;
        const totalAcceptedAmount = round2(accepted * unitPrice);

        totalDelivered = round2(totalDelivered + delivered);
        totalAccepted = round2(totalAccepted + accepted);
        totalRejected = round2(totalRejected + rejected);
        totalDamaged = round2(totalDamaged + damaged);
        totalShort = round2(totalShort + short);
        totalValue = round2(totalValue + totalAcceptedAmount);

        updatedItems.push({
          id: rawItem.id || `GRI-${crypto.randomBytes(4).toString('hex')}`,
          purchaseOrderItemId: poItem.id,
          materialId: poItem.materialId,
          materialCode: poItem.materialCode,
          materialName: poItem.materialName,
          specification: poItem.specification,
          unitId: poItem.unitId,
          unitCode: poItem.unitCode,
          orderedQuantity: poItem.orderedQuantity,
          previouslyReceivedQuantity: poItem.receivedQuantity,
          poOutstandingQuantity: poItem.outstandingQuantity,
          deliveredQuantity: delivered,
          acceptedQuantity: accepted,
          rejectedQuantity: rejected,
          damagedQuantity: damaged,
          shortQuantity: short,
          remarks: rawItem.remarks ? String(rawItem.remarks).trim() : undefined,
          storageLocation: rawItem.storageLocation ? String(rawItem.storageLocation).trim() : grn.storageLocation,
          unitPrice,
          totalAcceptedAmount,
        });
      }

      grn.items = updatedItems;
      grn.totalDeliveredQuantity = totalDelivered;
      grn.totalAcceptedQuantity = totalAccepted;
      grn.totalRejectedQuantity = totalRejected;
      grn.totalDamagedQuantity = totalDamaged;
      grn.totalShortQuantity = totalShort;
      grn.totalAcceptedValue = totalValue;
    }

    if (inspectionChecklist) {
      grn.inspectionChecklist = {
        ...grn.inspectionChecklist,
        ...inspectionChecklist,
      };
    }

    const nowUtc = new Date().toISOString();
    grn.updatedAtUtc = nowUtc;
    grn.auditTrail.push({
      id: `GA-${crypto.randomBytes(4).toString('hex')}`,
      grnId: grn.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'User',
      action: 'Updated',
      comments: 'Goods Received Note draft updated.',
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(grnsFile, grns);

    return res.status(200).json({
      success: true,
      message: `Goods Received Note ${grn.grnNumber} updated successfully`,
      data: grn,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/grns/:id/submit (Draft -> SubmittedForInspection)
  router.post('/grns/:id/submit', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const user = req.user!;

    const grn = grns.find((g) => g.id === req.params.id);
    if (!grn) {
      return res.status(404).json({ success: false, message: `Goods Received Note '${req.params.id}' was not found` });
    }

    if (grn.status !== 'Draft' && grn.status !== 'ReturnedForCorrection') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit GRN in status '${grn.status}'. Only 'Draft' or 'ReturnedForCorrection' can be submitted for inspection.`,
      });
    }

    if (!grn.deliveryChallanNumber || !grn.deliveryChallanNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Delivery challan number is mandatory for inspection submission' });
    }

    if (grn.items.length === 0 || grn.totalDeliveredQuantity <= 0) {
      return res.status(400).json({ success: false, message: 'Cannot submit a GRN with zero delivered physical items' });
    }

    const { comments } = req.body || {};
    const nowUtc = new Date().toISOString();

    grn.status = 'SubmittedForInspection';
    grn.updatedAtUtc = nowUtc;

    grn.auditTrail.push({
      id: `GA-${crypto.randomBytes(4).toString('hex')}`,
      grnId: grn.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: 'SubmittedForInspection',
      comments: comments ? String(comments).trim() : 'Physical delivery submitted for quality inspection.',
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(grnsFile, grns);

    return res.status(200).json({
      success: true,
      message: `Goods Received Note ${grn.grnNumber} submitted for QA inspection`,
      data: grn,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/grns/:id/inspect (Record SCM-F-01 QA Inspection & Quantities)
  router.post('/grns/:id/inspect', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProcurementOfficer']), (req: AuthenticatedRequest, res: Response) => {
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const user = req.user!;

    const grn = grns.find((g) => g.id === req.params.id);
    if (!grn) {
      return res.status(404).json({ success: false, message: `Goods Received Note '${req.params.id}' was not found` });
    }

    if (grn.status !== 'SubmittedForInspection' && grn.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot record inspection on GRN in status '${grn.status}'. Only 'SubmittedForInspection' or 'Draft' can be inspected.`,
      });
    }

    const po = purchaseOrders.find((p) => p.id === grn.purchaseOrderId);
    if (!po) {
      return res.status(400).json({ success: false, message: 'Associated Purchase Order not found' });
    }

    const { checklist, items, comments } = req.body || {};

    if (checklist) {
      if (checklist.debitNoteRequired && (!checklist.debitNoteReason || !String(checklist.debitNoteReason).trim())) {
        return res.status(400).json({
          success: false,
          message: 'Debit note reason is mandatory when debit note recommendation is flagged',
        });
      }

      grn.inspectionChecklist = {
        ...grn.inspectionChecklist,
        ...checklist,
      };
    }

    if (items && Array.isArray(items) && items.length > 0) {
      let totalDelivered = 0;
      let totalAccepted = 0;
      let totalRejected = 0;
      let totalDamaged = 0;
      let totalShort = 0;
      let totalValue = 0;

      for (const updatedItem of items) {
        const existing = grn.items.find(
          (gi) => gi.id === updatedItem.id || gi.purchaseOrderItemId === updatedItem.purchaseOrderItemId
        );
        const poItem = po.items.find((pi) => pi.id === (existing?.purchaseOrderItemId || updatedItem.purchaseOrderItemId));

        if (!existing || !poItem) continue;

        const delivered = Math.max(0, parseFloat(updatedItem.deliveredQuantity ?? existing.deliveredQuantity) || 0);
        const accepted = Math.max(0, parseFloat(updatedItem.acceptedQuantity ?? existing.acceptedQuantity) || 0);
        const rejected = Math.max(0, parseFloat(updatedItem.rejectedQuantity ?? existing.rejectedQuantity) || 0);
        const damaged = Math.max(0, parseFloat(updatedItem.damagedQuantity ?? existing.damagedQuantity) || 0);
        const short = Math.max(0, parseFloat(updatedItem.shortQuantity ?? existing.shortQuantity) || 0);

        if (Math.abs(delivered - (accepted + rejected)) > 0.01) {
          return res.status(400).json({
            success: false,
            message: `Delivered quantity (${delivered}) must equal accepted (${accepted}) + rejected (${rejected}) for item ${poItem.materialCode}`,
          });
        }

        if (accepted > poItem.outstandingQuantity) {
          return res.status(400).json({
            success: false,
            message: `Over-Receipt Violation: Accepted quantity (${accepted}) exceeds PO outstanding balance (${poItem.outstandingQuantity}) for '${poItem.materialName}'.`,
          });
        }

        existing.deliveredQuantity = delivered;
        existing.acceptedQuantity = accepted;
        existing.rejectedQuantity = rejected;
        existing.damagedQuantity = damaged;
        existing.shortQuantity = short;
        if (updatedItem.storageLocation) existing.storageLocation = String(updatedItem.storageLocation).trim();
        if (updatedItem.remarks !== undefined) existing.remarks = updatedItem.remarks ? String(updatedItem.remarks).trim() : undefined;
        existing.totalAcceptedAmount = round2(accepted * existing.unitPrice);

        totalDelivered = round2(totalDelivered + delivered);
        totalAccepted = round2(totalAccepted + accepted);
        totalRejected = round2(totalRejected + rejected);
        totalDamaged = round2(totalDamaged + damaged);
        totalShort = round2(totalShort + short);
        totalValue = round2(totalValue + existing.totalAcceptedAmount);
      }

      grn.totalDeliveredQuantity = totalDelivered;
      grn.totalAcceptedQuantity = totalAccepted;
      grn.totalRejectedQuantity = totalRejected;
      grn.totalDamagedQuantity = totalDamaged;
      grn.totalShortQuantity = totalShort;
      grn.totalAcceptedValue = totalValue;

      // Auto-flag discrepancy if rejected/damaged/short exists
      if (totalRejected > 0 || totalDamaged > 0 || totalShort > 0) {
        grn.inspectionChecklist.discrepancyIdentified = true;
      }
    }

    const nowUtc = new Date().toISOString();
    grn.status = 'Inspected';
    grn.inspectedByUserId = user.sub;
    grn.inspectedByName = user.fullName;
    grn.inspectedAtUtc = nowUtc;
    grn.updatedAtUtc = nowUtc;

    grn.auditTrail.push({
      id: `GA-${crypto.randomBytes(4).toString('hex')}`,
      grnId: grn.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'QualityInspector',
      action: 'Inspected',
      comments: comments ? String(comments).trim() : `QA Inspection completed per SOP SCM-F-01. Accepted: ${grn.totalAcceptedQuantity}, Rejected: ${grn.totalRejectedQuantity}.`,
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(grnsFile, grns);

    return res.status(200).json({
      success: true,
      message: `Goods Received Note ${grn.grnNumber} QA inspection recorded`,
      data: grn,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/grns/:id/approve (Supervisory Dual-Control Approval)
  router.post('/grns/:id/approve', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const user = req.user!;

    const grn = grns.find((g) => g.id === req.params.id);
    if (!grn) {
      return res.status(404).json({ success: false, message: `Goods Received Note '${req.params.id}' was not found` });
    }

    if (!canUserAccessProject(user, grn.projectId)) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have approval authority over this project site' });
    }

    // Policy Rule: Dual-Control Approval (Receiver cannot approve their own GRN unless SuperAdmin)
    if (grn.receivedByUserId === user.sub && !user.roles.includes('SuperAdmin')) {
      return res.status(403).json({
        success: false,
        message: 'Dual-control policy violation: The receiving clerk who created this GRN cannot approve it. Requires independent store supervisor or manager approval.',
      });
    }

    if (grn.status !== 'Inspected') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve GRN in status '${grn.status}'. Only inspected GRNs ('Inspected') can be approved.`,
      });
    }

    const { comments } = req.body || {};
    const nowUtc = new Date().toISOString();

    grn.status = 'Approved';
    grn.approvedByUserId = user.sub;
    grn.approvedByName = user.fullName;
    grn.approvedAtUtc = nowUtc;
    grn.updatedAtUtc = nowUtc;

    grn.auditTrail.push({
      id: `GA-${crypto.randomBytes(4).toString('hex')}`,
      grnId: grn.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles.find((r) => ['SuperAdmin', 'ProjectManager', 'InventoryManager'].includes(r)) || user.roles[0],
      action: 'Approved',
      comments: comments ? String(comments).trim() : 'Goods Received Note approved for inventory ledger posting.',
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(grnsFile, grns);

    return res.status(200).json({
      success: true,
      message: `Goods Received Note ${grn.grnNumber} approved successfully`,
      data: grn,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/grns/:id/reject (Rejection with justification)
  router.post('/grns/:id/reject', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const user = req.user!;

    const grn = grns.find((g) => g.id === req.params.id);
    if (!grn) {
      return res.status(404).json({ success: false, message: `Goods Received Note '${req.params.id}' was not found` });
    }

    if (grn.status !== 'SubmittedForInspection' && grn.status !== 'Inspected') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject GRN in status '${grn.status}'. Only 'SubmittedForInspection' or 'Inspected' can be rejected.`,
      });
    }

    const { reason, comments } = req.body || {};
    const rejectionReason = String(reason || comments || '').trim();

    if (!rejectionReason || rejectionReason.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is mandatory (minimum 3 characters). Please detail why the delivery intake is rejected.',
      });
    }

    const nowUtc = new Date().toISOString();
    grn.status = 'Rejected';
    grn.rejectionReason = rejectionReason;
    grn.updatedAtUtc = nowUtc;

    grn.auditTrail.push({
      id: `GA-${crypto.randomBytes(4).toString('hex')}`,
      grnId: grn.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'User',
      action: 'Rejected',
      comments: rejectionReason,
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(grnsFile, grns);

    return res.status(200).json({
      success: true,
      message: `Goods Received Note ${grn.grnNumber} has been rejected`,
      data: grn,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/grns/:id/return-for-correction
  router.post('/grns/:id/return-for-correction', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const user = req.user!;

    const grn = grns.find((g) => g.id === req.params.id);
    if (!grn) {
      return res.status(404).json({ success: false, message: `Goods Received Note '${req.params.id}' was not found` });
    }

    if (grn.status !== 'SubmittedForInspection' && grn.status !== 'Inspected') {
      return res.status(400).json({
        success: false,
        message: `Cannot return GRN in status '${grn.status}'. Only 'SubmittedForInspection' or 'Inspected' can be returned for correction.`,
      });
    }

    const { notes, comments, correctionNotes } = req.body || {};
    const feedback = String(notes || comments || correctionNotes || '').trim();

    if (!feedback || feedback.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Correction notes are mandatory. Detail what needs to be revised by the receiving clerk.',
      });
    }

    const nowUtc = new Date().toISOString();
    grn.status = 'ReturnedForCorrection';
    grn.correctionNotes = feedback;
    grn.updatedAtUtc = nowUtc;

    grn.auditTrail.push({
      id: `GA-${crypto.randomBytes(4).toString('hex')}`,
      grnId: grn.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'User',
      action: 'ReturnedForCorrection',
      comments: feedback,
      timestampUtc: nowUtc,
    });

    writeJsonAtomic(grnsFile, grns);

    return res.status(200).json({
      success: true,
      message: `Goods Received Note ${grn.grnNumber} returned for correction`,
      data: grn,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/grns/:id/post (Post to Receipt Ledger & Update Purchase Order)
  router.post('/api/grns/:id/post', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper']), (req: AuthenticatedRequest, res: Response) => {
    // Also handled by standard mount
  });

  router.post('/grns/:id/post', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper']), (req: AuthenticatedRequest, res: Response) => {
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const receiptLedger = readJsonSafe<ReceiptLedgerRecord[]>(receiptLedgerFile, []);
    const stockLedger = readJsonSafe<StockLedgerRecord[]>(stockLedgerFile, []);
    const inventoryBalances = readJsonSafe<InventoryBalanceRecord[]>(inventoryBalancesFile, []);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, []);
    const projects = readJsonSafe<ProjectRecord[]>(projectsFile, defaultProjects);
    const user = req.user!;

    const grn = grns.find((g) => g.id === req.params.id);
    if (!grn) {
      return res.status(404).json({ success: false, message: `Goods Received Note '${req.params.id}' was not found` });
    }

    if (grn.status === 'Posted') {
      return res.status(400).json({
        success: false,
        message: `Goods Received Note ${grn.grnNumber} is already posted. Posting is an idempotent terminal action.`,
      });
    }

    if (grn.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: `Cannot post GRN in status '${grn.status}'. Only 'Approved' GRNs can be posted to the receipt ledger.`,
      });
    }

    const po = purchaseOrders.find((p) => p.id === grn.purchaseOrderId);
    if (!po) {
      return res.status(400).json({ success: false, message: 'Associated Purchase Order was not found' });
    }

    const nowUtc = new Date().toISOString();

    // Verify no line exceeds outstanding balance before applying changes
    for (const grnItem of grn.items) {
      const poItem = po.items.find((pi) => pi.id === grnItem.purchaseOrderItemId);
      if (!poItem) {
        return res.status(400).json({
          success: false,
          message: `PO line item not found for material '${grnItem.materialCode}'`,
        });
      }
      if (grnItem.acceptedQuantity > poItem.outstandingQuantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot post: Accepted quantity (${grnItem.acceptedQuantity}) exceeds available PO balance (${poItem.outstandingQuantity}) for material '${poItem.materialName}'.`,
        });
      }
    }

    // Cost Validation: Reject or hold posting if any accepted line lacks a positive unit rate
    for (const grnItem of grn.items) {
      if (grnItem.acceptedQuantity > 0) {
        if (!grnItem.unitPrice || grnItem.unitPrice <= 0 || isNaN(grnItem.unitPrice)) {
          return res.status(400).json({
            success: false,
            message: `Cannot value inventory posting: Material '${grnItem.materialCode}' (${grnItem.materialName}) has non-positive or invalid unit cost (${grnItem.unitPrice}). Posting is held safely to prevent corrupting inventory valuation.`,
          });
        }
      }
    }

    // Apply updates to PO items & build receipt ledger records
    for (const grnItem of grn.items) {
      const poItem = po.items.find((pi) => pi.id === grnItem.purchaseOrderItemId)!;

      poItem.receivedQuantity = round2(poItem.receivedQuantity + grnItem.acceptedQuantity);
      poItem.outstandingQuantity = round2(Math.max(0, poItem.orderedQuantity - poItem.receivedQuantity));

      // Append to receipt ledger if acceptedQuantity > 0
      if (grnItem.acceptedQuantity > 0) {
        const ledgerEntry: ReceiptLedgerRecord = {
          id: `RCPT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`,
          grnId: grn.id,
          grnNumber: grn.grnNumber,
          purchaseOrderId: po.id,
          purchaseOrderNumber: po.poNumber,
          supplierId: grn.supplierId,
          supplierName: grn.supplierName,
          projectId: grn.projectId,
          warehouseId: grn.warehouseId,
          materialId: grnItem.materialId,
          materialCode: grnItem.materialCode,
          materialName: grnItem.materialName,
          unitCode: grnItem.unitCode,
          acceptedQuantity: grnItem.acceptedQuantity,
          unitPrice: grnItem.unitPrice,
          totalAmount: grnItem.totalAcceptedAmount,
          storageLocation: grnItem.storageLocation || grn.storageLocation,
          deliveryChallanNumber: grn.deliveryChallanNumber,
          postedAtUtc: nowUtc,
          postedByUserId: user.sub,
          postedByName: user.fullName,
          reconciledWithInventoryLedger: true,
        };
        receiptLedger.unshift(ledgerEntry);
      }
    }

    // Execute Authoritative Stock Ledger & Moving WAC Balance Update
    const postingResult = postGrnToInventoryLedger(
      grn,
      po,
      user,
      nowUtc,
      stockLedger,
      inventoryBalances,
      materials,
      projects
    );

    if (!postingResult.success) {
      return res.status(400).json({
        success: false,
        message: postingResult.error || 'Inventory posting failed.',
      });
    }

    // Re-evaluate PO overall status
    const allLinesFulfilled = po.items.every((pi) => pi.receivedQuantity >= pi.orderedQuantity);
    const anyReceived = po.items.some((pi) => pi.receivedQuantity > 0);

    const previousPoStatus = po.status;
    if (allLinesFulfilled) {
      po.status = 'FullyReceived';
    } else if (anyReceived) {
      po.status = 'PartiallyReceived';
    }

    // Also update PO header level received/outstanding fields if present
    po.receivedQuantity = round2(po.items.reduce((s, i) => s + i.receivedQuantity, 0));
    po.outstandingQuantity = round2(po.items.reduce((s, i) => s + i.outstandingQuantity, 0));
    po.updatedAtUtc = nowUtc;

    po.approvalHistory.push({
      id: `PO-HIS-${crypto.randomBytes(4).toString('hex')}`,
      poId: po.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: (po.status === 'FullyReceived' ? 'FullyReceived' : 'PartiallyReceived') as any,
      comments: `Goods receipt posted via ${grn.grnNumber}. Total accepted value: $${grn.totalAcceptedValue}. Status transitioned from ${previousPoStatus} to ${po.status}.`,
      timestampUtc: nowUtc,
    });

    // Finalize GRN
    grn.status = 'Posted';
    grn.postedByUserId = user.sub;
    grn.postedByName = user.fullName;
    grn.postedAtUtc = nowUtc;
    grn.updatedAtUtc = nowUtc;

    grn.auditTrail.push({
      id: `GA-${crypto.randomBytes(4).toString('hex')}`,
      grnId: grn.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: 'Posted',
      comments: `GRN posted to durable receipt ledger & stock ledger. Purchase Order ${po.poNumber} status updated to ${po.status}.`,
      timestampUtc: nowUtc,
    });

    // Atomic persistence across all 5 aggregate files
    writeJsonAtomic(grnsFile, grns);
    writeJsonAtomic(purchaseOrdersFile, purchaseOrders);
    writeJsonAtomic(receiptLedgerFile, receiptLedger);
    writeJsonAtomic(stockLedgerFile, stockLedger);
    writeJsonAtomic(inventoryBalancesFile, inventoryBalances);

    return res.status(200).json({
      success: true,
      message: `Goods Received Note ${grn.grnNumber} posted successfully. Inventory balances and authoritative stock ledger updated with moving WAC.`,
      data: grn,
      purchaseOrderStatus: po.status,
      timestampUtc: nowUtc,
    });
  });

  // GET /api/purchase-orders/:id/receipts (PO Receipt Integration Endpoint)
  router.get('/purchase-orders/:id/receipts', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const receiptLedger = readJsonSafe<ReceiptLedgerRecord[]>(receiptLedgerFile, []);
    const user = req.user!;

    const po = purchaseOrders.find((p) => p.id === req.params.id || p.poNumber === req.params.id);
    if (!po) {
      return res.status(404).json({
        success: false,
        message: `Purchase Order '${req.params.id}' was not found`,
        timestampUtc: new Date().toISOString(),
      });
    }

    if (!canUserAccessProject(user, po.projectId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have access to purchase orders for this project site',
        timestampUtc: new Date().toISOString(),
      });
    }

    // Filter GRNs and receipts linked to this PO
    const linkedGrns = grns.filter((g) => g.purchaseOrderId === po.id || g.purchaseOrderNumber === po.poNumber);
    const linkedReceipts = receiptLedger.filter((r) => r.purchaseOrderId === po.id || r.purchaseOrderNumber === po.poNumber);

    const itemReceiptSummaries = po.items.map((pi) => {
      const itemReceipts = linkedReceipts.filter((r) => r.materialId === pi.materialId);
      const cumulativeReceived = round2(itemReceipts.reduce((sum, r) => sum + r.acceptedQuantity, 0));
      return {
        purchaseOrderItemId: pi.id,
        materialId: pi.materialId,
        materialCode: pi.materialCode,
        materialName: pi.materialName,
        unitCode: pi.unitCode,
        orderedQuantity: pi.orderedQuantity,
        receivedQuantity: pi.receivedQuantity,
        ledgerCumulativeReceived: cumulativeReceived,
        outstandingQuantity: pi.outstandingQuantity,
        unitRate: pi.unitRate,
        isFullyReceived: pi.receivedQuantity >= pi.orderedQuantity,
      };
    });

    const totalOrdered = round2(po.items.reduce((s, i) => s + i.orderedQuantity, 0));
    const totalReceived = round2(po.items.reduce((s, i) => s + i.receivedQuantity, 0));
    const totalOutstanding = round2(po.items.reduce((s, i) => s + i.outstandingQuantity, 0));

    return res.status(200).json({
      success: true,
      data: {
        purchaseOrderId: po.id,
        purchaseOrderNumber: po.poNumber,
        status: po.status,
        supplierName: po.supplierName,
        projectName: po.projectName,
        totalOrderedQuantity: totalOrdered,
        totalReceivedQuantity: totalReceived,
        totalOutstandingQuantity: totalOutstanding,
        grnCount: linkedGrns.length,
        postedGrnCount: linkedGrns.filter((g) => g.status === 'Posted').length,
        itemSummaries: itemReceiptSummaries,
        grns: linkedGrns,
        receipts: linkedReceipts,
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // ------------------------------------------------------------------------
  // API: INVENTORY BALANCES, STOCK LEDGER & WEIGHTED-AVERAGE COSTING
  // ------------------------------------------------------------------------

  // GET /api/inventory/balances (Paginated & Filtered Balances by Location)
  router.get('/inventory/balances', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const balances = readJsonSafe<InventoryBalanceRecord[]>(inventoryBalancesFile, []);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, []);
    const user = req.user!;

    const { materialId, warehouseId, projectId, search, status, page, pageSize } = req.query;

    // Filter by user location scope
    let filtered = balances.filter((b) => canUserAccessLocation(user, b.projectId, b.warehouseId));

    if (materialId && typeof materialId === 'string' && materialId !== 'ALL') {
      filtered = filtered.filter((b) => b.materialId === materialId || b.materialCode === materialId);
    }

    if (warehouseId && typeof warehouseId === 'string' && warehouseId !== 'ALL') {
      filtered = filtered.filter((b) => b.warehouseId === warehouseId);
    }

    if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
      filtered = filtered.filter((b) => b.projectId === projectId);
    }

    if (search && typeof search === 'string') {
      const term = search.trim().toUpperCase();
      filtered = filtered.filter(
        (b) =>
          b.materialCode.toUpperCase().includes(term) ||
          b.materialName.toUpperCase().includes(term) ||
          (b.categoryName && b.categoryName.toUpperCase().includes(term)) ||
          b.warehouseName.toUpperCase().includes(term) ||
          b.projectName.toUpperCase().includes(term)
      );
    }

    // Attach master global stock thresholds (explicitly noted as master global)
    const enriched = filtered.map((b) => {
      const mat = materials.find((m) => m.id === b.materialId);
      const globalMin = mat?.minimumStockLevel;
      const globalReorder = mat?.reorderLevel;
      const isLowStock = globalMin !== undefined && b.quantityOnHand <= globalMin;
      return {
        ...b,
        globalMinimumStockLevel: globalMin,
        globalReorderLevel: globalReorder,
        isLowStock,
      };
    });

    let resultItems = enriched;
    if (status && typeof status === 'string' && status !== 'ALL') {
      if (status === 'IN_STOCK') {
        resultItems = resultItems.filter((b) => b.quantityOnHand > 0);
      } else if (status === 'LOW_STOCK') {
        resultItems = resultItems.filter((b) => b.isLowStock);
      } else if (status === 'OUT_OF_STOCK') {
        resultItems = resultItems.filter((b) => b.quantityOnHand <= 0);
      }
    }

    // Sort by material code, warehouse name
    resultItems.sort((a, b) => a.materialCode.localeCompare(b.materialCode) || a.warehouseName.localeCompare(b.warehouseName));

    const pageIndex = Math.max(1, parseInt(page as string, 10) || 1);
    const size = Math.max(1, parseInt(pageSize as string, 10) || 20);
    const totalCount = resultItems.length;
    const totalPages = Math.ceil(totalCount / size);
    const paged = resultItems.slice((pageIndex - 1) * size, pageIndex * size);

    const distinctMatIds = new Set(filtered.map((b) => b.materialId));
    const locationKeys = new Set(filtered.map((b) => `${b.warehouseId}:${b.projectId}`));

    const metrics = {
      totalMaterials: distinctMatIds.size,
      totalLocations: locationKeys.size,
      totalInventoryValue: round2(filtered.reduce((sum, b) => sum + (b.inventoryValue || 0), 0)),
      totalQuantityOnHand: round2(filtered.reduce((sum, b) => sum + (b.quantityOnHand || 0), 0)),
      lowStockCount: enriched.filter((b) => b.isLowStock).length,
    };

    return res.status(200).json({
      success: true,
      data: {
        items: paged,
        pageIndex,
        pageSize: size,
        totalCount,
        totalPages,
        metrics,
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/inventory/balances/:materialId (Location breakdown for single material)
  router.get('/inventory/balances/:materialId', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const balances = readJsonSafe<InventoryBalanceRecord[]>(inventoryBalancesFile, []);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, []);
    const user = req.user!;

    const mat = materials.find((m) => m.id === req.params.materialId || m.itemCode === req.params.materialId);
    const materialId = mat ? mat.id : req.params.materialId;

    const matching = balances.filter(
      (b) =>
        (b.materialId === materialId || b.materialCode === req.params.materialId) &&
        canUserAccessLocation(user, b.projectId, b.warehouseId)
    );

    return res.status(200).json({
      success: true,
      data: matching,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/inventory/ledger (Authoritative Append-Only Transaction Ledger)
  router.get('/inventory/ledger', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const stockLedger = readJsonSafe<StockLedgerRecord[]>(stockLedgerFile, []);
    const user = req.user!;

    const {
      materialId,
      warehouseId,
      projectId,
      transactionType,
      search,
      referenceNumber,
      startDate,
      endDate,
      page,
      pageSize,
    } = req.query;

    let filtered = stockLedger.filter((e) => canUserAccessLocation(user, e.projectId, e.warehouseId));

    if (materialId && typeof materialId === 'string' && materialId !== 'ALL') {
      filtered = filtered.filter((e) => e.materialId === materialId || e.materialCode === materialId);
    }

    if (warehouseId && typeof warehouseId === 'string' && warehouseId !== 'ALL') {
      filtered = filtered.filter((e) => e.warehouseId === warehouseId);
    }

    if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
      filtered = filtered.filter((e) => e.projectId === projectId);
    }

    if (transactionType && typeof transactionType === 'string' && transactionType !== 'ALL') {
      filtered = filtered.filter((e) => e.transactionType === transactionType);
    }

    if (referenceNumber && typeof referenceNumber === 'string') {
      filtered = filtered.filter((e) => e.referenceNumber.toUpperCase().includes(referenceNumber.trim().toUpperCase()));
    }

    if (startDate && typeof startDate === 'string') {
      filtered = filtered.filter((e) => e.transactionDate >= startDate);
    }

    if (endDate && typeof endDate === 'string') {
      filtered = filtered.filter((e) => e.transactionDate <= endDate);
    }

    if (search && typeof search === 'string') {
      const term = search.trim().toUpperCase();
      filtered = filtered.filter(
        (e) =>
          e.referenceNumber.toUpperCase().includes(term) ||
          e.sourceDocumentNumber.toUpperCase().includes(term) ||
          e.materialCode.toUpperCase().includes(term) ||
          e.materialName.toUpperCase().includes(term) ||
          e.warehouseName.toUpperCase().includes(term) ||
          e.projectName.toUpperCase().includes(term) ||
          (e.remarks && e.remarks.toUpperCase().includes(term))
      );
    }

    // Chronological order: newest transactions first
    filtered.sort((a, b) => new Date(b.timestampUtc).getTime() - new Date(a.timestampUtc).getTime());

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
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/inventory/ledger/:id (Single Transaction Details)
  router.get('/inventory/ledger/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const stockLedger = readJsonSafe<StockLedgerRecord[]>(stockLedgerFile, []);
    const user = req.user!;

    const entry = stockLedger.find((e) => e.id === req.params.id || e.referenceNumber === req.params.id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: `Stock ledger transaction '${req.params.id}' was not found`,
        timestampUtc: new Date().toISOString(),
      });
    }

    if (!canUserAccessLocation(user, entry.projectId, entry.warehouseId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view stock ledger entries for this location',
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: entry,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/inventory/valuation (Moving WAC Valuation Grouped Summaries)
  router.get('/inventory/valuation', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const balances = readJsonSafe<InventoryBalanceRecord[]>(inventoryBalancesFile, []);
    const user = req.user!;
    const { warehouseId, projectId } = req.query;

    let filtered = balances.filter((b) => canUserAccessLocation(user, b.projectId, b.warehouseId));

    if (warehouseId && typeof warehouseId === 'string' && warehouseId !== 'ALL') {
      filtered = filtered.filter((b) => b.warehouseId === warehouseId);
    }

    if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
      filtered = filtered.filter((b) => b.projectId === projectId);
    }

    // Group By Material
    const materialMap = new Map<string, {
      materialId: string;
      materialCode: string;
      materialName: string;
      categoryName: string;
      unitCode: string;
      totalQuantity: number;
      totalValue: number;
      locationCount: number;
    }>();

    for (const b of filtered) {
      let g = materialMap.get(b.materialId);
      if (!g) {
        g = {
          materialId: b.materialId,
          materialCode: b.materialCode,
          materialName: b.materialName,
          categoryName: b.categoryName || 'General Inventory',
          unitCode: b.unitCode,
          totalQuantity: 0,
          totalValue: 0,
          locationCount: 0,
        };
        materialMap.set(b.materialId, g);
      }
      g.totalQuantity = round2(g.totalQuantity + b.quantityOnHand);
      g.totalValue = round2(g.totalValue + b.inventoryValue);
      g.locationCount++;
    }

    const byMaterial = Array.from(materialMap.values()).map((g) => ({
      ...g,
      averageCost: g.totalQuantity > 0 ? round4(g.totalValue / g.totalQuantity) : 0,
    })).sort((a, b) => b.totalValue - a.totalValue);

    // Group By Warehouse
    const warehouseMap = new Map<string, {
      locationId: string;
      locationName: string;
      locationType: 'Warehouse' | 'Project';
      itemCount: number;
      totalQuantity: number;
      totalValue: number;
    }>();

    for (const b of filtered) {
      let w = warehouseMap.get(b.warehouseId);
      if (!w) {
        w = {
          locationId: b.warehouseId,
          locationName: b.warehouseName,
          locationType: 'Warehouse',
          itemCount: 0,
          totalQuantity: 0,
          totalValue: 0,
        };
        warehouseMap.set(b.warehouseId, w);
      }
      w.itemCount++;
      w.totalQuantity = round2(w.totalQuantity + b.quantityOnHand);
      w.totalValue = round2(w.totalValue + b.inventoryValue);
    }

    // Group By Project
    const projectMap = new Map<string, {
      locationId: string;
      locationName: string;
      locationType: 'Warehouse' | 'Project';
      itemCount: number;
      totalQuantity: number;
      totalValue: number;
    }>();

    for (const b of filtered) {
      let p = projectMap.get(b.projectId);
      if (!p) {
        p = {
          locationId: b.projectId,
          locationName: b.projectName,
          locationType: 'Project',
          itemCount: 0,
          totalQuantity: 0,
          totalValue: 0,
        };
        projectMap.set(b.projectId, p);
      }
      p.itemCount++;
      p.totalQuantity = round2(p.totalQuantity + b.quantityOnHand);
      p.totalValue = round2(p.totalValue + b.inventoryValue);
    }

    const nowUtc = new Date().toISOString();
    const summary = {
      totalInventoryValue: round2(filtered.reduce((sum, b) => sum + b.inventoryValue, 0)),
      totalQuantityOnHand: round2(filtered.reduce((sum, b) => sum + b.quantityOnHand, 0)),
      distinctMaterials: materialMap.size,
      activeLocations: warehouseMap.size,
      asOfTimestampUtc: nowUtc,
    };

    return res.status(200).json({
      success: true,
      data: {
        byMaterial,
        byWarehouse: Array.from(warehouseMap.values()),
        byProject: Array.from(projectMap.values()),
        summary,
      },
      timestampUtc: nowUtc,
    });
  });

  // GET /api/inventory/reconciliation (Audit Comparison: GRNs vs Ledger vs Balances)
  router.get('/inventory/reconciliation', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'AccountsOfficer', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const stockLedger = readJsonSafe<StockLedgerRecord[]>(stockLedgerFile, []);
    const balances = readJsonSafe<InventoryBalanceRecord[]>(inventoryBalancesFile, []);
    const receiptLedger = readJsonSafe<ReceiptLedgerRecord[]>(receiptLedgerFile, []);
    const user = req.user!;

    const accessibleGrns = grns.filter((g) => canUserAccessLocation(user, g.projectId, g.warehouseId));
    const accessibleLedger = stockLedger.filter((e) => canUserAccessLocation(user, e.projectId, e.warehouseId));
    const accessibleBalances = balances.filter((b) => canUserAccessLocation(user, b.projectId, b.warehouseId));

    const grnVsLedgerDiscrepancies: any[] = [];
    const ledgerVsBalanceDiscrepancies: any[] = [];

    // Check 1: Every accepted line on a posted GRN must have a corresponding stock ledger entry
    for (const grn of accessibleGrns) {
      if (grn.status !== 'Posted') continue;
      for (const item of grn.items) {
        if (item.acceptedQuantity <= 0) continue;
        const idempotencyKey = `GRN_${grn.id}_ITEM_${item.id}`;
        const hasEntry = accessibleLedger.some((e) => e.idempotencyKey === idempotencyKey);
        if (!hasEntry) {
          grnVsLedgerDiscrepancies.push({
            id: `DISC-GRN-${item.id}`,
            type: 'UNPOSTED_RECEIPT',
            description: `Accepted delivery of ${item.acceptedQuantity} ${item.unitCode} on ${grn.grnNumber} is not recorded in the stock ledger.`,
            sourceReference: grn.grnNumber,
            materialCode: item.materialCode,
            location: grn.warehouseName || grn.warehouseId,
            expectedValue: item.acceptedQuantity,
            actualValue: 0,
            canAutoRecover: true,
          });
        }
      }
    }

    // Check 2: Sum of signed ledger quantities must equal balance on hand
    const ledgerSums = new Map<string, { qty: number; value: number; materialCode: string; location: string }>();
    for (const e of accessibleLedger) {
      const key = `${e.materialId}_${e.warehouseId}_${e.projectId}`;
      const curr = ledgerSums.get(key) || { qty: 0, value: 0, materialCode: e.materialCode, location: `${e.warehouseName} / ${e.projectName}` };
      curr.qty = round2(curr.qty + e.signedQuantity);
      curr.value = round2(curr.value + e.transactionValue);
      ledgerSums.set(key, curr);
    }

    for (const [key, lSum] of ledgerSums.entries()) {
      const parts = key.split('_');
      const b = accessibleBalances.find((b) => b.materialId === parts[0] && b.warehouseId === parts[1] && b.projectId === parts[2]);
      const storedOnHand = b ? b.quantityOnHand : 0;
      if (Math.abs(lSum.qty - storedOnHand) > 0.001) {
        ledgerVsBalanceDiscrepancies.push({
          id: `DISC-BAL-${key}`,
          type: 'QUANTITY_MISMATCH',
          description: `Cumulative ledger movements total ${lSum.qty}, but stored balance is ${storedOnHand}.`,
          sourceReference: `Location Balance: ${key}`,
          materialCode: lSum.materialCode,
          location: lSum.location,
          expectedValue: lSum.qty,
          actualValue: storedOnHand,
          canAutoRecover: true,
        });
      }
    }

    const unreconciledReceipts = receiptLedger.filter((r) => !r.reconciledWithInventoryLedger && canUserAccessLocation(user, r.projectId, r.warehouseId));
    const totalDiscrepancies = grnVsLedgerDiscrepancies.length + ledgerVsBalanceDiscrepancies.length + unreconciledReceipts.length;

    return res.status(200).json({
      success: true,
      data: {
        isReconciled: totalDiscrepancies === 0,
        totalDiscrepancies,
        grnVsLedgerDiscrepancies,
        ledgerVsBalanceDiscrepancies,
        unreconciledReceiptCount: unreconciledReceipts.length,
        lastReconciledAtUtc: new Date().toISOString(),
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // POST /api/inventory/reconciliation/recover (Idempotent Recovery of Unreconciled Receipts)
  router.post('/inventory/reconciliation/recover', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager']), (req: AuthenticatedRequest, res: Response) => {
    const grns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
    const purchaseOrders = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
    const receiptLedger = readJsonSafe<ReceiptLedgerRecord[]>(receiptLedgerFile, []);
    const stockLedger = readJsonSafe<StockLedgerRecord[]>(stockLedgerFile, []);
    const inventoryBalances = readJsonSafe<InventoryBalanceRecord[]>(inventoryBalancesFile, []);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, []);
    const projects = readJsonSafe<ProjectRecord[]>(projectsFile, defaultProjects);
    const user = req.user!;

    let recoveredCount = 0;
    const nowUtc = new Date().toISOString();

    for (const rcpt of receiptLedger) {
      if (rcpt.reconciledWithInventoryLedger) continue;
      const grn = grns.find((g) => g.id === rcpt.grnId);
      const po = purchaseOrders.find((p) => p.id === rcpt.purchaseOrderId);
      if (grn && po && grn.status === 'Posted') {
        const result = postGrnToInventoryLedger(
          grn,
          po,
          user,
          rcpt.postedAtUtc || nowUtc,
          stockLedger,
          inventoryBalances,
          materials,
          projects
        );
        if (result.success) {
          rcpt.reconciledWithInventoryLedger = true;
          recoveredCount += result.postedCount;
        }
      }
    }

    if (recoveredCount > 0) {
      writeJsonAtomic(receiptLedgerFile, receiptLedger);
      writeJsonAtomic(stockLedgerFile, stockLedger);
      writeJsonAtomic(inventoryBalancesFile, inventoryBalances);
    }

    return res.status(200).json({
      success: true,
      data: {
        recoveredCount,
        message: recoveredCount > 0
          ? `Successfully reconciled and posted ${recoveredCount} stock ledger transactions.`
          : 'All inventory receipts are already fully reconciled with the authoritative stock ledger.',
      },
      timestampUtc: nowUtc,
    });
  });

  // ========================================================================
  // API: MATERIAL ISSUES & SITE CONSUMPTION
  // ========================================================================

  // GET /api/material-issues (Paginated & Scoped List)
  router.get('/material-issues', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const user = req.user!;
    const { search, status, requisitionId, projectId, warehouseId, page, pageSize } = req.query;

    let filtered = issues.filter((i) => canUserAccessLocation(user, i.projectId, i.warehouseId));

    if (search && typeof search === 'string') {
      const term = search.trim().toUpperCase();
      filtered = filtered.filter(
        (i) =>
          i.issueNumber.toUpperCase().includes(term) ||
          i.requisitionNumber.toUpperCase().includes(term) ||
          i.purpose.toUpperCase().includes(term) ||
          i.receivedByPerson.toUpperCase().includes(term) ||
          i.items.some((it) => it.materialCode.toUpperCase().includes(term) || it.materialName.toUpperCase().includes(term))
      );
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      filtered = filtered.filter((i) => i.status === status);
    }

    if (requisitionId && typeof requisitionId === 'string' && requisitionId !== 'ALL') {
      filtered = filtered.filter((i) => i.requisitionId === requisitionId || i.requisitionNumber === requisitionId);
    }

    if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
      filtered = filtered.filter((i) => i.projectId === projectId);
    }

    if (warehouseId && typeof warehouseId === 'string' && warehouseId !== 'ALL') {
      filtered = filtered.filter((i) => i.warehouseId === warehouseId);
    }

    filtered.sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());

    if (page && pageSize) {
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
        },
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: filtered,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/material-issues/:id
  router.get('/material-issues/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const user = req.user!;
    const issue = issues.find((i) => i.id === req.params.id || i.issueNumber === req.params.id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: `Material issue '${req.params.id}' was not found`,
        timestampUtc: new Date().toISOString(),
      });
    }

    if (!canUserAccessLocation(user, issue.projectId, issue.warehouseId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view material issues for this site/warehouse location',
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: issue,
      timestampUtc: new Date().toISOString(),
    });
  });

  // POST /api/material-issues (Create Draft Material Issue)
  router.post('/material-issues', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const { requisitionId, warehouseId, purpose, workActivity, receivedByPerson, issueDate, items, remarks, submitImmediately } = req.body || {};
    const user = req.user!;
    const nowUtc = new Date().toISOString();

    if (!requisitionId) {
      return res.status(400).json({ success: false, message: 'Source approved requisition is required' });
    }

    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const reqDoc = requisitions.find((r) => r.id === requisitionId || r.requisitionNumber === requisitionId);

    if (!reqDoc) {
      return res.status(400).json({ success: false, message: `Source requisition '${requisitionId}' was not found` });
    }

    // Business Rule: Requisition must be Approved or PartiallyFulfilled!
    if (reqDoc.status !== 'Approved' && (reqDoc.status as string) !== 'PartiallyFulfilled') {
      return res.status(400).json({
        success: false,
        message: `Cannot issue materials for requisition '${reqDoc.requisitionNumber}'. Status is '${reqDoc.status}', but must be 'Approved' or 'PartiallyFulfilled'.`,
      });
    }

    if (!warehouseId) {
      return res.status(400).json({ success: false, message: 'Issuing warehouse/yard selection is required' });
    }

    if (!canUserAccessLocation(user, reqDoc.projectId, warehouseId)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not have access to issue stock for project '${reqDoc.projectName}' and warehouse '${warehouseId}'`,
      });
    }

    if (!purpose || !String(purpose).trim()) {
      return res.status(400).json({ success: false, message: 'Issue purpose / site activity description is required' });
    }

    if (!receivedByPerson || !String(receivedByPerson).trim()) {
      return res.status(400).json({ success: false, message: 'Receiving supervisor / contractor name is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Material issue must have at least one line item' });
    }

    // Check existing issues for previous fulfillment calculations
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const postedIssues = issues.filter((i) => (i.requisitionId === reqDoc.id || i.requisitionNumber === reqDoc.requisitionNumber) && i.status === 'Posted');

    const parsedItems: MaterialIssueItemRecord[] = [];

    for (let idx = 0; idx < items.length; idx++) {
      const line = items[idx];
      const reqItem = reqDoc.items.find((ri) => ri.id === line.requisitionItemId || ri.materialId === line.materialId);

      if (!reqItem) {
        return res.status(400).json({ success: false, message: `Line #${idx + 1}: Requisition item '${line.requisitionItemId || line.materialId}' was not found on source requisition` });
      }

      const qtyToIssue = parseFloat(line.quantityToIssue);
      if (isNaN(qtyToIssue) || qtyToIssue <= 0) {
        return res.status(400).json({ success: false, message: `Line #${idx + 1} (${reqItem.materialName}): Issue quantity must be greater than 0` });
      }

      // Calculate previously fulfilled quantity across posted issues
      let prevFulfilled = 0;
      for (const pIss of postedIssues) {
        for (const pIt of pIss.items) {
          if (pIt.requisitionItemId === reqItem.id || pIt.materialId === reqItem.materialId) {
            prevFulfilled += (pIt.actualIssuedQuantity || pIt.quantityToIssue || 0);
          }
        }
      }
      prevFulfilled = round2(prevFulfilled);
      const outstandingQty = round2(Math.max(0, reqItem.requestedQuantity - prevFulfilled));

      if (qtyToIssue > outstandingQty) {
        return res.status(400).json({
          success: false,
          message: `Line #${idx + 1} (${reqItem.materialName}): Requested issue quantity (${qtyToIssue} ${reqItem.unitCode}) exceeds remaining approved quantity (${outstandingQty} ${reqItem.unitCode}). Requested: ${reqItem.requestedQuantity}, Already Fulfilled: ${prevFulfilled}.`,
        });
      }

      parsedItems.push({
        id: `MII-${Date.now().toString(36)}-${idx}-${crypto.randomBytes(2).toString('hex')}`,
        materialIssueId: '',
        requisitionItemId: reqItem.id,
        materialId: reqItem.materialId,
        materialCode: reqItem.materialCode,
        materialName: reqItem.materialName,
        unitCode: reqItem.unitCode,
        requestedQuantity: reqItem.requestedQuantity,
        previouslyFulfilledQuantity: prevFulfilled,
        outstandingQuantity: outstandingQty,
        quantityToIssue: qtyToIssue,
        storageLocation: line.storageLocation || 'Site Yard',
        remarks: line.remarks || '',
      });
    }

    const warehouseName = warehouseId === 'WH-02' ? 'North Industrial Depot & Yard' : (warehouseId === 'WH-03' ? 'East Harbor Hub' : 'Metro Central Staging Yard');
    const newIssueNumber = generateNextIssueNumber(issues);
    const newIssueId = `ISS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`;

    parsedItems.forEach((it) => (it.materialIssueId = newIssueId));

    const initialStatus = submitImmediately ? 'Submitted' : 'Draft';

    const auditTrail: MaterialIssueAuditRecord[] = [
      {
        id: `IA-${crypto.randomBytes(4).toString('hex')}`,
        materialIssueId: newIssueId,
        actorUserId: user.sub,
        actorName: user.fullName,
        actorRole: user.roles[0] || 'Storekeeper',
        action: 'DraftCreated',
        comments: `Material issue draft created against ${reqDoc.requisitionNumber} for activity: ${purpose}`,
        timestampUtc: nowUtc,
      },
    ];

    if (submitImmediately) {
      auditTrail.push({
        id: `IA-${crypto.randomBytes(4).toString('hex')}`,
        materialIssueId: newIssueId,
        actorUserId: user.sub,
        actorName: user.fullName,
        actorRole: user.roles[0] || 'Storekeeper',
        action: 'Submitted',
        comments: 'Submitted for issue approval & stock verification.',
        timestampUtc: nowUtc,
      });
    }

    const newIssue: MaterialIssueRecord = {
      id: newIssueId,
      issueNumber: newIssueNumber,
      requisitionId: reqDoc.id,
      requisitionNumber: reqDoc.requisitionNumber,
      projectId: reqDoc.projectId,
      projectName: reqDoc.projectName,
      warehouseId,
      warehouseName,
      issueDate: issueDate || nowUtc.split('T')[0],
      status: initialStatus,
      purpose: String(purpose).trim(),
      workActivity: workActivity ? String(workActivity).trim() : undefined,
      receivedByPerson: String(receivedByPerson).trim(),
      items: parsedItems,
      auditTrail,
      remarks: remarks ? String(remarks).trim() : undefined,
      createdByUserId: user.sub,
      createdByName: user.fullName,
      createdAtUtc: nowUtc,
      submittedByUserId: submitImmediately ? user.sub : undefined,
      submittedByName: submitImmediately ? user.fullName : undefined,
      submittedAtUtc: submitImmediately ? nowUtc : undefined,
    };

    issues.unshift(newIssue);
    writeJsonAtomic(materialIssuesFile, issues);

    return res.status(201).json({
      success: true,
      data: newIssue,
      message: `Material issue ${newIssue.issueNumber} created successfully.`,
      timestampUtc: nowUtc,
    });
  });

  // PUT /api/material-issues/:id (Update Draft Issue)
  router.put('/material-issues/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const user = req.user!;
    const issueIndex = issues.findIndex((i) => i.id === req.params.id || i.issueNumber === req.params.id);

    if (issueIndex === -1) {
      return res.status(404).json({ success: false, message: `Material issue '${req.params.id}' was not found` });
    }

    const issue = issues[issueIndex];

    if (issue.status === 'Posted') {
      return res.status(405).json({
        success: false,
        message: 'Method Not Allowed: Posted material issues are permanently immutable and cannot be modified.',
      });
    }

    if (issue.status !== 'Draft' && issue.status !== 'ReturnedForCorrection') {
      return res.status(400).json({
        success: false,
        message: `Cannot edit material issue in '${issue.status}' status. Only Draft or ReturnedForCorrection issues can be edited.`,
      });
    }

    const { purpose, workActivity, receivedByPerson, issueDate, items, remarks } = req.body || {};
    const nowUtc = new Date().toISOString();

    if (purpose) issue.purpose = String(purpose).trim();
    if (workActivity !== undefined) issue.workActivity = String(workActivity).trim();
    if (receivedByPerson) issue.receivedByPerson = String(receivedByPerson).trim();
    if (issueDate) issue.issueDate = issueDate;
    if (remarks !== undefined) issue.remarks = String(remarks).trim();

    if (Array.isArray(items) && items.length > 0) {
      const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
      const reqDoc = requisitions.find((r) => r.id === issue.requisitionId);
      const postedIssues = issues.filter((i) => i.requisitionId === issue.requisitionId && i.status === 'Posted' && i.id !== issue.id);

      for (let idx = 0; idx < items.length; idx++) {
        const line = items[idx];
        const existingItem = issue.items.find((it) => it.id === line.id || it.requisitionItemId === line.requisitionItemId);
        if (existingItem) {
          const qtyToIssue = parseFloat(line.quantityToIssue);
          if (!isNaN(qtyToIssue) && qtyToIssue > 0) {
            let prevFulfilled = 0;
            if (reqDoc) {
              for (const pIss of postedIssues) {
                for (const pIt of pIss.items) {
                  if (pIt.requisitionItemId === existingItem.requisitionItemId) {
                    prevFulfilled += (pIt.actualIssuedQuantity || pIt.quantityToIssue || 0);
                  }
                }
              }
              const outstanding = round2(Math.max(0, existingItem.requestedQuantity - prevFulfilled));
              if (qtyToIssue > outstanding) {
                return res.status(400).json({
                  success: false,
                  message: `Line #${idx + 1} (${existingItem.materialName}): Issue quantity (${qtyToIssue}) exceeds remaining approved quantity (${outstanding}).`,
                });
              }
            }
            existingItem.quantityToIssue = qtyToIssue;
          }
          if (line.storageLocation) existingItem.storageLocation = line.storageLocation;
          if (line.remarks !== undefined) existingItem.remarks = line.remarks;
        }
      }
    }

    issue.auditTrail.push({
      id: `IA-${crypto.randomBytes(4).toString('hex')}`,
      materialIssueId: issue.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: 'Updated',
      comments: 'Material issue details updated.',
      timestampUtc: nowUtc,
    });

    issue.updatedAtUtc = nowUtc;
    issues[issueIndex] = issue;
    writeJsonAtomic(materialIssuesFile, issues);

    return res.status(200).json({
      success: true,
      data: issue,
      message: `Material issue ${issue.issueNumber} updated successfully.`,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/material-issues/:id/submit
  router.post('/material-issues/:id/submit', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const user = req.user!;
    const issueIndex = issues.findIndex((i) => i.id === req.params.id || i.issueNumber === req.params.id);

    if (issueIndex === -1) {
      return res.status(404).json({ success: false, message: `Material issue '${req.params.id}' was not found` });
    }

    const issue = issues[issueIndex];
    if (issue.status !== 'Draft' && issue.status !== 'ReturnedForCorrection') {
      return res.status(400).json({ success: false, message: `Cannot submit issue in '${issue.status}' status.` });
    }

    const nowUtc = new Date().toISOString();
    issue.status = 'Submitted';
    issue.submittedByUserId = user.sub;
    issue.submittedByName = user.fullName;
    issue.submittedAtUtc = nowUtc;

    issue.auditTrail.push({
      id: `IA-${crypto.randomBytes(4).toString('hex')}`,
      materialIssueId: issue.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: 'Submitted',
      comments: 'Submitted for issue approval & stock verification.',
      timestampUtc: nowUtc,
    });

    issue.updatedAtUtc = nowUtc;
    issues[issueIndex] = issue;
    writeJsonAtomic(materialIssuesFile, issues);

    return res.status(200).json({ success: true, data: issue, message: `Material issue ${issue.issueNumber} submitted.` });
  });

  // POST /api/material-issues/:id/approve
  router.post('/material-issues/:id/approve', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const user = req.user!;
    const issueIndex = issues.findIndex((i) => i.id === req.params.id || i.issueNumber === req.params.id);

    if (issueIndex === -1) {
      return res.status(404).json({ success: false, message: `Material issue '${req.params.id}' was not found` });
    }

    const issue = issues[issueIndex];

    // Dual-control policy: Creator cannot approve their own issue
    if (issue.createdByUserId === user.sub && !user.roles.includes('SuperAdmin')) {
      return res.status(403).json({
        success: false,
        message: 'Dual-control policy violation: You cannot approve a material issue that you created yourself.',
      });
    }

    if (issue.status !== 'Submitted') {
      return res.status(400).json({ success: false, message: `Cannot approve issue in '${issue.status}' status. Must be 'Submitted'.` });
    }

    const nowUtc = new Date().toISOString();
    const { comments } = req.body || {};

    issue.status = 'Approved';
    issue.approvedByUserId = user.sub;
    issue.approvedByName = user.fullName;
    issue.approvedAtUtc = nowUtc;

    issue.auditTrail.push({
      id: `IA-${crypto.randomBytes(4).toString('hex')}`,
      materialIssueId: issue.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'ProjectManager',
      action: 'Approved',
      comments: comments ? String(comments).trim() : 'Material issue approved for stock dispatch.',
      timestampUtc: nowUtc,
    });

    issue.updatedAtUtc = nowUtc;
    issues[issueIndex] = issue;
    writeJsonAtomic(materialIssuesFile, issues);

    return res.status(200).json({ success: true, data: issue, message: `Material issue ${issue.issueNumber} approved.` });
  });

  // POST /api/material-issues/:id/reject
  router.post('/material-issues/:id/reject', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const user = req.user!;
    const issueIndex = issues.findIndex((i) => i.id === req.params.id || i.issueNumber === req.params.id);

    if (issueIndex === -1) {
      return res.status(404).json({ success: false, message: `Material issue '${req.params.id}' was not found` });
    }

    const issue = issues[issueIndex];
    const { rejectionReason, comments } = req.body || {};
    const reason = rejectionReason || comments;

    if (!reason || String(reason).trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Rejection reason / explanation is required (minimum 5 characters).' });
    }

    const nowUtc = new Date().toISOString();
    issue.status = 'Rejected';
    issue.rejectionReason = String(reason).trim();

    issue.auditTrail.push({
      id: `IA-${crypto.randomBytes(4).toString('hex')}`,
      materialIssueId: issue.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'ProjectManager',
      action: 'Rejected',
      comments: String(reason).trim(),
      timestampUtc: nowUtc,
    });

    issue.updatedAtUtc = nowUtc;
    issues[issueIndex] = issue;
    writeJsonAtomic(materialIssuesFile, issues);

    return res.status(200).json({ success: true, data: issue, message: `Material issue ${issue.issueNumber} rejected.` });
  });

  // POST /api/material-issues/:id/return-for-correction
  router.post('/material-issues/:id/return-for-correction', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const user = req.user!;
    const issueIndex = issues.findIndex((i) => i.id === req.params.id || i.issueNumber === req.params.id);

    if (issueIndex === -1) {
      return res.status(404).json({ success: false, message: `Material issue '${req.params.id}' was not found` });
    }

    const issue = issues[issueIndex];
    const { correctionNotes, comments } = req.body || {};
    const notes = correctionNotes || comments;

    if (!notes || String(notes).trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Correction notes / feedback instructions are required (minimum 5 characters).' });
    }

    const nowUtc = new Date().toISOString();
    issue.status = 'ReturnedForCorrection';
    issue.correctionNotes = String(notes).trim();

    issue.auditTrail.push({
      id: `IA-${crypto.randomBytes(4).toString('hex')}`,
      materialIssueId: issue.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'ProjectManager',
      action: 'ReturnedForCorrection',
      comments: String(notes).trim(),
      timestampUtc: nowUtc,
    });

    issue.updatedAtUtc = nowUtc;
    issues[issueIndex] = issue;
    writeJsonAtomic(materialIssuesFile, issues);

    return res.status(200).json({ success: true, data: issue, message: `Material issue ${issue.issueNumber} returned for correction.` });
  });

  // POST /api/material-issues/:id/post (Post Issue to Stock Ledger & Location Balances)
  router.post('/material-issues/:id/post', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper']), (req: AuthenticatedRequest, res: Response) => {
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const stockLedger = readJsonSafe<StockLedgerRecord[]>(stockLedgerFile, []);
    const inventoryBalances = readJsonSafe<InventoryBalanceRecord[]>(inventoryBalancesFile, []);
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const user = req.user!;
    const nowUtc = new Date().toISOString();

    const issueIndex = issues.findIndex((i) => i.id === req.params.id || i.issueNumber === req.params.id);

    if (issueIndex === -1) {
      return res.status(404).json({ success: false, message: `Material issue '${req.params.id}' was not found` });
    }

    const issue = issues[issueIndex];

    // Idempotency / Already Posted check
    if (issue.status === 'Posted') {
      return res.status(200).json({
        success: true,
        data: issue,
        message: `Material issue ${issue.issueNumber} was already posted previously to the stock ledger.`,
        timestampUtc: nowUtc,
      });
    }

    if (issue.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: `Cannot post material issue '${issue.issueNumber}'. Status is '${issue.status}', but must be 'Approved'.`,
      });
    }

    // Call authoritative inventory posting service
    const result = postMaterialIssueToStockLedger(issue, user, nowUtc, stockLedger, inventoryBalances, requisitions);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to post material issue to inventory ledger.',
        timestampUtc: nowUtc,
      });
    }

    issue.status = 'Posted';
    issue.postedByUserId = user.sub;
    issue.postedByName = user.fullName;
    issue.postedAtUtc = nowUtc;

    issue.auditTrail.push({
      id: `IA-${crypto.randomBytes(4).toString('hex')}`,
      materialIssueId: issue.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: 'Posted',
      comments: `Material issue posted to stock ledger. ${result.postedCount} line items dispatched. Source requisition status updated.`,
      timestampUtc: nowUtc,
    });

    issue.updatedAtUtc = nowUtc;
    issues[issueIndex] = issue;

    writeJsonAtomic(materialIssuesFile, issues);
    writeJsonAtomic(stockLedgerFile, stockLedger);
    writeJsonAtomic(inventoryBalancesFile, inventoryBalances);
    writeJsonAtomic(requisitionsFile, requisitions);

    return res.status(200).json({
      success: true,
      data: issue,
      message: `Material issue ${issue.issueNumber} posted successfully. Stock balances reduced.`,
      timestampUtc: nowUtc,
    });
  });

  // GET /api/material-issues/:id/history
  router.get('/material-issues/:id/history', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const issue = issues.find((i) => i.id === req.params.id || i.issueNumber === req.params.id);

    if (!issue) {
      return res.status(404).json({ success: false, message: `Material issue '${req.params.id}' was not found` });
    }

    return res.status(200).json({
      success: true,
      data: issue.auditTrail || [],
      timestampUtc: new Date().toISOString(),
    });
  });

  // ========================================================================
  // API: MATERIAL RETURNS
  // ========================================================================

  // GET /api/material-returns
  router.get('/material-returns', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const returns = readJsonSafe<MaterialReturnRecord[]>(materialReturnsFile, []);
    const user = req.user!;
    const { search, status, materialIssueId, projectId, warehouseId, page, pageSize } = req.query;

    let filtered = returns.filter((r) => canUserAccessLocation(user, r.projectId, r.warehouseId));

    if (search && typeof search === 'string') {
      const term = search.trim().toUpperCase();
      filtered = filtered.filter(
        (r) =>
          r.returnNumber.toUpperCase().includes(term) ||
          r.materialIssueNumber.toUpperCase().includes(term) ||
          r.reason.toUpperCase().includes(term) ||
          r.returnedByPerson.toUpperCase().includes(term) ||
          r.items.some((it) => it.materialCode.toUpperCase().includes(term) || it.materialName.toUpperCase().includes(term))
      );
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      filtered = filtered.filter((r) => r.status === status);
    }

    if (materialIssueId && typeof materialIssueId === 'string' && materialIssueId !== 'ALL') {
      filtered = filtered.filter((r) => r.materialIssueId === materialIssueId || r.materialIssueNumber === materialIssueId);
    }

    if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
      filtered = filtered.filter((r) => r.projectId === projectId);
    }

    if (warehouseId && typeof warehouseId === 'string' && warehouseId !== 'ALL') {
      filtered = filtered.filter((r) => r.warehouseId === warehouseId);
    }

    filtered.sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());

    if (page && pageSize) {
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
        },
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: filtered,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/material-returns/:id
  router.get('/material-returns/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const returns = readJsonSafe<MaterialReturnRecord[]>(materialReturnsFile, []);
    const user = req.user!;
    const returnDoc = returns.find((r) => r.id === req.params.id || r.returnNumber === req.params.id);

    if (!returnDoc) {
      return res.status(404).json({ success: false, message: `Material return '${req.params.id}' was not found` });
    }

    if (!canUserAccessLocation(user, returnDoc.projectId, returnDoc.warehouseId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view material returns for this location',
      });
    }

    return res.status(200).json({ success: true, data: returnDoc, timestampUtc: new Date().toISOString() });
  });

  // POST /api/material-returns (Create Return Draft)
  router.post('/material-returns', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const { materialIssueId, returnDate, returnedByPerson, reason, items, remarks } = req.body || {};
    const user = req.user!;
    const nowUtc = new Date().toISOString();

    if (!materialIssueId) {
      return res.status(400).json({ success: false, message: 'Source posted material issue ID is required' });
    }

    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const issue = issues.find((i) => i.id === materialIssueId || i.issueNumber === materialIssueId);

    if (!issue) {
      return res.status(400).json({ success: false, message: `Source material issue '${materialIssueId}' was not found` });
    }

    // Business Rule: Can only return against a POSTED issue!
    if (issue.status !== 'Posted') {
      return res.status(400).json({
        success: false,
        message: `Cannot create return for material issue '${issue.issueNumber}'. Issue status is '${issue.status}', but must be 'Posted'.`,
      });
    }

    if (!canUserAccessLocation(user, issue.projectId, issue.warehouseId)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not have access to return materials for project '${issue.projectName}'`,
      });
    }

    if (!returnedByPerson || !String(returnedByPerson).trim()) {
      return res.status(400).json({ success: false, message: 'Returning person / supervisor name is required' });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Return reason description is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Material return must have at least one line item' });
    }

    // Check existing returns for previously returned calculation
    const returns = readJsonSafe<MaterialReturnRecord[]>(materialReturnsFile, []);
    const postedReturns = returns.filter((r) => r.materialIssueId === issue.id && r.status === 'Posted');

    const parsedItems: MaterialReturnItemRecord[] = [];

    for (let idx = 0; idx < items.length; idx++) {
      const line = items[idx];
      const issueItem = issue.items.find((ii) => ii.id === line.materialIssueItemId || ii.materialId === line.materialId);

      if (!issueItem) {
        return res.status(400).json({ success: false, message: `Line #${idx + 1}: Material issue line item was not found` });
      }

      const returnedQty = parseFloat(line.returnedQuantity);
      if (isNaN(returnedQty) || returnedQty <= 0) {
        return res.status(400).json({ success: false, message: `Line #${idx + 1} (${issueItem.materialName}): Return quantity must be greater than 0` });
      }

      // Calculate previously returned quantity
      let prevReturned = 0;
      for (const pRet of postedReturns) {
        for (const pIt of pRet.items) {
          if (pIt.materialIssueItemId === issueItem.id || pIt.materialId === issueItem.materialId) {
            prevReturned += (pIt.returnedQuantity || 0);
          }
        }
      }
      prevReturned = round2(prevReturned);
      const issuedQty = issueItem.actualIssuedQuantity || issueItem.quantityToIssue;
      const maxReturnable = round2(Math.max(0, issuedQty - prevReturned));

      if (returnedQty > maxReturnable) {
        return res.status(400).json({
          success: false,
          message: `Line #${idx + 1} (${issueItem.materialName}): Return quantity (${returnedQty} ${issueItem.unitCode}) exceeds net issued quantity available to return (${maxReturnable} ${issueItem.unitCode}). Total Issued: ${issuedQty}, Previously Returned: ${prevReturned}.`,
        });
      }

      const condition = line.condition || 'ReusableGood';
      const disposition = line.disposition || (condition === 'ReusableGood' ? 'ReturnToUsableStock' : 'QuarantineScrap');
      const unitCost = issueItem.unitCost || 0;

      parsedItems.push({
        id: `MRI-${Date.now().toString(36)}-${idx}-${crypto.randomBytes(2).toString('hex')}`,
        materialReturnId: '',
        materialIssueItemId: issueItem.id,
        materialId: issueItem.materialId,
        materialCode: issueItem.materialCode,
        materialName: issueItem.materialName,
        unitCode: issueItem.unitCode,
        issuedQuantity: issuedQty,
        previouslyReturnedQuantity: prevReturned,
        maxReturnableQuantity: maxReturnable,
        returnedQuantity: returnedQty,
        condition,
        disposition,
        unitCost,
        totalReturnAmount: round2(returnedQty * unitCost),
        inspectionNotes: line.inspectionNotes || '',
      });
    }

    const newReturnNumber = generateNextReturnNumber(returns);
    const newReturnId = `RET-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`;
    parsedItems.forEach((it) => (it.materialReturnId = newReturnId));

    const newReturn: MaterialReturnRecord = {
      id: newReturnId,
      returnNumber: newReturnNumber,
      materialIssueId: issue.id,
      materialIssueNumber: issue.issueNumber,
      requisitionId: issue.requisitionId,
      requisitionNumber: issue.requisitionNumber,
      projectId: issue.projectId,
      projectName: issue.projectName,
      warehouseId: issue.warehouseId,
      warehouseName: issue.warehouseName,
      returnDate: returnDate || nowUtc.split('T')[0],
      returnedByPerson: String(returnedByPerson).trim(),
      reason: String(reason).trim(),
      status: 'Draft',
      items: parsedItems,
      auditTrail: [
        {
          id: `RA-${crypto.randomBytes(4).toString('hex')}`,
          materialReturnId: newReturnId,
          actorUserId: user.sub,
          actorName: user.fullName,
          actorRole: user.roles[0] || 'Storekeeper',
          action: 'DraftCreated',
          comments: `Material return note draft created against ${issue.issueNumber}. Reason: ${reason}`,
          timestampUtc: nowUtc,
        },
      ],
      remarks: remarks ? String(remarks).trim() : undefined,
      createdByUserId: user.sub,
      createdByName: user.fullName,
      createdAtUtc: nowUtc,
    };

    returns.unshift(newReturn);
    writeJsonAtomic(materialReturnsFile, returns);

    return res.status(201).json({
      success: true,
      data: newReturn,
      message: `Material return note ${newReturn.returnNumber} created.`,
      timestampUtc: nowUtc,
    });
  });

  // PUT /api/material-returns/:id (Update Return Draft)
  router.put('/material-returns/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const returns = readJsonSafe<MaterialReturnRecord[]>(materialReturnsFile, []);
    const user = req.user!;
    const returnIndex = returns.findIndex((r) => r.id === req.params.id || r.returnNumber === req.params.id);

    if (returnIndex === -1) {
      return res.status(404).json({ success: false, message: `Material return '${req.params.id}' was not found` });
    }

    const returnDoc = returns[returnIndex];

    if (returnDoc.status === 'Posted') {
      return res.status(405).json({
        success: false,
        message: 'Method Not Allowed: Posted material returns are permanently immutable and cannot be modified.',
      });
    }

    const { returnedByPerson, reason, returnDate, remarks } = req.body || {};
    const nowUtc = new Date().toISOString();

    if (returnedByPerson) returnDoc.returnedByPerson = String(returnedByPerson).trim();
    if (reason) returnDoc.reason = String(reason).trim();
    if (returnDate) returnDoc.returnDate = returnDate;
    if (remarks !== undefined) returnDoc.remarks = String(remarks).trim();

    returnDoc.auditTrail.push({
      id: `RA-${crypto.randomBytes(4).toString('hex')}`,
      materialReturnId: returnDoc.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: 'Updated',
      comments: 'Material return details updated.',
      timestampUtc: nowUtc,
    });

    returnDoc.updatedAtUtc = nowUtc;
    returns[returnIndex] = returnDoc;
    writeJsonAtomic(materialReturnsFile, returns);

    return res.status(200).json({ success: true, data: returnDoc, timestampUtc: nowUtc });
  });

  // POST /api/material-returns/:id/inspect (QA Inspection of Returned Material)
  router.post('/material-returns/:id/inspect', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper']), (req: AuthenticatedRequest, res: Response) => {
    const returns = readJsonSafe<MaterialReturnRecord[]>(materialReturnsFile, []);
    const user = req.user!;
    const returnIndex = returns.findIndex((r) => r.id === req.params.id || r.returnNumber === req.params.id);

    if (returnIndex === -1) {
      return res.status(404).json({ success: false, message: `Material return '${req.params.id}' was not found` });
    }

    const returnDoc = returns[returnIndex];
    const { items, comments } = req.body || {};

    if (Array.isArray(items) && items.length > 0) {
      for (const line of items) {
        const item = returnDoc.items.find((it) => it.id === line.id || it.materialId === line.materialId);
        if (item) {
          if (line.condition) item.condition = line.condition;
          if (line.disposition) item.disposition = line.disposition;
          if (line.inspectionNotes !== undefined) item.inspectionNotes = String(line.inspectionNotes).trim();
        }
      }
    }

    const nowUtc = new Date().toISOString();
    returnDoc.status = 'Inspected';
    returnDoc.inspectedByUserId = user.sub;
    returnDoc.inspectedByName = user.fullName;
    returnDoc.inspectedAtUtc = nowUtc;

    returnDoc.auditTrail.push({
      id: `RA-${crypto.randomBytes(4).toString('hex')}`,
      materialReturnId: returnDoc.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: 'Inspected',
      comments: comments ? String(comments).trim() : 'QA Inspection completed on returned material.',
      timestampUtc: nowUtc,
    });

    returnDoc.updatedAtUtc = nowUtc;
    returns[returnIndex] = returnDoc;
    writeJsonAtomic(materialReturnsFile, returns);

    return res.status(200).json({ success: true, data: returnDoc, message: `Material return ${returnDoc.returnNumber} inspected.` });
  });

  // POST /api/material-returns/:id/approve
  router.post('/material-returns/:id/approve', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const returns = readJsonSafe<MaterialReturnRecord[]>(materialReturnsFile, []);
    const user = req.user!;
    const returnIndex = returns.findIndex((r) => r.id === req.params.id || r.returnNumber === req.params.id);

    if (returnIndex === -1) {
      return res.status(404).json({ success: false, message: `Material return '${req.params.id}' was not found` });
    }

    const returnDoc = returns[returnIndex];
    const { comments } = req.body || {};
    const nowUtc = new Date().toISOString();

    returnDoc.status = 'Approved';
    returnDoc.approvedByUserId = user.sub;
    returnDoc.approvedByName = user.fullName;
    returnDoc.approvedAtUtc = nowUtc;

    returnDoc.auditTrail.push({
      id: `RA-${crypto.randomBytes(4).toString('hex')}`,
      materialReturnId: returnDoc.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'ProjectManager',
      action: 'Approved',
      comments: comments ? String(comments).trim() : 'Material return approved.',
      timestampUtc: nowUtc,
    });

    returnDoc.updatedAtUtc = nowUtc;
    returns[returnIndex] = returnDoc;
    writeJsonAtomic(materialReturnsFile, returns);

    return res.status(200).json({ success: true, data: returnDoc, message: `Material return ${returnDoc.returnNumber} approved.` });
  });

  // POST /api/material-returns/:id/post (Post Return to Stock Ledger)
  router.post('/material-returns/:id/post', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper']), (req: AuthenticatedRequest, res: Response) => {
    const returns = readJsonSafe<MaterialReturnRecord[]>(materialReturnsFile, []);
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const stockLedger = readJsonSafe<StockLedgerRecord[]>(stockLedgerFile, []);
    const inventoryBalances = readJsonSafe<InventoryBalanceRecord[]>(inventoryBalancesFile, []);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, []);
    const user = req.user!;
    const nowUtc = new Date().toISOString();

    const returnIndex = returns.findIndex((r) => r.id === req.params.id || r.returnNumber === req.params.id);

    if (returnIndex === -1) {
      return res.status(404).json({ success: false, message: `Material return '${req.params.id}' was not found` });
    }

    const returnDoc = returns[returnIndex];

    if (returnDoc.status === 'Posted') {
      return res.status(200).json({
        success: true,
        data: returnDoc,
        message: `Material return ${returnDoc.returnNumber} was already posted previously.`,
        timestampUtc: nowUtc,
      });
    }

    if (returnDoc.status !== 'Approved' && returnDoc.status !== 'Inspected') {
      return res.status(400).json({
        success: false,
        message: `Cannot post material return '${returnDoc.returnNumber}'. Status is '${returnDoc.status}', but must be 'Approved' or 'Inspected'.`,
      });
    }

    const result = postMaterialReturnToStockLedger(returnDoc, user, nowUtc, stockLedger, inventoryBalances, issues, materials);

    returnDoc.status = 'Posted';
    returnDoc.postedByUserId = user.sub;
    returnDoc.postedByName = user.fullName;
    returnDoc.postedAtUtc = nowUtc;

    returnDoc.auditTrail.push({
      id: `RA-${crypto.randomBytes(4).toString('hex')}`,
      materialReturnId: returnDoc.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: 'Posted',
      comments: `Material return posted to stock ledger. ${result.postedCount} reusable lines restored to inventory balances.`,
      timestampUtc: nowUtc,
    });

    returnDoc.updatedAtUtc = nowUtc;
    returns[returnIndex] = returnDoc;

    writeJsonAtomic(materialReturnsFile, returns);
    writeJsonAtomic(materialIssuesFile, issues);
    writeJsonAtomic(stockLedgerFile, stockLedger);
    writeJsonAtomic(inventoryBalancesFile, inventoryBalances);

    return res.status(200).json({
      success: true,
      data: returnDoc,
      message: `Material return ${returnDoc.returnNumber} posted successfully. Reusable stock restored.`,
      timestampUtc: nowUtc,
    });
  });

  // GET /api/material-returns/:id/history
  router.get('/material-returns/:id/history', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const returns = readJsonSafe<MaterialReturnRecord[]>(materialReturnsFile, []);
    const returnDoc = returns.find((r) => r.id === req.params.id || r.returnNumber === req.params.id);

    if (!returnDoc) {
      return res.status(404).json({ success: false, message: `Material return '${req.params.id}' was not found` });
    }

    return res.status(200).json({
      success: true,
      data: returnDoc.auditTrail || [],
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/requisitions/:id/fulfillment (Comprehensive Requisition Fulfillment Details)
  router.get('/requisitions/:id/fulfillment', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const requisitions = readJsonSafe<RequisitionRecord[]>(requisitionsFile, []);
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const returns = readJsonSafe<MaterialReturnRecord[]>(materialReturnsFile, []);
    const user = req.user!;

    const reqDoc = requisitions.find((r) => r.id === req.params.id || r.requisitionNumber === req.params.id);

    if (!reqDoc) {
      return res.status(404).json({ success: false, message: `Requisition '${req.params.id}' was not found` });
    }

    if (!canUserAccessProject(user, reqDoc.projectId)) {
      return res.status(403).json({ success: false, message: `Forbidden: You do not have permission for project '${reqDoc.projectName}'` });
    }

    const linkedIssues = issues.filter((i) => i.requisitionId === reqDoc.id || i.requisitionNumber === reqDoc.requisitionNumber);
    const postedIssues = linkedIssues.filter((i) => i.status === 'Posted');

    const issueIds = new Set(linkedIssues.map((i) => i.id));
    const linkedReturns = returns.filter((r) => issueIds.has(r.materialIssueId));
    const postedReturns = linkedReturns.filter((r) => r.status === 'Posted');

    // Build line item breakdown
    const lineBreakdown = reqDoc.items.map((ri) => {
      let issuedQty = 0;
      for (const pIss of postedIssues) {
        for (const pIt of pIss.items) {
          if (pIt.requisitionItemId === ri.id || pIt.materialId === ri.materialId) {
            issuedQty += (pIt.actualIssuedQuantity || pIt.quantityToIssue || 0);
          }
        }
      }
      issuedQty = round2(issuedQty);

      let returnedQty = 0;
      for (const pRet of postedReturns) {
        for (const pIt of pRet.items) {
          if (pIt.materialId === ri.materialId) {
            returnedQty += (pIt.returnedQuantity || 0);
          }
        }
      }
      returnedQty = round2(returnedQty);

      const netIssued = round2(Math.max(0, issuedQty - returnedQty));
      const outstandingQty = round2(Math.max(0, ri.requestedQuantity - issuedQty));

      return {
        requisitionItemId: ri.id,
        materialId: ri.materialId,
        materialCode: ri.materialCode,
        materialName: ri.materialName,
        unitCode: ri.unitCode,
        requestedQuantity: ri.requestedQuantity,
        issuedQuantity: issuedQty,
        returnedQuantity: returnedQty,
        netIssuedQuantity: netIssued,
        outstandingQuantity: outstandingQty,
        fulfillmentPercent: ri.requestedQuantity > 0 ? round2((issuedQty / ri.requestedQuantity) * 100) : 0,
      };
    });

    const totalRequested = round2(lineBreakdown.reduce((sum, l) => sum + l.requestedQuantity, 0));
    const totalIssued = round2(lineBreakdown.reduce((sum, l) => sum + l.issuedQuantity, 0));
    const totalReturned = round2(lineBreakdown.reduce((sum, l) => sum + l.returnedQuantity, 0));

    return res.status(200).json({
      success: true,
      data: {
        requisition: reqDoc,
        lineBreakdown,
        summary: {
          totalRequested,
          totalIssued,
          totalReturned,
          netConsumed: round2(totalIssued - totalReturned),
          totalOutstanding: round2(Math.max(0, totalRequested - (totalIssued - totalReturned))),
          overallFulfillmentPercent: totalRequested > 0 ? round2((totalIssued / totalRequested) * 100) : 0,
          issueDocumentCount: linkedIssues.length,
          returnDocumentCount: linkedReturns.length,
        },
        linkedIssues,
        linkedReturns,
        linkedVouchers: {
          issues: linkedIssues,
          returns: linkedReturns,
        },
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // ========================================================================
  // API: STOCK TRANSFERS & IN-TRANSIT INVENTORY
  // ========================================================================

  function generateNextTransferNumber(transfers: StockTransferRecord[]): string {
    const currentYear = new Date().getFullYear();
    const yearPrefix = `STN-${currentYear}-`;
    const matching = transfers
      .map((t) => t.transferNumber)
      .filter((num) => num && num.startsWith(yearPrefix));

    if (matching.length === 0) {
      return `${yearPrefix}0001`;
    }

    let maxSeq = 0;
    for (const num of matching) {
      const parts = num.split('-');
      if (parts.length === 3) {
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }

    return `${yearPrefix}${(maxSeq + 1).toString().padStart(4, '0')}`;
  }

  function postStockTransferDispatchToLedger(
    transfer: StockTransferRecord,
    user: JwtPayload,
    nowUtc: string,
    stockLedger: StockLedgerRecord[],
    inventoryBalances: InventoryBalanceRecord[],
    materials: MaterialRecord[]
  ) {
    let dispatchedCount = 0;

    for (let idx = 0; idx < transfer.items.length; idx++) {
      const item = transfer.items[idx];
      const dispatchedQty = item.dispatchedQuantity || item.approvedQuantity || item.requestedQuantity || 0;

      if (dispatchedQty <= 0) continue;

      // 1. Check Source Balance
      let sourceBal = inventoryBalances.find(
        (b) =>
          (b.materialId === item.materialId || b.materialCode === item.materialCode) &&
          b.warehouseId === transfer.sourceWarehouseId &&
          b.projectId === transfer.sourceProjectId
      );

      if (!sourceBal) {
        sourceBal = inventoryBalances.find(
          (b) =>
            (b.materialId === item.materialId || b.materialCode === item.materialCode) &&
            b.warehouseId === transfer.sourceWarehouseId
        );
      }

      const available = sourceBal ? sourceBal.quantityOnHand : 0;
      if (!sourceBal || available < dispatchedQty) {
        throw new Error(
          `Insufficient available stock at source location '${transfer.sourceWarehouseName}'. Required: ${dispatchedQty} ${item.unitCode}, Available: ${available} ${item.unitCode} for '${item.materialName}'.`
        );
      }

      const unitCost = sourceBal.weightedAverageCost || 0;
      const totalAmount = round2(dispatchedQty * unitCost);

      // 2. Outbound Stock Ledger Entry
      const idempotencyKey = `STF_DISPATCH_${transfer.id}_ITEM_${item.id}`;
      if (!stockLedger.some((e) => e.idempotencyKey === idempotencyKey)) {
        const entryId = `STK-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
        const refNum = `STK-${new Date().getFullYear()}-${(stockLedger.length + 1).toString().padStart(4, '0')}`;

        const newBalQty = round2(sourceBal.quantityOnHand - dispatchedQty);
        const newTotalVal = round2(newBalQty * unitCost);

        const ledgerEntry: StockLedgerRecord = {
          id: entryId,
          referenceNumber: refNum,
          transactionType: 'TransferOut',
          sourceDocumentType: 'StockTransferNote',
          sourceDocumentId: transfer.id,
          sourceDocumentNumber: transfer.transferNumber,
          sourceLineId: item.id,
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          unitCode: item.unitCode,
          warehouseId: transfer.sourceWarehouseId,
          warehouseName: transfer.sourceWarehouseName,
          projectId: transfer.sourceProjectId,
          projectName: transfer.sourceProjectName,
          quantityIn: 0,
          quantityOut: dispatchedQty,
          signedQuantity: -dispatchedQty,
          unitCost,
          transactionValue: totalAmount,
          balanceQuantityAfter: newBalQty,
          weightedAverageCostAfter: unitCost,
          totalValuationAfter: newTotalVal,
          idempotencyKey,
          transactionDate: nowUtc.split('T')[0],
          timestampUtc: nowUtc,
          createdByUserId: user.sub,
          createdByName: user.fullName,
          remarks: `Stock Transfer dispatch to ${transfer.destinationWarehouseName} / ${transfer.destinationProjectName}`,
        };

        stockLedger.unshift(ledgerEntry);
        item.sourceStockLedgerEntryId = entryId;

        // Reduce Source Location Balance
        sourceBal.quantityOnHand = newBalQty;
        sourceBal.inventoryValue = newTotalVal;
        sourceBal.lastUpdatedUtc = nowUtc;
        sourceBal.version = (sourceBal.version || 1) + 1;
      }

      // 3. Track In-Transit Quantity at Destination Location Balance
      let destBal = inventoryBalances.find(
        (b) =>
          (b.materialId === item.materialId || b.materialCode === item.materialCode) &&
          b.warehouseId === transfer.destinationWarehouseId &&
          b.projectId === transfer.destinationProjectId
      );

      if (!destBal) {
        destBal = {
          id: `BAL-DST-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          unitCode: item.unitCode,
          warehouseId: transfer.destinationWarehouseId,
          warehouseName: transfer.destinationWarehouseName,
          projectId: transfer.destinationProjectId,
          projectName: transfer.destinationProjectName,
          quantityOnHand: 0,
          quantityReserved: 0,
          quantityAvailable: 0,
          quantityInTransit: 0,
          weightedAverageCost: unitCost,
          inventoryValue: 0,
          version: 1,
          lastUpdatedUtc: nowUtc,
        };
        inventoryBalances.push(destBal);
      }

      destBal.quantityInTransit = round2((destBal.quantityInTransit || 0) + dispatchedQty);
      destBal.lastUpdatedUtc = nowUtc;

      item.unitCostAtDispatch = unitCost;
      item.totalDispatchedAmount = totalAmount;
      item.dispatchedQuantity = dispatchedQty;
      item.remainingInTransitQuantity = dispatchedQty;

      dispatchedCount++;
    }

    return { dispatchedCount };
  }

  function postStockTransferReceiptToLedger(
    transfer: StockTransferRecord,
    user: JwtPayload,
    nowUtc: string,
    stockLedger: StockLedgerRecord[],
    inventoryBalances: InventoryBalanceRecord[],
    materials: MaterialRecord[]
  ) {
    let receivedCount = 0;

    for (let idx = 0; idx < transfer.items.length; idx++) {
      const item = transfer.items[idx];
      const goodQty = item.receivedGoodQuantity || 0;
      const damagedQty = item.damagedQuantity || 0;
      const shortQty = item.shortQuantity || 0;
      const disputedQty = item.disputedQuantity || 0;
      const totalAccounted = round2(goodQty + damagedQty + shortQty + disputedQty);

      if (totalAccounted <= 0) continue;

      const unitCost = item.unitCostAtDispatch || 0;

      // Destination Balance
      let destBal = inventoryBalances.find(
        (b) =>
          (b.materialId === item.materialId || b.materialCode === item.materialCode) &&
          b.warehouseId === transfer.destinationWarehouseId &&
          b.projectId === transfer.destinationProjectId
      );

      if (!destBal) {
        destBal = {
          id: `BAL-DST-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          unitCode: item.unitCode,
          warehouseId: transfer.destinationWarehouseId,
          warehouseName: transfer.destinationWarehouseName,
          projectId: transfer.destinationProjectId,
          projectName: transfer.destinationProjectName,
          quantityOnHand: 0,
          quantityReserved: 0,
          quantityAvailable: 0,
          quantityInTransit: 0,
          weightedAverageCost: unitCost,
          inventoryValue: 0,
          version: 1,
          lastUpdatedUtc: nowUtc,
        };
        inventoryBalances.push(destBal);
      }

      // 1. Post Inbound Good Quantity to Stock Ledger
      if (goodQty > 0) {
        const idempotencyKey = `STF_RECEIPT_${transfer.id}_ITEM_${item.id}_${goodQty}`;
        if (!stockLedger.some((e) => e.idempotencyKey === idempotencyKey)) {
          const entryId = `STK-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
          const refNum = `STK-${new Date().getFullYear()}-${(stockLedger.length + 1).toString().padStart(4, '0')}`;

          const oldOnHand = destBal.quantityOnHand || 0;
          const oldValuation = destBal.inventoryValue || 0;
          const incomingValue = round2(goodQty * unitCost);

          const newOnHand = round2(oldOnHand + goodQty);
          const newValuation = round2(oldValuation + incomingValue);
          const newWac = newOnHand > 0 ? round4(newValuation / newOnHand) : unitCost;

          const ledgerEntry: StockLedgerRecord = {
            id: entryId,
            referenceNumber: refNum,
            transactionType: 'TransferIn',
            sourceDocumentType: 'StockTransferNote',
            sourceDocumentId: transfer.id,
            sourceDocumentNumber: transfer.transferNumber,
            sourceLineId: item.id,
            materialId: item.materialId,
            materialCode: item.materialCode,
            materialName: item.materialName,
            unitCode: item.unitCode,
            warehouseId: transfer.destinationWarehouseId,
            warehouseName: transfer.destinationWarehouseName,
            projectId: transfer.destinationProjectId,
            projectName: transfer.destinationProjectName,
            quantityIn: goodQty,
            quantityOut: 0,
            signedQuantity: goodQty,
            unitCost,
            transactionValue: incomingValue,
            balanceQuantityAfter: newOnHand,
            weightedAverageCostAfter: newWac,
            totalValuationAfter: newValuation,
            idempotencyKey,
            transactionDate: nowUtc.split('T')[0],
            timestampUtc: nowUtc,
            createdByUserId: user.sub,
            createdByName: user.fullName,
            remarks: `Stock Transfer receipt from ${transfer.sourceWarehouseName} / ${transfer.sourceProjectName}`,
          };

          stockLedger.unshift(ledgerEntry);
          item.destinationStockLedgerEntryId = entryId;

          // Update destination stock on hand
          destBal.quantityOnHand = newOnHand;
          destBal.weightedAverageCost = newWac;
          destBal.inventoryValue = newValuation;
        }
      }

      // 2. Reduce In-Transit Quantity by total accounted
      destBal.quantityInTransit = Math.max(0, round2((destBal.quantityInTransit || 0) - totalAccounted));
      destBal.lastUpdatedUtc = nowUtc;
      destBal.version = (destBal.version || 1) + 1;

      // Update remaining in-transit quantity on transfer item
      item.remainingInTransitQuantity = Math.max(
        0,
        round2(item.dispatchedQuantity - (goodQty + damagedQty + shortQty + disputedQty))
      );

      receivedCount++;
    }

    return { receivedCount };
  }

  // GET /api/stock-transfers (Paginated, Filtered & Scoped List)
  router.get('/stock-transfers', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const user = req.user!;
    const { search, status, sourceWarehouseId, destinationWarehouseId, projectId, page, pageSize } = req.query;

    let filtered = transfers.filter(
      (t) =>
        canUserAccessLocation(user, t.sourceProjectId, t.sourceWarehouseId) ||
        canUserAccessLocation(user, t.destinationProjectId, t.destinationWarehouseId)
    );

    if (search && typeof search === 'string') {
      const term = search.trim().toUpperCase();
      filtered = filtered.filter(
        (t) =>
          t.transferNumber.toUpperCase().includes(term) ||
          t.sourceWarehouseName.toUpperCase().includes(term) ||
          t.destinationWarehouseName.toUpperCase().includes(term) ||
          t.purpose.toUpperCase().includes(term) ||
          t.items.some((it) => it.materialCode.toUpperCase().includes(term) || it.materialName.toUpperCase().includes(term))
      );
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      filtered = filtered.filter((t) => t.status === status);
    }

    if (sourceWarehouseId && typeof sourceWarehouseId === 'string' && sourceWarehouseId !== 'ALL') {
      filtered = filtered.filter((t) => t.sourceWarehouseId === sourceWarehouseId);
    }

    if (destinationWarehouseId && typeof destinationWarehouseId === 'string' && destinationWarehouseId !== 'ALL') {
      filtered = filtered.filter((t) => t.destinationWarehouseId === destinationWarehouseId);
    }

    if (projectId && typeof projectId === 'string' && projectId !== 'ALL') {
      filtered = filtered.filter((t) => t.sourceProjectId === projectId || t.destinationProjectId === projectId);
    }

    filtered.sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());

    if (page && pageSize) {
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
        },
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: filtered,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/stock-transfers/discrepancies (Scoped Unresolved Discrepancy Queue)
  router.get('/stock-transfers/discrepancies', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const user = req.user!;

    const accessible = transfers.filter(
      (t) =>
        canUserAccessLocation(user, t.sourceProjectId, t.sourceWarehouseId) ||
        canUserAccessLocation(user, t.destinationProjectId, t.destinationWarehouseId)
    );

    const discrepancies: any[] = [];

    for (const t of accessible) {
      for (const item of t.items) {
        const hasDamage = (item.damagedQuantity || 0) > 0;
        const hasShortage = (item.shortQuantity || 0) > 0;
        const hasDispute = (item.disputedQuantity || 0) > 0;
        const isPending = item.resolutionStatus === 'Pending' || t.discrepancyStatus === 'PendingReview';

        if ((hasDamage || hasShortage || hasDispute || item.discrepancyReason) && isPending) {
          discrepancies.push({
            id: `DISC-STF-${item.id}`,
            stockTransferId: t.id,
            transferNumber: t.transferNumber,
            materialId: item.materialId,
            materialCode: item.materialCode,
            materialName: item.materialName,
            unitCode: item.unitCode,
            sourceLocation: `${t.sourceWarehouseName} (${t.sourceProjectName})`,
            destinationLocation: `${t.destinationWarehouseName} (${t.destinationProjectName})`,
            dispatchedQuantity: item.dispatchedQuantity,
            receivedGoodQuantity: item.receivedGoodQuantity,
            damagedQuantity: item.damagedQuantity,
            shortQuantity: item.shortQuantity,
            disputedQuantity: item.disputedQuantity,
            discrepancyReason: item.discrepancyReason || 'Quantity discrepancy reported upon site receipt inspection',
            inspectionNotes: item.inspectionNotes || '',
            resolutionStatus: item.resolutionStatus || 'Pending',
            reportedBy: t.receivedByUserId ? 'Receiving Storekeeper' : 'Inspector',
            reportedAtUtc: t.actualReceiptDate || t.updatedAtUtc || t.createdAtUtc,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: discrepancies,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/inventory/in-transit (Scoped In-Transit Quantity & Transfers Summary)
  router.get('/inventory/in-transit', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const user = req.user!;

    const inTransitTransfers = transfers.filter(
      (t) =>
        (t.status === 'Dispatched' || t.status === 'PartiallyReceived') &&
        (canUserAccessLocation(user, t.sourceProjectId, t.sourceWarehouseId) ||
          canUserAccessLocation(user, t.destinationProjectId, t.destinationWarehouseId))
    );

    const itemsSummary: any[] = [];

    for (const t of inTransitTransfers) {
      for (const item of t.items) {
        if ((item.remainingInTransitQuantity || item.dispatchedQuantity) > 0) {
          itemsSummary.push({
            stockTransferId: t.id,
            transferNumber: t.transferNumber,
            materialId: item.materialId,
            materialCode: item.materialCode,
            materialName: item.materialName,
            unitCode: item.unitCode,
            sourceWarehouseId: t.sourceWarehouseId,
            sourceWarehouseName: t.sourceWarehouseName,
            destinationWarehouseId: t.destinationWarehouseId,
            destinationWarehouseName: t.destinationWarehouseName,
            sourceProjectId: t.sourceProjectId,
            sourceProjectName: t.sourceProjectName,
            destinationProjectId: t.destinationProjectId,
            destinationProjectName: t.destinationProjectName,
            dispatchedQuantity: item.dispatchedQuantity,
            receivedGoodQuantity: item.receivedGoodQuantity,
            remainingInTransitQuantity: item.remainingInTransitQuantity || item.dispatchedQuantity,
            unitCostAtDispatch: item.unitCostAtDispatch,
            totalInTransitValue: round2((item.remainingInTransitQuantity || item.dispatchedQuantity) * item.unitCostAtDispatch),
            actualDispatchDate: t.actualDispatchDate,
            expectedArrivalDate: t.expectedArrivalDate,
            status: t.status,
          });
        }
      }
    }

    const totalValue = round2(itemsSummary.reduce((sum, i) => sum + i.totalInTransitValue, 0));
    const totalQuantity = round2(itemsSummary.reduce((sum, i) => sum + i.remainingInTransitQuantity, 0));

    return res.status(200).json({
      success: true,
      data: {
        items: itemsSummary,
        transfers: inTransitTransfers,
        metrics: {
          activeTransferCount: inTransitTransfers.length,
          totalInTransitQuantity: totalQuantity,
          totalInTransitValue: totalValue,
        },
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/stock-transfers/:id
  router.get('/stock-transfers/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const user = req.user!;
    const transfer = transfers.find((t) => t.id === req.params.id || t.transferNumber === req.params.id);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: `Stock transfer '${req.params.id}' was not found`,
        timestampUtc: new Date().toISOString(),
      });
    }

    if (
      !canUserAccessLocation(user, transfer.sourceProjectId, transfer.sourceWarehouseId) &&
      !canUserAccessLocation(user, transfer.destinationProjectId, transfer.destinationWarehouseId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have access permission to view transfers for these locations',
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      data: transfer,
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/stock-transfers/:id/history
  router.get('/stock-transfers/:id/history', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const transfer = transfers.find((t) => t.id === req.params.id || t.transferNumber === req.params.id);

    if (!transfer) {
      return res.status(404).json({ success: false, message: `Stock transfer '${req.params.id}' was not found` });
    }

    return res.status(200).json({
      success: true,
      data: transfer.auditTrail || [],
      timestampUtc: new Date().toISOString(),
    });
  });

  // GET /api/stock-transfers/:id/reconciliation
  router.get('/stock-transfers/:id/reconciliation', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const transfer = transfers.find((t) => t.id === req.params.id || t.transferNumber === req.params.id);

    if (!transfer) {
      return res.status(404).json({ success: false, message: `Stock transfer '${req.params.id}' was not found` });
    }

    const lines = transfer.items.map((it) => {
      const dispatched = it.dispatchedQuantity || 0;
      const good = it.receivedGoodQuantity || 0;
      const damaged = it.damagedQuantity || 0;
      const short = it.shortQuantity || 0;
      const disputed = it.disputedQuantity || 0;
      const inTransit = it.remainingInTransitQuantity || 0;

      const totalAccounted = round2(good + damaged + short + disputed + inTransit);
      const isReconciled = Math.abs(dispatched - totalAccounted) < 0.001;

      return {
        lineId: it.id,
        materialCode: it.materialCode,
        materialName: it.materialName,
        unitCode: it.unitCode,
        dispatchedQuantity: dispatched,
        receivedGoodQuantity: good,
        damagedQuantity: damaged,
        shortQuantity: short,
        disputedQuantity: disputed,
        remainingInTransitQuantity: inTransit,
        totalAccounted,
        isReconciled,
        variance: round2(dispatched - totalAccounted),
      };
    });

    const isFullyReconciled = lines.every((l) => l.isReconciled);

    return res.status(200).json({
      success: true,
      data: {
        transferId: transfer.id,
        transferNumber: transfer.transferNumber,
        status: transfer.status,
        isFullyReconciled,
        lines,
      },
      timestampUtc: new Date().toISOString(),
    });
  });

  // POST /api/stock-transfers (Create Draft Transfer Request)
  router.post('/stock-transfers', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const {
      sourceWarehouseId,
      sourceProjectId = 'PRJ-101',
      destinationWarehouseId,
      destinationProjectId = 'PRJ-101',
      purpose,
      transferReason,
      priority = 'Medium',
      requestDate,
      items,
      remarks,
      submitImmediately,
    } = req.body || {};

    const user = req.user!;
    const nowUtc = new Date().toISOString();

    if (!sourceWarehouseId || !destinationWarehouseId) {
      return res.status(400).json({ success: false, message: 'Both Source and Destination warehouse/store locations are required.' });
    }

    // Business Rule: Source and Destination stock locations MUST BE DIFFERENT
    if (sourceWarehouseId === destinationWarehouseId && sourceProjectId === destinationProjectId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Location Transfer: Source and Destination stock locations cannot be identical.',
      });
    }

    // Access Check: User must hold access permission for both source and destination
    if (!canUserAccessLocation(user, sourceProjectId, sourceWarehouseId)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not have authorization scope for source location '${sourceWarehouseId}'.`,
      });
    }

    if (!canUserAccessLocation(user, destinationProjectId, destinationWarehouseId)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not have authorization scope for destination location '${destinationWarehouseId}'.`,
      });
    }

    if (!purpose || !String(purpose).trim()) {
      return res.status(400).json({ success: false, message: 'Stock transfer purpose / site justification is required.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Stock transfer request must contain at least one line item.' });
    }

    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);
    const parsedItems: StockTransferItemRecord[] = [];

    for (let idx = 0; idx < items.length; idx++) {
      const line = items[idx];
      if (!line.materialId) {
        return res.status(400).json({ success: false, message: `Line #${idx + 1}: Material selection is required.` });
      }

      const mat = materials.find((m) => m.id === line.materialId || m.itemCode === line.materialId);
      if (!mat) {
        return res.status(400).json({ success: false, message: `Line #${idx + 1}: Material '${line.materialId}' was not found in Material Master.` });
      }

      const reqQty = parseFloat(line.requestedQuantity);
      if (isNaN(reqQty) || reqQty <= 0) {
        return res.status(400).json({ success: false, message: `Line #${idx + 1} (${mat.name}): Requested transfer quantity must be greater than 0.` });
      }

      parsedItems.push({
        id: `STI-${Date.now().toString(36)}-${idx}-${crypto.randomBytes(2).toString('hex')}`,
        stockTransferId: '',
        materialId: mat.id,
        materialCode: mat.itemCode,
        materialName: mat.name,
        unitCode: mat.baseUnitName || 'Unit',
        requestedQuantity: reqQty,
        approvedQuantity: reqQty,
        dispatchedQuantity: 0,
        receivedGoodQuantity: 0,
        damagedQuantity: 0,
        shortQuantity: 0,
        disputedQuantity: 0,
        remainingInTransitQuantity: 0,
        unitCostAtDispatch: 0,
        totalDispatchedAmount: 0,
      });
    }

    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const transferNumber = generateNextTransferNumber(transfers);
    const transferId = `STF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex')}`;

    parsedItems.forEach((it) => (it.stockTransferId = transferId));

    const sourceWarehouseName = sourceWarehouseId === 'WH-01' ? 'Metro Central Staging Yard' : sourceWarehouseId === 'WH-02' ? 'North Industrial Depot & Yard' : 'East Harbor Hub';
    const destWarehouseName = destinationWarehouseId === 'WH-01' ? 'Metro Central Staging Yard' : destinationWarehouseId === 'WH-02' ? 'North Industrial Depot & Yard' : 'East Harbor Hub';

    const sourceProjectName = sourceProjectId === 'PRJ-102' ? 'Harbor Commercial Docklands' : sourceProjectId === 'PRJ-103' ? 'Skyline Corporate Towers' : 'Metro Rail Line 3 Extension';
    const destProjectName = destinationProjectId === 'PRJ-102' ? 'Harbor Commercial Docklands' : destinationProjectId === 'PRJ-103' ? 'Skyline Corporate Towers' : 'Metro Rail Line 3 Extension';

    const initialStatus: TransferStatus = submitImmediately ? 'Submitted' : 'Draft';

    const auditTrail: StockTransferAuditRecord[] = [
      {
        id: `STA-${crypto.randomBytes(4).toString('hex')}`,
        stockTransferId: transferId,
        actorUserId: user.sub,
        actorName: user.fullName,
        actorRole: user.roles[0] || 'Storekeeper',
        action: 'DraftCreated',
        comments: `Stock transfer request draft created from ${sourceWarehouseName} to ${destWarehouseName}. Purpose: ${purpose}`,
        timestampUtc: nowUtc,
      },
    ];

    if (submitImmediately) {
      auditTrail.push({
        id: `STA-${crypto.randomBytes(4).toString('hex')}`,
        stockTransferId: transferId,
        actorUserId: user.sub,
        actorName: user.fullName,
        actorRole: user.roles[0] || 'Storekeeper',
        action: 'Submitted',
        comments: 'Submitted for managerial transfer approval.',
        timestampUtc: nowUtc,
      });
    }

    const newTransfer: StockTransferRecord = {
      id: transferId,
      transferNumber,
      sourceWarehouseId,
      sourceWarehouseName,
      sourceProjectId,
      sourceProjectName,
      destinationWarehouseId,
      destinationWarehouseName: destWarehouseName,
      destinationProjectId,
      destinationProjectName: destProjectName,
      requestDate: requestDate || nowUtc.split('T')[0],
      purpose: String(purpose).trim(),
      transferReason: transferReason ? String(transferReason).trim() : undefined,
      priority: ['Low', 'Medium', 'High', 'Urgent'].includes(priority) ? priority : 'Medium',
      status: initialStatus,
      discrepancyStatus: 'None',
      items: parsedItems,
      auditTrail,
      remarks: remarks ? String(remarks).trim() : undefined,
      createdByUserId: user.sub,
      createdByName: user.fullName,
      createdAtUtc: nowUtc,
      submittedByUserId: submitImmediately ? user.sub : undefined,
      submittedByName: submitImmediately ? user.fullName : undefined,
      submittedAtUtc: submitImmediately ? nowUtc : undefined,
    };

    transfers.unshift(newTransfer);
    writeJsonAtomic(stockTransfersFile, transfers);

    return res.status(201).json({
      success: true,
      data: newTransfer,
      message: `Stock transfer request ${newTransfer.transferNumber} created successfully.`,
      timestampUtc: nowUtc,
    });
  });

  // PUT /api/stock-transfers/:id (Update Draft Transfer Request)
  router.put('/stock-transfers/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const user = req.user!;
    const idx = transfers.findIndex((t) => t.id === req.params.id || t.transferNumber === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: `Stock transfer '${req.params.id}' was not found` });
    }

    const transfer = transfers[idx];

    // Immutability Check: Ordinary edits blocked if dispatched or received
    if (['Dispatched', 'PartiallyReceived', 'Received', 'Completed'].includes(transfer.status)) {
      return res.status(405).json({
        success: false,
        message: 'Method Not Allowed: Dispatched or completed stock transfers are permanently immutable and cannot be updated.',
      });
    }

    if (transfer.status !== 'Draft' && transfer.status !== 'ReturnedForCorrection') {
      return res.status(400).json({ success: false, message: `Cannot edit transfer in status '${transfer.status}'. Only Draft or ReturnedForCorrection can be edited.` });
    }

    const { purpose, transferReason, priority, items, remarks } = req.body || {};
    const nowUtc = new Date().toISOString();

    if (purpose) transfer.purpose = String(purpose).trim();
    if (transferReason !== undefined) transfer.transferReason = String(transferReason).trim();
    if (priority && ['Low', 'Medium', 'High', 'Urgent'].includes(priority)) transfer.priority = priority;
    if (remarks !== undefined) transfer.remarks = String(remarks).trim();

    if (Array.isArray(items) && items.length > 0) {
      for (const line of items) {
        const existing = transfer.items.find((it) => it.id === line.id || it.materialId === line.materialId);
        if (existing) {
          const qty = parseFloat(line.requestedQuantity);
          if (!isNaN(qty) && qty > 0) {
            existing.requestedQuantity = qty;
            existing.approvedQuantity = qty;
          }
        }
      }
    }

    transfer.auditTrail.push({
      id: `STA-${crypto.randomBytes(4).toString('hex')}`,
      stockTransferId: transfer.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: 'Updated',
      comments: 'Stock transfer request details updated.',
      timestampUtc: nowUtc,
    });

    transfer.updatedAtUtc = nowUtc;
    transfers[idx] = transfer;
    writeJsonAtomic(stockTransfersFile, transfers);

    return res.status(200).json({ success: true, data: transfer, message: `Stock transfer ${transfer.transferNumber} updated.` });
  });

  // POST /api/stock-transfers/:id/submit
  router.post('/stock-transfers/:id/submit', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const user = req.user!;
    const idx = transfers.findIndex((t) => t.id === req.params.id || t.transferNumber === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: `Stock transfer '${req.params.id}' was not found` });
    }

    const transfer = transfers[idx];
    if (transfer.status !== 'Draft' && transfer.status !== 'ReturnedForCorrection') {
      return res.status(400).json({ success: false, message: `Cannot submit transfer in '${transfer.status}' status.` });
    }

    const nowUtc = new Date().toISOString();
    transfer.status = 'Submitted';
    transfer.submittedByUserId = user.sub;
    transfer.submittedByName = user.fullName;
    transfer.submittedAtUtc = nowUtc;

    transfer.auditTrail.push({
      id: `STA-${crypto.randomBytes(4).toString('hex')}`,
      stockTransferId: transfer.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: 'Submitted',
      comments: 'Submitted for transfer authorization.',
      timestampUtc: nowUtc,
    });

    transfer.updatedAtUtc = nowUtc;
    transfers[idx] = transfer;
    writeJsonAtomic(stockTransfersFile, transfers);

    return res.status(200).json({ success: true, data: transfer, message: `Stock transfer ${transfer.transferNumber} submitted for approval.` });
  });

  // POST /api/stock-transfers/:id/approve (Supervisory Dual-Control Transfer Approval)
  router.post('/stock-transfers/:id/approve', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const user = req.user!;
    const idx = transfers.findIndex((t) => t.id === req.params.id || t.transferNumber === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: `Stock transfer '${req.params.id}' was not found` });
    }

    const transfer = transfers[idx];

    // Dual-control policy: Requesting creator cannot self-approve
    if (transfer.createdByUserId === user.sub && !user.roles.includes('SuperAdmin')) {
      return res.status(403).json({
        success: false,
        message: 'Dual-control policy violation: You cannot approve a stock transfer request that you created yourself.',
      });
    }

    if (transfer.status !== 'Submitted') {
      return res.status(400).json({ success: false, message: `Cannot approve transfer in '${transfer.status}' status. Must be 'Submitted'.` });
    }

    const { items, comments } = req.body || {};
    const nowUtc = new Date().toISOString();

    if (Array.isArray(items) && items.length > 0) {
      for (const line of items) {
        const item = transfer.items.find((it) => it.id === line.id || it.materialId === line.materialId);
        if (item) {
          const appQty = parseFloat(line.approvedQuantity);
          if (!isNaN(appQty) && appQty >= 0) {
            item.approvedQuantity = appQty;
          }
        }
      }
    }

    transfer.status = 'Approved';
    transfer.approvedByUserId = user.sub;
    transfer.approvedByName = user.fullName;
    transfer.approvedAtUtc = nowUtc;

    transfer.auditTrail.push({
      id: `STA-${crypto.randomBytes(4).toString('hex')}`,
      stockTransferId: transfer.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'ProjectManager',
      action: 'Approved',
      comments: comments ? String(comments).trim() : 'Stock transfer approved for dispatch.',
      timestampUtc: nowUtc,
    });

    transfer.updatedAtUtc = nowUtc;
    transfers[idx] = transfer;
    writeJsonAtomic(stockTransfersFile, transfers);

    return res.status(200).json({ success: true, data: transfer, message: `Stock transfer ${transfer.transferNumber} approved.` });
  });

  // POST /api/stock-transfers/:id/reject
  router.post('/stock-transfers/:id/reject', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const user = req.user!;
    const idx = transfers.findIndex((t) => t.id === req.params.id || t.transferNumber === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: `Stock transfer '${req.params.id}' was not found` });
    }

    const transfer = transfers[idx];
    const { rejectionReason, comments } = req.body || {};
    const reason = rejectionReason || comments;

    if (!reason || String(reason).trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required (minimum 5 characters).' });
    }

    const nowUtc = new Date().toISOString();
    transfer.status = 'Rejected';
    transfer.rejectionReason = String(reason).trim();

    transfer.auditTrail.push({
      id: `STA-${crypto.randomBytes(4).toString('hex')}`,
      stockTransferId: transfer.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'ProjectManager',
      action: 'Rejected',
      comments: String(reason).trim(),
      timestampUtc: nowUtc,
    });

    transfer.updatedAtUtc = nowUtc;
    transfers[idx] = transfer;
    writeJsonAtomic(stockTransfersFile, transfers);

    return res.status(200).json({ success: true, data: transfer, message: `Stock transfer ${transfer.transferNumber} rejected.` });
  });

  // POST /api/stock-transfers/:id/return-for-correction
  router.post('/stock-transfers/:id/return-for-correction', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const user = req.user!;
    const idx = transfers.findIndex((t) => t.id === req.params.id || t.transferNumber === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: `Stock transfer '${req.params.id}' was not found` });
    }

    const transfer = transfers[idx];
    const { correctionNotes, comments } = req.body || {};
    const notes = correctionNotes || comments;

    if (!notes || String(notes).trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Correction notes are required (minimum 5 characters).' });
    }

    const nowUtc = new Date().toISOString();
    transfer.status = 'ReturnedForCorrection';
    transfer.correctionNotes = String(notes).trim();

    transfer.auditTrail.push({
      id: `STA-${crypto.randomBytes(4).toString('hex')}`,
      stockTransferId: transfer.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'ProjectManager',
      action: 'ReturnedForCorrection',
      comments: String(notes).trim(),
      timestampUtc: nowUtc,
    });

    transfer.updatedAtUtc = nowUtc;
    transfers[idx] = transfer;
    writeJsonAtomic(stockTransfersFile, transfers);

    return res.status(200).json({ success: true, data: transfer, message: `Stock transfer ${transfer.transferNumber} returned for correction.` });
  });

  // POST /api/stock-transfers/:id/dispatch (Post Dispatch Outbound Movement to Stock Ledger)
  router.post('/stock-transfers/:id/dispatch', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper']), (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const stockLedger = readJsonSafe<StockLedgerRecord[]>(stockLedgerFile, []);
    const inventoryBalances = readJsonSafe<InventoryBalanceRecord[]>(inventoryBalancesFile, []);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);
    const user = req.user!;
    const nowUtc = new Date().toISOString();

    const idx = transfers.findIndex((t) => t.id === req.params.id || t.transferNumber === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: `Stock transfer '${req.params.id}' was not found` });
    }

    const transfer = transfers[idx];

    if (transfer.status === 'Dispatched') {
      return res.status(200).json({ success: true, data: transfer, message: `Transfer ${transfer.transferNumber} is already dispatched.` });
    }

    if (transfer.status !== 'Approved') {
      return res.status(400).json({ success: false, message: `Cannot dispatch transfer in status '${transfer.status}'. Only 'Approved' transfers can be dispatched.` });
    }

    const { items, dispatchDate, expectedArrivalDate, remarks } = req.body || {};

    if (Array.isArray(items) && items.length > 0) {
      for (const line of items) {
        const item = transfer.items.find((it) => it.id === line.id || it.materialId === line.materialId);
        if (item) {
          const dQty = parseFloat(line.dispatchedQuantity);
          if (!isNaN(dQty) && dQty > 0) {
            if (dQty > item.approvedQuantity) {
              return res.status(400).json({
                success: false,
                message: `Dispatch violation: Dispatched quantity (${dQty}) exceeds approved quantity (${item.approvedQuantity}) for material '${item.materialName}'.`,
              });
            }
            item.dispatchedQuantity = dQty;
          }
        }
      }
    } else {
      // Default dispatched quantity to approved quantity
      transfer.items.forEach((it) => {
        if (!it.dispatchedQuantity || it.dispatchedQuantity <= 0) {
          it.dispatchedQuantity = it.approvedQuantity || it.requestedQuantity;
        }
      });
    }

    try {
      postStockTransferDispatchToLedger(transfer, user, nowUtc, stockLedger, inventoryBalances, materials);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message || 'Dispatch stock ledger posting failed.' });
    }

    transfer.status = 'Dispatched';
    transfer.actualDispatchDate = dispatchDate || nowUtc.split('T')[0];
    if (expectedArrivalDate) transfer.expectedArrivalDate = expectedArrivalDate;
    if (remarks) transfer.remarks = String(remarks).trim();

    transfer.dispatchedByUserId = user.sub;
    transfer.dispatchedByName = user.fullName;
    transfer.dispatchedAtUtc = nowUtc;

    transfer.auditTrail.push({
      id: `STA-${crypto.randomBytes(4).toString('hex')}`,
      stockTransferId: transfer.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: 'Dispatched',
      comments: `Stock transfer dispatched from ${transfer.sourceWarehouseName}. Outbound stock ledger entries recorded and in-transit inventory established.`,
      timestampUtc: nowUtc,
    });

    transfer.updatedAtUtc = nowUtc;
    transfers[idx] = transfer;

    writeJsonAtomic(stockTransfersFile, transfers);
    writeJsonAtomic(stockLedgerFile, stockLedger);
    writeJsonAtomic(inventoryBalancesFile, inventoryBalances);

    return res.status(200).json({
      success: true,
      data: transfer,
      message: `Stock transfer ${transfer.transferNumber} dispatched successfully. Source stock reduced and in-transit tracking active.`,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/stock-transfers/:id/receive (Post Inbound Destination Receipt to Stock Ledger)
  router.post('/stock-transfers/:id/receive', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'Storekeeper']), (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const stockLedger = readJsonSafe<StockLedgerRecord[]>(stockLedgerFile, []);
    const inventoryBalances = readJsonSafe<InventoryBalanceRecord[]>(inventoryBalancesFile, []);
    const materials = readJsonSafe<MaterialRecord[]>(materialsFile, defaultMaterials);
    const user = req.user!;
    const nowUtc = new Date().toISOString();

    const idx = transfers.findIndex((t) => t.id === req.params.id || t.transferNumber === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: `Stock transfer '${req.params.id}' was not found` });
    }

    const transfer = transfers[idx];

    if (transfer.status === 'Completed') {
      return res.status(200).json({ success: true, data: transfer, message: `Transfer ${transfer.transferNumber} is already completed.` });
    }

    if (transfer.status !== 'Dispatched' && transfer.status !== 'PartiallyReceived') {
      return res.status(400).json({ success: false, message: `Cannot receive transfer in status '${transfer.status}'. Only 'Dispatched' or 'PartiallyReceived' transfers can be received.` });
    }

    const { items, actualReceiptDate, remarks } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Receipt verification must include at least one item line.' });
    }

    let hasDiscrepancy = false;

    for (const line of items) {
      const item = transfer.items.find((it) => it.id === line.id || it.materialId === line.materialId);
      if (item) {
        const good = Math.max(0, parseFloat(line.receivedGoodQuantity ?? item.receivedGoodQuantity) || 0);
        const damaged = Math.max(0, parseFloat(line.damagedQuantity ?? item.damagedQuantity) || 0);
        const short = Math.max(0, parseFloat(line.shortQuantity ?? item.shortQuantity) || 0);
        const disputed = Math.max(0, parseFloat(line.disputedQuantity ?? item.disputedQuantity) || 0);

        const totalQty = round2(good + damaged + short + disputed);

        if (totalQty > item.dispatchedQuantity) {
          return res.status(400).json({
            success: false,
            message: `Over-Receipt Violation: Total received quantity (${totalQty}) exceeds dispatched quantity (${item.dispatchedQuantity}) for '${item.materialName}'.`,
          });
        }

        item.receivedGoodQuantity = good;
        item.damagedQuantity = damaged;
        item.shortQuantity = short;
        item.disputedQuantity = disputed;

        if (line.discrepancyReason) item.discrepancyReason = String(line.discrepancyReason).trim();
        if (line.inspectionNotes) item.inspectionNotes = String(line.inspectionNotes).trim();

        if (damaged > 0 || short > 0 || disputed > 0) {
          hasDiscrepancy = true;
          item.resolutionStatus = item.resolutionStatus || 'Pending';
        }
      }
    }

    postStockTransferReceiptToLedger(transfer, user, nowUtc, stockLedger, inventoryBalances, materials);

    const totalDispatched = round2(transfer.items.reduce((sum, it) => sum + it.dispatchedQuantity, 0));
    const totalGood = round2(transfer.items.reduce((sum, it) => sum + it.receivedGoodQuantity, 0));
    const totalAccounted = round2(transfer.items.reduce((sum, it) => sum + (it.receivedGoodQuantity + it.damagedQuantity + it.shortQuantity + it.disputedQuantity), 0));

    let nextStatus: TransferStatus = 'Completed';
    if (totalAccounted < totalDispatched) {
      nextStatus = 'PartiallyReceived';
    } else if (hasDiscrepancy) {
      nextStatus = 'Received';
      transfer.discrepancyStatus = 'PendingReview';
    } else {
      nextStatus = 'Completed';
      transfer.discrepancyStatus = 'None';
    }

    transfer.status = nextStatus;
    transfer.actualReceiptDate = actualReceiptDate || nowUtc.split('T')[0];
    if (remarks) transfer.remarks = String(remarks).trim();

    transfer.receivedByUserId = user.sub;
    transfer.receivedByName = user.fullName;
    transfer.receivedAtUtc = nowUtc;

    if (nextStatus === 'Completed') {
      transfer.completedByUserId = user.sub;
      transfer.completedByName = user.fullName;
      transfer.completedAtUtc = nowUtc;
    }

    transfer.auditTrail.push({
      id: `STA-${crypto.randomBytes(4).toString('hex')}`,
      stockTransferId: transfer.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'Storekeeper',
      action: 'Received',
      comments: `Transfer received at destination. Accepted Good: ${totalGood}, Damaged: ${transfer.items.reduce((sum, it) => sum + it.damagedQuantity, 0)}, Short: ${transfer.items.reduce((sum, it) => sum + it.shortQuantity, 0)}.`,
      timestampUtc: nowUtc,
    });

    transfer.updatedAtUtc = nowUtc;
    transfers[idx] = transfer;

    writeJsonAtomic(stockTransfersFile, transfers);
    writeJsonAtomic(stockLedgerFile, stockLedger);
    writeJsonAtomic(inventoryBalancesFile, inventoryBalances);

    return res.status(200).json({
      success: true,
      data: transfer,
      message: `Stock transfer ${transfer.transferNumber} receipt posted. Usable stock increased at destination.`,
      timestampUtc: nowUtc,
    });
  });

  // POST /api/stock-transfers/:id/complete
  router.post('/stock-transfers/:id/complete', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const user = req.user!;
    const idx = transfers.findIndex((t) => t.id === req.params.id || t.transferNumber === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: `Stock transfer '${req.params.id}' was not found` });
    }

    const transfer = transfers[idx];
    const { comments } = req.body || {};
    const nowUtc = new Date().toISOString();

    transfer.status = 'Completed';
    transfer.discrepancyStatus = 'Resolved';
    transfer.completedByUserId = user.sub;
    transfer.completedByName = user.fullName;
    transfer.completedAtUtc = nowUtc;

    transfer.auditTrail.push({
      id: `STA-${crypto.randomBytes(4).toString('hex')}`,
      stockTransferId: transfer.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'InventoryManager',
      action: 'Completed',
      comments: comments ? String(comments).trim() : 'Stock transfer marked as fully completed and reconciled.',
      timestampUtc: nowUtc,
    });

    transfer.updatedAtUtc = nowUtc;
    transfers[idx] = transfer;
    writeJsonAtomic(stockTransfersFile, transfers);

    return res.status(200).json({ success: true, data: transfer, message: `Stock transfer ${transfer.transferNumber} completed.` });
  });

  // POST /api/stock-transfers/:id/discrepancies/:lineId/resolve
  router.post('/stock-transfers/:id/discrepancies/:lineId/resolve', authMiddleware, requireRole(['SuperAdmin', 'InventoryManager', 'ProjectManager']), (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const user = req.user!;
    const idx = transfers.findIndex((t) => t.id === req.params.id || t.transferNumber === req.params.id);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: `Stock transfer '${req.params.id}' was not found` });
    }

    const transfer = transfers[idx];
    const item = transfer.items.find((it) => it.id === req.params.lineId || it.materialId === req.params.lineId);

    if (!item) {
      return res.status(404).json({ success: false, message: `Transfer line item '${req.params.lineId}' was not found` });
    }

    const { resolutionNotes, comments, action } = req.body || {};
    const notes = resolutionNotes || comments || action || 'Discrepancy reviewed and reconciled.';

    const nowUtc = new Date().toISOString();
    item.resolutionStatus = 'Resolved';
    item.resolutionNotes = String(notes).trim();

    const allLinesResolved = transfer.items.every((it) => !it.resolutionStatus || it.resolutionStatus === 'Resolved' || it.resolutionStatus === 'None');
    if (allLinesResolved) {
      transfer.discrepancyStatus = 'Resolved';
      if (transfer.status === 'Received') {
        transfer.status = 'Completed';
        transfer.completedByUserId = user.sub;
        transfer.completedByName = user.fullName;
        transfer.completedAtUtc = nowUtc;
      }
    }

    transfer.auditTrail.push({
      id: `STA-${crypto.randomBytes(4).toString('hex')}`,
      stockTransferId: transfer.id,
      actorUserId: user.sub,
      actorName: user.fullName,
      actorRole: user.roles[0] || 'InventoryManager',
      action: 'DiscrepancyResolved',
      comments: `Discrepancy resolved for '${item.materialName}'. Action/Notes: ${notes}`,
      timestampUtc: nowUtc,
    });

    transfer.updatedAtUtc = nowUtc;
    transfers[idx] = transfer;
    writeJsonAtomic(stockTransfersFile, transfers);

    return res.status(200).json({
      success: true,
      data: transfer,
      message: `Discrepancy resolved for line item '${item.materialName}'.`,
      timestampUtc: nowUtc,
    });
  });

  // Immutability Protection for Dispatched or Posted Stock Transfers (HTTP 405 Method Not Allowed)
  router.delete('/stock-transfers/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const transfers = readJsonSafe<StockTransferRecord[]>(stockTransfersFile, []);
    const paramId = req.params.id;
    const transfer = transfers.find((t) => t.id === paramId || t.transferNumber === paramId);

    if (transfer && ['Dispatched', 'PartiallyReceived', 'Received', 'Completed'].includes(transfer.status)) {
      return res.status(405).json({
        success: false,
        message: 'Method Not Allowed (Policy Violation): Direct deletion of dispatched or completed stock transfers is prohibited.',
        timestampUtc: new Date().toISOString(),
      });
    }

    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed: Direct deletion of stock transfer vouchers is prohibited.',
      timestampUtc: new Date().toISOString(),
    });
  });

  // Immutability Protection for Posted Material Issues & Returns (HTTP 405 Method Not Allowed)
  router.put('/material-issues/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const issue = issues.find((i) => i.id === req.params.id || i.issueNumber === req.params.id);
    if (issue && issue.status === 'Posted') {
      return res.status(405).json({
        success: false,
        message: 'Method Not Allowed (Policy Violation): Posted material issues are permanently immutable. Direct editing or deletion is prohibited.',
        timestampUtc: new Date().toISOString(),
      });
    }
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  });

  router.put('/material-returns/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const returns = readJsonSafe<MaterialReturnRecord[]>(materialReturnsFile, []);
    const returnDoc = returns.find((r) => r.id === req.params.id || r.returnNumber === req.params.id);
    if (returnDoc && returnDoc.status === 'Posted') {
      return res.status(405).json({
        success: false,
        message: 'Method Not Allowed (Policy Violation): Posted material returns are permanently immutable. Direct editing or deletion is prohibited.',
        timestampUtc: new Date().toISOString(),
      });
    }
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  });

  router.delete('/material-issues/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const issues = readJsonSafe<MaterialIssueRecord[]>(materialIssuesFile, []);
    const issue = issues.find((i) => i.id === req.params.id || i.issueNumber === req.params.id);
    if (issue && issue.status === 'Posted') {
      return res.status(405).json({
        success: false,
        message: 'Method Not Allowed (Policy Violation): Direct deletion of posted material issues is prohibited.',
        timestampUtc: new Date().toISOString(),
      });
    }
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  });

  router.delete('/material-returns/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const returns = readJsonSafe<MaterialReturnRecord[]>(materialReturnsFile, []);
    const returnDoc = returns.find((r) => r.id === req.params.id || r.returnNumber === req.params.id);
    if (returnDoc && returnDoc.status === 'Posted') {
      return res.status(405).json({
        success: false,
        message: 'Method Not Allowed (Policy Violation): Direct deletion of posted material returns is prohibited.',
        timestampUtc: new Date().toISOString(),
      });
    }
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  });

  // Immutable Protections: Direct CRUD editing or deletion of stock ledger or balances is prohibited
  router.put('/inventory/ledger/:id', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed (Policy Violation): Direct mutation of posted inventory transactions or balances is strictly prohibited. Use an authorized reversal or stock adjustment.',
      timestampUtc: new Date().toISOString(),
    });
  });

  router.put('/inventory/balances/:id', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed (Policy Violation): Direct mutation of posted inventory transactions or balances is strictly prohibited. Use an authorized reversal or stock adjustment.',
      timestampUtc: new Date().toISOString(),
    });
  });

  router.delete('/inventory/ledger/:id', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed (Policy Violation): Direct deletion of posted inventory transactions or balances is strictly prohibited. The stock ledger is immutable.',
      timestampUtc: new Date().toISOString(),
    });
  });

  router.delete('/inventory/balances/:id', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed (Policy Violation): Direct deletion of posted inventory transactions or balances is strictly prohibited. The stock ledger is immutable.',
      timestampUtc: new Date().toISOString(),
    });
  });

  let isReconciled = false;
  function ensureReconciled() {
    if (isReconciled) return;
    isReconciled = true;
    // Startup Reconciliation: Automatically reconcile any legacy or pending posted receipts
    try {
      const startupReceipts = readJsonSafe<ReceiptLedgerRecord[]>(receiptLedgerFile, []);
      const unreconciled = startupReceipts.filter((r) => !r.reconciledWithInventoryLedger);
      if (unreconciled.length > 0) {
        const startupGrns = readJsonSafe<GoodsReceivedNoteRecord[]>(grnsFile, []);
        const startupPos = readJsonSafe<PurchaseOrderRecord[]>(purchaseOrdersFile, []);
        const startupLedger = readJsonSafe<StockLedgerRecord[]>(stockLedgerFile, []);
        const startupBalances = readJsonSafe<InventoryBalanceRecord[]>(inventoryBalancesFile, []);
        const startupMaterials = readJsonSafe<MaterialRecord[]>(materialsFile, []);
        const startupProjects = readJsonSafe<ProjectRecord[]>(projectsFile, defaultProjects);

        let reconciledAny = false;
        for (const rcpt of unreconciled) {
          const grn = startupGrns.find((g) => g.id === rcpt.grnId && g.status === 'Posted');
          const po = startupPos.find((p) => p.id === rcpt.purchaseOrderId);
          if (grn && po) {
            const systemUser: JwtPayload = {
              sub: rcpt.postedByUserId || 'USR-ADMIN-01',
              username: 'system',
              email: 'system@constructcorp.com',
              fullName: rcpt.postedByName || 'System Auto-Reconciliation',
              roles: ['SuperAdmin', 'InventoryManager'],
              projectScopes: ['*'],
              warehouseScopes: ['*'],
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 3600,
              iss: JWT_ISSUER,
              aud: JWT_AUDIENCE,
            };
            postGrnToInventoryLedger(
              grn,
              po,
              systemUser,
              rcpt.postedAtUtc || new Date().toISOString(),
              startupLedger,
              startupBalances,
              startupMaterials,
              startupProjects
            );
            rcpt.reconciledWithInventoryLedger = true;
            reconciledAny = true;
          }
        }
        if (reconciledAny) {
          writeJsonAtomic(receiptLedgerFile, startupReceipts);
          writeJsonAtomic(stockLedgerFile, startupLedger);
          writeJsonAtomic(inventoryBalancesFile, startupBalances);
          console.log(`[ConstructionStock] Reconciled ${unreconciled.length} pending stock receipts into authoritative ledger.`);
        }
      }
    } catch (err) {
      console.error('[ConstructionStock] Startup reconciliation error:', err);
    }
  }
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

  if (PORT !== 3000) {
    const http = await import('node:http');
    http.createServer(app).listen(3000, '0.0.0.0', () => {
      console.log(`[ConstructionStock] Secondary test server running on http://0.0.0.0:3000`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('[ConstructionStock] Server start error:', err);
  });
}

export default app;
