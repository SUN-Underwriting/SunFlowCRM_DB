import { BaseService } from '../base-service';
import { prisma } from '@/lib/db/prisma';
import { FieldEntityType, FieldType } from '@prisma/client';
import { ValidationError } from '@/lib/errors/app-errors';

export interface CreateFieldDefinitionInput {
  entityType: FieldEntityType;
  key: string;
  label: string;
  fieldType: FieldType;
  options?: string[]; // For SELECT/MULTI_SELECT
  sortOrder?: number;
}

export interface UpdateFieldDefinitionInput {
  label?: string;
  fieldType?: FieldType;
  options?: string[];
  sortOrder?: number;
}

export class FieldDefinitionService extends BaseService {
  /**
   * List field definitions for an entity type
   */
  async listByEntityType(entityType: FieldEntityType) {
    const fields = await prisma.fieldDefinition.findMany({
      where: {
        ...this.getTenantFilter(),
        entityType,
        deleted: false // Soft delete filter
      },
      orderBy: { sortOrder: 'asc' }
    });

    return fields;
  }

  /**
   * Get field definition by ID
   */
  async getById(id: string) {
    const field = await prisma.fieldDefinition.findFirst({
      where: {
        id,
        deleted: false // Soft delete filter
      }
    });

    this.ensureTenantAccess(field);
    return field;
  }

  /**
   * Create new field definition
   * Context7: Wrap check-then-create in transaction to prevent race condition
   */
  async create(input: CreateFieldDefinitionInput) {
    // Validate options for SELECT/MULTI_SELECT
    if (
      (input.fieldType === FieldType.SELECT ||
        input.fieldType === FieldType.MULTI_SELECT) &&
      (!input.options || input.options.length === 0)
    ) {
      throw new ValidationError(
        'Options are required for SELECT and MULTI_SELECT field types'
      );
    }

    // Context7: Interactive transaction for conditional check-then-create with sortOrder calculation
    return await prisma.$transaction(async (tx) => {
      // Check for duplicate key (exclude soft-deleted)
      const existing = await tx.fieldDefinition.findFirst({
        where: {
          tenantId: this.tenantId,
          entityType: input.entityType,
          key: input.key,
          deleted: false
        }
      });

      if (existing) {
        throw new ValidationError(
          `Field with key "${input.key}" already exists for ${input.entityType}`
        );
      }

      // Auto-assign sort order if not provided (exclude soft-deleted)
      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const maxField = await tx.fieldDefinition.findFirst({
          where: {
            tenantId: this.tenantId,
            entityType: input.entityType,
            deleted: false
          },
          orderBy: { sortOrder: 'desc' }
        });
        sortOrder = (maxField?.sortOrder ?? -1) + 1;
      }

      return await tx.fieldDefinition.create({
        data: {
          ...input,
          tenantId: this.tenantId,
          sortOrder,
          options: input.options || []
        }
      });
    });
  }

  /**
   * Update field definition
   */
  async update(id: string, input: UpdateFieldDefinitionInput) {
    const existing = await prisma.fieldDefinition.findUnique({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    // Validate options if changing to SELECT/MULTI_SELECT
    if (
      input.fieldType &&
      (input.fieldType === FieldType.SELECT ||
        input.fieldType === FieldType.MULTI_SELECT) &&
      (!input.options || input.options.length === 0)
    ) {
      throw new ValidationError(
        'Options are required for SELECT and MULTI_SELECT field types'
      );
    }

    const field = await prisma.fieldDefinition.update({
      where: { id },
      data: input
    });

    return field;
  }

  /**
   * Soft delete field definition (preserves schema history)
   * Best Practice: Never hard delete field definitions - breaks data integrity
   */
  async delete(id: string) {
    const existing = await prisma.fieldDefinition.findFirst({
      where: { id, deleted: false }
    });
    this.ensureTenantAccess(existing);

    await prisma.fieldDefinition.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date()
      }
    });

    return { success: true };
  }

  /**
   * Validate custom field value against definition
   */
  validateValue(
    field: { fieldType: FieldType; options?: any },
    value: any
  ): boolean {
    switch (field.fieldType) {
      case FieldType.TEXT:
        return typeof value === 'string';

      case FieldType.NUMBER:
        return typeof value === 'number' && !isNaN(value);

      case FieldType.DATE:
        return value instanceof Date || !isNaN(Date.parse(value));

      case FieldType.SELECT:
        const options = Array.isArray(field.options) ? field.options : [];
        return typeof value === 'string' && options.includes(value);

      case FieldType.MULTI_SELECT:
        const multiOptions = Array.isArray(field.options) ? field.options : [];
        return (
          Array.isArray(value) &&
          value.every((v) => typeof v === 'string' && multiOptions.includes(v))
        );

      default:
        return false;
    }
  }
}
