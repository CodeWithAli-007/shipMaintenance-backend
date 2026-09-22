import { ILike } from 'typeorm';
import { AppDataSource } from '../data-source.js';
import { Client } from '../entities/Client.js';
import { Vessel } from '../entities/Vessel.js';
import { EntityStatus } from '../entities/enums.js';
import { User } from '../entities/User.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { rethrowUnique } from '../lib/dbErrors.js';

export interface VesselInput {
  clientId: string;
  name: string;
  imoNumber: string | null;
  vesselType: string | null;
  currentLocation: string | null;
  description: string | null;
  status?: EntityStatus;
}

function toVesselDto(vessel: Vessel) {
  return {
    id: vessel.id,
    name: vessel.name,
    imoNumber: vessel.imoNumber,
    vesselType: vessel.vesselType,
    currentLocation: vessel.currentLocation,
    description: vessel.description,
    status: vessel.status,
    createdAt: vessel.createdAt,
    updatedAt: vessel.updatedAt,
    projectCount: vessel.projects?.length ?? 0,
    client: {
      id: vessel.client.id,
      name: vessel.client.name,
      status: vessel.client.status,
    },
  };
}

async function requireClient(clientId: string, mustBeActive: boolean) {
  const client = await AppDataSource.getRepository(Client).findOne({
    where: { id: clientId },
  });
  if (!client) {
    throw new NotFoundError('Client not found');
  }
  if (mustBeActive && client.status !== EntityStatus.ACTIVE) {
    throw new ValidationError('Select an active client');
  }
  return client;
}

export async function listVessels(filters: { search?: string; clientId?: string }) {
  const term = filters.search?.trim();
  const vessels = await AppDataSource.getRepository(Vessel).find({
    where: term
      ? [
          {
            ...(filters.clientId ? { client: { id: filters.clientId } } : {}),
            name: ILike(`%${term}%`),
          },
          {
            ...(filters.clientId ? { client: { id: filters.clientId } } : {}),
            imoNumber: ILike(`%${term}%`),
          },
          {
            ...(filters.clientId ? { client: { id: filters.clientId } } : {}),
            currentLocation: ILike(`%${term}%`),
          },
        ]
      : filters.clientId
        ? { client: { id: filters.clientId } }
        : undefined,
    relations: { client: true, projects: true },
    order: { name: 'ASC' },
  });

  return vessels.map(toVesselDto);
}

export async function getVessel(id: string) {
  const vessel = await AppDataSource.getRepository(Vessel).findOne({
    where: { id },
    relations: { client: true, projects: true },
  });
  if (!vessel) {
    throw new NotFoundError('Vessel not found');
  }
  return toVesselDto(vessel);
}

export async function createVessel(input: VesselInput, actorId: string) {
  const client = await requireClient(input.clientId, true);
  const repo = AppDataSource.getRepository(Vessel);
  const vessel = repo.create({
    client,
    name: input.name,
    imoNumber: input.imoNumber,
    vesselType: input.vesselType,
    currentLocation: input.currentLocation,
    description: input.description,
    status: input.status ?? EntityStatus.ACTIVE,
    createdBy: { id: actorId } as User,
  });

  try {
    const saved = await repo.save(vessel);
    return getVessel(saved.id);
  } catch (error) {
    rethrowUnique(error, 'A vessel with this IMO number already exists');
  }
}

export async function updateVessel(id: string, input: Partial<VesselInput>) {
  const repo = AppDataSource.getRepository(Vessel);
  const vessel = await repo.findOne({
    where: { id },
    relations: { client: true },
  });
  if (!vessel) {
    throw new NotFoundError('Vessel not found');
  }

  if (input.clientId && input.clientId !== vessel.client.id) {
    vessel.client = await requireClient(input.clientId, true);
  }

  if (input.name !== undefined) vessel.name = input.name;
  if (input.imoNumber !== undefined) vessel.imoNumber = input.imoNumber;
  if (input.vesselType !== undefined) vessel.vesselType = input.vesselType;
  if (input.currentLocation !== undefined) {
    vessel.currentLocation = input.currentLocation;
  }
  if (input.description !== undefined) vessel.description = input.description;
  if (input.status !== undefined) vessel.status = input.status;

  try {
    await repo.save(vessel);
  } catch (error) {
    rethrowUnique(error, 'A vessel with this IMO number already exists');
  }

  return getVessel(id);
}
