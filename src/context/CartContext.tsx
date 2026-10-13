import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addLine, CartLine, groupByMerchant, parseCart, removeLine, setQuantity, totals, type MerchantGroup } from '../lib/cart';

const STORAGE_KEY = 'spot:cart:v1';

type CartValue = {
  lines: CartLine[];
  groups: MerchantGroup[];
  itemCount: number;
  subtotalCents: number;
  add: (line: CartLine) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);

function read(): CartLine[] {
  try {
    return parseCart(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Sin almacenamiento (modo privado): el carrito dura hasta cerrar la pestaña.
    }
  }, [lines]);

  // Si se modifica desde otra pestaña, esta se actualiza.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLines(parseCart(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((line: CartLine) => setLines((current) => addLine(current, line)), []);
  const set = useCallback((variantId: string, quantity: number) => setLines((current) => setQuantity(current, variantId, quantity)), []);
  const remove = useCallback((variantId: string) => setLines((current) => removeLine(current, variantId)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartValue>(() => {
    const { itemCount, subtotalCents } = totals(lines);
    return { lines, groups: groupByMerchant(lines), itemCount, subtotalCents, add, setQuantity: set, remove, clear };
  }, [lines, add, set, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return value;
}
