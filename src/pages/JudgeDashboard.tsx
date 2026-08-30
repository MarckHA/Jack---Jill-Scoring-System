import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { type GroupedCompetitors, type Fase, type Categoria, type Rol } from '../types';
import Footer from '../components/Footer';

export default function JudgeDashboard() {
    const juezEspecialidad = (localStorage.getItem('juezEspecialidad') as Rol) || 'Leader';

    const [fase, setFase] = useState<Fase>((localStorage.getItem('juezFase') as Fase) || 'Preliminar');
    const [categoria, setCategoria] = useState<Categoria>((localStorage.getItem('juezCategoria') as Categoria) || 'Amateur');
    const [rol, setRol] = useState<Rol>((localStorage.getItem('juezRol') as Rol) || juezEspecialidad);
    
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    
    // NUEVO ESTADO: Saber si el juez ya envió calificaciones en esta ronda
    const [hasSubmitted, setHasSubmitted] = useState(false);
    
    const [competidoresAgrupados, setCompetidoresAgrupados] = useState<GroupedCompetitors | null>(null);
    const [calificaciones, setCalificaciones] = useState<Record<number, string>>(() => {
        const saved = localStorage.getItem('juezCalificaciones');
        return saved ? JSON.parse(saved) : {};
    });
    
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isFirstRender = useRef(true);

    const [globalConfig, setGlobalConfig] = useState<any>({});

    // 1. Obtener la lista de competidores
    useEffect(() => {
        const fetchCompetidores = async () => {
            try {
                const response = await api.get('/competitors');
                setCompetidoresAgrupados(response.data.data);
            } catch (err: any) {
                setError('Error al cargar la lista.');
            }
        };
        fetchCompetidores();
    }, [fase]);

    // 2. Polling del Control Maestro (Obtenemos toda la config global)
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const configRes = await api.get('/config');
                if (configRes.data.config) {
                    setGlobalConfig(configRes.data.config);
                }
            } catch (error) {
                console.error("Error al obtener fase global");
            }
        };
        fetchConfig();
        const interval = setInterval(fetchConfig, 3000);
        return () => clearInterval(interval);
    }, []);

    // 3. SINCRONIZACIÓN MÁGICA: Si cambia la categoría elegida O la config global, ajustamos la Fase
    useEffect(() => {
        if (categoria === 'Amateur' && globalConfig.Fase_Activa_Amateur) {
            setFase(globalConfig.Fase_Activa_Amateur as Fase);
        } else if (categoria === 'Open' && globalConfig.Fase_Activa_Open) {
            setFase(globalConfig.Fase_Activa_Open as Fase);
        }
    }, [categoria, globalConfig]);

    // 3. NUEVO EFECTO: Consultar si ya calificó esta ronda
    useEffect(() => {
        const checkMyScores = async () => {
            try {
                const res = await api.get(`/scores/my-scores?fase=${fase}&categoria=${categoria}&rol=${rol}`);
                if (res.data.hasSubmitted) {
                    setHasSubmitted(true);
                    setCalificaciones(res.data.scores); // Pintamos los valores que ya había enviado
                    setSuccess('Ya enviaste calificaciones para esta ronda.');
                } else {
                    setHasSubmitted(false);
                    setSuccess('');
                    // Si no es la primera carga y no ha calificado, limpiamos inputs
                    if (!isFirstRender.current) {
                        setCalificaciones({});
                    }
                }
            } catch (error) {
                console.error("Error validando calificaciones previas", error);
            }
        };
        
        checkMyScores();
    }, [fase, categoria, rol]);

    useEffect(() => {
        localStorage.setItem('juezFase', fase);
        localStorage.setItem('juezCategoria', categoria);
        localStorage.setItem('juezRol', rol);
    }, [fase, categoria, rol]);

    useEffect(() => {
        // Solo guardamos en localStorage si NO ha sido enviado aún
        if (!hasSubmitted) {
            localStorage.setItem('juezCalificaciones', JSON.stringify(calificaciones));
        }
    }, [calificaciones, hasSubmitted]);

    useEffect(() => {
        if (fase !== 'Final' && rol !== juezEspecialidad) {
            setRol(juezEspecialidad);
        }
    }, [fase, juezEspecialidad, rol]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
        }
    }, [fase, categoria, rol]);

    const competidoresActuales = competidoresAgrupados 
        ? competidoresAgrupados[categoria][`${rol}s` as 'Leaders' | 'Followers'] 
        : [];

    // NUEVO: Validación estricta por Regex para permitir punto o coma y rechazar letras
    const handleScoreChange = (competidorId: number, valor: string) => {
        if (hasSubmitted) return; // Si ya envió, bloqueamos escritura
        
        // Regex: Solo permite números con hasta un punto o una coma
        if (valor === '' || /^[0-9]*[.,]?[0-9]*$/.test(valor)) {
            const sanitizedValue = valor.replace(',', '.');
            setCalificaciones(prev => ({
                ...prev,
                [competidorId]: sanitizedValue
            }));
        }
    };

    const getInputError = (compId: number): boolean => {
        if (hasSubmitted) return false; // Si ya se enviaron, no marcamos errores rojos
        
        const valStr = calificaciones[compId];
        if (valStr === '' || valStr === undefined) return false;
        
        const val = parseFloat(valStr);
        if (isNaN(val)) return true;

        if (fase === 'Final') {
            if (val < 1 || val > competidoresActuales.length || !Number.isInteger(val)) return true;
            const isDuplicate = Object.values(calificaciones).filter(v => parseFloat(v) === val).length > 1;
            if (isDuplicate) return true;
        } else {
            if (val < 1 || val > 10) return true;
        }
        return false;
    };

    const faltanCalificaciones = competidoresActuales.length > 0 && competidoresActuales.some(
        c => calificaciones[c.id] === '' || calificaciones[c.id] === undefined
    );
    const hayErrores = competidoresActuales.length > 0 && competidoresActuales.some(c => getInputError(c.id));
    
    // Bloquear botón si: enviando, faltan notas, hay errores, O ya se enviaron.
    const isButtonDisabled = isSubmitting || faltanCalificaciones || hayErrores || hasSubmitted;

    // Mensaje dinámico del botón
    let buttonText = 'Revisar y Enviar Calificaciones';
    if (hasSubmitted) buttonText = 'Ronda Completada';
    else if (isSubmitting) buttonText = 'Enviando...';
    else if (hayErrores) buttonText = 'Corrige los errores en rojo';
    else if (faltanCalificaciones) buttonText = 'Completa todas las casillas';

    const handleOpenConfirmation = () => {
        setError('');
        setSuccess('');
        setIsConfirmModalOpen(true);
    };

    const confirmAndSubmit = async () => {
        setIsConfirmModalOpen(false);
        setIsSubmitting(true);

        const payload = {
            fase,
            categoria,
            rol,
            calificaciones: competidoresActuales.map(c => ({
                competidorId: c.id,
                valor: calificaciones[c.id]
            }))
        };

        try {
            await api.post('/scores', payload);
            setSuccess('¡Calificaciones registradas exitosamente!');
            setHasSubmitted(true); // Bloqueamos la interfaz inmediatamente
            localStorage.removeItem('juezCalificaciones');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Ocurrió un error al enviar las calificaciones.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#150D0D] font-['Montserrat'] relative overflow-hidden flex flex-col">
            
            <div className="fixed top-0 left-0 w-96 h-96 bg-[#D9776A] rounded-full blur-[150px] opacity-10 pointer-events-none"></div>
            <div className="fixed bottom-0 right-0 w-96 h-96 bg-[#DFBA84] rounded-full blur-[150px] opacity-10 pointer-events-none"></div>

            <header className="sticky top-0 z-40 w-full bg-[#150D0D]/80 backdrop-blur-md border-b border-[#DFBA84]/20 shadow-lg">
                {/* (Header idéntico al que tenías) */}
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex justify-between items-center relative">
                    <div className="flex flex-col justify-center">
                        <h1 className="text-2xl md:text-3xl font-['Playfair_Display'] font-bold text-[#F4EBE1] tracking-widest">
                            JACK <span className="text-[#DFBA84] italic">&</span> JILL
                        </h1>
                    </div>

                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="text-[#DFBA84] hover:text-[#F4EBE1] transition-colors focus:outline-none p-2"
                    >
                        {isMenuOpen ? (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        )}
                    </button>

                    {isMenuOpen && (
                        <div className="absolute top-20 right-0 w-full md:w-64 md:right-8 bg-[#231515] border-b md:border border-[#DFBA84]/20 shadow-2xl md:rounded-b-2xl overflow-hidden origin-top animate-fade-in-down">
                            
                            {/* NUEVO: Saludo personalizado */}
                            <div className="px-6 py-4 border-b border-white/10 bg-black/20">
                                <p className="text-sm font-bold text-[#DFBA84]">¡Hola, {localStorage.getItem('username')}!</p>
                            </div>

                            <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="w-full text-left px-6 py-5 text-[11px] font-semibold tracking-[0.2em] uppercase text-red-400 hover:bg-white/5 transition-colors flex items-center justify-between">
                                <span>Cerrar Sesión</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 space-y-6 relative z-10">
                
                <div className="text-center pt-2 pb-4">
                    <h2 className="text-[#DFBA84] tracking-[0.3em] text-xs font-semibold uppercase mb-1">
                        Panel de Calificación
                    </h2>
                    <h3 className="text-[#F4EBE1] text-lg font-light tracking-wide">
                        {fase} • {categoria} • {rol}s
                    </h3>
                </div>

                {error && <div className="bg-red-900/40 border border-red-500/50 text-red-200 p-4 rounded-xl text-sm font-medium animate-pulse shadow-lg">{error}</div>}
                {success && <div className="bg-green-900/40 border border-green-500/50 text-green-200 p-4 rounded-xl text-sm font-medium shadow-lg">{success}</div>}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#231515]/60 backdrop-blur-md p-6 rounded-2xl border border-[#DFBA84]/10 shadow-xl">
                    <div>
                        <label className="block text-[10px] font-semibold text-[#DFBA84]/70 uppercase tracking-widest mb-2 ml-1">Fase (Automática)</label>
                        <select value={fase} disabled={true} className="w-full p-3 bg-black/40 border border-white/5 rounded-xl text-white/50 cursor-not-allowed outline-none text-sm font-medium">
                            <option value="Preliminar">Preliminar</option>
                            <option value="Semifinal">Semifinal</option>
                            <option value="Final">Final</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold text-[#DFBA84]/70 uppercase tracking-widest mb-2 ml-1">Categoría</label>
                        <select value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)} className="w-full p-3 bg-[#150D0D] border border-white/10 rounded-xl text-[#F4EBE1] focus:border-[#DFBA84] outline-none text-sm font-medium">
                            <option value="Amateur">Amateur</option>
                            <option value="Open">Open</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold text-[#DFBA84]/70 uppercase tracking-widest mb-2 ml-1">Rol a calificar</label>
                        <select value={rol} onChange={(e) => setRol(e.target.value as Rol)} disabled={fase !== 'Final'} className={`w-full p-3 border rounded-xl outline-none transition-all text-sm font-medium ${fase !== 'Final' ? 'bg-black/40 border-white/5 text-white/50 cursor-not-allowed' : 'bg-[#150D0D] border-white/10 text-[#F4EBE1] focus:border-[#DFBA84]'}`}>
                            {fase !== 'Final' ? (
                                <option value={juezEspecialidad}>{juezEspecialidad}s</option>
                            ) : (
                                <>
                                    <option value="Leader">Leaders</option>
                                    <option value="Follower">Followers</option>
                                </>
                            )}
                        </select>
                    </div>
                </div>

                <div className="bg-[#231515]/60 backdrop-blur-md p-6 rounded-2xl border border-[#DFBA84]/10 shadow-xl">
                    <h2 className="text-xl font-['Playfair_Display'] font-bold text-[#F4EBE1] mb-5 flex items-baseline">
                        Pista Principal
                        <span className="text-[9px] font-['Montserrat'] uppercase tracking-[0.2em] font-semibold text-[#D9776A] ml-3">
                            {fase === 'Final' ? `(Asigna de 1 al ${competidoresActuales.length})` : '(Puntúa del 1 al 10)'}
                        </span>
                    </h2>
                    
                    <div className="space-y-3">
                        {competidoresActuales.length > 0 ? (
                            <>
                                {competidoresActuales.map(comp => {
                                    const hasError = getInputError(comp.id);
                                    
                                    return (
                                        <div key={comp.id} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 hover:border-[#DFBA84]/40 transition-colors">
                                            <div>
                                                <span className="font-['Playfair_Display'] font-bold text-2xl text-[#DFBA84] mr-4">#{comp.dorsal}</span>
                                                <span className="text-[#F4EBE1] font-medium tracking-wide">{comp.nombre}</span>
                                            </div>
                                            <div className="w-20 relative">
                                                {/* NUEVO: Type="text" evita bloqueos de teclado móvil. pattern/inputMode guían al celular */}
                                                <input 
                                                    type="text" 
                                                    inputMode="decimal"
                                                    pattern="[0-9]*[.,]?[0-9]*"
                                                    disabled={hasSubmitted}
                                                    value={calificaciones[comp.id] ?? ''}
                                                    onChange={(e) => handleScoreChange(comp.id, e.target.value)}
                                                    className={`w-full p-2 text-center text-lg font-bold border rounded-xl outline-none transition-all ${
                                                        hasSubmitted 
                                                        ? 'bg-black/50 text-[#DFBA84] border-transparent cursor-not-allowed' 
                                                        : hasError 
                                                            ? 'bg-[#150D0D] border-red-500 text-red-400 focus:ring-1 focus:ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                                                            : 'bg-[#150D0D] border-white/10 text-[#F4EBE1] focus:border-[#DFBA84]'
                                                    }`}
                                                    placeholder="-"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                
                                <button
                                    onClick={handleOpenConfirmation}
                                    disabled={isButtonDisabled}
                                    className={`w-full mt-8 font-bold uppercase tracking-[0.15em] text-sm py-4 px-4 rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(223,186,132,0.15)] ${
                                        hasSubmitted
                                        ? 'bg-[#231515] text-[#DFBA84] border border-[#DFBA84]/30 cursor-not-allowed shadow-none'
                                        : isButtonDisabled 
                                            ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed' 
                                            : 'bg-[#DFBA84] text-[#150D0D] hover:bg-[#F4EBE1] hover:shadow-[0_0_25px_rgba(223,186,132,0.4)] hover:-translate-y-0.5'
                                    }`}
                                >
                                    {buttonText}
                                </button>
                            </>
                        ) : (
                            <div className="py-10 text-center">
                                <p className="text-white/30 text-sm font-medium tracking-wider">Pista vacía en esta ronda.</p>
                            </div>
                        )}
                    </div>
                </div>

            </main>

            <Footer />            
            {/* MODAL DE CONFIRMACIÓN (Se mantiene igual) */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#231515] border border-[#DFBA84]/30 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl text-[#F4EBE1] flex flex-col max-h-[90vh]">
                        
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-['Playfair_Display'] font-bold text-[#DFBA84] mb-2">
                                Revisión de Calificaciones
                            </h3>
                            <p className="text-xs text-white/60 uppercase tracking-widest font-semibold">
                                {fase} • {categoria} • {rol}s
                            </p>
                        </div>

                        <div className="bg-[#D9776A]/20 border border-[#D9776A]/50 text-[#F4EBE1] p-4 rounded-xl text-xs md:text-sm mb-6 leading-relaxed text-center font-medium">
                            ¿Está seguro de que desea enviar las siguientes calificaciones? 
                            <span className="block text-[#DFBA84] font-bold mt-1">Una vez enviados no se pueden realizar cambios.</span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 mb-6 pr-1 custom-scrollbar">
                            {competidoresActuales.map(comp => (
                                <div key={comp.id} className="flex justify-between items-center bg-black/40 border border-white/5 p-3 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <span className="font-['Playfair_Display'] font-bold text-lg text-[#DFBA84]">
                                            #{comp.dorsal}
                                        </span>
                                        <span className="font-medium text-sm text-[#F4EBE1]">
                                            {comp.nombre}
                                        </span>
                                    </div>
                                    <span className="font-black text-lg text-[#D9776A] px-3 py-1 bg-white/5 rounded-lg">
                                        {calificaciones[comp.id]}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                            <button
                                onClick={() => setIsConfirmModalOpen(false)}
                                className="w-full bg-white/5 text-white/70 hover:bg-white/10 font-bold uppercase tracking-wider text-xs py-4 rounded-xl transition-colors border border-white/10"
                            >
                                Volver y Editar
                            </button>
                            <button
                                onClick={confirmAndSubmit}
                                className="w-full bg-[#DFBA84] text-[#150D0D] hover:bg-[#F4EBE1] font-bold uppercase tracking-wider text-xs py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(223,186,132,0.3)] hover:shadow-[0_0_20px_rgba(223,186,132,0.5)]"
                            >
                                Sí, Enviar Definitivamente
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}