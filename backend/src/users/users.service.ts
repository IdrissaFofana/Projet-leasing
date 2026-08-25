import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import {
  generateTempPassword,
  MODULES,
  resolvePermissions,
} from '../common/auth/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { CreateUserDto, UpdateProfileDto, UpdateUserDto } from './dto/user.dto';

const ROLE_METIER_SELECT = {
  id: true,
  code: true,
  libelle: true,
  permissions: true,
  systeme: true,
  actif: true,
} as const;

const PROFILE_SELECT = {
  id: true,
  email: true,
  nom: true,
  prenom: true,
  nomFamille: true,
  autreAdresse: true,
  telephone: true,
  autreTelephone: true,
  dateNaissance: true,
  avatarUrl: true,
  languePref: true,
  notifEmail: true,
  role: true,
  roleMetierId: true,
  roleMetier: { select: ROLE_METIER_SELECT },
  permissions: true,
  mustChangePassword: true,
  actif: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rolesService: RolesService,
  ) {}

  modulesCatalog() {
    return {
      modules: MODULES,
      defaultsByRole: {
        ADMIN: resolvePermissions('ADMIN'),
        TECHNICIEN: resolvePermissions('TECHNICIEN'),
        FACTURATION: resolvePermissions('FACTURATION'),
        LECTURE: resolvePermissions('LECTURE'),
      },
    };
  }

  listAssignees() {
    return this.prisma.utilisateur.findMany({
      where: { actif: true },
      select: { id: true, nom: true, email: true, role: true },
      orderBy: { nom: 'asc' },
    });
  }

  findAll() {
    return this.prisma.utilisateur.findMany({
      select: {
        id: true,
        email: true,
        nom: true,
        role: true,
        roleMetierId: true,
        roleMetier: { select: ROLE_METIER_SELECT },
        permissions: true,
        mustChangePassword: true,
        actif: true,
        createdAt: true,
      },
      orderBy: { nom: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id },
      select: PROFILE_SELECT,
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const fromMetier = Boolean(user.roleMetier?.actif);
    return {
      ...user,
      effectivePermissions: fromMetier
        ? user.roleMetier!.code === 'ADMIN'
          ? [...MODULES]
          : resolvePermissions(user.role, user.roleMetier!.permissions, {
              fromRoleMetier: true,
            })
        : resolvePermissions(user.role, user.permissions),
    };
  }

  async create(dto: CreateUserDto, actorId?: string) {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.utilisateur.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email deja utilise');

    const generated = !dto.password;
    const plain = dto.password ?? generateTempPassword(10);
    const motDePasseHash = await bcrypt.hash(plain, 10);

    let role = dto.role ?? ('TECHNICIEN' as const);
    let permissions = dto.permissions?.length
      ? dto.permissions
      : resolvePermissions(role);
    let roleMetierId: string | undefined = dto.roleMetierId;

    if (dto.roleMetierId) {
      const rm = await this.prisma.roleMetier.findUnique({
        where: { id: dto.roleMetierId },
      });
      if (!rm || !rm.actif) throw new NotFoundException('Rôle métier introuvable');
      const assigned = this.rolesService.resolveAssignment(rm);
      role = assigned.role;
      permissions = dto.permissions?.length ? dto.permissions : assigned.permissions;
      roleMetierId = rm.id;
    }

    const user = await this.prisma.utilisateur.create({
      data: {
        email,
        nom: dto.nom.trim(),
        role,
        roleMetierId,
        permissions,
        motDePasseHash,
        mustChangePassword: true,
      },
      select: PROFILE_SELECT,
    });

    await this.audit
      .log({
        userId: actorId ?? null,
        action: 'USER_CREATE',
        entite: 'utilisateur',
        entiteId: user.id,
        details: `Création compte ${user.email} · rôle ${user.roleMetier?.libelle ?? user.role} · MDP temporaire généré · changement obligatoire`,
        resultat: 'SUCCESS',
      })
      .catch(() => undefined);

    return {
      ...user,
      effectivePermissions: resolvePermissions(user.role, user.permissions),
      temporaryPassword: generated ? plain : undefined,
      generatedPassword: generated,
    };
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string) {
    const before = await this.findOne(id);
    const data: {
      nom?: string;
      role?: CreateUserDto['role'];
      roleMetierId?: string | null;
      actif?: boolean;
      motDePasseHash?: string;
      permissions?: string[];
      mustChangePassword?: boolean;
    } = {
      nom: dto.nom,
      role: dto.role,
      actif: dto.actif,
    };
    if (dto.permissions !== undefined) data.permissions = dto.permissions;
    if (dto.mustChangePassword !== undefined) {
      data.mustChangePassword = dto.mustChangePassword;
    }
    if (dto.roleMetierId !== undefined) {
      if (dto.roleMetierId === null || dto.roleMetierId === '') {
        data.roleMetierId = null;
      } else {
        const rm = await this.prisma.roleMetier.findUnique({
          where: { id: dto.roleMetierId },
        });
        if (!rm || !rm.actif) throw new NotFoundException('Rôle métier introuvable');
        const assigned = this.rolesService.resolveAssignment(rm);
        data.roleMetierId = rm.id;
        data.role = assigned.role;
        if (dto.permissions === undefined) data.permissions = assigned.permissions;
      }
    }
    let temporaryPassword: string | undefined;
    if (dto.password) {
      data.motDePasseHash = await bcrypt.hash(dto.password, 10);
      data.mustChangePassword = dto.mustChangePassword ?? true;
    }

    const user = await this.prisma.utilisateur.update({
      where: { id },
      data,
      select: PROFILE_SELECT,
    });

    const changes: string[] = [];
    if (dto.nom && dto.nom !== before.nom) changes.push(`nom: ${before.nom} → ${dto.nom}`);
    if (dto.role && dto.role !== before.role) changes.push(`rôle: ${before.role} → ${dto.role}`);
    if (dto.roleMetierId !== undefined) {
      changes.push(
        `rôle métier → ${user.roleMetier?.libelle ?? user.roleMetierId ?? 'aucun'}`,
      );
    }
    if (dto.actif !== undefined && dto.actif !== before.actif) {
      changes.push(`actif: ${before.actif} → ${dto.actif}`);
    }
    if (dto.permissions !== undefined) {
      changes.push(`permissions mises à jour (${dto.permissions.length} modules)`);
    }

    await this.audit
      .log({
        userId: actorId ?? null,
        action: 'USER_UPDATE',
        entite: 'utilisateur',
        entiteId: id,
        details: changes.length
          ? `Mise à jour ${user.email} · ${changes.join(' · ')}`
          : `Mise à jour ${user.email}`,
        resultat: 'SUCCESS',
      })
      .catch(() => undefined);

    return {
      ...user,
      effectivePermissions: resolvePermissions(user.role, user.permissions),
      temporaryPassword,
    };
  }

  /** Régénère un mot de passe temporaire et force le changement. */
  async resetPassword(id: string, actorId?: string) {
    const target = await this.findOne(id);
    const plain = generateTempPassword(10);
    const user = await this.prisma.utilisateur.update({
      where: { id },
      data: {
        motDePasseHash: await bcrypt.hash(plain, 10),
        mustChangePassword: true,
      },
      select: PROFILE_SELECT,
    });

    await this.audit
      .log({
        userId: actorId ?? null,
        action: 'PASSWORD_RESET',
        entite: 'utilisateur',
        entiteId: id,
        details: `Réinitialisation MDP pour ${target.email} — connexion avec MDP temporaire puis redéfinition obligatoire`,
        resultat: 'SUCCESS',
      })
      .catch(() => undefined);

    return {
      ...user,
      effectivePermissions: resolvePermissions(user.role, user.permissions),
      temporaryPassword: plain,
      generatedPassword: true,
    };
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const current = await this.prisma.utilisateur.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Utilisateur introuvable');

    if (dto.email && dto.email !== current.email) {
      const taken = await this.prisma.utilisateur.findUnique({
        where: { email: dto.email },
      });
      if (taken) throw new ConflictException('Email deja utilise');
    }

    if (dto.password) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Mot de passe actuel requis');
      }
      const ok = await bcrypt.compare(dto.currentPassword, current.motDePasseHash);
      if (!ok) throw new BadRequestException('Mot de passe actuel incorrect');
    }

    const prenom = dto.prenom !== undefined ? dto.prenom.trim() : current.prenom;
    const nomFamille =
      dto.nomFamille !== undefined ? dto.nomFamille.trim() : current.nomFamille;

    let nom = dto.nom?.trim();
    if (dto.prenom !== undefined || dto.nomFamille !== undefined) {
      nom = [prenom, nomFamille].filter(Boolean).join(' ').trim() || current.nom;
    }

    const data: Record<string, unknown> = {};
    if (nom !== undefined) data.nom = nom;
    if (dto.prenom !== undefined) data.prenom = prenom || null;
    if (dto.nomFamille !== undefined) data.nomFamille = nomFamille || null;
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.autreAdresse !== undefined) data.autreAdresse = dto.autreAdresse.trim() || null;
    if (dto.telephone !== undefined) data.telephone = dto.telephone.trim() || null;
    if (dto.autreTelephone !== undefined) {
      data.autreTelephone = dto.autreTelephone.trim() || null;
    }
    if (dto.dateNaissance !== undefined) {
      data.dateNaissance = dto.dateNaissance
        ? new Date(`${dto.dateNaissance}T00:00:00.000Z`)
        : null;
    }
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl || null;
    if (dto.languePref !== undefined) data.languePref = dto.languePref;
    if (dto.notifEmail !== undefined) data.notifEmail = dto.notifEmail;
    if (dto.password) {
      data.motDePasseHash = await bcrypt.hash(dto.password, 10);
      data.mustChangePassword = false;
    }

    const user = await this.prisma.utilisateur.update({
      where: { id },
      data,
      select: PROFILE_SELECT,
    });
    return {
      ...user,
      effectivePermissions: resolvePermissions(user.role, user.permissions),
    };
  }
}
