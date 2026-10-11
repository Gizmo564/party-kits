import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Toast = { id: number; text: string };
const Ctx = createContext<(text: string, ms?: number) => void>(() => undefined);

/** Wrap the app once; call `useToast()('Copied')` anywhere. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, ms = 2500) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), ms);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">{items.map((t) => <div key={t.id} className="toast">{t.text}</div>)}</div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
