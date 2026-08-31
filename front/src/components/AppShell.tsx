'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { HeaderTools } from '@/components/HeaderTools';
import { PageMotion } from '@/components/PageMotion';
import { useAuth } from '@/lib/auth-context';
import { userHasPermission, type ModulePermission } from '@/lib/permissions';

type NavKey =
  | 'dashboard'
  | 'printers'
  | 'stock'
  | 'assignments'
  | 'readings'
  | 'campaigns'
  | 'billing'
  | 'maintenance'
  | 'admin'
  | 'users';

type NavChild = {
  href: string;
  label: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: NavKey;
  permission?: ModulePermission;
  children?: NavChild[];
};

const NAV: NavItem[] = [
  { href: '/', label: 'Tableau de bord', icon: 'dashboard', permission: 'dashboard' },
  { href: '/imprimantes', label: 'Copieurs', icon: 'printers', permission: 'printers' },
  { href: '/stock', label: 'Stock cartouches', icon: 'stock', permission: 'stock' },
  {
    href: '/stock-produits',
    label: 'Stock produits',
    icon: 'stock',
    permission: 'stock_produits',
  },
  { href: '/affectations', label: 'Affectations', icon: 'assignments', permission: 'assignments' },
  { href: '/releves', label: 'Relevés', icon: 'readings', permission: 'readings' },
  { href: '/campagnes', label: 'Campagnes', icon: 'campaigns', permission: 'campaigns' },
  { href: '/facturation', label: 'Facturation', icon: 'billing', permission: 'billing' },
  {
    href: '/maintenance',
    label: 'Maintenance',
    icon: 'maintenance',
    permission: 'maintenance',
    children: [
      { href: '/maintenance', label: 'Interventions' },
      { href: '/maintenance/quotas', label: 'Quotas assistances' },
    ],
  },
  {
    href: '/referentiels',
    label: 'Référentiels',
    icon: 'admin',
    permission: 'referentiels',
    children: [
      { href: '/referentiels/marques', label: 'Marques' },
      { href: '/referentiels/fournisseurs', label: 'Fournisseurs' },
      { href: '/referentiels/agents', label: 'Agents' },
      { href: '/referentiels/services', label: 'Services' },
      { href: '/referentiels/clients', label: 'Clients' },
      { href: '/referentiels/tarifs', label: 'Tarifs' },
    ],
  },
  {
    href: '/utilisateurs',
    label: 'Gestion utilisateurs',
    icon: 'users',
    permission: 'users',
    children: [
      { href: '/utilisateurs/comptes', label: 'Comptes' },
      { href: '/utilisateurs/mots-de-passe', label: 'Mots de passe' },
      { href: '/utilisateurs/roles', label: 'Rôles & permissions' },
      { href: '/utilisateurs/tracabilite', label: 'Traçabilité' },
    ],
  },
  {
    href: '/sauvegardes',
    label: 'Sauvegardes',
    icon: 'admin',
    permission: 'backups',
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Tableau de bord',
  '/imprimantes': 'Copieurs',
  '/stock': 'Stock cartouches',
  '/stock-produits': 'Stock produits',
  '/affectations': 'Affectations',
  '/releves': 'Relevés',
  '/campagnes': 'Campagnes',
  '/facturation': 'Facturation',
  '/maintenance': 'Interventions',
  '/maintenance/quotas': 'Quotas assistances',
  '/referentiels': 'Référentiels',
  '/referentiels/marques': 'Marques',
  '/referentiels/fournisseurs': 'Fournisseurs',
  '/referentiels/agents': 'Agents',
  '/referentiels/services': 'Services',
  '/referentiels/clients': 'Clients',
  '/referentiels/tarifs': 'Tarifs',
  '/admin': 'Référentiels',
  '/utilisateurs': 'Gestion utilisateurs',
  '/utilisateurs/comptes': 'Comptes utilisateurs',
  '/utilisateurs/mots-de-passe': 'Réinitialisation mots de passe',
  '/utilisateurs/roles': 'Rôles & permissions',
  '/utilisateurs/tracabilite': 'Traçabilité',
  '/sauvegardes': 'Sauvegardes',
  '/notifications': 'Notifications',
  '/profil': 'Mon profil',
  '/messagerie': 'Messagerie',
};

function pageTitle(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const hit = Object.keys(PAGE_TITLES)
    .filter((k) => k !== '/' && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? PAGE_TITLES[hit] : 'Suivi Leasing';
}

function NavIcon({ name }: { name: NavKey }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true as const,
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <path
            d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'printers':
      return (
        <svg {...common}>
          <path
            d="M7 8V5.8A1.8 1.8 0 0 1 8.8 4h6.4A1.8 1.8 0 0 1 17 5.8V8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <rect x="4" y="8" width="16" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7 17v3h10v-3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="17.2" cy="12.2" r="0.9" fill="currentColor" />
        </svg>
      );
    case 'stock':
      return (
        <svg {...common}>
          <path
            d="M4.5 8.2 12 4l7.5 4.2v7.6L12 20l-7.5-4.2V8.2Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M12 12v8M4.5 8.2 12 12l7.5-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case 'assignments':
      return (
        <svg {...common}>
          <path
            d="M8 7V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8V7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <rect x="5" y="7" width="14" height="13" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'readings':
      return (
        <svg {...common}>
          <path
            d="M8 4h6.2L18 7.8V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M14 4.2V8h3.8M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'campaigns':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 3.5v3M16 3.5v3M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8 14h3M13 14h3M8 17h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'billing':
      return (
        <svg {...common}>
          <rect x="4.5" y="5" width="15" height="14" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 9h8M8 12.5h8M8 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'maintenance':
      return (
        <svg {...common}>
          <path
            d="M14.7 6.3a4.2 4.2 0 0 0-5.9 5.9L4 16.9 7.1 20l4.7-4.8a4.2 4.2 0 0 0 5.9-5.9l-2.2 2.2-2.1-2.1 2.3-2.1Z"
            stroke="currentColor"
            strokeWidth="1.55"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'admin':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 4.5v1.6M12 17.9v1.6M4.5 12h1.6M17.9 12h1.6M6.4 6.4l1.1 1.1M16.5 16.5l1.1 1.1M17.6 6.4l-1.1 1.1M7.5 16.5l-1.1 1.1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="16" cy="10" r="2" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M4.5 18.5c.6-2.4 2.5-3.8 4.5-3.8s3.9 1.4 4.5 3.8M13.2 18.2c.4-1.6 1.6-2.6 3-2.6 1.2 0 2.2.7 2.7 1.9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function IconBtn({
  title,
  href,
  onClick,
  children,
}: {
  title: string;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} className="header-icon-btn" title={title} aria-label={title}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="header-icon-btn"
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, refreshUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitle(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastPermSync = useRef(0);

  useEffect(() => {
    if (!user) return;
    const now = Date.now();
    if (now - lastPermSync.current < 3_000) return;
    lastPermSync.current = now;
    void refreshUser();
  }, [pathname, user?.id, refreshUser]);

  const items = NAV.filter(
    (item) => !item.permission || userHasPermission(user, item.permission),
  );

  function isNavActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function isChildActive(childHref: string) {
    if (childHref === '/maintenance') {
      return (
        pathname === '/maintenance' ||
        (pathname.startsWith('/maintenance/') && !pathname.startsWith('/maintenance/quotas'))
      );
    }
    if (childHref === '/utilisateurs/comptes') {
      return pathname === '/utilisateurs' || pathname === '/utilisateurs/comptes';
    }
    return isNavActive(childHref);
  }

  function isGroupActive(item: NavItem) {
    if (item.children?.some((c) => isChildActive(c.href))) return true;
    return isNavActive(item.href);
  }

  function isGroupOpen(item: NavItem) {
    if (openGroups[item.href] !== undefined) return openGroups[item.href];
    // Par défaut masqué ; ouvert seulement si on est déjà dans la section
    return isGroupActive(item);
  }

  function toggleGroup(href: string) {
    setOpenGroups((prev) => {
      const item = NAV.find((n) => n.href === href);
      const currentlyOpen = prev[href] !== undefined ? prev[href] : (item ? isGroupActive(item) : false);
      return { ...prev, [href]: !currentlyOpen };
    });
  }

  useEffect(() => {
    // Ouvre automatiquement le groupe de la page courante, sans forcer la fermeture des autres
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of NAV) {
        if (!item.children?.length) continue;
        if (isGroupActive(item)) next[item.href] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <header className="app-header">
        <div className="header-left">
          <div className="header-toolbar">
            <IconBtn
              title={sidebarCollapsed ? 'Afficher le menu' : 'Masquer le menu'}
              onClick={() => setSidebarCollapsed((v) => !v)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </IconBtn>
            <IconBtn title="Tableau de bord" href="/">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
                <path d="m8.2 12.2 2.4 2.4 5.2-5.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </IconBtn>
            <IconBtn title="Modules" href="/">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
                <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
                <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
                <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </IconBtn>
            <IconBtn
              title="Référentiels"
              href={userHasPermission(user, 'referentiels') ? '/referentiels/marques' : '/'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M8 8V6.8A1.8 1.8 0 0 1 9.8 5h4.4A1.8 1.8 0 0 1 16 6.8V8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <rect x="4.5" y="8" width="15" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </IconBtn>
            {userHasPermission(user, 'printers') ? (
            <IconBtn title="Copieurs" href="/imprimantes">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="5" y="4" width="14" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8 17h8M9 20h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </IconBtn>
            ) : null}
          </div>

          <div className="header-divider" aria-hidden />

          <Link href="/" className="header-brand" aria-label="ESAY Accueil">
            <Image
              src="/logo-esay.png"
              alt="ESAY Corporation"
              width={140}
              height={42}
              className="header-logo"
              priority
            />
          </Link>

          <div className="header-context">
            <span className="header-product">Suivi Leasing</span>
            <span className="header-page">{title}</span>
          </div>
        </div>

        <div className="header-right">
          <div className={`header-search-wrap${searchOpen ? ' is-open' : ''}`}>
            <IconBtn title="Rechercher" onClick={() => setSearchOpen((v) => !v)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </IconBtn>
            {searchOpen && (
              <div className="header-search" role="search">
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Rechercher…"
                  aria-label="Recherche"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const q = (e.target as HTMLInputElement).value.trim();
                      if (q) router.push(`/imprimantes?q=${encodeURIComponent(q)}`);
                      setSearchOpen(false);
                    }
                  }}
                />
              </div>
            )}
          </div>

          <div className="header-toolbar">
            <IconBtn title="Nouveau relevé" href="/releves/nouveau">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </IconBtn>
            <HeaderTools />
          </div>

          <div className="header-user" ref={menuRef}>
            <button
              type="button"
              className="header-user-trigger"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="header-avatar" aria-hidden>
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M5.5 19c1.4-3.2 3.6-4.8 6.5-4.8S16.1 15.8 17.5 19"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </span>
              <span className="header-user-name">{user?.nom ?? 'Utilisateur'}</span>
            </button>

            {menuOpen && (
              <div className="header-user-menu" role="menu">
                <div className="header-user-menu-meta">
                  <span className="header-user-menu-name">{user?.nom}</span>
                  <span className="header-user-menu-email">{user?.email}</span>
                  <span className="header-user-menu-role">{user?.role}</span>
                </div>
                <Link
                  href="/profil"
                  role="menuitem"
                  className="header-user-menu-item"
                  onClick={() => setMenuOpen(false)}
                >
                  Voir / modifier mon profil
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="header-user-menu-item is-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    router.replace('/login');
                  }}
                >
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar" aria-label="Menu latéral">
          <nav className="nav-list" aria-label="Navigation principale">
            {items.map((item) => {
              if (item.children?.length) {
                const groupActive = isGroupActive(item);
                const open = isGroupOpen(item);
                return (
                  <div
                    key={item.href}
                    className={`nav-group${open ? ' is-open' : ''}${groupActive ? ' is-active-group' : ''}`}
                  >
                    <button
                      type="button"
                      className={`nav-link nav-group-toggle${groupActive ? ' is-section-active' : ''}`}
                      title={item.label}
                      aria-expanded={open}
                      aria-controls={`nav-sub-${item.href.replace(/\//g, '-')}`}
                      onClick={() => toggleGroup(item.href)}
                    >
                      <span className="nav-link-icon">
                        <NavIcon name={item.icon} />
                      </span>
                      <span className="nav-link-label">{item.label}</span>
                      <span className={`nav-chevron${open ? ' is-open' : ''}`} aria-hidden>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M6 9l6 6 6-6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </button>
                    <div
                      id={`nav-sub-${item.href.replace(/\//g, '-')}`}
                      className="nav-sublist"
                      hidden={!open}
                    >
                      {item.children.map((child) => {
                        const active = isChildActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`nav-link nav-sublink${active ? ' is-active' : ''}`}
                            title={child.label}
                            aria-label={child.label}
                          >
                            <span className="nav-link-label">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              const active = isNavActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link${active ? ' is-active' : ''}`}
                  title={item.label}
                  aria-label={item.label}
                >
                  <span className="nav-link-icon">
                    <NavIcon name={item.icon} />
                  </span>
                  <span className="nav-link-label">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="app-content">
          <PageMotion>{children}</PageMotion>
        </main>
      </div>
    </div>
  );
}
