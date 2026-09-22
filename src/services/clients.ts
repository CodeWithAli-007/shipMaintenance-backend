import { ILike } from 'typeorm';
import { AppDataSource } from '../data-source.js';
import { Client } from '../entities/Client.js';
import { EntityStatus } from '../entities/enums.js';
import { User } from '../entities/User.js';
import { NotFoundError } from '../lib/errors.js';
import { rethrowUnique } from '../lib/dbErrors.js';

export interface ClientInput {
  name: string;
  clientCode: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  status?: EntityStatus;
}

function toClientDto(client: Client) {
  const vessels = client.vessels ?? [];
  const projectCount = vessels.reduce(
    (sum, vessel) => sum + (vessel.projects?.length ?? 0),
    0,
  );

  return {
    id: client.id,
    name: client.name,
    clientCode: client.clientCode,
    addressLine1: client.addressLine1,
    addressLine2: client.addressLine2,
    city: client.city,
    postalCode: client.postalCode,
    country: client.country,
    phone: client.phone,
    email: client.email,
    status: client.status,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    vesselCount: vessels.length,
    projectCount,
  };
}

export async function listClients(search?: string) {
  const repo = AppDataSource.getRepository(Client);
  const term = search?.trim();
  const clients = await repo.find({
    where: term
      ? [
          { name: ILike(`%${term}%`) },
          { clientCode: ILike(`%${term}%`) },
          { email: ILike(`%${term}%`) },
          { city: ILike(`%${term}%`) },
        ]
      : undefined,
    relations: { vessels: { projects: true } },
    order: { name: 'ASC' },
  });

  return clients.map(toClientDto);
}

export async function getClient(id: string) {
  const client = await AppDataSource.getRepository(Client).findOne({
    where: { id },
    relations: { vessels: { projects: true } },
  });
  if (!client) {
    throw new NotFoundError('Client not found');
  }
  return toClientDto(client);
}

export async function createClient(input: ClientInput, actorId: string) {
  const repo = AppDataSource.getRepository(Client);
  const client = repo.create({
    ...input,
    status: input.status ?? EntityStatus.ACTIVE,
    createdBy: { id: actorId } as User,
  });

  try {
    const saved = await repo.save(client);
    return getClient(saved.id);
  } catch (error) {
    rethrowUnique(error, 'A client with this code already exists');
  }
}

export async function updateClient(id: string, input: Partial<ClientInput>) {
  const repo = AppDataSource.getRepository(Client);
  const client = await repo.findOne({ where: { id } });
  if (!client) {
    throw new NotFoundError('Client not found');
  }

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      Object.assign(client, { [key]: value });
    }
  }

  try {
    await repo.save(client);
  } catch (error) {
    rethrowUnique(error, 'A client with this code already exists');
  }

  return getClient(id);
}
