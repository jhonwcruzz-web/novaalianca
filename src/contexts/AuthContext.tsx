import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../lib/types'

interface AuthContextType {
    session: Session | null
    user: User | null
    profile: Profile | null
    role: UserRole | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
    signInAsMockDev: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    async function fetchProfile(userId: string) {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
        if (data) setProfile(data as Profile)
    }

    useEffect(() => {
        let cancelled = false

        // Timeout fallback: se Supabase demorar mais de 5s, libera o loading
        const timeout = setTimeout(() => {
            if (!cancelled) setLoading(false)
        }, 5000)

        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                if (cancelled) return
                clearTimeout(timeout)
                setSession(session)
                if (session?.user) fetchProfile(session.user.id)
                setLoading(false)
            })
            .catch(() => {
                if (!cancelled) {
                    clearTimeout(timeout)
                    setLoading(false)
                }
            })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            if (session?.user) {
                fetchProfile(session.user.id)
            } else {
                setProfile(null)
            }
        })

        return () => {
            cancelled = true
            clearTimeout(timeout)
            subscription.unsubscribe()
        }
    }, [])

    async function signIn(email: string, password: string) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error }
    }

    function signInAsMockDev() {
        const mockUser: User = {
            id: '00000000-0000-0000-0000-000000000000',
            email: 'dev_dono@grapedist.com',
            aud: 'authenticated',
            role: 'authenticated',
            email_confirmed_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: { full_name: 'Dono Dev (Simulado)', role: 'dono' },
            identities: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
        const mockSession: Session = {
            access_token: 'mock_token',
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: 'mock_refresh_token',
            user: mockUser,
        }
        const mockProfile: Profile = {
            id: '00000000-0000-0000-0000-000000000000',
            nome: 'Dono Dev (Simulado)',
            role: 'dono',
            avatar_url: null,
            created_at: new Date().toISOString()
        }

        setSession(mockSession)
        setProfile(mockProfile)
    }

    async function signOut() {
        if (session && session.access_token !== 'mock_token') {
            try {
                await supabase.auth.signOut()
            } catch (e) {
                console.error('Error signing out:', e)
            }
        }
        setSession(null)
        setProfile(null)
    }

    return (
        <AuthContext.Provider value={{
            session,
            user: session?.user ?? null,
            profile,
            role: profile?.role ?? null,
            loading,
            signIn,
            signOut,
            signInAsMockDev,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
    return ctx
}
