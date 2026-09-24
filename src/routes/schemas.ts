import { z } from 'zod';

/** PostgreSQL accepts any hex UUID. Zod 4's uuid() rejects the seeded ids. */
export const uuidString = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID');

const blankToNull = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => {
      if (value == null || value === '') return value === undefined ? undefined : null;
      return value;
    });

export const uuidParam = z.object({
  id: uuidString,
});

export const userIdParam = z.object({
  id: uuidString,
  userId: uuidString,
});

export const loginBody = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
});

export const clientBody = z.object({
  name: z.string().trim().min(1).max(255),
  clientCode: blankToNull(100),
  addressLine1: blankToNull(255),
  addressLine2: blankToNull(255),
  city: blankToNull(100),
  postalCode: blankToNull(50),
  country: blankToNull(100),
  phone: blankToNull(50),
  email: blankToNull(255),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const clientPatchBody = clientBody.partial();

export const vesselBody = z.object({
  clientId: uuidString,
  name: z.string().trim().min(1).max(255),
  imoNumber: blankToNull(30),
  vesselType: blankToNull(100),
  currentLocation: blankToNull(255),
  description: blankToNull(5000),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const vesselPatchBody = vesselBody.partial();

export const teamBody = z.object({
  name: z.string().trim().min(1).max(255),
  description: blankToNull(5000),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const teamPatchBody = teamBody.partial();

export const memberBody = z.object({
  userId: uuidString,
});

export const createProjectBody = z.object({
  vesselId: uuidString,
  title: z.string().trim().min(1).max(255),
  description: blankToNull(5000),
  notes: blankToNull(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  mode: z.enum(['MANUAL', 'TEAM']),
  technicianIds: z.array(uuidString).default([]),
  teamId: uuidString.nullable().optional(),
  additionalTechnicianIds: z.array(uuidString).default([]),
});

export const updateProjectBody = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: blankToNull(5000),
  notes: blankToNull(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  status: z
    .enum([
      'OPEN',
      'IN_PROGRESS',
      'WAITING_FOR_INFO',
      'UNDER_REVIEW',
      'COMPLETED',
      'CLOSED',
    ])
    .optional(),
});

export const createFindingBody = z.object({
  title: blankToNull(255),
  description: z.string().trim().min(1).max(10000),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  equipmentName: blankToNull(255),
  equipmentModel: blankToNull(255),
  equipmentLocation: blankToNull(255),
});

export const updateFindingBody = z.object({
  title: blankToNull(255),
  description: z.string().trim().min(1).max(10000).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  status: z
    .enum(['OPEN', 'NEEDS_INFO', 'UNDER_REVIEW', 'REVIEWED', 'CLOSED'])
    .optional(),
  equipmentName: blankToNull(255),
  equipmentModel: blankToNull(255),
  equipmentLocation: blankToNull(255),
});

export const findingUpdateBody = z.object({
  note: z.string().trim().min(1).max(10000),
});

export const projectIdParam = z.object({
  projectId: uuidString,
});

export const managedUserBody = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(1).max(255),
  role: z.enum(['BACKOFFICE', 'TECHNICIAN']),
  password: z.string().min(6).max(200).optional(),
  isActive: z.boolean().optional(),
});

export const createManagedUserBody = managedUserBody.extend({
  password: z.string().min(6).max(200),
});

export const updateManagedUserBody = managedUserBody.partial();
