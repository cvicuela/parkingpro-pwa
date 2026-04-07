import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  Hash, AlertTriangle, CheckCircle, XCircle, Edit3,
  Save, X, RefreshCw, Shield, Calendar, BarChart3,
  Database, Upload, Search, Building2, Loader2
} from 'lucide-react';
import { ncfAPI, dgiiAPI } from '../services/api';

const NCF_TYPE_LABELS = {
  '01': { name: 'Crédito Fiscal', desc: 'B2B con ITBIS deducible', color: 'blue' },
  '02': { name: 'Consumo', desc: 'Ventas a consumidores finales', color: 'green' },
  '03': { name: 'Nota de Débito', desc: 'Modificar factura al alza', color: 'orange' },
  '04': { name: 'Nota de Crédito', desc: 'Devoluciones/descuentos', color: 'red' },
  '11': { name: 'Compras', desc: 'Proveedores informales', color: 'purple' },
  '13': { name: 'Gastos Menores', desc: 'Parking, peajes, consumibles', color: 'gray' },
  '14': { name: 'Régimen Especial', desc: 'Zonas francas, etc.', color: 'teal' },
  '15': { name: 'Gubernamental', desc: 'Ventas al gobierno', color: 'indigo' },
};

function getStatusColor(seq) {
  if (!seq.is_active) return 'gray';
  if (seq.needs_alert) return 'red';
  if (seq.usage_pct > 80) return 'yellow';
  return 'green';
}

