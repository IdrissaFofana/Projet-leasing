import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

const SENSITIVE = /password|motDePasse|token|secret|hash/i;

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
      user?: { id?: string; sub?: string; userId?: string };
      params?: Record<string, string>;
      body?: Record<string, unknown>;
    }>();

    const method = req.method?.toUpperCase();
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const path = (req.url?.split('?')[0] ?? '').replace(/^\/api/, '');
    // Login / health / change-password gérés explicitement ailleurs
    if (
      path.includes('/auth/login') ||
      path.includes('/health') ||
      path.includes('/auth/change-password') ||
      (method === 'POST' && /^\/users\/?$/.test(path)) ||
      (method === 'POST' && /\/users\/[^/]+\/reset-password/.test(path)) ||
      (method === 'PATCH' && /^\/users\/[^/]+$/.test(path) && path !== '/users/me')
    ) {
      return next.handle();
    }

    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.ip ||
      null;
    const ua =
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    return next.handle().pipe(
      tap({
        next: (body) => {
          const entiteId =
            (body && typeof body === 'object' && 'id' in body
              ? String((body as { id: string }).id)
              : undefined) ?? req.params?.id;
          void this.audit
            .log({
              userId: req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null,
              action: this.labelAction(method, path),
              entite: this.guessEntite(path),
              entiteId,
              details: this.safeDetails(body, path),
              ipAdresse: ip,
              userAgent: ua,
              resultat: 'SUCCESS',
            })
            .catch(() => undefined);
        },
      }),
    );
  }

  private labelAction(method: string, path: string) {
    if (path.includes('/reset-password')) return 'PASSWORD_RESET';
    if (path.startsWith('/users') && method === 'POST') return 'USER_CREATE';
    if (path.startsWith('/users') && method === 'PATCH') return 'USER_UPDATE';
    return `${method} ${path}`;
  }

  private guessEntite(url?: string) {
    if (!url) return undefined;
    const path = url.replace(/^\//, '').split('/')[0];
    return path || undefined;
  }

  private safeDetails(body: unknown, path: string) {
    if (!body || typeof body !== 'object') return undefined;
    const o = body as Record<string, unknown>;
    const bits: string[] = [];
    if (typeof o.code === 'string') bits.push(`code=${o.code}`);
    if (typeof o.email === 'string') bits.push(`email=${o.email}`);
    if (typeof o.nom === 'string') bits.push(`nom=${o.nom}`);
    if (typeof o.role === 'string') bits.push(`role=${o.role}`);
    if (path.includes('/reset-password')) {
      bits.push('mot de passe temporaire régénéré — mustChangePassword=true');
    }
    // Ne jamais journaliser de secrets
    for (const k of Object.keys(o)) {
      if (SENSITIVE.test(k)) continue;
    }
    return bits.length ? bits.join(' · ') : undefined;
  }
}
