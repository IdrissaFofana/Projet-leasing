'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type Locale = 'fr' | 'en';

const DICT = {
  fr: {
    language: 'Langue',
    history: 'Historique',
    notifications: 'Notifications',
    messages: 'Messages',
    members: 'Membres',
    markAllRead: 'Tout marquer comme lu',
    settings: 'Paramètres',
    seeAll: 'Tout voir',
    noNotifications: 'Aucune notification',
    noMessages: 'Aucun message',
    noMembers: 'Aucun membre',
    noHistory: 'Aucune activité récente',
    unread: 'non lu',
    inbox: 'Reçus',
    sent: 'Envoyés',
    compose: 'Nouvelle conversation',
    startChat: 'Démarrer une conversation',
    recipient: 'Destinataire',
    subject: 'Sujet',
    body: 'Message',
    send: 'Envoyer',
    viewAll: 'Ouvrir la messagerie',
    myActivity: 'Mon activité',
    systemActivity: 'Activité système',
    french: 'Français',
    english: 'English',
    justNow: 'À l’instant',
    loading: 'Chargement…',
    error: 'Impossible de charger',
    close: 'Fermer',
    clickToChat: 'Cliquer pour écrire',
    module: 'Module',
  },
  en: {
    language: 'Language',
    history: 'History',
    notifications: 'Notifications',
    messages: 'Messages',
    members: 'Members',
    markAllRead: 'Mark all as read',
    settings: 'Settings',
    seeAll: 'See all',
    noNotifications: 'No notifications',
    noMessages: 'No messages',
    noMembers: 'No members',
    noHistory: 'No recent activity',
    unread: 'unread',
    inbox: 'Inbox',
    sent: 'Sent',
    compose: 'New conversation',
    startChat: 'Start a conversation',
    recipient: 'Recipient',
    subject: 'Subject',
    body: 'Message',
    send: 'Send',
    viewAll: 'Open mailbox',
    myActivity: 'My activity',
    systemActivity: 'System activity',
    french: 'Français',
    english: 'English',
    justNow: 'Just now',
    loading: 'Loading…',
    error: 'Unable to load',
    close: 'Close',
    clickToChat: 'Click to write',
    module: 'Module',
  },
} as const;

type DictKey = keyof typeof DICT.fr;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: DictKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const STORAGE_KEY = 'leasing_locale';

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === 'fr' || stored === 'en') setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: DictKey) => DICT[locale][key] ?? DICT.fr[key],
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale hors LocaleProvider');
  return ctx;
}

export function roleLabel(role: string, locale: Locale = 'fr') {
  const map: Record<string, { fr: string; en: string }> = {
    ADMIN: { fr: 'Administrateur', en: 'Administrator' },
    TECHNICIEN: { fr: 'Technicien', en: 'Technician' },
    FACTURATION: { fr: 'Facturation', en: 'Billing' },
    LECTURE: { fr: 'Lecture seule', en: 'Read only' },
  };
  return map[role]?.[locale] ?? role;
}
