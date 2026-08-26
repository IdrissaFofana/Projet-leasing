'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Enveloppe le contenu principal avec une apparition douce à chaque navigation. */
export function PageMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick((t) => t + 1);
  }, [pathname]);

  return (
    <div key={tick} className="page-motion">
      {children}
    </div>
  );
}
