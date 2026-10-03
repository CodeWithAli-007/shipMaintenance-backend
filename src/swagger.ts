import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';

const uuid = { type: 'string', format: 'uuid' } as const;
const entityStatus = { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } as const;

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Ship Maintenance API',
    version: '0.1.0',
    description: [
      'Backoffice/Admin API. Auth uses HttpOnly session cookie `shipmaintenance_session` plus CSRF cookie `shipmaintenance_csrf`.',
      'Mutating requests (POST/PATCH/PUT/DELETE) must send header `X-CSRF-Token` matching the CSRF cookie.',
      'Swagger UI is mounted only when `NODE_ENV=development`.',
    ].join(' '),
  },
  servers: [{ url: `http://localhost:${env.port}`, description: 'Local API' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Clients' },
    { name: 'Vessels' },
    { name: 'Teams' },
    { name: 'Projects' },
    { name: 'Findings' },
    { name: 'Users' },
    { name: 'Admin' },
    { name: 'Access' },
  ],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'shipmaintenance_session',
        description: 'Set automatically after POST /api/auth/login (browser cookie jar).',
      },
      csrfHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-CSRF-Token',
        description: 'Required for mutations. Value equals the `shipmaintenance_csrf` cookie.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      ClientBody: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          clientCode: { type: 'string', nullable: true },
          addressLine1: { type: 'string', nullable: true },
          addressLine2: { type: 'string', nullable: true },
          city: { type: 'string', nullable: true },
          postalCode: { type: 'string', nullable: true },
          country: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          status: entityStatus,
        },
      },
      VesselBody: {
        type: 'object',
        required: ['clientId', 'name'],
        properties: {
          clientId: uuid,
          name: { type: 'string' },
          imoNumber: { type: 'string', nullable: true },
          vesselType: { type: 'string', nullable: true },
          currentLocation: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          status: entityStatus,
        },
      },
      TeamBody: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          status: entityStatus,
        },
      },
      MemberBody: {
        type: 'object',
        required: ['userId'],
        properties: { userId: uuid },
      },
      CreateProjectBody: {
        type: 'object',
        required: ['vesselId', 'title', 'mode'],
        properties: {
          vesselId: uuid,
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
          mode: { type: 'string', enum: ['MANUAL', 'TEAM'] },
          technicianIds: { type: 'array', items: uuid, default: [] },
          teamId: { ...uuid, nullable: true },
          additionalTechnicianIds: { type: 'array', items: uuid, default: [] },
        },
      },
      UpdateProjectBody: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          status: {
            type: 'string',
            enum: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_INFO', 'UNDER_REVIEW', 'COMPLETED', 'CLOSED'],
          },
        },
      },
      CreateFindingBody: {
        type: 'object',
        required: ['description'],
        properties: {
          title: { type: 'string', nullable: true },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
          equipmentName: { type: 'string', nullable: true },
          equipmentModel: { type: 'string', nullable: true },
          equipmentLocation: { type: 'string', nullable: true },
        },
      },
      UpdateFindingBody: {
        type: 'object',
        properties: {
          title: { type: 'string', nullable: true },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          status: {
            type: 'string',
            enum: ['OPEN', 'NEEDS_INFO', 'UNDER_REVIEW', 'REVIEWED', 'CLOSED'],
          },
          equipmentName: { type: 'string', nullable: true },
          equipmentModel: { type: 'string', nullable: true },
          equipmentLocation: { type: 'string', nullable: true },
        },
      },
      FindingUpdateBody: {
        type: 'object',
        required: ['note'],
        properties: { note: { type: 'string' } },
      },
      FindingMessageBody: {
        type: 'object',
        required: ['requestId'],
        properties: {
          requestId: uuid,
          note: { type: 'string' },
          internal: { type: 'boolean', default: false },
          files: {
            type: 'array',
            maxItems: 8,
            items: {
              type: 'object',
              required: ['name', 'type', 'data'],
              properties: {
                name: { type: 'string' },
                type: { type: 'string', description: 'MIME type' },
                data: { type: 'string', description: 'Base64 payload' },
              },
            },
          },
        },
      },
      ManagedUserCreate: {
        type: 'object',
        required: ['email', 'fullName', 'role', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string' },
          role: { type: 'string', enum: ['BACKOFFICE', 'TECHNICIAN'] },
          password: { type: 'string', minLength: 6 },
          isActive: { type: 'boolean' },
        },
      },
      ManagedUserUpdate: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          fullName: { type: 'string' },
          role: { type: 'string', enum: ['BACKOFFICE', 'TECHNICIAN'] },
          password: { type: 'string', minLength: 6 },
          isActive: { type: 'boolean' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: {
          '200': { description: 'OK' },
          '503': { description: 'Database down' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login (sets session + CSRF cookies)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
              example: { email: 'backoffice@example.com', password: 'password' },
            },
          },
        },
        responses: {
          '200': { description: 'Logged in; Set-Cookie headers issued' },
          '401': { description: 'Invalid credentials' },
          '429': { description: 'Rate limited' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user',
        security: [{ sessionCookie: [] }],
        responses: {
          '200': { description: 'User + optional csrfToken' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/auth/csrf': {
      get: {
        tags: ['Auth'],
        summary: 'Read CSRF token (for native clients)',
        security: [{ sessionCookie: [] }],
        responses: {
          '200': { description: '{ csrfToken }' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Invalid CSRF' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        responses: {
          '204': { description: 'Logged out' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/clients': {
      get: {
        tags: ['Clients'],
        summary: 'List clients',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'search', in: 'query', schema: { type: 'string' } }],
        responses: { '200': { description: '{ clients }' } },
      },
      post: {
        tags: ['Clients'],
        summary: 'Create client',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientBody' } } },
        },
        responses: { '201': { description: '{ client }' } },
      },
    },
    '/api/clients/{id}': {
      get: {
        tags: ['Clients'],
        summary: 'Get client',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        responses: { '200': { description: '{ client }' } },
      },
      patch: {
        tags: ['Clients'],
        summary: 'Update client',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          content: {
            'application/json': {
              schema: { allOf: [{ $ref: '#/components/schemas/ClientBody' }], description: 'Partial' },
            },
          },
        },
        responses: { '200': { description: '{ client }' } },
      },
    },
    '/api/vessels': {
      get: {
        tags: ['Vessels'],
        summary: 'List vessels',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'clientId', in: 'query', schema: uuid },
        ],
        responses: { '200': { description: '{ vessels }' } },
      },
      post: {
        tags: ['Vessels'],
        summary: 'Create vessel',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/VesselBody' } } },
        },
        responses: { '201': { description: '{ vessel }' } },
      },
    },
    '/api/vessels/{id}': {
      get: {
        tags: ['Vessels'],
        summary: 'Get vessel',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        responses: { '200': { description: '{ vessel }' } },
      },
      patch: {
        tags: ['Vessels'],
        summary: 'Update vessel',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/VesselBody' } } },
        },
        responses: { '200': { description: '{ vessel }' } },
      },
    },
    '/api/teams': {
      get: {
        tags: ['Teams'],
        summary: 'List teams',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: '{ teams }' } },
      },
      post: {
        tags: ['Teams'],
        summary: 'Create team',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamBody' } } },
        },
        responses: { '201': { description: '{ team }' } },
      },
    },
    '/api/teams/{id}': {
      get: {
        tags: ['Teams'],
        summary: 'Get team',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        responses: { '200': { description: '{ team }' } },
      },
      patch: {
        tags: ['Teams'],
        summary: 'Update team',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamBody' } } },
        },
        responses: { '200': { description: '{ team }' } },
      },
    },
    '/api/teams/{id}/members': {
      post: {
        tags: ['Teams'],
        summary: 'Add team member',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MemberBody' } } },
        },
        responses: { '201': { description: '{ team }' } },
      },
    },
    '/api/teams/{id}/members/{userId}/remove': {
      post: {
        tags: ['Teams'],
        summary: 'Remove team member',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: uuid },
          { name: 'userId', in: 'path', required: true, schema: uuid },
        ],
        responses: { '200': { description: '{ team }' } },
      },
    },
    '/api/projects': {
      get: {
        tags: ['Projects'],
        summary: 'List projects (membership-scoped)',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: '{ projects }' } },
      },
      post: {
        tags: ['Projects'],
        summary: 'Create project (snapshots team members when mode=TEAM)',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProjectBody' } } },
        },
        responses: { '201': { description: '{ project }' } },
      },
    },
    '/api/projects/{id}': {
      get: {
        tags: ['Projects'],
        summary: 'Get project',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        responses: { '200': { description: '{ project }' } },
      },
      patch: {
        tags: ['Projects'],
        summary: 'Update project',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateProjectBody' } } },
        },
        responses: { '200': { description: '{ project }' } },
      },
    },
    '/api/projects/{id}/members': {
      post: {
        tags: ['Projects'],
        summary: 'Add MANUAL project member',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MemberBody' } } },
        },
        responses: { '201': { description: '{ project }' } },
      },
    },
    '/api/projects/{id}/members/{userId}/remove': {
      post: {
        tags: ['Projects'],
        summary: 'Remove project member',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: uuid },
          { name: 'userId', in: 'path', required: true, schema: uuid },
        ],
        responses: { '200': { description: '{ project }' } },
      },
    },
    '/api/projects/{projectId}/findings': {
      get: {
        tags: ['Findings'],
        summary: 'List findings for project',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: uuid }],
        responses: { '200': { description: '{ findings }' } },
      },
      post: {
        tags: ['Findings'],
        summary: 'Create finding',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateFindingBody' } } },
        },
        responses: { '201': { description: '{ finding }' } },
      },
    },
    '/api/findings/{id}': {
      get: {
        tags: ['Findings'],
        summary: 'Get finding',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        responses: { '200': { description: '{ finding }' } },
      },
      patch: {
        tags: ['Findings'],
        summary: 'Update finding',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateFindingBody' } } },
        },
        responses: { '200': { description: '{ finding }' } },
      },
    },
    '/api/findings/{id}/updates': {
      post: {
        tags: ['Findings'],
        summary: 'Add finding update note',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/FindingUpdateBody' } } },
        },
        responses: { '201': { description: '{ finding }' } },
      },
    },
    '/api/findings/{id}/messages': {
      post: {
        tags: ['Findings'],
        summary: 'Post finding message (text + optional media)',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/FindingMessageBody' } } },
        },
        responses: { '201': { description: '{ finding }' } },
      },
    },
    '/api/findings/{id}/analyze': {
      post: {
        tags: ['Findings'],
        summary: 'AI-analyse finding with selected media (ephemeral; not persisted)',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mediaIds'],
                properties: {
                  mediaIds: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 8,
                    items: uuid,
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '{ analysis }' },
          '400': { description: 'Invalid media selection' },
          '503': { description: 'LLM service unavailable' },
        },
      },
    },
    '/api/findings/{id}/media/{mediaId}': {
      get: {
        tags: ['Findings'],
        summary: 'Download / inline media bytes',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: uuid },
          { name: 'mediaId', in: 'path', required: true, schema: uuid },
        ],
        responses: { '200': { description: 'Binary media' } },
      },
    },
    '/api/users': {
      get: {
        tags: ['Users'],
        summary: 'List users (backoffice)',
        security: [{ sessionCookie: [] }],
        parameters: [
          {
            name: 'role',
            in: 'query',
            schema: { type: 'string', enum: ['ADMIN', 'BACKOFFICE', 'TECHNICIAN'] },
          },
        ],
        responses: { '200': { description: '{ users }' } },
      },
    },
    '/api/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List managed users',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['BACKOFFICE', 'TECHNICIAN'] } },
          { name: 'includeInactive', in: 'query', schema: { type: 'string', enum: ['true', '1'] } },
        ],
        responses: { '200': { description: '{ users }' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create BACKOFFICE or TECHNICIAN user',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ManagedUserCreate' } } },
        },
        responses: { '201': { description: '{ user }' } },
      },
    },
    '/api/admin/users/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Get managed user',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        responses: { '200': { description: '{ user }' } },
      },
      patch: {
        tags: ['Admin'],
        summary: 'Update managed user',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ManagedUserUpdate' } } },
        },
        responses: { '200': { description: '{ user }' } },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Deactivate / delete managed user',
        security: [{ sessionCookie: [], csrfHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        responses: { '200': { description: '{ user }' } },
      },
    },
    '/api/access/projects/{projectId}': {
      get: {
        tags: ['Access'],
        summary: 'Check project access',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: uuid }],
        responses: { '200': { description: '{ projectId, allowed }' } },
      },
    },
    '/api/access/findings/{findingId}': {
      get: {
        tags: ['Access'],
        summary: 'Check finding access',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'findingId', in: 'path', required: true, schema: uuid }],
        responses: { '200': { description: '{ findingId, allowed }' } },
      },
    },
    '/api/backoffice/ping': {
      get: {
        tags: ['Access'],
        summary: 'Backoffice role ping',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: '{ ok, module }' } },
      },
    },
  },
};

/** Mount Swagger UI only in development. */
export function mountSwagger(app: Express): boolean {
  if (!env.isDevelopment) return false;

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'Ship Maintenance API',
      swaggerOptions: {
        withCredentials: true,
        persistAuthorization: true,
      },
    }),
  );
  app.get('/api-docs.json', (_req, res) => {
    res.json(openApiSpec);
  });
  return true;
}
