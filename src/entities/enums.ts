export enum UserRole {
  ADMIN = 'ADMIN',
  BACKOFFICE = 'BACKOFFICE',
  TECHNICIAN = 'TECHNICIAN',
}

export enum EntityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ProjectStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_FOR_INFO = 'WAITING_FOR_INFO',
  UNDER_REVIEW = 'UNDER_REVIEW',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}

export enum ProjectPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum AssignmentType {
  MANUAL = 'MANUAL',
  TEAM = 'TEAM',
}

export enum FindingSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum FindingStatus {
  OPEN = 'OPEN',
  NEEDS_INFO = 'NEEDS_INFO',
  UNDER_REVIEW = 'UNDER_REVIEW',
  REVIEWED = 'REVIEWED',
  CLOSED = 'CLOSED',
}

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
}

export enum CommentVisibility {
  TECHNICIAN_VISIBLE = 'TECHNICIAN_VISIBLE',
  INTERNAL = 'INTERNAL',
}
