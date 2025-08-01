# Security and Compliance Documentation
## Founders Day Square Payment Integration

### Table of Contents
1. [Security Overview](#security-overview)
2. [PCI DSS Compliance](#pci-dss-compliance)
3. [Data Protection](#data-protection)
4. [Authentication & Authorization](#authentication--authorization)
5. [API Security](#api-security)
6. [Infrastructure Security](#infrastructure-security)
7. [Monitoring & Incident Response](#monitoring--incident-response)
8. [Compliance Auditing](#compliance-auditing)
9. [Privacy Policy Guidelines](#privacy-policy-guidelines)
10. [Security Maintenance](#security-maintenance)

---

## Security Overview

### Security Architecture Principles
- **Zero Trust Security Model**: Never trust, always verify
- **Defense in Depth**: Multiple layers of security controls
- **Least Privilege Access**: Minimum required permissions
- **Security by Design**: Security integrated from development
- **Continuous Monitoring**: Real-time threat detection
- **Incident Response Ready**: Prepared for security events

### Threat Model
```typescript
// Security threat assessment
export const threatModel = {
  // Web Application Threats
  webApplication: {
    'SQL Injection': 'HIGH - Mitigated by Prisma ORM',
    'XSS Attacks': 'HIGH - Mitigated by React and CSP',
    'CSRF Attacks': 'MEDIUM - Mitigated by SameSite cookies',
    'Authentication Bypass': 'HIGH - Mitigated by JWT + bcrypt',
    'Authorization Flaws': 'MEDIUM - Mitigated by RBAC',
    'Session Management': 'MEDIUM - Mitigated by secure sessions',
  },
  
  // Payment Processing Threats
  paymentProcessing: {
    'Card Data Exposure': 'CRITICAL - Mitigated by Square tokenization',
    'Payment Fraud': 'HIGH - Mitigated by Square fraud detection',
    'Man-in-the-Middle': 'HIGH - Mitigated by TLS 1.3',
    'Payment Tampering': 'HIGH - Mitigated by webhook signatures',
  },
  
  // Infrastructure Threats
  infrastructure: {
    'DDoS Attacks': 'MEDIUM - Mitigated by CDN and rate limiting',
    'Data Breaches': 'CRITICAL - Mitigated by encryption',
    'Insider Threats': 'MEDIUM - Mitigated by access controls',
    'Supply Chain': 'MEDIUM - Mitigated by dependency scanning',
  },
};
```

### Security Standards Compliance
- **PCI DSS Level 1**: Payment Card Industry Data Security Standard
- **GDPR**: General Data Protection Regulation (EU)
- **CCPA**: California Consumer Privacy Act
- **SOC 2 Type II**: Service Organization Control 2
- **OWASP Top 10**: Web Application Security Risks
- **NIST Cybersecurity Framework**: Risk management framework

---

## PCI DSS Compliance

### PCI DSS Requirements Implementation

#### Requirement 1: Install and maintain a firewall
```typescript
// Firewall configuration (AWS Security Groups example)
export const firewallRules = {
  webTier: {
    inbound: [
      { port: 80, source: '0.0.0.0/0', protocol: 'HTTP' },
      { port: 443, source: '0.0.0.0/0', protocol: 'HTTPS' },
    ],
    outbound: [
      { port: 443, destination: 'api.squareup.com', protocol: 'HTTPS' },
      { port: 5432, destination: 'database-subnet', protocol: 'PostgreSQL' },
    ],
  },
  
  databaseTier: {
    inbound: [
      { port: 5432, source: 'web-tier-subnet', protocol: 'PostgreSQL' },
    ],
    outbound: [],
  },
};

// Network segmentation
export const networkSegmentation = {
  dmz: 'Public-facing web servers',
  webTier: 'Application servers',
  databaseTier: 'Database servers (isolated)',
  managementTier: 'Admin access (VPN only)',
};
```

#### Requirement 2: Don't use vendor-supplied defaults
```typescript
// Security configuration hardening
export const securityHardening = {
  // Database security
  database: {
    defaultPasswords: 'CHANGED - All default passwords changed',
    adminAccounts: 'CONFIGURED - Custom admin usernames',
    encryption: 'ENABLED - TLS for connections',
    logging: 'ENABLED - All access logged',
  },
  
  // Application security
  application: {
    secretKeys: 'RANDOMIZED - Cryptographically secure',
    debugMode: 'DISABLED - In production',
    errorHandling: 'CONFIGURED - No sensitive data in errors',
    headers: 'SECURED - Security headers implemented',
  },
  
  // Server security
  server: {
    sshKeys: 'CONFIGURED - Key-based authentication only',
    services: 'MINIMIZED - Only required services running',
    patches: 'UPDATED - Automatic security updates',
    monitoring: 'ENABLED - Intrusion detection active',
  },
};
```

#### Requirement 3: Protect stored cardholder data
```typescript
// Data protection implementation
export const cardholderDataProtection = {
  // NO CARDHOLDER DATA STORED
  storage: 'NONE - Square handles all card data storage',
  
  // Tokenization approach
  tokenization: {
    provider: 'Square',
    method: 'Client-side tokenization',
    storage: 'Tokens only, no raw card data',
    scope: 'Single-use payment tokens',
  },
  
  // Data flow
  dataFlow: {
    frontend: 'Square Web SDK - Direct to Square',
    backend: 'Payment tokens only',
    database: 'No card data stored',
    logs: 'Card data excluded from all logs',
  },
  
  // Compliance status
  compliance: 'SAQ A - Card data never on systems',
};

// Data encryption standards
export const encryptionStandards = {
  inTransit: {
    protocol: 'TLS 1.3',
    cipherSuites: 'AES-256-GCM, ChaCha20-Poly1305',
    certificates: 'RSA-4096 or ECDSA P-384',
    hsts: 'Enabled with preload',
  },
  
  atRest: {
    database: 'AES-256 encryption at rest',
    backups: 'Encrypted with separate keys',
    logs: 'Encrypted storage',
    secrets: 'AWS Secrets Manager / HashiCorp Vault',
  },
  
  keyManagement: {
    rotation: 'Automatic key rotation (90 days)',
    storage: 'Hardware Security Modules (HSM)',
    access: 'Multi-person control for key access',
    audit: 'All key operations logged',
  },
};
```

#### Requirement 4: Encrypt transmission of cardholder data
```typescript
// Transmission security implementation
export const transmissionSecurity = {
  // TLS Configuration
  tlsConfig: {
    version: 'TLS 1.3 minimum',
    cipherSuites: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
    ],
    keyExchange: 'ECDHE',
    certificateValidation: 'Strict',
  },
  
  // HTTPS enforcement
  httpsEnforcement: {
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    redirects: 'All HTTP to HTTPS (301)',
    secureHeaders: 'Comprehensive security headers',
  },
  
  // API security
  apiSecurity: {
    authentication: 'Bearer tokens (JWT)',
    authorization: 'Role-based access control',
    rateLimit: 'IP-based rate limiting',
    requestValidation: 'Schema validation',
  },
};

// Security headers implementation
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.squareup.com; connect-src 'self' https://connect.squareup.com",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
```

#### Requirement 5 & 6: Protect against malware and secure systems
```typescript
// Malware protection and secure development
export const malwareProtection = {
  // Dependency scanning
  dependencyScanning: {
    tool: 'npm audit, Snyk, Dependabot',
    frequency: 'Daily automated scans',
    response: 'Automated security updates',
    reporting: 'Security team notifications',
  },
  
  // Code security scanning
  codeScanning: {
    static: 'SonarQube, CodeQL',
    dynamic: 'OWASP ZAP, Burp Suite',
    secrets: 'GitLeaks, TruffleHog',
    containers: 'Trivy, Clair',
  },
  
  // Secure development lifecycle
  sdlc: {
    codeReview: 'Mandatory peer review',
    testing: 'Security tests in CI/CD',
    deployment: 'Automated security checks',
    monitoring: 'Runtime security monitoring',
  },
};

// Vulnerability management
export const vulnerabilityManagement = {
  scanning: {
    infrastructure: 'Weekly vulnerability scans',
    applications: 'Continuous DAST/SAST',
    containers: 'Image scanning before deployment',
    dependencies: 'Real-time monitoring',
  },
  
  remediation: {
    critical: 'Within 24 hours',
    high: 'Within 72 hours',
    medium: 'Within 1 week',
    low: 'Within 1 month',
  },
  
  testing: {
    penetration: 'Annual third-party pen testing',
    internal: 'Quarterly internal testing',
    automated: 'Continuous automated testing',
    scope: 'Full application and infrastructure',
  },
};
```

#### Requirements 7-12: Access control, monitoring, and testing
```typescript
// Access control implementation
export const accessControl = {
  // Role-based access control
  rbac: {
    roles: {
      customer: ['read:own_data', 'write:own_data'],
      admin: ['read:all_data', 'write:orders', 'write:products'],
      superAdmin: ['read:all_data', 'write:all_data', 'admin:users'],
    },
    
    implementation: {
      authentication: 'JWT with refresh tokens',
      authorization: 'Middleware-based checks',
      sessionManagement: 'Secure session handling',
      passwordPolicy: 'Strong password requirements',
    },
  },
  
  // Multi-factor authentication
  mfa: {
    adminAccounts: 'Required for all admin access',
    methods: ['TOTP', 'SMS', 'Hardware tokens'],
    enforcement: 'Cannot be disabled by users',
    backup: 'Recovery codes provided',
  },
  
  // Privileged access management
  pam: {
    adminAccess: 'Separate admin accounts',
    privilegedSessions: 'Recorded and monitored',
    accessReview: 'Quarterly access reviews',
    justInTime: 'Temporary elevated access',
  },
};

// Logging and monitoring
export const loggingMonitoring = {
  // Audit logging
  auditLogs: {
    events: [
      'User authentication/authorization',
      'Payment processing',
      'Data access/modification',
      'Administrative actions',
      'System configuration changes',
    ],
    
    retention: '1 year minimum',
    integrity: 'Log tampering protection',
    analysis: 'Automated log analysis',
    alerting: 'Real-time security alerts',
  },
  
  // Security monitoring
  monitoring: {
    siem: 'Security Information Event Management',
    ids: 'Intrusion Detection System',
    fim: 'File Integrity Monitoring',
    ueba: 'User Entity Behavior Analytics',
  },
  
  // Incident response
  incidentResponse: {
    team: '24/7 security operations center',
    procedures: 'Documented response procedures',
    testing: 'Regular incident response drills',
    communication: 'Incident notification system',
  },
};
```

---

## Data Protection

### Data Classification
```typescript
// Data classification system
export const dataClassification = {
  public: {
    description: 'Information intended for public consumption',
    examples: ['Product catalogs', 'Marketing content'],
    protection: 'Standard web security',
  },
  
  internal: {
    description: 'Information for internal business use',
    examples: ['Business analytics', 'Operational data'],
    protection: 'Access controls, encryption in transit',
  },
  
  confidential: {
    description: 'Sensitive information requiring protection',
    examples: ['Customer PII', 'Financial data'],
    protection: 'Encryption at rest and in transit, access logging',
  },
  
  restricted: {
    description: 'Highly sensitive information',
    examples: ['Payment tokens', 'Admin credentials'],
    protection: 'Strong encryption, MFA, audit trails',
  },
};
```

### Personal Data Protection (GDPR/CCPA)
```typescript
// Privacy protection implementation
export const privacyProtection = {
  // Data minimization
  dataMinimization: {
    collection: 'Only collect necessary data',
    retention: 'Delete data when no longer needed',
    processing: 'Process only for stated purposes',
    sharing: 'Share only with explicit consent',
  },
  
  // Individual rights
  individualRights: {
    access: 'API for data access requests',
    rectification: 'Update/correct personal data',
    erasure: 'Right to be forgotten implementation',
    portability: 'Export data in machine-readable format',
    objection: 'Opt-out of data processing',
  },
  
  // Consent management
  consentManagement: {
    collection: 'Clear consent before data collection',
    granular: 'Separate consent for different purposes',
    withdrawal: 'Easy consent withdrawal mechanism',
    records: 'Maintain consent records',
  },
  
  // Privacy by design
  privacyByDesign: {
    encryption: 'Default encryption for personal data',
    anonymization: 'Data anonymization where possible',
    pseudonymization: 'Use pseudonyms for identifiers',
    dataMapping: 'Complete data flow mapping',
  },
};

// Data retention policy
export const dataRetentionPolicy = {
  customerData: {
    active: 'Retain while account is active',
    inactive: 'Delete after 3 years of inactivity',
    requested: 'Delete within 30 days of request',
  },
  
  transactionData: {
    financial: 'Retain for 7 years (tax/legal requirements)',
    operational: 'Retain for 3 years',
    analytics: 'Anonymized data retained indefinitely',
  },
  
  logData: {
    security: 'Retain for 1 year',
    operational: 'Retain for 90 days',
    debug: 'Retain for 30 days',
  },
  
  backupData: {
    encryption: 'All backups encrypted',
    retention: 'Same as source data retention',
    deletion: 'Secure deletion when expired',
  },
};
```

### Data Loss Prevention (DLP)
```typescript
// Data loss prevention measures
export const dlpMeasures = {
  // Classification and tagging
  classification: {
    automated: 'Automatic data classification',
    manual: 'Manual classification for sensitive data',
    labeling: 'Data labels in all systems',
    tracking: 'Data lineage tracking',
  },
  
  // Access controls
  accessControls: {
    authentication: 'Strong authentication required',
    authorization: 'Role-based access control',
    monitoring: 'Access monitoring and logging',
    restrictions: 'IP and time-based restrictions',
  },
  
  // Data movement monitoring
  monitoring: {
    egress: 'Monitor data leaving the system',
    copying: 'Track data copying/downloading',
    sharing: 'Monitor data sharing activities',
    alerts: 'Real-time anomaly alerts',
  },
  
  // Technical controls
  technicalControls: {
    encryption: 'Encryption for data at rest/transit',
    masking: 'Data masking in non-prod environments',
    tokenization: 'Tokenization for sensitive data',
    watermarking: 'Digital watermarking for documents',
  },
};
```

---

## Authentication & Authorization

### Authentication Implementation
```typescript
// Authentication system
export const authenticationSystem = {
  // Multi-factor authentication
  mfa: {
    factors: {
      knowledge: 'Password (something you know)',
      possession: 'Mobile device (something you have)',
      inherence: 'Biometrics (something you are)',
    },
    
    implementation: {
      totp: 'Time-based One-Time Passwords',
      sms: 'SMS-based verification',
      push: 'Push notifications',
      hardware: 'Hardware security keys (FIDO2)',
    },
    
    enforcement: {
      admin: 'Required for all admin accounts',
      customer: 'Optional but encouraged',
      sensitive: 'Required for sensitive operations',
    },
  },
  
  // Password security
  passwordSecurity: {
    requirements: {
      length: 'Minimum 12 characters',
      complexity: 'Mixed case, numbers, symbols',
      history: 'Cannot reuse last 12 passwords',
      expiration: 'Admin passwords expire every 90 days',
    },
    
    storage: {
      hashing: 'bcrypt with salt rounds >= 12',
      pepper: 'Application-level pepper',
      timing: 'Constant-time comparison',
    },
    
    breachProtection: {
      monitoring: 'Monitor for password breaches',
      notification: 'Notify users of breached passwords',
      enforcement: 'Force password reset if breached',
    },
  },
  
  // Session management
  sessionManagement: {
    tokens: {
      jwt: 'JSON Web Tokens for stateless auth',
      refresh: 'Refresh tokens for long-term access',
      expiration: 'Access tokens expire in 15 minutes',
      rotation: 'Refresh tokens rotate on use',
    },
    
    security: {
      httpOnly: 'HTTP-only cookies for tokens',
      secure: 'Secure flag for HTTPS only',
      sameSite: 'SameSite=Strict for CSRF protection',
      domain: 'Restrict to specific domain',
    },
    
    lifecycle: {
      creation: 'Secure token generation',
      validation: 'Strict token validation',
      revocation: 'Token revocation support',
      cleanup: 'Automatic cleanup of expired tokens',
    },
  },
};

// JWT implementation
export const jwtImplementation = {
  // Token structure
  structure: {
    header: {
      alg: 'RS256', // RSA with SHA-256
      typ: 'JWT',
    },
    payload: {
      sub: 'user_id',
      role: 'user_role',
      iat: 'issued_at',
      exp: 'expires_at',
      aud: 'audience',
      iss: 'issuer',
    },
    signature: 'RS256 signature with private key',
  },
  
  // Key management
  keyManagement: {
    algorithm: 'RSA-4096',
    rotation: 'Automatic key rotation every 90 days',
    storage: 'AWS KMS or HashiCorp Vault',
    distribution: 'JWKS endpoint for public keys',
  },
  
  // Security measures
  security: {
    audience: 'Validate audience claim',
    issuer: 'Validate issuer claim',
    expiration: 'Strict expiration validation',
    signature: 'Verify signature with public key',
    replay: 'Prevent token replay attacks',
  },
};
```

### Authorization Framework
```typescript
// Role-based access control (RBAC)
export const rbacSystem = {
  // Role definitions
  roles: {
    customer: {
      description: 'Regular customer account',
      permissions: [
        'profile:read',
        'profile:update',
        'orders:read_own',
        'cart:manage_own',
        'addresses:manage_own',
      ],
    },
    
    customerService: {
      description: 'Customer service representative',
      permissions: [
        'customers:read',
        'orders:read',
        'orders:update_status',
        'refunds:process',
      ],
    },
    
    admin: {
      description: 'System administrator',
      permissions: [
        'products:manage',
        'categories:manage',
        'orders:manage',
        'customers:read',
        'analytics:read',
      ],
    },
    
    superAdmin: {
      description: 'Super administrator',
      permissions: [
        '*:*', // All permissions
      ],
    },
  },
  
  // Permission enforcement
  enforcement: {
    middleware: 'Express.js middleware for API routes',
    hooks: 'React hooks for frontend components',
    database: 'Row-level security in PostgreSQL',
    caching: 'Permission caching for performance',
  },
  
  // Attribute-based access control (ABAC)
  attributes: {
    user: ['role', 'department', 'location', 'clearance'],
    resource: ['type', 'owner', 'classification', 'created_date'],
    environment: ['time', 'location', 'device', 'network'],
    action: ['type', 'urgency', 'risk_level'],
  },
};

// Permission checking implementation
export class PermissionChecker {
  static hasPermission(
    userPermissions: string[],
    requiredPermission: string
  ): boolean {
    // Check for wildcard permissions
    if (userPermissions.includes('*:*')) {
      return true;
    }
    
    // Check for specific permission
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }
    
    // Check for resource wildcard
    const [resource, action] = requiredPermission.split(':');
    if (userPermissions.includes(`${resource}:*`)) {
      return true;
    }
    
    return false;
  }
  
  static checkResourceOwnership(
    userId: string,
    resourceOwnerId: string,
    permission: string
  ): boolean {
    // Allow if user owns the resource
    if (userId === resourceOwnerId) {
      return true;
    }
    
    // Check if user has global permission
    return this.hasPermission(
      getUserPermissions(userId),
      permission
    );
  }
}
```

---

## API Security

### API Security Framework
```typescript
// API security implementation
export const apiSecurity = {
  // Authentication
  authentication: {
    bearer: 'Bearer token authentication',
    jwt: 'JSON Web Token validation',
    refresh: 'Refresh token mechanism',
    expiry: 'Token expiration handling',
  },
  
  // Rate limiting
  rateLimiting: {
    strategy: 'Token bucket algorithm',
    limits: {
      authenticated: '1000 requests/hour',
      unauthenticated: '100 requests/hour',
      payment: '10 requests/minute',
      admin: '5000 requests/hour',
    },
    headers: 'Rate limit headers in response',
    storage: 'Redis for rate limit counters',
  },
  
  // Input validation
  inputValidation: {
    schema: 'Zod schema validation',
    sanitization: 'Input sanitization',
    encoding: 'Proper encoding/decoding',
    limits: 'Request size limits',
  },
  
  // Output security
  outputSecurity: {
    sanitization: 'Output sanitization',
    encoding: 'Proper content encoding',
    headers: 'Security headers',
    errors: 'Secure error messages',
  },
};

// API rate limiting implementation
export class RateLimiter {
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  async checkLimit(
    identifier: string,
    limit: number,
    window: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - window * 1000;
    
    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests
    const current = await this.redis.zcard(key);
    
    if (current < limit) {
      // Add current request
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);
      await this.redis.expire(key, window);
      
      return {
        allowed: true,
        remaining: limit - current - 1,
        resetTime: now + window * 1000,
      };
    }
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: now + window * 1000,
    };
  }
}

// API security middleware
export function apiSecurityMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  next: NextFunction
) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CORS headers
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
}
```

### API Endpoint Security
```typescript
// Secure API endpoint implementation
export async function secureApiHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // 1. Request validation
    const validatedData = await validateRequest(req);
    
    // 2. Authentication
    const user = await authenticateRequest(req);
    
    // 3. Authorization
    await authorizeRequest(user, req.url, req.method);
    
    // 4. Rate limiting
    await checkRateLimit(req);
    
    // 5. Business logic
    const result = await processRequest(validatedData, user);
    
    // 6. Response sanitization
    const sanitizedResult = sanitizeResponse(result);
    
    // 7. Audit logging
    await logApiAccess(user, req, res, 'success');
    
    res.status(200).json(sanitizedResult);
    
  } catch (error) {
    await handleApiError(error, req, res);
  }
}

// Request validation
async function validateRequest(req: NextApiRequest) {
  const schema = getValidationSchema(req.url, req.method);
  
  try {
    return schema.parse({
      body: req.body,
      query: req.query,
      headers: req.headers,
    });
  } catch (error) {
    throw new ValidationError('Invalid request data', error);
  }
}

// Authentication
async function authenticateRequest(req: NextApiRequest) {
  const token = extractToken(req);
  
  if (!token) {
    throw new AuthenticationError('No authentication token provided');
  }
  
  try {
    const payload = jwt.verify(token, getPublicKey());
    const user = await getUserById(payload.sub);
    
    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid user');
    }
    
    return user;
  } catch (error) {
    throw new AuthenticationError('Invalid authentication token');
  }
}

// Authorization
async function authorizeRequest(
  user: User,
  endpoint: string,
  method: string
) {
  const requiredPermission = getRequiredPermission(endpoint, method);
  
  if (!PermissionChecker.hasPermission(user.permissions, requiredPermission)) {
    throw new AuthorizationError('Insufficient permissions');
  }
}
```

---

## Infrastructure Security

### Cloud Security Configuration
```typescript
// AWS security configuration example
export const awsSecurityConfig = {
  // VPC configuration
  vpc: {
    cidr: '10.0.0.0/16',
    subnets: {
      public: ['10.0.1.0/24', '10.0.2.0/24'],
      private: ['10.0.10.0/24', '10.0.20.0/24'],
      database: ['10.0.100.0/24', '10.0.200.0/24'],
    },
    securityGroups: {
      web: {
        ingress: [
          { port: 80, source: '0.0.0.0/0' },
          { port: 443, source: '0.0.0.0/0' },
        ],
        egress: [
          { port: 443, destination: '0.0.0.0/0' },
          { port: 5432, destination: 'database-sg' },
        ],
      },
      database: {
        ingress: [
          { port: 5432, source: 'web-sg' },
        ],
        egress: [],
      },
    },
  },
  
  // IAM configuration
  iam: {
    policies: {
      leastPrivilege: 'Minimum required permissions',
      roleSeparation: 'Separate roles for different functions',
      temporaryCredentials: 'Use temporary credentials where possible',
      mfa: 'MFA required for sensitive operations',
    },
    
    roles: {
      webServer: ['s3:GetObject', 'secretsmanager:GetSecretValue'],
      database: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      deployment: ['ecs:UpdateService', 'ecr:BatchGetImage'],
    },
  },
  
  // Encryption configuration
  encryption: {
    ebs: 'AES-256 encryption for all EBS volumes',
    s3: 'Server-side encryption with S3-managed keys',
    rds: 'Encryption at rest with customer-managed keys',
    secrets: 'AWS Secrets Manager with KMS encryption',
  },
  
  // Monitoring configuration
  monitoring: {
    cloudTrail: 'All API calls logged',
    guardDuty: 'Threat detection enabled',
    inspector: 'Vulnerability assessment enabled',
    config: 'Configuration compliance monitoring',
  },
};
```

### Container Security
```dockerfile
# Secure Dockerfile practices
FROM node:18-alpine AS base

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY --chown=nextjs:nodejs . .

# Build application
RUN npm run build && \
    rm -rf .next/cache

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Run with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
```

```yaml
# Kubernetes security configuration
apiVersion: v1
kind: Pod
metadata:
  name: founders-day-app
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 1001
    seccompProfile:
      type: RuntimeDefault
  
  containers:
  - name: app
    image: founders-day:latest
    
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
    
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
      limits:
        memory: "512Mi"
        cpu: "500m"
    
    livenessProbe:
      httpGet:
        path: /api/health
        port: 3000
      initialDelaySeconds: 30
      periodSeconds: 10
    
    readinessProbe:
      httpGet:
        path: /api/ready
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 5
```

---

## Monitoring & Incident Response

### Security Monitoring
```typescript
// Security monitoring implementation
export const securityMonitoring = {
  // Log collection
  logCollection: {
    sources: [
      'Application logs',
      'Web server logs',
      'Database logs',
      'System logs',
      'Security tool logs',
    ],
    
    format: 'Structured JSON logging',
    transport: 'Secure log transport (TLS)',
    retention: 'Encrypted storage with retention policies',
    integrity: 'Log tampering protection',
  },
  
  // Security events
  securityEvents: [
    'Failed authentication attempts',
    'Privilege escalation attempts',
    'Suspicious API calls',
    'Data access anomalies',
    'Payment processing errors',
    'System configuration changes',
  ],
  
  // Alerting rules
  alertingRules: {
    authentication: {
      trigger: '5 failed attempts in 5 minutes',
      action: 'Block IP and notify security team',
      escalation: 'Page on-call if persistent',
    },
    
    dataAccess: {
      trigger: 'Unusual data access patterns',
      action: 'Flag for investigation',
      escalation: 'Alert security team if high-risk',
    },
    
    payment: {
      trigger: 'Payment processing anomalies',
      action: 'Immediate investigation',
      escalation: 'Page security and finance teams',
    },
  },
  
  // Threat detection
  threatDetection: {
    behavioral: 'User behavior analytics (UBA)',
    network: 'Network intrusion detection',
    endpoint: 'Endpoint detection and response',
    application: 'Application security monitoring',
  },
};

// Security incident classification
export const incidentClassification = {
  severity: {
    critical: {
      description: 'System compromise or data breach',
      response: 'Immediate response required',
      sla: 'Response within 15 minutes',
      escalation: 'Executive notification',
    },
    
    high: {
      description: 'Security vulnerability exploitation',
      response: 'Urgent response required',
      sla: 'Response within 1 hour',
      escalation: 'Security team lead notification',
    },
    
    medium: {
      description: 'Policy violation or suspicious activity',
      response: 'Investigation required',
      sla: 'Response within 4 hours',
      escalation: 'Security team notification',
    },
    
    low: {
      description: 'Minor security event',
      response: 'Standard investigation',
      sla: 'Response within 24 hours',
      escalation: 'Log for analysis',
    },
  },
  
  categories: [
    'Data breach',
    'System intrusion',
    'Malware infection',
    'Denial of service',
    'Fraud/abuse',
    'Policy violation',
    'Configuration error',
    'Physical security',
  ],
};
```

### Incident Response Procedures
```typescript
// Incident response workflow
export const incidentResponse = {
  // Response phases
  phases: {
    preparation: {
      team: 'Incident response team formation',
      procedures: 'Documented response procedures',
      tools: 'Incident response tools and systems',
      training: 'Regular training and drills',
    },
    
    identification: {
      detection: 'Automated threat detection',
      analysis: 'Initial incident analysis',
      classification: 'Severity and type classification',
      notification: 'Stakeholder notification',
    },
    
    containment: {
      isolation: 'Isolate affected systems',
      preservation: 'Preserve evidence',
      communication: 'Internal communication',
      escalation: 'Escalate if necessary',
    },
    
    eradication: {
      analysis: 'Root cause analysis',
      removal: 'Remove threat from environment',
      patching: 'Apply security patches',
      hardening: 'Improve security posture',
    },
    
    recovery: {
      restoration: 'Restore systems from clean backups',
      monitoring: 'Enhanced monitoring',
      testing: 'System functionality testing',
      validation: 'Security validation',
    },
    
    lessons: {
      analysis: 'Post-incident analysis',
      documentation: 'Update documentation',
      improvement: 'Process improvements',
      training: 'Additional training if needed',
    },
  },
  
  // Communication plan
  communication: {
    internal: {
      immediate: ['Security team', 'IT team', 'Management'],
      within1hour: ['All staff', 'Board members'],
      within4hours: ['Customers (if affected)', 'Partners'],
    },
    
    external: {
      regulatory: ['Regulatory bodies (if required)'],
      legal: ['Legal team', 'Law enforcement'],
      public: ['Media', 'Public relations'],
    },
    
    templates: [
      'Initial incident notification',
      'Incident update template',
      'Customer notification template',
      'Public statement template',
    ],
  },
};

// Incident response automation
export class IncidentResponseAutomation {
  async detectIncident(event: SecurityEvent): Promise<void> {
    // Analyze security event
    const incident = await this.analyzeEvent(event);
    
    if (incident.severity >= Severity.HIGH) {
      // Immediate containment actions
      await this.performContainment(incident);
      
      // Notification
      await this.notifyResponders(incident);
      
      // Evidence collection
      await this.collectEvidence(incident);
    }
  }
  
  private async performContainment(incident: Incident): Promise<void> {
    switch (incident.type) {
      case 'compromised_account':
        await this.disableAccount(incident.affectedUser);
        await this.revokeTokens(incident.affectedUser);
        break;
        
      case 'suspicious_payment':
        await this.flagTransaction(incident.transactionId);
        await this.notifyFraudTeam(incident);
        break;
        
      case 'system_intrusion':
        await this.blockSourceIP(incident.sourceIP);
        await this.isolateSystem(incident.affectedSystem);
        break;
    }
  }
}
```

---

## Compliance Auditing

### Audit Framework
```typescript
// Compliance audit framework
export const auditFramework = {
  // Audit scope
  scope: {
    systems: 'All systems handling payment data',
    processes: 'Security and operational processes',
    personnel: 'Staff with access to sensitive data',
    vendors: 'Third-party service providers',
  },
  
  // Audit types
  types: {
    internal: {
      frequency: 'Quarterly',
      scope: 'Comprehensive internal assessment',
      team: 'Internal audit team',
      reporting: 'Management and board',
    },
    
    external: {
      frequency: 'Annual',
      scope: 'Independent third-party assessment',
      certifications: ['PCI DSS', 'SOC 2 Type II'],
      reporting: 'Stakeholders and regulators',
    },
    
    penetration: {
      frequency: 'Bi-annual',
      scope: 'Technical security assessment',
      team: 'External security firm',
      reporting: 'Security and IT teams',
    },
  },
  
  // Audit checklist
  checklist: {
    pciDss: [
      'Firewall configuration review',
      'Default password assessment',
      'Cardholder data protection',
      'Encryption implementation',
      'Antivirus deployment',
      'Secure system development',
      'Access control measures',
      'Unique ID assignment',
      'Physical access restrictions',
      'Network monitoring',
      'Regular security testing',
      'Information security policy',
    ],
    
    gdpr: [
      'Lawful basis for processing',
      'Consent mechanisms',
      'Data subject rights',
      'Privacy by design',
      'Data protection impact assessments',
      'Data breach procedures',
      'Data processor agreements',
      'International data transfers',
    ],
  },
};

// Audit evidence collection
export class AuditEvidenceCollector {
  async collectSystemConfiguration(): Promise<AuditEvidence> {
    return {
      firewallRules: await this.getFirewallConfiguration(),
      systemHardening: await this.getSystemHardening(),
      encryption: await this.getEncryptionStatus(),
      patches: await this.getPatchStatus(),
      accounts: await this.getAccountConfiguration(),
    };
  }
  
  async collectAccessLogs(dateRange: DateRange): Promise<AccessLog[]> {
    return await this.getAccessLogs({
      startDate: dateRange.start,
      endDate: dateRange.end,
      includeFailedAttempts: true,
      includePrivilegedAccess: true,
    });
  }
  
  async collectChangeManagement(): Promise<ChangeRecord[]> {
    return await this.getChangeRecords({
      types: ['system', 'application', 'configuration'],
      approvalStatus: 'all',
      includeDocs: true,
    });
  }
}
```

### Continuous Compliance Monitoring
```typescript
// Compliance monitoring system
export const complianceMonitoring = {
  // Automated checks
  automatedChecks: {
    daily: [
      'System patch status',
      'Antivirus status',
      'Backup verification',
      'SSL certificate expiration',
      'Failed login attempts',
    ],
    
    weekly: [
      'User access review',
      'Vulnerability scan results',
      'Configuration drift detection',
      'Log integrity verification',
    ],
    
    monthly: [
      'Access rights validation',
      'Data retention compliance',
      'Vendor security assessments',
      'Incident response testing',
    ],
  },
  
  // Compliance dashboard
  dashboard: {
    metrics: [
      'PCI DSS compliance score',
      'Security policy violations',
      'Patch compliance percentage',
      'Vulnerability remediation time',
      'Training completion rates',
    ],
    
    alerts: [
      'Compliance threshold breaches',
      'Failed automated checks',
      'Upcoming certification renewals',
      'Regulatory deadline notifications',
    ],
  },
  
  // Reporting
  reporting: {
    frequency: 'Monthly executive reports',
    recipients: ['CISO', 'CTO', 'CEO', 'Board'],
    contents: [
      'Compliance status summary',
      'Key risk indicators',
      'Remediation progress',
      'Upcoming requirements',
    ],
  },
};
```

---

## Privacy Policy Guidelines

### Privacy Policy Framework
```markdown
# Privacy Policy Template

## Information We Collect

### Personal Information
- **Account Information**: Name, email address, phone number, billing address
- **Payment Information**: Credit card details (processed by Square, not stored by us)
- **Order Information**: Purchase history, shipping addresses, order preferences
- **Communication**: Support requests, feedback, survey responses

### Automatically Collected Information
- **Usage Data**: Pages visited, time spent, click patterns
- **Device Information**: Browser type, operating system, IP address
- **Cookies**: Session cookies, preference cookies, analytics cookies

## How We Use Information

### Primary Purposes
- **Order Processing**: Fulfill orders, process payments, provide customer service
- **Account Management**: Maintain user accounts, provide order history
- **Communication**: Send order confirmations, shipping updates, important notices
- **Improvement**: Analyze usage patterns to improve our services

### Secondary Purposes (with consent)
- **Marketing**: Send promotional emails, product recommendations
- **Analytics**: Understand customer behavior and preferences
- **Personalization**: Customize user experience based on preferences

## Information Sharing

### Service Providers
- **Payment Processing**: Square (for payment processing)
- **Shipping**: Shipping carriers (for order fulfillment)
- **Email**: Email service providers (for communications)
- **Analytics**: Analytics providers (for usage analysis)

### Legal Requirements
- **Compliance**: When required by law or regulation
- **Protection**: To protect our rights or the rights of others
- **Safety**: To prevent fraud or ensure transaction security

## Your Rights

### Access and Control
- **Access**: Request access to your personal information
- **Correction**: Update or correct inaccurate information
- **Deletion**: Request deletion of your personal information
- **Portability**: Receive your data in a machine-readable format

### Communication Preferences
- **Opt-out**: Unsubscribe from marketing communications
- **Preferences**: Choose which communications you receive
- **Frequency**: Control how often you hear from us

## Data Security

### Protection Measures
- **Encryption**: All data encrypted in transit and at rest
- **Access Controls**: Strict access controls and authentication
- **Monitoring**: Continuous security monitoring and threat detection
- **Training**: Regular security training for all staff

### Incident Response
- **Detection**: Automated systems detect potential breaches
- **Response**: Immediate containment and investigation procedures
- **Notification**: Prompt notification of affected individuals
- **Remediation**: Steps to prevent similar incidents
```

### Cookie Policy Implementation
```typescript
// Cookie management system
export const cookieManagement = {
  // Cookie categories
  categories: {
    essential: {
      description: 'Required for website functionality',
      examples: ['Session cookies', 'Authentication tokens'],
      consent: 'Not required (legitimate interest)',
      expiry: 'Session or short-term',
    },
    
    functional: {
      description: 'Enhance website functionality',
      examples: ['Language preferences', 'Theme settings'],
      consent: 'Implied consent acceptable',
      expiry: 'Long-term (up to 1 year)',
    },
    
    analytics: {
      description: 'Understand website usage',
      examples: ['Google Analytics', 'Usage statistics'],
      consent: 'Explicit consent required',
      expiry: 'Medium-term (up to 2 years)',
    },
    
    marketing: {
      description: 'Personalized advertising',
      examples: ['Ad targeting', 'Social media pixels'],
      consent: 'Explicit consent required',
      expiry: 'Long-term (up to 2 years)',
    },
  },
  
  // Consent management
  consentManagement: {
    banner: 'Cookie consent banner on first visit',
    granular: 'Granular consent for each category',
    withdrawal: 'Easy consent withdrawal mechanism',
    records: 'Maintain consent records for compliance',
  },
  
  // Technical implementation
  implementation: {
    storage: 'Consent preferences in localStorage',
    validation: 'Validate consent before setting cookies',
    cleanup: 'Remove cookies when consent withdrawn',
    audit: 'Log all consent-related actions',
  },
};

// Cookie consent component
export const CookieConsent: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true,
    functional: false,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const consent = {
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
    };
    
    localStorage.setItem('cookie-consent', JSON.stringify(consent));
    initializeCookies(consent);
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    const consent = {
      ...preferences,
      timestamp: Date.now(),
    };
    
    localStorage.setItem('cookie-consent', JSON.stringify(consent));
    initializeCookies(consent);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="cookie-banner">
      {/* Cookie banner implementation */}
    </div>
  );
};
```

---

## Security Maintenance

### Regular Security Tasks
```typescript
// Security maintenance schedule
export const securityMaintenance = {
  // Daily tasks
  daily: [
    'Monitor security alerts',
    'Review failed login attempts',
    'Check system health indicators',
    'Verify backup completion',
    'Review payment processing logs',
  ],
  
  // Weekly tasks
  weekly: [
    'Review access logs',
    'Update security documentation',
    'Test incident response procedures',
    'Analyze vulnerability scan results',
    'Review third-party security status',
  ],
  
  // Monthly tasks
  monthly: [
    'Security awareness training',
    'Access rights review',
    'Vendor security assessment',
    'Security metrics reporting',
    'Policy and procedure updates',
  ],
  
  // Quarterly tasks
  quarterly: [
    'Penetration testing',
    'Business continuity testing',
    'Security architecture review',
    'Compliance audit preparation',
    'Risk assessment updates',
  ],
  
  // Annual tasks
  annual: [
    'Comprehensive security audit',
    'PCI DSS certification renewal',
    'Security policy review',
    'Incident response plan update',
    'Security training program review',
  ],
};

// Security metrics tracking
export const securityMetrics = {
  // Key performance indicators
  kpis: {
    availability: {
      target: '99.9% uptime',
      measurement: 'System availability monitoring',
      reporting: 'Real-time dashboard',
    },
    
    responseTime: {
      target: 'Incident response within SLA',
      measurement: 'Time to detection and response',
      reporting: 'Monthly incident reports',
    },
    
    vulnerability: {
      target: 'Critical vulnerabilities patched within 24 hours',
      measurement: 'Vulnerability management system',
      reporting: 'Weekly vulnerability reports',
    },
    
    compliance: {
      target: '100% compliance with security standards',
      measurement: 'Automated compliance checks',
      reporting: 'Monthly compliance dashboard',
    },
  },
  
  // Risk indicators
  riskIndicators: [
    'Number of security incidents',
    'Mean time to detect (MTTD)',
    'Mean time to respond (MTTR)',
    'Vulnerability exposure time',
    'Failed authentication rate',
    'Compliance score',
  ],
};
```

### Security Documentation Maintenance
```typescript
// Documentation management
export const securityDocumentation = {
  // Document types
  types: {
    policies: {
      examples: ['Security Policy', 'Privacy Policy', 'Incident Response Policy'],
      review: 'Annual review and approval',
      owner: 'Chief Information Security Officer',
      approval: 'Executive management',
    },
    
    procedures: {
      examples: ['Incident Response Procedures', 'Access Control Procedures'],
      review: 'Semi-annual review',
      owner: 'Security team leads',
      approval: 'Security manager',
    },
    
    guidelines: {
      examples: ['Secure Coding Guidelines', 'System Hardening Guidelines'],
      review: 'Quarterly review',
      owner: 'Technical leads',
      approval: 'Security architect',
    },
    
    runbooks: {
      examples: ['Security Incident Runbook', 'Disaster Recovery Runbook'],
      review: 'Monthly review',
      owner: 'Operations team',
      approval: 'Operations manager',
    },
  },
  
  // Version control
  versionControl: {
    system: 'Git-based documentation system',
    approval: 'Pull request approval workflow',
    history: 'Complete change history',
    distribution: 'Automated distribution to stakeholders',
  },
  
  // Training integration
  training: {
    onboarding: 'Security documentation in onboarding',
    updates: 'Training on documentation updates',
    testing: 'Knowledge testing on critical procedures',
    reinforcement: 'Regular refresher training',
  },
};
```

---

This comprehensive security and compliance documentation provides a complete framework for implementing and maintaining enterprise-grade security for the Square payment integration. It covers all aspects from technical implementation to regulatory compliance and ongoing security operations.