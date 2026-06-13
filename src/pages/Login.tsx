import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function Login() {
    const navigate = useNavigate()
    const { signIn, signInAsMockDev } = useAuth()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [remember, setRemember] = useState(false)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('login-saved')
        if (saved) {
            const { email: e, password: p } = JSON.parse(saved)
            setEmail(e)
            setPassword(p)
            setRemember(true)
        }
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const { error } = await signIn(email, password)
        setLoading(false)
        if (error) {
            toast.error('E-mail ou senha inválidos')
        } else {
            if (remember) {
                localStorage.setItem('login-saved', JSON.stringify({ email, password }))
            } else {
                localStorage.removeItem('login-saved')
            }
            navigate('/')
        }
    }

    async function handleDevLogin() {
        setLoading(true)
        const email = 'dev_dono@grapedist.com'
        const password = 'devpassword123'

        try {
            // 1. Tenta login normal no Supabase
            const { error: loginError } = await signIn(email, password)

            if (loginError) {
                console.log('Login falhou, tentando cadastrar usuário dev...', loginError.message)
                
                // 2. Se o usuário não existir, tenta cadastrar
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: 'Dono Dev',
                            role: 'dono'
                        }
                    }
                })

                if (signUpError) {
                    console.warn('Cadastro falhou no Supabase, caindo para modo simulado:', signUpError.message)
                    signInAsMockDev()
                    toast.success('Entrou no Modo de Teste Simulado (Offline/Sem Conexão)')
                    navigate('/')
                    setLoading(false)
                    return
                }

                // 3. Tenta fazer login após o cadastro
                const { error: secondLoginError } = await signIn(email, password)
                if (secondLoginError) {
                    console.warn('Login pós-cadastro falhou (provavelmente confirmação de e-mail ativa), caindo para modo simulado:', secondLoginError.message)
                    signInAsMockDev()
                    toast.success('Entrou no Modo de Teste Simulado (Aguardando Confirmação)')
                    navigate('/')
                    setLoading(false)
                    return
                }
            }

            toast.success('Entrou no Modo de Teste Real (Autenticado no Supabase)')
            navigate('/')
        } catch (e: any) {
            console.error('Erro no login dev, caindo para modo simulado:', e)
            signInAsMockDev()
            toast.success('Entrou no Modo de Teste Simulado')
            navigate('/')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Background gradient roxo-escuro da logo */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700">
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A236' fill-opacity='0.15'%3E%3Ccircle cx='20' cy='10' r='4'/%3E%3Ccircle cx='35' cy='15' r='3'/%3E%3Ccircle cx='15' cy='25' r='5'/%3E%3Ccircle cx='40' cy='30' r='3'/%3E%3Ccircle cx='25' cy='40' r='4'/%3E%3Ccircle cx='50' cy='45' r='5'/%3E%3Ccircle cx='10' cy='50' r='3'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }} />
            </div>

            {/* Conteúdo */}
            <div className="relative z-10 w-full max-w-sm mx-4 py-12">
                {/* Logo + título */}
                <div className="flex flex-col items-center mb-10">
                    <img src="/logo.png" alt="Logo Nova Aliança" className="w-20 h-20 object-contain mb-5 drop-shadow-xl" />
                    <h1 className="text-3xl font-black text-white tracking-tight">Nova Aliança</h1>
                    <p className="text-[var(--accent)] text-xs font-bold uppercase tracking-[0.25em] mt-1">Sistema de Gestão</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email */}
                    <div>
                        <label className="block text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-widest">E-mail</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                className="w-full bg-white/10 border border-white/20 rounded-input px-3 py-2.5 pl-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#C9A236] focus:border-transparent transition"
                                required
                            />
                        </div>
                    </div>

                    {/* Senha */}
                    <div>
                        <label className="block text-[10px] font-bold text-white/60 mb-1.5 uppercase tracking-widest">Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-white/10 border border-white/20 rounded-input px-3 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#C9A236] focus:border-transparent transition"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Lembrar */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="remember"
                            checked={remember}
                            onChange={e => setRemember(e.target.checked)}
                            className="w-4 h-4 accent-[#C9A236] rounded"
                        />
                        <label htmlFor="remember" className="text-sm text-white/60 font-medium">Lembrar acesso</label>
                    </div>

                    {/* Entrar */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-gold w-full justify-center py-3 text-base mt-2"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                                Entrando...
                            </span>
                        ) : 'Entrar →'}
                    </button>

                    {/* Beta */}
                    <button
                        type="button"
                        onClick={handleDevLogin}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 border border-amber-400/30 hover:border-amber-400/60 text-amber-300/60 hover:text-amber-300 font-medium py-2 px-4 rounded-xl transition-all duration-200 text-xs tracking-wide cursor-pointer"
                    >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Entrar no Modo Beta
                    </button>
                </form>

                {/* Status */}
                <div className="flex items-center justify-center gap-2 mt-10">
                    <span className="w-1.5 h-1.5 rounded-full bg-success inline-block animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Sistemas Online</span>
                </div>
            </div>
        </div>
    )
}
