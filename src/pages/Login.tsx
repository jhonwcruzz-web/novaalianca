import { useState } from 'react'
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

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const { error } = await signIn(email, password)
        setLoading(false)
        if (error) {
            toast.error('E-mail ou senha inválidos')
        } else {
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
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background transition-colors duration-500">
            {/* Background gradient (vineyard) */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500">
                <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Ccircle cx='20' cy='10' r='4'/%3E%3Ccircle cx='35' cy='15' r='3'/%3E%3Ccircle cx='15' cy='25' r='5'/%3E%3Ccircle cx='40' cy='30' r='3'/%3E%3Ccircle cx='25' cy='40' r='4'/%3E%3Ccircle cx='50' cy='45' r='5'/%3E%3Ccircle cx='10' cy='50' r='3'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }} />
            </div>

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-md mx-4">
                <div className="bg-[var(--card)] rounded-2xl shadow-2xl p-10 border border-border transition-colors duration-300">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg overflow-hidden bg-brand-900 border border-brand-800">
                            <img src="/logo.png" alt="Logo Nova Aliança" className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-2xl font-black text-foreground tracking-tight">Nova Aliança ERP</h1>
                        <p className="text-muted text-sm mt-1">Gestão inteligente para sua distribuição</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-bold text-foreground mb-1.5 opacity-80 uppercase tracking-widest text-[10px]">E-mail</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="seu@email.com"
                                    className="input pl-10"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-bold text-foreground mb-1.5 opacity-80 uppercase tracking-widest text-[10px]">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="input pl-10 pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Remember */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="remember"
                                checked={remember}
                                onChange={e => setRemember(e.target.checked)}
                                className="w-4 h-4 accent-brand-600 rounded"
                            />
                            <label htmlFor="remember" className="text-sm text-muted font-medium">Lembrar acesso</label>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full justify-center py-3 text-base"
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

                        {/* Dev Access Button */}
                        <button
                            type="button"
                            onClick={handleDevLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 border border-brand-500/40 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-bold py-2.5 px-4 rounded-xl transition-all duration-200 text-sm tracking-wide cursor-pointer"
                        >
                            🍇 Acesso Rápido (Modo Dev - Dono)
                        </button>
                    </form>

                    {/* Footer link */}
                    <p className="text-center text-sm text-gray-500 mt-6">
                        Não tem uma conta?{' '}
                        <a href="#" className="text-brand-600 hover:underline font-medium">
                            Solicite uma demonstração
                        </a>
                    </p>

                    {/* Status */}
                    <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-border">
                        <span className="w-2 h-2 rounded-full bg-success inline-block animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Sistemas Online</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
