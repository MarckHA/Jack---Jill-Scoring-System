import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Footer from '../components/Footer';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // NUEVO: Estado para alternar la visibilidad de la contraseña
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await api.post('/auth/login', { username, password });
            // 1. Añadimos el "token" a la desestructuración
            const { role, especialidad, token } = response.data;
            // NUEVO: Guardamos el username para saludarlo
            localStorage.setItem('username', username);
            // 2. Guardamos el token en la memoria del navegador
            if (token) {
                localStorage.setItem('token', token);
            }
            if (especialidad) localStorage.setItem('juezEspecialidad', especialidad);
            
            if (role === 'Organizer') navigate('/organizador');
            else navigate('/juez');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Credenciales incorrectas.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#150D0D] relative overflow-hidden p-4 font-['Montserrat']">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-[#D9776A] rounded-full blur-[120px] opacity-20 pointer-events-none"></div>

            <div className="z-10 w-full max-w-md bg-[#231515]/80 backdrop-blur-lg rounded-2xl border border-[#DFBA84]/20 shadow-2xl p-8 md:p-10">
                <div className="text-center mb-10">
                    <h2 className="text-[#DFBA84] tracking-[0.25em] text-xs font-semibold uppercase mb-2">Competencia</h2>
                    <h1 className="text-5xl md:text-6xl font-['Playfair_Display'] font-bold text-[#F4EBE1] tracking-wide mb-2 drop-shadow-lg">
                        JACK <span className="text-[#DFBA84] italic">&</span> JILL
                    </h1>
                    <h3 className="text-[#D9776A] tracking-[0.35em] text-sm font-light uppercase">Bachata</h3>
                </div>
                
                {error && (
                    <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm text-center mb-6 animate-pulse font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-[#DFBA84]/80 uppercase tracking-widest ml-1">Usuario</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isLoading}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[#F4EBE1] focus:bg-white/10 focus:border-[#DFBA84] focus:ring-1 focus:ring-[#DFBA84] outline-none transition-all placeholder-white/20 font-medium"
                            placeholder="Ingresa tu usuario"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-[#DFBA84]/80 uppercase tracking-widest ml-1">Contraseña</label>
                        <div className="relative">
                            <input
                                // NUEVO: Alterna el tipo de input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                className="w-full pl-4 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-[#F4EBE1] focus:bg-white/10 focus:border-[#DFBA84] focus:ring-1 focus:ring-[#DFBA84] outline-none transition-all placeholder-white/20 font-medium"
                                placeholder="••••••••"
                                required
                            />
                            {/* NUEVO: Botón del Ojito */}
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#DFBA84]/50 hover:text-[#DFBA84] transition-colors p-1"
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                )}
                            </button>
                        </div>
                        <Footer />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full mt-4 font-bold uppercase tracking-[0.15em] text-sm py-4 px-4 rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(223,186,132,0.3)] 
                            ${isLoading ? 'bg-[#DFBA84]/50 text-[#150D0D] cursor-not-allowed' : 'bg-[#DFBA84] text-[#150D0D] hover:bg-[#F4EBE1] hover:shadow-[0_0_25px_rgba(223,186,132,0.6)] hover:-translate-y-0.5'}`}
                    >
                        {isLoading ? 'Iniciando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
}