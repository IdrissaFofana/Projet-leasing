'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { roleLabel, useLocale, type Locale } from '@/lib/locale-context';
import type {
  AppMessage,
  AppNotification,
  AuditEntry,
  DirectoryUser,
} from '@/lib/types';

type Panel = 'lang' | 'history' | 'notifs' | 'messages' | null;
type MsgTab = 'messages' | 'members';

function formatWhen(iso: string, locale: Locale, justNow: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return justNow;
  return d.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Avatar({ online }: { online?: boolean }) {
  return (
    <span className={`people-avatar${online ? ' is-online' : ''}`} aria-hidden>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M5.5 19c1.4-3.2 3.6-4.8 6.5-4.8S16.1 15.8 17.5 19"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function moduleFromLink(lien: string | null, fallback: string) {
  if (!lien) return fallback;
  const map: Record<string, string> = {
    '/stock': 'Stock',
    '/releves': 'Relevés',
    '/maintenance': 'Maintenance',
    '/facturation': 'Facturation',
    '/campagnes': 'Campagnes',
    '/messagerie': 'Messagerie',
    '/': 'Tableau de bord',
  };
  return map[lien] ?? lien.replace(/^\//, '');
}

export function HeaderTools() {
  const { user, hasPermission } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Panel>(null);
  const [msgTab, setMsgTab] = useState<MsgTab>('members');
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [members, setMembers] = useState<DirectoryUser[]>([]);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canMessages = hasPermission('messages');
  const canBackups = hasPermission('backups');
  const [backupFailed, setBackupFailed] = useState(false);
  const [backupFailedAt, setBackupFailedAt] = useState<string | null>(null);

  const refreshBadges = useCallback(async () => {
    if (!user) return;
    try {
      const notifP = api.notifications.unreadCount();
      const msgP = canMessages
        ? api.messages.unreadCount()
        : Promise.resolve({ count: 0 });
      const backupP = canBackups
        ? api.backups.latest().catch(() => null)
        : Promise.resolve(null);
      const [n, m, latestBackup] = await Promise.all([notifP, msgP, backupP]);
      setNotifCount(n.count);
      setMsgCount(m.count);
      if (latestBackup?.status === 'FAILED') {
        setBackupFailed(true);
        setBackupFailedAt(latestBackup.startedAt);
      } else {
        setBackupFailed(false);
        setBackupFailedAt(null);
      }
    } catch {
      /* ignore */
    }
  }, [user, canMessages, canBackups]);

  useEffect(() => {
    void refreshBadges();
    const id = window.setInterval(() => void refreshBadges(), 45_000);
    return () => window.clearInterval(id);
  }, [refreshBadges]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null);
    }
    // click (pas mousedown) pour laisser le onClick des items du panel s'exécuter
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  async function loadMessagesPanel() {
    const [list, dir] = await Promise.all([
      api.messages.inbox(20),
      api.messages.directory(),
    ]);
    setMessages(list);
    setMembers(dir);
    setMsgCount(list.filter((m) => !m.luAt).length);
  }

  async function openPanel(panel: Panel) {
    const next = open === panel ? null : panel;
    setOpen(next);
    setError(null);
    if (!next || next === 'lang') return;

    setLoading(true);
    try {
      if (next === 'notifs') {
        const list = await api.notifications.list();
        setNotifs(list);
        setNotifCount(list.filter((n) => !n.luAt).length);
      } else if (next === 'messages') {
        setMsgTab('members');
        await loadMessagesPanel();
      } else if (next === 'history') {
        const mine = await api.audit.me(30);
        setHistory(mine);
        if (user?.role === 'ADMIN') {
          try {
            const all = await api.audit.recent(20);
            const ids = new Set(mine.map((e) => e.id));
            setHistory([...mine, ...all.filter((e) => !ids.has(e.id))]);
          } catch {
            /* keep mine */
          }
        }
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('error'));
    } finally {
      setLoading(false);
    }
  }

  function startConversation(memberId: string) {
    setOpen(null);
    // Navigation après fermeture du panel (évite le conflit mousedown)
    window.setTimeout(() => {
      router.push(`/messagerie?to=${encodeURIComponent(memberId)}`);
    }, 0);
  }

  return (
    <div className="header-tools" ref={rootRef}>
      <PageFeedback error={error} onDismiss={() => setError(null)} />
      {backupFailed ? (
        <Link
          href="/sauvegardes"
          className="badge badge-warn"
          title={
            backupFailedAt
              ? `Sauvegarde échouée — ${formatWhen(backupFailedAt, locale, t('justNow'))}`
              : 'Sauvegarde échouée'
          }
          style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Sauvegarde échouée
        </Link>
      ) : null}
      {/* Langue */}
      <div className="header-tool">
        <button
          type="button"
          className={`header-icon-btn${open === 'lang' ? ' is-open' : ''}`}
          title={t('language')}
          aria-label={t('language')}
          aria-expanded={open === 'lang'}
          onClick={() => void openPanel('lang')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M4 12h16M12 4c2.6 2.8 2.6 13.2 0 16M12 4c-2.6 2.8-2.6 13.2 0 16"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
        </button>
        {open === 'lang' && (
          <div className="header-panel" role="menu">
            <div className="header-panel-title">{t('language')}</div>
            <button
              type="button"
              className={`header-panel-item${locale === 'fr' ? ' is-active' : ''}`}
              onClick={() => {
                setLocale('fr');
                setOpen(null);
              }}
            >
              {t('french')}
            </button>
            <button
              type="button"
              className={`header-panel-item${locale === 'en' ? ' is-active' : ''}`}
              onClick={() => {
                setLocale('en');
                setOpen(null);
              }}
            >
              {t('english')}
            </button>
          </div>
        )}
      </div>

      {/* Historique */}
      <div className="header-tool">
        <button
          type="button"
          className={`header-icon-btn${open === 'history' ? ' is-open' : ''}`}
          title={t('history')}
          aria-label={t('history')}
          aria-expanded={open === 'history'}
          onClick={() => void openPanel('history')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M12 7.5v5l3.2 2"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {open === 'history' && (
          <div className="header-panel header-panel-wide" role="dialog" aria-label={t('history')}>
            <div className="modal-head">
              <h3>{t('history')}</h3>
              <button type="button" className="modal-close" aria-label={t('close')} onClick={() => setOpen(null)}>
                ×
              </button>
            </div>
            {loading && <p className="header-panel-empty">{t('loading')}</p>}
            
            {!loading && !error && history.length === 0 && (
              <p className="header-panel-empty">{t('noHistory')}</p>
            )}
            <ul className="header-panel-list">
              {history.map((h) => (
                <li key={h.id} className="header-panel-row">
                  <div className="header-panel-row-main">
                    <strong>{h.action}</strong>
                    {h.entite && <span className="header-panel-tag">{h.entite}</span>}
                  </div>
                  <p className="header-panel-row-sub">{h.details || h.entiteId || '—'}</p>
                  <time className="header-panel-time">
                    {formatWhen(h.dateHeure, locale, t('justNow'))}
                  </time>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Notifications — maquette image 2 */}
      <div className="header-tool">
        <button
          type="button"
          className={`header-icon-btn${open === 'notifs' ? ' is-open' : ''}`}
          title={t('notifications')}
          aria-label={t('notifications')}
          aria-expanded={open === 'notifs'}
          onClick={() => void openPanel('notifs')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {notifCount > 0 && (
            <span className="header-badge">{notifCount > 9 ? '9+' : notifCount}</span>
          )}
        </button>
        {open === 'notifs' && (
          <div className="header-panel notif-modal" role="dialog" aria-label={t('notifications')}>
            <div className="notif-modal-head">
              <h3>{t('notifications')}</h3>
              <div className="notif-modal-actions">
                <button
                  type="button"
                  className="header-panel-action"
                  onClick={async () => {
                    await api.notifications.markAllRead();
                    setNotifs((prev) =>
                      prev.map((n) => ({ ...n, luAt: n.luAt ?? new Date().toISOString() })),
                    );
                    setNotifCount(0);
                  }}
                >
                  {t('markAllRead')}
                </button>
                <span className="notif-sep" aria-hidden>
                  ·
                </span>
                <Link
                  href="/profil"
                  className="header-panel-action"
                  onClick={() => setOpen(null)}
                >
                  {t('settings')}
                </Link>
              </div>
            </div>

            {loading && <p className="header-panel-empty">{t('loading')}</p>}
            
            {!loading && !error && notifs.length === 0 && (
              <p className="header-panel-empty">{t('noNotifications')}</p>
            )}

            <ul className="notif-list">
              {notifs.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notif-item${n.luAt ? '' : ' is-unread'}`}
                    onClick={async () => {
                      if (!n.luAt) {
                        await api.notifications.markRead(n.id);
                        setNotifs((prev) =>
                          prev.map((x) =>
                            x.id === n.id ? { ...x, luAt: new Date().toISOString() } : x,
                          ),
                        );
                        setNotifCount((c) => Math.max(0, c - 1));
                      }
                      setOpen(null);
                      if (n.lien) router.push(n.lien);
                    }}
                  >
                    <Avatar />
                    <div className="notif-item-body">
                      <div className="notif-item-top">
                        <strong>{n.titre}</strong>
                        <time>{formatWhen(n.createdAt, locale, t('justNow'))}</time>
                      </div>
                      <p className="notif-item-text">{n.message}</p>
                      <p className="notif-item-meta">
                        {t('module')}: {moduleFromLink(n.lien, n.type)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="notif-modal-foot">
              <button
                type="button"
                className="header-panel-action"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(null);
                  // Naviguer après fermeture du panel (évite le démontage du lien avant la nav)
                  window.setTimeout(() => {
                    router.push('/notifications');
                  }, 0);
                }}
              >
                {t('seeAll')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Messages — maquette image 1 */}
      {canMessages ? (
      <div className="header-tool">
        <button
          type="button"
          className={`header-icon-btn${open === 'messages' ? ' is-open' : ''}`}
          title={t('messages')}
          aria-label={t('messages')}
          aria-expanded={open === 'messages'}
          onClick={() => void openPanel('messages')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3.75" y="6" width="16.5" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="m5 8 7 5 7-5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {msgCount > 0 && (
            <span className="header-badge">{msgCount > 9 ? '9+' : msgCount}</span>
          )}
        </button>
        {open === 'messages' && (
          <div className="header-panel msg-modal" role="dialog" aria-label={t('messages')}>
            <div className="modal-head">
              <h3>{msgTab === 'members' ? t('members') : t('messages')}</h3>
              <div className="modal-head-actions">
                <Link
                  href="/messagerie"
                  className="modal-more"
                  title={t('viewAll')}
                  onClick={() => setOpen(null)}
                >
                  ⋯
                </Link>
                <button
                  type="button"
                  className="modal-close"
                  aria-label={t('close')}
                  onClick={() => setOpen(null)}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="msg-modal-body">
              {loading && <p className="header-panel-empty">{t('loading')}</p>}
              

              {!loading && !error && msgTab === 'members' && (
                <>
                  {members.length === 0 ? (
                    <p className="header-panel-empty">{t('noMembers')}</p>
                  ) : (
                    <ul className="people-list">
                      {members.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            className="people-item"
                            title={t('startChat')}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              startConversation(m.id);
                            }}
                          >
                            <Avatar online={false} />
                            <span className="people-meta">
                              <strong>{m.nom}</strong>
                              <em>{roleLabel(m.role, locale)}</em>
                            </span>
                            <span className="people-chat-btn" aria-hidden>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M5 6.5h14v9.5a1.5 1.5 0 0 1-1.5 1.5H10l-3.5 2.5V17.5H6.5A1.5 1.5 0 0 1 5 16V6.5Z"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {!loading && !error && msgTab === 'messages' && (
                <>
                  {messages.length === 0 ? (
                    <p className="header-panel-empty">{t('noMessages')}</p>
                  ) : (
                    <ul className="people-list">
                      {messages.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            className={`people-item${m.luAt ? '' : ' is-unread'}`}
                            onClick={async () => {
                              if (!m.luAt) {
                                await api.messages.markRead(m.id);
                                setMsgCount((c) => Math.max(0, c - 1));
                              }
                              setOpen(null);
                              router.push(`/messagerie?id=${m.id}`);
                            }}
                          >
                            <Avatar />
                            <span className="people-meta">
                              <strong>{m.expediteur?.nom ?? m.sujet}</strong>
                              <em>
                                {m.sujet} — {m.corps.slice(0, 48)}
                              </em>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="msg-modal-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={msgTab === 'messages'}
                className={`msg-tab${msgTab === 'messages' ? ' is-active' : ''}`}
                onClick={() => setMsgTab('messages')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M5 6.5h14v9.5a1.5 1.5 0 0 1-1.5 1.5H10l-3.5 2.5V17.5H6.5A1.5 1.5 0 0 1 5 16V6.5Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{t('messages')}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={msgTab === 'members'}
                className={`msg-tab${msgTab === 'members' ? ' is-active' : ''}`}
                onClick={() => setMsgTab('members')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="9" cy="8.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="16" cy="9.5" r="2" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    d="M4.5 18c.9-2.4 2.5-3.6 4.5-3.6s3.6 1.2 4.5 3.6M13.2 14.8c1.4-.4 2.8.1 3.8 1.6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <span>{t('members')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
      ) : null}
    </div>
  );
}
