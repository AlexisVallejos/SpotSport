import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isConfigured, supabase } from '../lib/supabase';
import type { Merchant, Profile } from '../lib/types';

type AuthValue = {
  /** Mientras se resuelve la sesión inicial. */
  loading: boolean;
  configured: boolean;
  session: Session | null;
  profile: Profile | null;
  /** El comercio de la cuenta, en cualquier estado (null si nunca pidió afiliarse). */
  merchant: Merchant | null;
  isAdmin: boolean;
  /** Comercio aprobado: es quien puede publicar productos. */
  isMerchant: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  /** Vuelve a leer perfil y comercio (después de pedir afiliación, editar datos, etc.). */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);

  const load = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      setMerchant(null);
      return;
    }
    const [profileResult, merchantResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('merchants').select('*').eq('owner_id', userId).maybeSingle(),
    ]);
    setProfile((profileResult.data as Profile | null) ?? null);
    setMerchant((merchantResult.data as Merchant | null) ?? null);
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await load(data.session?.user.id ?? null);
      if (alive) setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Se difiere para no hacer consultas dentro del callback de autenticación.
      setTimeout(() => {
        if (alive) void load(next?.user.id ?? null);
      }, 0);
    });
    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, [load]);

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      configured: isConfigured,
      session,
      profile,
      merchant,
      isAdmin: profile?.is_admin ?? false,
      isMerchant: merchant?.status === 'approved',
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(/invalid login/i.test(error.message) ? 'Email o contraseña incorrectos.' : /not confirmed/i.test(error.message) ? 'Confirmá tu email desde el enlace que te enviamos.' : error.message);
      },
      signUp: async (email, password, fullName) => {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } });
        if (error) throw new Error(/already registered/i.test(error.message) ? 'Ese email ya tiene una cuenta. Probá iniciar sesión.' : /password/i.test(error.message) ? 'La contraseña debe tener al menos 6 caracteres.' : error.message);
        return { needsConfirmation: !data.session };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refresh: async () => {
        await load(session?.user.id ?? null);
      },
    }),
    [loading, session, profile, merchant, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return value;
}
