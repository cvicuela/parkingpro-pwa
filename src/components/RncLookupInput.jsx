import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { dgiiAPI } from '../services/api';
import { isValidRNC, formatRNC } from '../utils/validators';

/**
 * RNC input with auto-lookup from the local DGII database.
 * When user types 3+ digits, searches the database and shows a dropdown.
 * On selection, calls onSelect({ rnc, business_name, trade_name, status }).
 */
export default function RncLookupInput({ value, onChange, onSelect, placeholder = 'Sin guiones', className = '' }) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [validated, setValidated] = useState(null); // null | 'valid' | 'invalid' | 'not_found'
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchRnc = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setResults([]);
      setShowDropdown(false);
      setValidated(null);
      return;
    }

    setSearching(true);
    try {
      const res = await dgiiAPI.searchRnc(query, 8);
      const data = res?.data?.data || res?.data || [];
      const items = Array.isArray(data) ? data : [];
      setResults(items);
      setShowDropdown(items.length > 0);

      // If exact match found, auto-select and fill supplier name
      const clean = query.replace(/\D/g, '');
      if (isValidRNC(clean)) {
        const exact = items.find(r => r.rnc?.replace(/\D/g, '') === clean);
        if (exact) {
          setValidated(exact.status === 'active' ? 'valid' : 'inactive');
          setShowDropdown(false);
          // Auto-fill: call onSelect so parent gets the business name
          if (onSelect) {
            onSelect({
              rnc: clean,
              business_name: exact.business_name || exact.razon_social || '',
              trade_name: exact.trade_name || exact.nombre_comercial || '',
              status: exact.status || '',
              economic_activity: exact.economic_activity || '',
            });
          }
        } else {
          setValidated(items.length === 0 ? 'not_found' : null);
        }
      } else {
        setValidated(null);
      }
    } catch {
      setResults([]);
      setValidated(null);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
    onChange(raw);
    setValidated(null);

    // Debounce search
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchRnc(raw), 400);
  };

  const handleSelect = (item) => {
    const cleanRnc = item.rnc?.replace(/\D/g, '') || '';
    onChange(cleanRnc);
    setShowDropdown(false);
    setValidated(item.status === 'active' ? 'valid' : 'inactive');
    if (onSelect) {
      onSelect({
        rnc: cleanRnc,
        business_name: item.business_name || item.razon_social || '',
        trade_name: item.trade_name || item.nombre_comercial || '',
        status: item.status || '',
        economic_activity: item.economic_activity || '',
      });
    }
  };

  const statusIcon = validated === 'valid'
    ? <CheckCircle size={16} className="text-green-500" />
    : validated === 'inactive'
      ? <XCircle size={16} className="text-yellow-500" title="RNC inactivo" />
      : validated === 'not_found'
        ? <XCircle size={16} className="text-red-400" title="No encontrado en DGII" />
        : searching
          ? <Loader2 size={16} className="text-gray-400 animate-spin" />
          : <Search size={16} className="text-gray-300" />;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value || ''}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 pr-8 ${className}`}
          placeholder={placeholder}
          maxLength={11}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {statusIcon}
        </div>
      </div>

      {/* Validation hint */}
      {validated === 'valid' && (
        <p className="text-xs text-green-600 mt-0.5">RNC verificado en base DGII</p>
      )}
      {validated === 'inactive' && (
        <p className="text-xs text-yellow-600 mt-0.5">RNC encontrado pero inactivo en DGII</p>
      )}
      {validated === 'not_found' && value?.length >= 9 && (
        <p className="text-xs text-red-400 mt-0.5">No encontrado en base DGII local</p>
      )}

      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((item, idx) => (
            <button
              key={idx}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 border-b border-gray-50 last:border-0 transition-colors"
              onClick={() => handleSelect(item)}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-indigo-700 font-medium">
                  {formatRNC(item.rnc || '')}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {item.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p className="text-xs text-gray-700 truncate mt-0.5">
                {item.business_name || item.razon_social || '-'}
              </p>
              {(item.trade_name || item.nombre_comercial) && (
                <p className="text-[11px] text-gray-400 truncate">
                  {item.trade_name || item.nombre_comercial}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
