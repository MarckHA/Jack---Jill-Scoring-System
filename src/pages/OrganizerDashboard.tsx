import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { type Fase, type Categoria, type Rol } from '../types';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';

interface Resultado {
    competidorId: string;
    total: number;
    valoresDetallados: number[];
}

type Tab = 'dashboard' | 'registro';

export default function OrganizerDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    
    // NUEVOS ESTADOS DE FASE SEPARADA
    const [faseAmateur, setFaseAmateur] = useState<Fase>('Preliminar');
    const [faseOpen, setFaseOpen] = useState<Fase>('Preliminar');
    
    // Formularios (se mantienen igual)
    const [nuevoDorsal, setNuevoDorsal] = useState('');
    const [nuevoNombre, setNuevoNombre] = useState('');
    const [nuevaCategoria, setNuevaCategoria] = useState<Categoria>('Amateur');
    const [nuevoRol, setNuevoRol] = useState<Rol>('Leader');

    // Resultados (se mantienen igual)
    const [filtroFase, setFiltroFase] = useState<Fase>((localStorage.getItem('orgFase') as Fase) || 'Preliminar');
    const [filtroCategoria, setFiltroCategoria] = useState<Categoria>((localStorage.getItem('orgCategoria') as Categoria) || 'Amateur');
    const [filtroRol, setFiltroRol] = useState<Rol>((localStorage.getItem('orgRol') as Rol) || 'Leader');
    
    const [resultados, setResultados] = useState<Resultado[]>([]);
    const [diccionarioCompetidores, setDiccionarioCompetidores] = useState<Record<string, { nombre: string, dorsal: string }>>({});
    
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // NUEVOS ESTADOS: Modal de Progresión Dinámico
    const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
    const [categoryToAdvance, setCategoryToAdvance] = useState<Categoria | null>(null);
    const [phaseToAdvance, setPhaseToAdvance] = useState<Fase | null>(null);
    const [cupos, setCupos] = useState({ leader: 10, follower: 10 }); // Solo preguntamos por 2 cupos

    useEffect(() => {
        const initData = async () => {
            try {
                const configRes = await api.get('/config');
                if (configRes.data.config) {
                    if (configRes.data.config.Fase_Activa_Amateur) setFaseAmateur(configRes.data.config.Fase_Activa_Amateur as Fase);
                    if (configRes.data.config.Fase_Activa_Open) setFaseOpen(configRes.data.config.Fase_Activa_Open as Fase);
                }
                
                const compRes = await api.get('/competitors');
                const todos = compRes.data.todos || []; // Obtenemos TODOS los competidores
                const diccionario: Record<string, { nombre: string, dorsal: string }> = {};
                
                todos.forEach((c: any) => {
                    diccionario[c.id.toString()] = { nombre: c.nombre, dorsal: c.dorsal };
                });
                setDiccionarioCompetidores(diccionario);
            } catch (error) {
                console.error("Error cargando datos iniciales");
            }
        };
        initData();
    }, [activeTab]);

    const fetchResultados = async () => {
        setIsRefreshing(true);
        try {
            const res = await api.get(`/results?fase=${filtroFase}&categoria=${filtroCategoria}&rol=${filtroRol}`);
            setResultados(res.data.resultados);
        } catch (error) {
            mostrarMensaje('Error al obtener los resultados', 'error');
        } finally {
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    useEffect(() => {
        if (activeTab === 'dashboard') {
            localStorage.setItem('orgFase', filtroFase);
            localStorage.setItem('orgCategoria', filtroCategoria);
            localStorage.setItem('orgRol', filtroRol);
            fetchResultados();
        }
    }, [filtroFase, filtroCategoria, filtroRol, activeTab]);

    // -------------------------------------------------------------
    // NUEVA LÓGICA DE AVANCE ESPECÍFICA POR CATEGORÍA
    // -------------------------------------------------------------
    const handleAdvancePhaseSubmit = async () => {
        if (!categoryToAdvance || !phaseToAdvance) return;
        setIsRefreshing(true);
        
        try {
            // Sabemos qué fase estamos dejando atrás
            const faseActual = categoryToAdvance === 'Amateur' ? faseAmateur : faseOpen;

            // 1. Obtenemos SOLO los resultados de la categoría que avanza
            const [resL, resF] = await Promise.all([
                api.get(`/results?fase=${faseActual}&categoria=${categoryToAdvance}&rol=Leader`),
                api.get(`/results?fase=${faseActual}&categoria=${categoryToAdvance}&rol=Follower`)
            ]);

            // 2. Extraemos a los perdedores cortando la lista según el cupo
            const losersL = resL.data.resultados.slice(cupos.leader).map((r: any) => r.competidorId);
            const losersF = resF.data.resultados.slice(cupos.follower).map((r: any) => r.competidorId);
            const allLosers = [...losersL, ...losersF];

            // 3. Los marcamos como eliminados en la base de datos
            if (allLosers.length > 0) {
                await api.post('/competitors/bulk-status', { ids: allLosers, status: 'eliminado' });
            }

            // 4. Cambiamos la Fase de esa Categoría
            const paramName = `Fase_Activa_${categoryToAdvance}`;
            await api.post('/config', { parametro: paramName, valor: phaseToAdvance });
            
            if (categoryToAdvance === 'Amateur') setFaseAmateur(phaseToAdvance);
            else setFaseOpen(phaseToAdvance);
            
            mostrarMensaje(`Categoría ${categoryToAdvance} avanzó a ${phaseToAdvance}. ${allLosers.length} eliminados.`, 'success');
            setIsAdvanceModalOpen(false);
            
            // Reflejamos los cambios en la tabla visualmente
            setFiltroCategoria(categoryToAdvance);
            setFiltroFase(phaseToAdvance);
            
        } catch (error) {
            mostrarMensaje('Error procesando el avance de fase.', 'error');
        } finally {
            setIsRefreshing(false);
            setCupos({ leader: 10, follower: 10 }); // Reset
        }
    };

    const handleAddCompetitor = async (e: React.FormEvent) => {
        // ... (El código de añadir competidor se mantiene igual)
        e.preventDefault();
        try {
            await api.post('/competitors', { dorsal: nuevoDorsal, nombre: nuevoNombre, categoria: nuevaCategoria, rol: nuevoRol });
            mostrarMensaje('Competidor registrado con éxito.', 'success');
            setNuevoDorsal(''); setNuevoNombre('');
        } catch (error) {
            mostrarMensaje('Error al registrar competidor', 'error');
        }
    };

    const mostrarMensaje = (texto: string, tipo: 'success' | 'error') => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 5000);
    };

    const phasesOrder: Fase[] = ['Preliminar', 'Semifinal', 'Final'];

    // UI Helper: Renderizador de botones por categoría
    const renderPhaseControls = (catName: Categoria, currentPhase: Fase) => {
        const currentIdx = phasesOrder.indexOf(currentPhase);
        
        return (
            <div className="bg-black/30 border border-white/5 rounded-xl p-4 mb-4">
                <h3 className="text-[#DFBA84] font-bold uppercase tracking-widest text-xs mb-3">{catName}</h3>
                <div className="flex flex-col space-y-2">
                    {phasesOrder.map((f, index) => {
                        const isNext = index === currentIdx + 1;
                        return (
                            <button
                                key={f}
                                disabled={!isNext}
                                onClick={() => {
                                    setCategoryToAdvance(catName);
                                    setPhaseToAdvance(f);
                                    setIsAdvanceModalOpen(true);
                                }}
                                className={`py-2 px-3 rounded-lg font-bold uppercase tracking-wider text-[10px] transition-all ${
                                    f === currentPhase 
                                    ? 'bg-[#DFBA84] text-[#150D0D] cursor-default shadow-sm' 
                                    : isNext
                                        ? 'bg-white/10 text-[#F4EBE1] border border-[#DFBA84]/50 hover:bg-white/20'
                                        : 'bg-transparent text-white/20 border border-transparent cursor-not-allowed'
                                }`}
                            >
                                Activar {f}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#150D0D] font-['Montserrat'] relative overflow-x-hidden flex flex-col pb-10">
            {/* Luces y Header (Idéntico a antes) */}
            <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-[#D9776A] rounded-full blur-[150px] opacity-10 pointer-events-none"></div>
            <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-[#DFBA84] rounded-full blur-[150px] opacity-10 pointer-events-none"></div>

            <header className="sticky top-0 z-40 w-full bg-[#150D0D]/80 backdrop-blur-md border-b border-[#DFBA84]/20 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex justify-between items-center relative">
                    <div className="flex flex-col justify-center">
                        <h1 className="text-2xl md:text-3xl font-['Playfair_Display'] font-bold text-[#F4EBE1] tracking-widest">
                            JACK <span className="text-[#DFBA84] italic">&</span> JILL
                        </h1>
                    </div>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-[#DFBA84] hover:text-[#F4EBE1] focus:outline-none p-2">
                        {isMenuOpen ? <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg> : <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>}
                    </button>
                    {isMenuOpen && (
                        <div className="absolute top-20 right-0 w-full md:w-64 md:right-8 bg-[#231515] border-b md:border border-[#DFBA84]/20 shadow-2xl md:rounded-b-2xl overflow-hidden origin-top animate-fade-in-down">
                            
                            {/* NUEVO: Saludo personalizado */}
                            <div className="px-6 py-4 border-b border-white/10 bg-black/20">
                                <p className="text-sm font-bold text-[#DFBA84]">¡Hola, {localStorage.getItem('username')}!</p>
                            </div>

                            <button 
                                onClick={() => { 
                                    localStorage.clear(); 
                                    navigate('/login'); 
                                }} 
                                className="w-full text-left px-6 py-5 text-[11px] font-semibold tracking-[0.2em] uppercase text-red-400 hover:bg-white/5 transition-colors flex items-center justify-between">
                                <span>Cerrar Sesión</span>
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6 relative z-10">
                <div className="mb-8">
                    <div className="text-center md:text-left pt-2 pb-6">
                        <h2 className="text-[#DFBA84] tracking-[0.3em] text-xs font-semibold uppercase mb-1">Centro de Control</h2>
                        <h3 className="text-[#F4EBE1] text-xl font-light tracking-wide">Panel del Organizador</h3>
                    </div>

                    <div className="flex border-b border-white/10 overflow-x-auto hide-scrollbar">
                        <button onClick={() => setActiveTab('dashboard')} className={`pb-4 px-6 text-xs md:text-sm font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${activeTab === 'dashboard' ? 'text-[#DFBA84] border-b-2 border-[#DFBA84]' : 'text-white/40 hover:text-white/70'}`}>
                            Control y Resultados
                        </button>
                        <button onClick={() => setActiveTab('registro')} className={`pb-4 px-6 text-xs md:text-sm font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${activeTab === 'registro' ? 'text-[#DFBA84] border-b-2 border-[#DFBA84]' : 'text-white/40 hover:text-white/70'}`}>
                            Registro de Participantes
                        </button>
                    </div>
                </div>

                {mensaje.texto && (
                    <div className={`p-4 rounded-xl text-sm font-medium animate-pulse shadow-lg ${mensaje.tipo === 'success' ? 'bg-green-900/40 border-green-500/50 text-green-200' : 'bg-red-900/40 border-red-500/50 text-red-200'}`}>{mensaje.texto}</div>
                )}

                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
                        
                        {/* NUEVO: Control Maestro Separado por Categoría */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-[#231515]/60 backdrop-blur-md p-6 rounded-2xl border border-[#DFBA84]/20 shadow-xl border-t-4 border-t-[#D9776A]">
                                <h2 className="text-lg font-['Playfair_Display'] font-bold text-[#F4EBE1] mb-5">Progreso Global</h2>
                                
                                {renderPhaseControls('Amateur', faseAmateur)}
                                {renderPhaseControls('Open', faseOpen)}
                                
                                <p className="text-[9px] text-red-300/60 mt-4 italic text-center">
                                    *Fases anteriores bloqueadas por seguridad.
                                </p>
                            </div>
                        </div>

                        {/* Tabla de Resultados (Mismo código de siempre) */}
                        <div className="bg-[#231515]/60 backdrop-blur-md p-6 rounded-2xl border border-[#DFBA84]/10 shadow-xl lg:col-span-3 flex flex-col min-h-[500px]">
                            {/* CÓDIGO DE LA TABLA - COMPLETAMENTE INTACTO PARA AHORRAR ESPACIO, MANTÉN EL TUYO AQUÍ */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <h2 className="text-xl font-['Playfair_Display'] font-bold text-[#F4EBE1]">Posiciones en Vivo</h2>
                                <button onClick={fetchResultados} className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 border border-[#DFBA84]/30 text-[#DFBA84] rounded-full hover:bg-[#DFBA84]/10 flex items-center gap-2 ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <svg className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    Actualizar
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-6">
                                <select value={filtroFase} onChange={e => setFiltroFase(e.target.value as Fase)} className="w-full p-2 bg-[#150D0D] border border-white/10 rounded-lg text-white/80 outline-none text-xs sm:text-sm">
                                    <option value="Preliminar">Preliminar</option>
                                    <option value="Semifinal">Semifinal</option>
                                    <option value="Final">Final</option>
                                </select>
                                <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value as Categoria)} className="w-full p-2 bg-[#150D0D] border border-white/10 rounded-lg text-white/80 outline-none text-xs sm:text-sm">
                                    <option value="Amateur">Amateur</option>
                                    <option value="Open">Open</option>
                                </select>
                                <select value={filtroRol} onChange={e => setFiltroRol(e.target.value as Rol)} className="w-full p-2 bg-[#150D0D] border border-white/10 rounded-lg text-white/80 outline-none text-xs sm:text-sm">
                                    <option value="Leader">Leaders</option>
                                    <option value="Follower">Followers</option>
                                </select>
                            </div>

                            <div className="flex-1 overflow-auto rounded-xl border border-white/5 bg-black/20">
                                {resultados.length > 0 ? (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#150D0D]/80 text-[#DFBA84]/70 text-[10px] uppercase tracking-widest border-b border-white/10">
                                                <th className="py-4 px-4 font-semibold text-center w-16">Pos</th>
                                                <th className="py-4 px-4 font-semibold">Competidor</th>
                                                <th className="py-4 px-4 font-semibold text-center">{filtroFase === 'Final' ? 'Ranking' : 'Puntaje'}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {resultados.map((res, index) => {
                                                const comp = diccionarioCompetidores[res.competidorId.toString()] || { nombre: 'Desconocido', dorsal: 'N/A' };
                                                const isGold = index === 0;
                                                const isSilver = index === 1;
                                                const isBronze = index === 2;

                                                return (
                                                    <tr key={res.competidorId} className={`transition-colors hover:bg-white/5 ${isGold ? 'bg-[#DFBA84]/5' : ''}`}>
                                                        <td className="py-3 px-4 text-center">
                                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${isGold ? 'bg-[#DFBA84] text-[#150D0D] shadow-[0_0_10px_rgba(223,186,132,0.5)]' : isSilver ? 'bg-gray-300 text-[#150D0D]' : isBronze ? 'bg-[#D9776A] text-white' : 'bg-white/5 text-white/40'}`}>
                                                                {index + 1}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-['Playfair_Display'] font-bold text-xl text-[#DFBA84]">#{comp.dorsal}</span>
                                                                <span className={`font-medium text-base tracking-wide ${isGold ? 'text-[#DFBA84]' : 'text-[#F4EBE1]'}`}>{comp.nombre}</span>
                                                            </div>
                                                        </td>
                                                        <td className={`py-3 px-4 text-center font-black text-xl ${isGold ? 'text-[#DFBA84]' : 'text-white/80'}`}>
                                                            {filtroFase === 'Final' ? res.total : res.total.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-white/30">
                                        <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                        <p className="text-sm uppercase tracking-widest font-semibold">Sin resultados aún</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* PESTAÑA REGISTRO (Se mantiene igual) */}
                {activeTab === 'registro' && (
                    <div className="max-w-2xl mx-auto animate-fade-in">
                        {/* CÓDIGO DEL FORMULARIO DE REGISTRO - MANTÉN EL TUYO */}
                        <div className="bg-[#231515]/60 backdrop-blur-md p-8 md:p-10 rounded-2xl border border-[#DFBA84]/10 shadow-xl">
                            <h2 className="text-2xl font-['Playfair_Display'] font-bold text-[#F4EBE1] mb-2 text-center">Nuevo Competidor</h2>
                            <form onSubmit={handleAddCompetitor} className="space-y-6 mt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-[11px] font-semibold text-[#DFBA84]/70 uppercase tracking-widest ml-1">Dorsal</label>
                                        <input type="text" required value={nuevoDorsal} onChange={e => setNuevoDorsal(e.target.value)} className="w-full p-4 bg-[#150D0D] border border-white/10 rounded-xl text-[#F4EBE1] focus:border-[#DFBA84] outline-none text-base" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[11px] font-semibold text-[#DFBA84]/70 uppercase tracking-widest ml-1">Nombre Completo</label>
                                        <input type="text" required value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} className="w-full p-4 bg-[#150D0D] border border-white/10 rounded-xl text-[#F4EBE1] focus:border-[#DFBA84] outline-none text-base" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-[11px] font-semibold text-[#DFBA84]/70 uppercase tracking-widest ml-1">Categoría</label>
                                        <select value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value as Categoria)} className="w-full p-4 bg-[#150D0D] border border-white/10 rounded-xl text-[#F4EBE1] focus:border-[#DFBA84] outline-none text-base">
                                            <option value="Amateur">Amateur</option>
                                            <option value="Open">Open</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-[11px] font-semibold text-[#DFBA84]/70 uppercase tracking-widest ml-1">Rol</label>
                                        <select value={nuevoRol} onChange={e => setNuevoRol(e.target.value as Rol)} className="w-full p-4 bg-[#150D0D] border border-white/10 rounded-xl text-[#F4EBE1] focus:border-[#DFBA84] outline-none text-base">
                                            <option value="Leader">Leader</option>
                                            <option value="Follower">Follower</option>
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" className="w-full mt-8 bg-[#DFBA84] text-[#150D0D] font-bold uppercase tracking-[0.2em] text-sm py-5 rounded-xl hover:bg-[#F4EBE1] shadow-lg">Registrar</button>
                            </form>
                        </div>
                    </div>
                )}
            </main>

            <Footer />

            {/* MODAL SIMPLIFICADO: Solo pregunta cupos para la categoría seleccionada */}
            {isAdvanceModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#231515] border border-[#D9776A]/40 rounded-3xl max-w-sm w-full p-6 md:p-8 shadow-2xl text-[#F4EBE1]">
                        
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-['Playfair_Display'] font-bold text-[#F4EBE1] mb-2">
                                Avanzar {categoryToAdvance} a <span className="text-[#D9776A]">{phaseToAdvance}</span>
                            </h3>
                            <p className="text-[11px] text-white/50 uppercase tracking-widest font-semibold leading-relaxed">
                                Define cuántos competidores clasifican en esta categoría
                            </p>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] text-white/70 uppercase tracking-widest mb-1 text-center">Leaders que pasan</label>
                                    <input type="number" min="1" value={cupos.leader} onChange={e => setCupos({...cupos, leader: parseInt(e.target.value) || 0})} className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-center font-bold text-2xl text-[#DFBA84] focus:border-[#D9776A] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-white/70 uppercase tracking-widest mb-1 text-center">Followers que pasan</label>
                                    <input type="number" min="1" value={cupos.follower} onChange={e => setCupos({...cupos, follower: parseInt(e.target.value) || 0})} className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-center font-bold text-2xl text-[#DFBA84] focus:border-[#D9776A] outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl text-[10px] text-red-200 mb-6 text-center leading-relaxed">
                            El sistema marcará automáticamente como <strong>eliminados</strong> a quienes queden por debajo de estos cupos.
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button disabled={isRefreshing} onClick={() => setIsAdvanceModalOpen(false)} className="w-full bg-white/5 text-white/70 hover:bg-white/10 font-bold uppercase tracking-wider text-xs py-4 rounded-xl transition-colors border border-white/10">
                                Cancelar
                            </button>
                            <button disabled={isRefreshing} onClick={handleAdvancePhaseSubmit} className="w-full bg-[#D9776A] text-[#150D0D] hover:bg-[#F4EBE1] font-bold uppercase tracking-wider text-xs py-4 rounded-xl transition-all shadow-[0_0_15px_rgba(217,119,106,0.3)]">
                                {isRefreshing ? 'Cortando...' : 'Avanzar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}