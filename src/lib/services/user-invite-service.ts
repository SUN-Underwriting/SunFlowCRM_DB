import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { BusinessRuleError, NotFoundError } from '@/lib/errors/app-errors';

const INVITE_TTL_HOURS = Number(process.env.INVITE_TTL_HOURS ?? 72);

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreateInviteInput {
  tenantId: string;
  userId: string;
  email: string;
  createdById?: string;
}

export class UserInviteService {
  static async create(input: CreateInviteInput) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

    const invite = await prisma.$transaction(async (tx) => {
      await tx.userInvite.updateMany({
        where: {
          tenantId: input.tenantId,
          email: input.email,
          acceptedAt: null,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });

      return tx.userInvite.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          email: input.email,
          tokenHash,
          expiresAt,
          createdById: input.createdById
        }
      });
    });

    return { invite, token };
  }

  static async verifyByToken(token: string) {
    if (!token) {
      throw new BusinessRuleError('Invite token is required');
    }

    const tokenHash = hashToken(token);
    const invite = await prisma.userInvite.findUnique({
      where: { tokenHash },
      include: {
        tenant: { select: { id: true, name: true } },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true
          }
        }
      }
    });

    if (!invite || invite.revokedAt) {
      throw new NotFoundError('Invite not found');
    }

    if (invite.acceptedAt) {
      throw new BusinessRuleError('Invite already accepted');
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      throw new BusinessRuleError('Invite has expired');
    }

    return invite;
  }

  static async acceptByToken(token: string) {
    const invite = await this.verifyByToken(token);

    const accepted = await prisma.$transaction(async (tx) => {
      await tx.userInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() }
      });

      const user = await tx.user.update({
        where: { id: invite.userId },
        data: { status: 'ACTIVE' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          tenantId: true
        }
      });

      return {
        user,
        tenant: invite.tenant
      };
    });

    return accepted;
  }
}