function ProgressBar({ pct, color }) {
  const bg = {
    green: 'bg-green-500', yellow: 'bg-yellow-500',
    red: 'bg-red-500', gray: 'bg-gray-400'
  }[color] || 'bg-blue-500';

  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div className={`${bg} h-2.5 rounded-full transition-all`}
        style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function NCFPage() {
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadSequences = useCallback(async () => {
    try {
      setLoading(true);
      const res = await ncfAPI.listSequences();
      setSequences(res.data?.data || []);
    } catch (err) {
      toast.error('Error cargando secuencias: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSequences(); }, [loadSequences]);

  const startEdit = (seq) => {
    setEditingId(seq.id);
    setEditForm({
      rangeFrom: seq.range_from,
      rangeTo: seq.range_to,
      alertThreshold: seq.alert_threshold,
      expirationDate: seq.expiration_date || '',
      authorizedDate: seq.authorized_date || '',
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async (id) => {
    try {
      await ncfAPI.updateSequence(id, editForm);
      toast.success('Secuencia actualizada');
      setEditingId(null);
      loadSequences();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  const toggleActive = async (seq) => {
    try {
      await ncfAPI.updateSequence(seq.id, { isActive: !seq.is_active });
      toast.success(seq.is_active ? 'Secuencia desactivada' : 'Secuencia activada');
      loadSequences();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  // Summary stats
  const activeSeqs = sequences.filter(s => s.is_active);
  const alertSeqs = sequences.filter(s => s.needs_alert && s.is_active);
  const totalUsed = sequences.reduce((sum, s) => sum + (s.current_number || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Comprobantes Fiscales (NCF)</h1>
        <p className="text-sm text-gray-500 mt-1">Gestión de secuencias de comprobantes autorizados por la DGII</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Hash size={14} /> Secuencias Activas
          </div>
          <p className="text-2xl font-bold">{activeSeqs.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <BarChart3 size={14} /> NCFs Emitidos
          </div>
          <p className="text-2xl font-bold">{totalUsed.toLocaleString()}</p>
        </div>
        <div className={`rounded-xl shadow-sm border p-4 ${alertSeqs.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
          <div className="flex items-center gap-2 text-xs mb-1 text-gray-500">
            <AlertTriangle size={14} className={alertSeqs.length > 0 ? 'text-red-500' : ''} /> Alertas
          </div>
          <p className={`text-2xl font-bold ${alertSeqs.length > 0 ? 'text-red-600' : ''}`}>
            {alertSeqs.length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center justify-center">
          <button onClick={loadSequences} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertSeqs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-red-800">Secuencias por agotarse</p>
              <p className="text-sm text-red-700 mt-1">
                {alertSeqs.map(s => `${s.prefix} (${s.remaining} restantes)`).join(', ')}
                {' '}&mdash; Solicite nuevas secuencias a la DGII.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sequences Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Prefijo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Progreso</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Usado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Rango</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Restante</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vencimiento</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sequences.map(seq => {
                const typeInfo = NCF_TYPE_LABELS[seq.ncf_type] || { name: seq.ncf_type, desc: '', color: 'gray' };
                const statusColor = getStatusColor(seq);
                const isEditing = editingId === seq.id;

                return (
                  <tr key={seq.id} className={`hover:bg-gray-50 ${!seq.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{typeInfo.name}</p>
                        <p className="text-xs text-gray-400">{typeInfo.desc}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-lg">{seq.prefix}</td>
                    <td className="px-4 py-3 min-w-[120px]">
                      <ProgressBar pct={seq.usage_pct} color={statusColor} />
                      <p className="text-xs text-gray-400 mt-1">{seq.usage_pct}%</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {seq.current_number.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input type="number" value={editForm.rangeFrom}
                            onChange={e => setEditForm({ ...editForm, rangeFrom: parseInt(e.target.value) || 0 })}
                            className="w-20 border rounded px-2 py-1 text-right text-sm" />
                          <span className="text-gray-400">-</span>
                          <input type="number" value={editForm.rangeTo}
                            onChange={e => setEditForm({ ...editForm, rangeTo: parseInt(e.target.value) || 0 })}
                            className="w-20 border rounded px-2 py-1 text-right text-sm" />
                        </div>
                      ) : (
                        `${(seq.range_from ?? 0).toLocaleString()} - ${(seq.range_to ?? 0).toLocaleString()}`
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      seq.needs_alert ? 'text-red-600' : seq.remaining < 500 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {seq.remaining.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(seq)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          seq.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        } transition-colors`}>
                        {seq.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {seq.is_active ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEditing ? (
                        <input type="date" value={editForm.expirationDate}
                          onChange={e => setEditForm({ ...editForm, expirationDate: e.target.value })}
                          className="border rounded px-2 py-1 text-sm" />
                      ) : (
                        seq.expiration_date
                          ? new Date(seq.expiration_date).toLocaleDateString('es-DO')
                          : <span className="text-gray-400">Sin vencimiento</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={() => saveEdit(seq.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                            <Save size={16} />
                          </button>
                          <button onClick={cancelEdit}
                            className="p-1.5 text-gray-400 hover:bg-gray-50 rounded">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(seq)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
                          <Edit3 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Shield className="text-blue-600 shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-medium">Sobre los comprobantes fiscales</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-700">
              <li><strong>B02</strong> (Consumo): Se usa para la mayoría de ventas a clientes del parqueo</li>
              <li><strong>B01</strong> (Crédito Fiscal): Para empresas que necesitan deducir ITBIS &mdash; requiere RNC válido en DGII</li>
              <li><strong>B11</strong> (Compras): Para compras a proveedores informales sin NCF</li>
              <li><strong>B13</strong> (Gastos Menores): Para gastos pequeños del negocio</li>
              <li>Las secuencias son autorizadas por la DGII y tienen un rango limitado</li>
              <li>Configure la alerta para ser notificado cuando queden pocos comprobantes</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ─── DGII RNC REGISTRY SECTION ─── */}
      <DGIIRNCSection />
    </div>
  );
}

// ─── DGII RNC Database Management Component ───────────────────────────
function DGIIRNCSection() {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const fileInputRef = useRef(null);

  const loadStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await dgiiAPI.stats();
      setStats(res?.data || null);
    } catch (err) {
      setStats(null);
      console.warn('DGII stats error:', err.message);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleSearch = async () => {
    if (searchQuery.trim().length < 3) {
      toast.warning('Mínimo 3 caracteres para buscar');
      return;
    }
    try {
      setSearching(true);
      const result = await dgiiAPI.searchRnc(searchQuery.trim());
      setSearchResults(result.success ? (result.data || []) : []);
      if (result.success && (!result.data || result.data.length === 0)) {
        toast.info('No se encontraron resultados');
      }
    } catch (err) {
      toast.error('Error en búsqueda: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  // Parse DGII pipe-delimited TXT file
  const parseDGIIFile = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    const records = [];
    // Skip header line if present
    const start = lines[0]?.includes('RNC') || lines[0]?.includes('CEDULA') ? 1 : 0;

    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split('|').map(c => c.trim());
      if (cols.length < 2) continue;
      const rnc = cols[0]?.replace(/[-\s]/g, '');
      if (!rnc || !/^\d{9,11}$/.test(rnc)) continue;

      records.push({
        rnc,
        business_name: cols[1] || '',
        trade_name: cols[2] || null,
        economic_activity: cols[3] || null,
        status: (cols[5] || 'ACTIVO').toUpperCase() === 'ACTIVO' ? 'active' : 'inactive',
        payment_regime: cols[6] || null,
      });
    }
    return records;
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setImportProgress({ stage: 'Leyendo archivo...', pct: 5 });

      const text = await file.text();
      setImportProgress({ stage: 'Parseando registros...', pct: 15 });

      const records = parseDGIIFile(text);
      if (records.length === 0) {
        toast.error('No se encontraron registros válidos en el archivo');
        return;
      }

      setImportProgress({ stage: `Importando ${records.length.toLocaleString()} registros...`, pct: 25 });

      // Send in batches of 3000
      const BATCH_SIZE = 3000;
      let totalImported = 0;
      const startTime = Date.now();

      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const pct = Math.round(25 + (i / records.length) * 70);
        setImportProgress({
          stage: `Lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(records.length / BATCH_SIZE)} (${totalImported.toLocaleString()} importados)...`,
          pct
        });

        const result = await dgiiAPI.importBatch(batch);
        totalImported += result?.imported || batch.length;
      }

      const duration = Date.now() - startTime;
      setImportProgress({ stage: 'Registrando importación...', pct: 97 });

      await dgiiAPI.logImport({
        recordsImported: totalImported,
        recordsTotal: records.length,
        source: 'dgii_file',
        durationMs: duration,
      });

      setImportProgress(null);
      toast.success(`Importados ${totalImported.toLocaleString()} registros en ${(duration / 1000).toFixed(1)}s`);
      loadStats();
    } catch (err) {
      toast.error('Error importando: ' + err.message);
    } finally {
      setImporting(false);
      setImportProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      {/* DGII Header */}
      <div className="border-t pt-6 mt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Database size={22} className="text-emerald-600" />
              Registro RNC (DGII)
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Base de datos local de contribuyentes para validar RNC en facturas B01
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadStats} disabled={loadingStats}
              className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
              <RefreshCw size={16} className={loadingStats ? 'animate-spin' : ''} />
            </button>
            <input ref={fileInputRef} type="file" accept=".txt,.csv" onChange={handleFileImport}
              className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? 'Importando...' : 'Actualizar Base DGII'}
            </button>
          </div>
        </div>
      </div>

      {/* Import Progress */}
      {importProgress && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm font-medium text-emerald-800 mb-2">{importProgress.stage}</p>
          <div className="w-full bg-emerald-200 rounded-full h-2">
            <div className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${importProgress.pct}%` }} />
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {!stats && !loadingStats ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <AlertTriangle size={16} />
            <span>Error al cargar estadísticas DGII</span>
          </div>
          <button onClick={loadStats} className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <Building2 size={14} /> Total Registros
            </div>
            <p className="text-2xl font-bold">{stats?.total_records?.toLocaleString() || '0'}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <CheckCircle size={14} className="text-green-500" /> Activos
            </div>
            <p className="text-2xl font-bold text-green-600">{stats?.active_records?.toLocaleString() || '0'}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <XCircle size={14} className="text-gray-400" /> Inactivos
            </div>
            <p className="text-2xl font-bold text-gray-400">{stats?.inactive_records?.toLocaleString() || '0'}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <Calendar size={14} /> Última Actualización
            </div>
            <p className="text-sm font-medium mt-1">
              {stats?.last_import?.date
                ? new Date(stats.last_import.date).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Nunca'}
            </p>
            {stats?.last_import?.records_total > 0 && (
              <p className="text-xs text-gray-400">{stats.last_import.records_total.toLocaleString()} registros</p>
            )}
          </div>
        </div>
      )}

      {/* RNC Search */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar por RNC o nombre de empresa..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <button onClick={handleSearch} disabled={searching}
            className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Buscar
          </button>
        </div>

        {/* Search Results */}
        {searchResults && searchResults.length > 0 && (
          <div className="mt-4 border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-2 font-medium text-gray-600">RNC</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Razón Social</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Nombre Comercial</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {searchResults.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono font-medium">{r.rnc}</td>
                    <td className="px-4 py-2">{r.business_name}</td>
                    <td className="px-4 py-2 text-gray-500">{r.trade_name || '-'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {r.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DGII Info */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Database className="text-emerald-600 shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-emerald-800 space-y-1">
            <p className="font-medium">Base de datos DGII de contribuyentes</p>
            <ul className="list-disc list-inside space-y-0.5 text-emerald-700">
              <li>Al emitir facturas <strong>B01</strong> (Crédito Fiscal), el sistema valida que el RNC esté registrado y activo en DGII</li>
              <li>Descargue el archivo actualizado desde el portal de la DGII y cárguelo con el botón &ldquo;Actualizar Base DGII&rdquo;</li>
              <li>El archivo es tipo TXT delimitado por pipes (|) publicado por la DGII</li>
              <li>Se recomienda actualizar periódicamente para mantener los datos al día</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
