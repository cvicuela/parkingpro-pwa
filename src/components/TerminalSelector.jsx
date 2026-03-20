import { useState } from 'react';
import { useTerminal } from '../context/TerminalContext';
import { Monitor, LogIn, LogOut, ArrowLeftRight, Wifi, WifiOff, X, ChevronDown } from 'lucide-react';

export default function TerminalSelector({ compact = false }) {
  const { terminal, terminals, loading, selectTerminal, clearTerminal } = useTerminal();
  const [showList, setShowList] = useState(false);

  if (loading) return null;

  const typeIcon = (type) => {
    if (type === 'entry') return <LogIn size={14} className="text-green-600" />;
    if (type === 'exit') return <LogOut size={14} className="text-amber-600" />;
    return <ArrowLeftRight size={14} className="text-blue-600" />;
  };

  const typeLabel = (type) => {
    if (type === 'entry') return 'Entrada';
    if (type === 'exit') return 'Salida';
    return 'Entrada/Salida';
  };

  const isOnline = (t) => {
    if (!t.last_heartbeat) return false;
    return (Date.now() - new Date(t.last_heartbeat).getTime()) < 300000; // 5 min
  };

  if (compact) {
    return (
      <div className="relative">
        <button onClick={() => setShowList(!showList)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            terminal
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
              : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
          }`}>
          <Monitor size={14} />
          <span>{terminal ? terminal.name : 'Sin terminal'}</span>
          <ChevronDown size={12} />
        </button>
        {showList && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowList(false)} />
            <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-lg border z-50 py-2 max-h-80 overflow-y-auto">
              {terminals.map(t => (
                <button key={t.id} onClick={() => { selectTerminal(t); setShowList(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors ${
                    terminal?.id === t.id ? 'bg-indigo-50' : ''
                  }`}>
                  {typeIcon(t.type)}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.code} · {typeLabel(t.type)}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${isOnline(t) ? 'bg-green-500' : 'bg-gray-300'}`} />
                </button>
              ))}
              {terminal && (
                <button onClick={() => { clearTerminal(); setShowList(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 border-t mt-1 pt-2 text-sm">
                  <X size={14} /> Desconectar terminal
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-5">
          <div className="flex items-center gap-3 text-white">
            <Monitor size={28} />
            <div>
              <h2 className="text-xl font-bold">Seleccionar Terminal</h2>
              <p className="text-indigo-100 text-sm">Elige el punto de acceso donde operas</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-2 max-h-80 overflow-y-auto">
          {terminals.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No hay terminales configuradas</p>
          ) : (
            terminals.map(t => (
              <button key={t.id} onClick={() => selectTerminal(t)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  t.type === 'entry' ? 'bg-green-100' : t.type === 'exit' ? 'bg-amber-100' : 'bg-blue-100'
                }`}>
                  {t.type === 'entry' ? <LogIn size={24} className="text-green-600" /> :
                   t.type === 'exit' ? <LogOut size={24} className="text-amber-600" /> :
                   <ArrowLeftRight size={24} className="text-blue-600" />}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-800">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.code} · {typeLabel(t.type)} · {t.location || 'Sin ubicación'}</p>
                </div>
                <div className="flex items-center gap-1">
                  {isOnline(t)
                    ? <Wifi size={14} className="text-green-500" />
                    : <WifiOff size={14} className="text-gray-300" />}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="p-4 border-t">
          <button onClick={() => selectTerminal({ id: null, name: 'Sin Terminal', code: 'NONE', type: 'both' })}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2">
            Continuar sin terminal asignada
          </button>
        </div>
      </div>
    </div>
  );
}
