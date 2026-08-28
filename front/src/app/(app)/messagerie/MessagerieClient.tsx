'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageFeedback } from '@/components/feedback/PageFeedback';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { roleLabel, useLocale } from '@/lib/locale-context';
import type {
  AppMessage,
  ConversationSummary,
  DirectoryUser,
} from '@/lib/types';

function formatChatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  });
}

function Avatar() {
  return (
    <span className="wa-avatar" aria-hidden>
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

export default function MessagerieClient() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const toId = params.get('to');

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [peer, setPeer] = useState<DirectoryUser | null>(null);
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const activePeerRef = useRef<string | null>(null);
  const bootstrapped = useRef(false);

  const refreshList = useCallback(async () => {
    try {
      const [c, d] = await Promise.all([
        api.messages.conversations(),
        api.messages.directory(),
      ]);
      setConversations(c);
      setDirectory(d);
      return { conversations: c, directory: d };
    } catch (e) {
      // Fallback : au moins le répertoire pour démarrer une conversation
      try {
        const d = await api.messages.directory();
        setDirectory(d);
        setError(
          e instanceof ApiError
            ? `Conversations: ${e.message}`
            : t('error'),
        );
        return { conversations: [] as ConversationSummary[], directory: d };
      } catch (e2) {
        setError(e2 instanceof ApiError ? e2.message : t('error'));
        return { conversations: [] as ConversationSummary[], directory: [] as DirectoryUser[] };
      }
    }
  }, [t]);

  const openChat = useCallback(
    async (member: DirectoryUser, syncUrl = true) => {
      activePeerRef.current = member.id;
      setPeer(member);
      setShowMembers(false);
      setDraft('');
      setError(null);
      setLoadingThread(true);
      setMessages([]);

      if (syncUrl) {
        router.replace(`/messagerie?to=${encodeURIComponent(member.id)}`);
      }

      try {
        const thread = await api.messages.thread(member.id);
        if (activePeerRef.current !== member.id) return;
        setPeer(thread.peer);
        setMessages(thread.messages);
        const list = await api.messages.conversations().catch(() => null);
        if (list) setConversations(list);
      } catch (e) {
        if (activePeerRef.current !== member.id) return;
        // Nouvelle conversation sans historique : on garde le peer local
        setMessages([]);
        if (!(e instanceof ApiError && e.status === 404)) {
          setError(e instanceof ApiError ? e.message : t('error'));
        }
      } finally {
        if (activePeerRef.current === member.id) setLoadingThread(false);
      }
    },
    [router, t],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      const { conversations: convs, directory: dir } = await refreshList();
      if (cancelled) return;
      setLoadingList(false);

      if (bootstrapped.current && !toId) return;
      bootstrapped.current = true;

      if (toId) {
        const fromDir = dir.find((u) => u.id === toId);
        const fromConv = convs.find((c) => c.peer.id === toId)?.peer;
        const member = fromDir ?? fromConv;
        if (member) {
          await openChat(member, false);
        } else {
          setError('Interlocuteur introuvable');
        }
        return;
      }

      if (convs[0]) {
        await openChat(convs[0].peer, false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toId, refreshList, openChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peer?.id]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!peer || !draft.trim() || !user) return;
    setSending(true);
    setError(null);
    const text = draft.trim();
    setDraft('');
    try {
      const msg = await api.messages.send({
        destinataireId: peer.id,
        corps: text,
      });
      setMessages((prev) => [...prev, msg]);
      const list = await api.messages.conversations().catch(() => null);
      if (list) setConversations(list);
    } catch (err) {
      setDraft(text);
      setError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setSending(false);
    }
  }

  const filteredConvs = conversations.filter((c) =>
    c.peer.nom.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredMembers = directory.filter((m) =>
    m.nom.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="wa-page">
      <aside className="wa-sidebar">
        <div className="wa-sidebar-head">
          <h1>{t('messages')}</h1>
          <button
            type="button"
            className={`wa-new-btn${showMembers ? ' is-active' : ''}`}
            title={t('startChat')}
            aria-label={t('startChat')}
            onClick={() => {
              setShowMembers(true);
              setSearch('');
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="wa-search">
          <input
            type="search"
            placeholder={showMembers ? 'Rechercher un membre…' : 'Rechercher une conversation…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher"
          />
        </div>

        {showMembers && (
          <div className="wa-subbar">
            <strong>{t('members')}</strong>
            <button type="button" onClick={() => setShowMembers(false)}>
              {t('messages')}
            </button>
          </div>
        )}

        {error ? (
          <PageFeedback error={error} onDismiss={() => setError(null)} />
        ) : null}

        <div className="wa-conv-list">
          {loadingList ? (
            <p className="wa-empty">{t('loading')}</p>
          ) : showMembers ? (
            filteredMembers.length === 0 ? (
              <p className="wa-empty">{t('noMembers')}</p>
            ) : (
              filteredMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`wa-conv-item${peer?.id === m.id ? ' is-active' : ''}`}
                  onClick={() => void openChat(m)}
                >
                  <Avatar />
                  <span className="wa-conv-meta">
                    <span className="wa-conv-top">
                      <strong>{m.nom}</strong>
                    </span>
                    <span className="wa-conv-preview">{roleLabel(m.role, locale)}</span>
                  </span>
                  <span className="people-chat-btn" title={t('startChat')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M5 6.5h14v9.5a1.5 1.5 0 0 1-1.5 1.5H10l-3.5 2.5V17.5H6.5A1.5 1.5 0 0 1 5 16V6.5Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              ))
            )
          ) : filteredConvs.length === 0 ? (
            <div className="wa-empty-block">
              <p className="wa-empty">{t('noMessages')}</p>
              <button
                type="button"
                className="btn-chat"
                onClick={() => {
                  setShowMembers(true);
                  setSearch('');
                }}
              >
                {t('startChat')}
              </button>
            </div>
          ) : (
            filteredConvs.map((c) => (
              <button
                key={c.peer.id}
                type="button"
                className={`wa-conv-item${peer?.id === c.peer.id ? ' is-active' : ''}${c.unreadCount ? ' is-unread' : ''}`}
                onClick={() => void openChat(c.peer)}
              >
                <Avatar />
                <span className="wa-conv-meta">
                  <span className="wa-conv-top">
                    <strong>{c.peer.nom}</strong>
                    <time>{formatChatTime(c.lastMessage.createdAt)}</time>
                  </span>
                  <span className="wa-conv-preview">
                    {c.lastMessage.fromMe ? 'Vous : ' : ''}
                    {c.lastMessage.corps}
                  </span>
                </span>
                {c.unreadCount > 0 && (
                  <span className="wa-unread">{c.unreadCount}</span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="wa-chat">
        {!peer ? (
          <div className="wa-chat-placeholder">
            <div>
              <h2>{t('messages')}</h2>
              <p>Sélectionnez une conversation ou démarrez-en une nouvelle.</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setShowMembers(true);
                  setSearch('');
                }}
              >
                {t('startChat')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="wa-chat-head">
              <Avatar />
              <div>
                <strong>{peer.nom}</strong>
                <span>{roleLabel(peer.role, locale)}</span>
              </div>
            </header>

            <div className="wa-chat-thread">
              {loadingThread ? (
                <p className="wa-empty">{t('loading')}</p>
              ) : messages.length === 0 ? (
                <p className="wa-empty">Aucun message — écrivez le premier.</p>
              ) : (
                messages.map((m) => {
                  const mine = m.expediteurId === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`wa-bubble-row${mine ? ' is-mine' : ' is-theirs'}`}
                    >
                      <div className={`wa-bubble${mine ? ' is-mine' : ' is-theirs'}`}>
                        <p>{m.corps}</p>
                        <time>{formatChatTime(m.createdAt)}</time>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form className="wa-composer" onSubmit={onSend}>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écrire un message…"
                aria-label={t('body')}
                autoComplete="off"
              />
              <button
                type="submit"
                className="wa-send"
                disabled={sending || !draft.trim()}
                aria-label={t('send')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 12 20 4l-6.5 16-2.2-6.3L4 12Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
