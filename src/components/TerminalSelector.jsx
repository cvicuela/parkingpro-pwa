import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTerminal } from '../context/TerminalContext';
import { useAuth } from '../context/AuthContext';
import { Monitor, LogIn, LogOut, ArrowLeftRight, Wifi, WifiOff, X, ChevronDown, Settings, Plus } from 'lucide-react';

export default function TerminalSelector({ compact = false }) {
  const { terminal, terminals, loading, selectTerminal, clearTerminal } = useTerminal();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showList, setShowList] = useState(false);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    if (!showList) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setShowList(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [showList]);

  if (loading) return null;

  const typeIcon = (type) => {
    if (type === 'entry') return <LogIn size={14} className="text-green-600" aria-hidden="true" />;
    if (type === 'exit') return <LogOut size={14} className="text-amber-600" aria-hidden="true" />;
    return <ArrowLeftRight size={14} className="text-blue-600" aria-hidden="true" />;
  };

  const typeLabel = (type) => {
    if (type === 'entry') return 'Entrada';
    if (type === 'exit') return 'Salida';
    return 'Entrada/Salida';
  };

  const isOnline = (t) => {
    if (!t.last_heartbeat) return false;
    return (Date.now() - new Date(t.last_heartbeat).getTime()) < 300000;
  };

  const isNoneTerminal = terminal && !terminal.id;

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowList(!showList)}
          aria-haspopup="listbox"
          aria-expanded={showList}
          aria-label={`Terminal: ${terminal ? terminal.name : 'Sin terminal'}`}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            terminal && terminal.id
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
              : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
          }`}>
          <Monitor size={14} aria-hidden="true" />
          <span>{terminal && terminal.id ? terminal.name : 'Sin terminal'}</span>
          <ChevronDown size={12} aria-hidden="true" />
        </button>
        {showList && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowList(false)} />
            <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-lg border z-50 py-2 max-h-80 overflow-y-auto" role="listbox" aria-label="Seleccionar terminal">
              {terminals.length > 0 && (
                <p className="px-4 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cambiar terminal</p>
              )}
              {terminals.map(t => (
                <button key={t.id} onClick={() => { selectTerminal(t); setShowList(false); }}
                  role="option"
                  aria-selected={terminal?.id === t.id}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors ${
                    terminal?.id === t.id ? 'bg-indigo-50' : ''
                  }`}>
                  {typeIcon(t.type)}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.code} · {typeLabel(t.type)}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${isOnline(t) ? 'bg-green-500' : 'bg-gray-300'}`} aria-label={isOnline(t) ? 'En línea' : 'Fuera de línea'} />
                </button>
              ))}
              {terminals.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-500 text-center">No hay terminales configuradas</p>
              )}
              {isAdmin && (
                <button onClick={() => { setShowList(false); navigate('/config'); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-indigo-600 hover:bg-indigo-50 border-t mt-1 pt-2 text-sm">
                  <Settings size={14} aria-hidden="true" /> Administrar terminales
                </button>
              )}
              {terminal && terminal.id && (
                <button onClick={() => { clearTerminal(); setShowList(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 border-t mt-1 pt-2 text-sm">
                  <X size={14} aria-hidden="true" /> Desconectar terminal
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Full-screen selector (shown when no terminal selected)
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="terminal-selector-title">
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-5">
          <div className="flex items-center gap-3 text-white">
            <Monitor size={28} aria-hidden="true" />
            <div>
              <h2 id="terminal-selector-title" className="text-xl font-bold">Seleccionar Terminal</h2>
              <p className="text-indigo-100 text-sm">Elige el punto de acceso donde operas</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-2 max-h-80 overflow-y-auto" role="listbox" aria-label="Terminales disponibles">
          {terminals.length === 0 ? (
            <div className="text-center py-8">
              <Monitor size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-4">No hay terminales configuradas</p>
              {isAdmin && (
                <button onClick={() => { selectTerminal({ id: null, name: 'Sin Terminal', code: 'NONE', type: 'both' }); navigate('/config'); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
                  <Plus size={16} /> Crear Terminal en Configuración
                </button>
              )}
            </div>
          ) : (
            terminals.map(t => (
              <button key={t.id} onClick={() => selectTerminal(t)}
                role="option"
                aria-selected={false}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  t.type === 'entry' ? 'bg-green-100' : t.type === 'exit' ? 'bg-amber-100' : 'bg-blue-100'
                }`}>
                  {t.type === 'entry' ? <LogIn size={24} className="text-green-600" aria-hidden="true" /> :
                   t.type === 'exit' ? <LogOut size={24} className="text-amber-600" aria-hidden="true" /> :
                   <ArrowLeftRight size={24} className="text-blue-600" aria-hidden="true" />}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-800">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.code} · {typeLabel(t.type)} · {t.location || 'Sin ubicación'}</p>
                </div>
                <div className="flex items-center gap-1">
                  {isOnline(t)
                    ? <Wifi size={14} className="text-green-500" aria-label="En línea" />
                    : <WifiOff size={14} className="text-gray-500" aria-label="Fuera de línea" />}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="p-4 border-t space-y-2">
          <button onClick={() => selectTerminal({ id: null, name: 'Sin Terminal', code: 'NONE', type: 'both' })}
            className="w-full text-center text-sm text-gray-600 hover:text-gray-800 py-2">
            Continuar sin terminal asignada
          </button>
          {isAdmin && terminals.length > 0 && (
            <button onClick={() => { selectTerminal({ id: null, name: 'Sin Terminal', code: 'NONE', type: 'both' }); navigate('/config'); }}
              className="w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 py-1">
              <Settings size={14} /> Administrar terminales
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
