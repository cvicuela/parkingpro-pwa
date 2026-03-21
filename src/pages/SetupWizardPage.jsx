import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useSetup } from '../context/SetupContext';
import { settingsAPI, plansAPI } from '../services/api';
import {
  Building2, Receipt, Car, Monitor, CreditCard, Bell, Shield, Wifi,
  ChevronRight, ChevronLeft, Check, Circle, Loader2, Sparkles,
  AlertTriangle, Info, Plus, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';

// ─── Step Definitions ───
const STEPS = [
  { id: 'welcome', label: 'Bienvenida', icon: Sparkles, required: true },
  { id: 'business', label: 'Datos del Negocio', icon: Building2, required: true },
  { id: 'parking', label: 'Configuración Parqueo', icon: Car, required: true },
  { id: 'billing', label: 'Facturación', icon: Receipt, required: true },
  { id: 'plans', label: 'Planes de Parqueo', icon: CreditCard, required: true },
  { id: 'terminals', label: 'Terminales', icon: Monitor, required: true },
  { id: 'notifications', label: 'Notificaciones', icon: Bell, required: false },
  { id: 'security', label: 'Seguridad', icon: Shield, required: false },
  { id: 'hardware', label: 'Hardware', icon: Wifi, required: false },
  { id: 'finish', label: 'Finalizar', icon: Check, required: true },
];

const CURRENCIES = [
  { value: 'DOP', label: 'Peso Dominicano (RD$)' },
  { value: 'USD', label: 'Dólar Americano (US$)' },
  { value: 'EUR', label: 'Euro (\u20AC)' },
];

const PLAN_TYPES = [
  { value: 'hourly', label: 'Por Hora' },
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'annual', label: 'Anual' },
];

const TERMINAL_TYPES = [
  { value: 'entry', label: 'Entrada' },
  { value: 'exit', label: 'Salida' },
  { value: 'both', label: 'Entrada/Salida' },
];

// ─── Input Component ───
function Field({ label, hint, required, error, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Input({ type = 'text', ...props }) {
  return (
    <input
      type={type}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
      {...props}
    />
  );
}

function Select({ options, ...props }) {
  return (
    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm" {...props}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Welcome Step ───
function WelcomeStep() {
  return (
    <div className="text-center py-8 space-y-6">
      <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
        <Sparkles className="text-indigo-600" size={40} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Bienvenido a ParkingPro</h2>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          Configure su sistema de gestión de parqueos en minutos.
          Este asistente lo guiará paso a paso.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto text-left">
        <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
          <Check size={18} className="text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Pasos obligatorios</p>
            <p className="text-xs text-green-600">Negocio, parqueo, facturación, planes y terminales</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
          <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Pasos opcionales</p>
            <p className="text-xs text-blue-600">Notificaciones, seguridad y hardware</p>
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-400">Los pasos opcionales se pueden configurar después en Configuración</p>
    </div>
  );
}

// ─── Business Step ───
function BusinessStep({ data, onChange }) {
  const update = (field, value) => onChange({ ...data, [field]: value });
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Building2 size={20} className="text-indigo-600" />
        <h3 className="text-lg font-semibold">Datos del Negocio</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre del Negocio" required>
          <Input value={data.business_name || ''} onChange={e => update('business_name', e.target.value)} placeholder="Mi Parqueo SRL" />
        </Field>
        <Field label="RNC" required hint="Registro Nacional del Contribuyente">
          <Input value={data.business_rnc || ''} onChange={e => update('business_rnc', e.target.value)} placeholder="123456789" maxLength={11} />
        </Field>
        <Field label="Dirección" required>
          <Input value={data.business_address || ''} onChange={e => update('business_address', e.target.value)} placeholder="Av. Principal #123, Santo Domingo" />
        </Field>
        <Field label="Teléfono" required>
          <Input type="tel" value={data.business_phone || ''} onChange={e => update('business_phone', e.target.value)} placeholder="809-555-0000" />
        </Field>
        <Field label="Moneda" required>
          <Select options={CURRENCIES} value={data.currency || 'DOP'} onChange={e => update('currency', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

// ─── Parking Step ───
function ParkingStep({ data, onChange }) {
  const update = (field, value) => onChange({ ...data, [field]: value });
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Car size={20} className="text-indigo-600" />
        <h3 className="text-lg font-semibold">Configuración del Parqueo</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Espacios Totales" required hint="Cantidad total de espacios de parqueo">
          <Input type="number" min="1" value={data.parking_spaces || ''} onChange={e => update('parking_spaces', e.target.value)} placeholder="50" />
        </Field>
        <Field label="Período de Gracia (min)" required hint="Minutos gratis al entrar">
          <Input type="number" min="0" value={data.grace_period || ''} onChange={e => update('grace_period', e.target.value)} placeholder="15" />
        </Field>
        <Field label="Tolerancia de Salida (min)" hint="Margen adicional antes de cobrar siguiente hora">
          <Input type="number" min="0" value={data.tolerance_minutes || ''} onChange={e => update('tolerance_minutes', e.target.value)} placeholder="10" />
        </Field>
        <Field label="Mora por Hora Extra (RD$)" hint="Cargo adicional por exceder el tiempo">
          <Input type="number" min="0" step="0.01" value={data.late_fee || ''} onChange={e => update('late_fee', e.target.value)} placeholder="50" />
        </Field>
      </div>
    </div>
  );
}

// ─── Billing Step ───
function BillingStep({ data, onChange }) {
  const update = (field, value) => onChange({ ...data, [field]: value });
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Receipt size={20} className="text-indigo-600" />
        <h3 className="text-lg font-semibold">Facturación y Fiscal</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Tasa ITBIS (%)" required hint="Impuesto sobre transferencias de bienes">
          <Input type="number" min="0" max="100" step="1" value={data.tax_rate != null ? data.tax_rate * 100 : 18} onChange={e => update('tax_rate', parseFloat(e.target.value) / 100)} placeholder="18" />
        </Field>
        <Field label="Modo de Facturación" required>
          <Select
            options={[
              { value: 'fiscal', label: 'Fiscal (con NCF - DGII)' },
              { value: 'internal', label: 'Interno (sin NCF)' },
            ]}
            value={data.invoice_mode || 'fiscal'}
            onChange={e => update('invoice_mode', e.target.value)}
          />
        </Field>
      </div>
      {data.invoice_mode === 'fiscal' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-700">
              <p className="font-medium">Modo Fiscal Activo</p>
              <p className="mt-1">Las secuencias NCF (B01, B02, B04) se pueden gestionar en Configuración &gt; Comprobantes NCF después de completar el setup.</p>
            </div>
          </div>
        </div>
      )}
      <Field label="Umbral de Diferencia en Caja (RD$)" hint="Monto máximo de diferencia aceptable al cerrar caja">
        <Input type="number" min="0" value={data.cash_diff_threshold || 200} onChange={e => update('cash_diff_threshold', parseFloat(e.target.value))} />
      </Field>
    </div>
  );
}

// ─── Plans Step ───
function PlansStep({ data, onChange }) {
  const plans = data.plans || [{ name: '', type: 'hourly', price: '', spaces: '' }];

  const updatePlan = (idx, field, value) => {
    const updated = [...plans];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...data, plans: updated });
  };

  const addPlan = () => onChange({ ...data, plans: [...plans, { name: '', type: 'monthly', price: '', spaces: '' }] });
  const removePlan = (idx) => {
    if (plans.length <= 1) return;
    onChange({ ...data, plans: plans.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CreditCard size={20} className="text-indigo-600" />
          <h3 className="text-lg font-semibold">Planes de Parqueo</h3>
        </div>
        <button onClick={addPlan} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
          <Plus size={16} /> Agregar Plan
        </button>
      </div>
      <p className="text-sm text-gray-500">Cree al menos un plan para que los clientes puedan estacionar.</p>

      {plans.map((plan, idx) => (
        <div key={idx} className="p-4 border border-gray-200 rounded-lg space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Plan #{idx + 1}</span>
            {plans.length > 1 && (
              <button onClick={() => removePlan(idx)} className="text-red-400 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nombre" required>
              <Input value={plan.name} onChange={e => updatePlan(idx, 'name', e.target.value)} placeholder="Ej: Por Hora, Mensual VIP" />
            </Field>
            <Field label="Tipo" required>
              <Select options={PLAN_TYPES} value={plan.type} onChange={e => updatePlan(idx, 'type', e.target.value)} />
            </Field>
            <Field label="Precio (RD$)" required>
              <Input type="number" min="0" step="0.01" value={plan.price} onChange={e => updatePlan(idx, 'price', e.target.value)} placeholder="100.00" />
            </Field>
            <Field label="Espacios Asignados" hint="Dejar vacío para ilimitado">
              <Input type="number" min="0" value={plan.spaces} onChange={e => updatePlan(idx, 'spaces', e.target.value)} placeholder="Ilimitado" />
            </Field>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Terminals Step ───
function TerminalsStep({ data, onChange }) {
  const terminals = data.terminals || [
    { name: 'Entrada Principal', code: 'ENTRY-1', type: 'entry', location: 'Portón principal' },
    { name: 'Salida Principal', code: 'EXIT-1', type: 'exit', location: 'Portón principal' },
  ];

  const updateTerminal = (idx, field, value) => {
    const updated = [...terminals];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...data, terminals: updated });
  };

  const addTerminal = () => onChange({
    ...data,
    terminals: [...terminals, { name: '', code: '', type: 'entry', location: '' }],
  });
  const removeTerminal = (idx) => {
    if (terminals.length <= 1) return;
    onChange({ ...data, terminals: terminals.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Monitor size={20} className="text-indigo-600" />
          <h3 className="text-lg font-semibold">Terminales de Acceso</h3>
        </div>
        <button onClick={addTerminal} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
          <Plus size={16} /> Agregar Terminal
        </button>
      </div>
      <p className="text-sm text-gray-500">Configure los puntos de entrada y salida del parqueo.</p>

      {terminals.map((terminal, idx) => (
        <div key={idx} className="p-4 border border-gray-200 rounded-lg space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Terminal #{idx + 1}</span>
            {terminals.length > 1 && (
              <button onClick={() => removeTerminal(idx)} className="text-red-400 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nombre" required>
              <Input value={terminal.name} onChange={e => updateTerminal(idx, 'name', e.target.value)} placeholder="Entrada Principal" />
            </Field>
            <Field label="Código" required hint="Identificador único (ej: ENTRY-1)">
              <Input value={terminal.code} onChange={e => updateTerminal(idx, 'code', e.target.value.toUpperCase())} placeholder="ENTRY-1" />
            </Field>
            <Field label="Tipo" required>
              <Select options={TERMINAL_TYPES} value={terminal.type} onChange={e => updateTerminal(idx, 'type', e.target.value)} />
            </Field>
            <Field label="Ubicación">
              <Input value={terminal.location} onChange={e => updateTerminal(idx, 'location', e.target.value)} placeholder="Portón principal" />
            </Field>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Notifications Step (Optional) ───
function NotificationsStep({ data, onChange }) {
  const update = (field, value) => onChange({ ...data, [field]: value });
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Bell size={20} className="text-amber-600" />
        <h3 className="text-lg font-semibold">Notificaciones</h3>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Opcional</span>
      </div>
      <p className="text-sm text-gray-500">Configure alertas por email para eventos importantes del sistema.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Email de Alertas" hint="Recibirá notificaciones del sistema">
          <Input type="email" value={data.alert_email || ''} onChange={e => update('alert_email', e.target.value)} placeholder="admin@miparqueo.com" />
        </Field>
        <Field label="Email Secundario" hint="Copia de alertas críticas">
          <Input type="email" value={data.alert_email_2 || ''} onChange={e => update('alert_email_2', e.target.value)} placeholder="gerente@miparqueo.com" />
        </Field>
      </div>
    </div>
  );
}

// ─── Security Step (Optional) ───
function SecurityStep({ data, onChange }) {
  const update = (field, value) => onChange({ ...data, [field]: value });
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Shield size={20} className="text-red-600" />
        <h3 className="text-lg font-semibold">Seguridad y Antifraude</h3>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Opcional</span>
      </div>
      <p className="text-sm text-gray-500">Configure límites de reembolso y protección contra fraude.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Límite Reembolso por Operador (RD$)" hint="Máximo que un operador puede reembolsar sin aprobación">
          <Input type="number" min="0" value={data.refund_limit_operator || 500} onChange={e => update('refund_limit_operator', parseFloat(e.target.value))} />
        </Field>
        <Field label="Multiplicador Diario de Reembolsos" hint="Veces el límite antes de bloquear reembolsos del día">
          <Input type="number" min="1" max="10" value={data.refund_daily_multiplier || 3} onChange={e => update('refund_daily_multiplier', parseInt(e.target.value))} />
        </Field>
      </div>
    </div>
  );
}

// ─── Hardware Step (Optional) ───
function HardwareStep() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Wifi size={20} className="text-purple-600" />
        <h3 className="text-lg font-semibold">Hardware y Dispositivos</h3>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Opcional</span>
      </div>
      <p className="text-sm text-gray-500">Los dispositivos de hardware se configuran después del setup inicial.</p>

      <div className="space-y-3">
        {[
          { title: 'Barreras ZKTeco', desc: 'PB3000, PB4000, PROBG3060 - Control de acceso vehicular', path: '/dispositivos' },
          { title: 'Lectores RFID/NFC', desc: 'KR500E, FR1300 - Lectura de tarjetas para acceso', path: '/rfid' },
          { title: 'Arduino/ESP32', desc: 'WT32-ETH01, ESP32 DevKit - Sensores y relés', path: '/dispositivos' },
          { title: 'Cámaras LPR', desc: 'LPR6500, LPRS2000 - Reconocimiento de placas', path: '/dispositivos' },
        ].map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
              <Wifi size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{item.title}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
              <p className="text-xs text-indigo-500 mt-1">Configurar en: {item.path}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            Podrá conectar y configurar dispositivos de hardware desde las secciones
            <strong> Dispositivos</strong> y <strong>RFID</strong> del menú principal una vez complete el setup.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Finish Step ───
function FinishStep({ data, skippedOptional }) {
  const requiredDone = !!(data.business_name && data.business_rnc && data.parking_spaces && data.plans?.some(p => p.name && p.price));
  return (
    <div className="text-center py-6 space-y-6">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto ${requiredDone ? 'bg-green-100' : 'bg-amber-100'}`}>
        {requiredDone
          ? <Check className="text-green-600" size={40} />
          : <AlertTriangle className="text-amber-600" size={40} />
        }
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {requiredDone ? 'Todo listo para comenzar' : 'Faltan pasos obligatorios'}
        </h2>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          {requiredDone
            ? 'Su sistema ParkingPro está configurado y listo para operar.'
            : 'Complete los pasos marcados como obligatorios antes de finalizar.'
          }
        </p>
      </div>

      <div className="max-w-md mx-auto text-left space-y-2">
        <p className="text-sm font-medium text-gray-700 mb-3">Resumen de configuración:</p>
        {[
          { label: 'Negocio', ok: !!(data.business_name && data.business_rnc) },
          { label: 'Parqueo', ok: !!data.parking_spaces },
          { label: 'Facturación', ok: data.tax_rate != null },
          { label: 'Planes', ok: data.plans?.some(p => p.name && p.price) },
          { label: 'Terminales', ok: data.terminals?.some(t => t.name && t.code) },
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            {item.ok
              ? <Check size={16} className="text-green-600" />
              : <Circle size={16} className="text-gray-300" />
            }
            <span className={item.ok ? 'text-green-700' : 'text-gray-400'}>{item.label}</span>
          </div>
        ))}
        {skippedOptional.length > 0 && (
          <p className="text-xs text-gray-400 mt-3 pt-2 border-t">
            Pasos opcionales omitidos: {skippedOptional.join(', ')} (configurables en Configuración)
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Wizard ───
export default function SetupWizardPage() {
  const navigate = useNavigate();
  const { markSetupComplete } = useSetup();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(true);
  const [data, setData] = useState({
    // Business
    business_name: '', business_rnc: '', business_address: '', business_phone: '', currency: 'DOP',
    // Parking
    parking_spaces: '', grace_period: '15', tolerance_minutes: '10', late_fee: '50',
    // Billing
    tax_rate: 0.18, invoice_mode: 'fiscal', cash_diff_threshold: 200,
    // Plans
    plans: [{ name: 'Por Hora', type: 'hourly', price: '', spaces: '' }],
    // Terminals
    terminals: [
      { name: 'Entrada Principal', code: 'ENTRY-1', type: 'entry', location: 'Portón principal' },
      { name: 'Salida Principal', code: 'EXIT-1', type: 'exit', location: 'Portón principal' },
    ],
    // Notifications (optional)
    alert_email: '', alert_email_2: '',
    // Security (optional)
    refund_limit_operator: 500, refund_daily_multiplier: 3,
  });

  // Filter steps based on whether optional are shown
  const visibleSteps = showOptional ? STEPS : STEPS.filter(s => s.required);
  const step = visibleSteps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === visibleSteps.length - 1;

  const skippedOptional = showOptional
    ? []
    : STEPS.filter(s => !s.required).map(s => s.label);

  const canProceed = useCallback(() => {
    if (!step) return false;
    switch (step.id) {
      case 'welcome': return true;
      case 'business': return data.business_name && data.business_rnc && data.business_address && data.business_phone;
      case 'parking': return data.parking_spaces;
      case 'billing': return data.tax_rate != null;
      case 'plans': return data.plans?.some(p => p.name && p.price);
      case 'terminals': return data.terminals?.some(t => t.name && t.code);
      case 'notifications': return true;
      case 'security': return true;
      case 'hardware': return true;
      case 'finish': return true;
      default: return true;
    }
  }, [step, data]);

  const saveSetup = async () => {
    setSaving(true);
    try {
      // 1. Save settings
      const settingsToSave = {
        business_name: data.business_name,
        business_rnc: data.business_rnc,
        company_rnc: data.business_rnc, // Sync para Reportes Fiscales DGII
        business_address: data.business_address,
        business_phone: data.business_phone,
        currency: data.currency,
        parking_spaces: parseInt(data.parking_spaces),
        grace_period: parseInt(data.grace_period) || 15,
        tolerance_minutes: parseInt(data.tolerance_minutes) || 10,
        late_fee: parseFloat(data.late_fee) || 0,
        tax_rate: data.tax_rate,
        invoice_mode: data.invoice_mode || 'fiscal',
        cash_diff_threshold: data.cash_diff_threshold || 200,
        refund_limit_operator: data.refund_limit_operator || 500,
        refund_daily_multiplier: data.refund_daily_multiplier || 3,
      };

      if (data.alert_email) settingsToSave.alert_email = data.alert_email;
      if (data.alert_email_2) settingsToSave.alert_email_2 = data.alert_email_2;

      // Save each setting
      for (const [key, value] of Object.entries(settingsToSave)) {
        try {
          await settingsAPI.update(key, value);
        } catch {
          // Setting might not exist yet, skip
        }
      }

      // 2. Create plans
      for (const plan of (data.plans || [])) {
        if (plan.name && plan.price) {
          try {
            await plansAPI.create({
              name: plan.name,
              type: plan.type,
              price: parseFloat(plan.price),
              max_spaces: plan.spaces ? parseInt(plan.spaces) : null,
              is_active: true,
            });
          } catch {
            // Plan might already exist
          }
        }
      }

      // 3. Mark setup as complete
      try {
        await settingsAPI.update('setup_completed', true);
      } catch {
        // Ignore
      }

      toast.success('Sistema configurado exitosamente');
      markSetupComplete();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Setup error:', error);
      toast.error('Error al guardar la configuración: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    if (!step) return null;
    switch (step.id) {
      case 'welcome': return <WelcomeStep />;
      case 'business': return <BusinessStep data={data} onChange={setData} />;
      case 'parking': return <ParkingStep data={data} onChange={setData} />;
      case 'billing': return <BillingStep data={data} onChange={setData} />;
      case 'plans': return <PlansStep data={data} onChange={setData} />;
      case 'terminals': return <TerminalsStep data={data} onChange={setData} />;
      case 'notifications': return <NotificationsStep data={data} onChange={setData} />;
      case 'security': return <SecurityStep data={data} onChange={setData} />;
      case 'hardware': return <HardwareStep />;
      case 'finish': return <FinishStep data={data} skippedOptional={skippedOptional} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">P</div>
            <span className="text-lg font-bold text-gray-900">ParkingPro Setup</span>
          </div>
          <button
            onClick={() => setShowOptional(!showOptional)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg"
          >
            {showOptional ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showOptional ? 'Ocultar opcionales' : 'Mostrar opcionales'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full">
        {/* Sidebar Steps */}
        <nav className="lg:w-64 p-4 lg:py-8 lg:pr-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
            {visibleSteps.map((s, idx) => {
              const Icon = s.icon;
              const isCurrent = idx === currentStep;
              const isPast = idx < currentStep;
              return (
                <button
                  key={s.id}
                  onClick={() => idx <= currentStep && setCurrentStep(idx)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                    isCurrent
                      ? 'bg-indigo-100 text-indigo-700 font-medium'
                      : isPast
                        ? 'text-green-600 hover:bg-green-50 cursor-pointer'
                        : 'text-gray-400 cursor-default'
                  }`}
                  disabled={idx > currentStep}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    isCurrent ? 'bg-indigo-600 text-white' : isPast ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {isPast ? <Check size={14} /> : <span className="text-xs">{idx + 1}</span>}
                  </div>
                  <span className="hidden lg:inline">{s.label}</span>
                  {!s.required && <span className="hidden lg:inline text-[10px] text-blue-400 ml-auto">OPC</span>}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8 min-h-[400px] flex flex-col">
            {/* Step indicator */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>Paso {currentStep + 1} de {visibleSteps.length}</span>
                {step && !step.required && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Opcional</span>
                )}
              </div>
              {/* Progress bar */}
              <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / visibleSteps.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 animate-fade-in">
              {renderStep()}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              <button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={isFirst}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isFirst
                    ? 'text-gray-400 cursor-default'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <ChevronLeft size={18} /> Anterior
              </button>

              <div className="flex items-center gap-3">
                {step && !step.required && (
                  <button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="text-sm text-gray-400 hover:text-gray-600"
                  >
                    Omitir
                  </button>
                )}

                {isLast ? (
                  <button
                    onClick={saveSetup}
                    disabled={saving || !canProceed()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    {saving ? 'Guardando...' : 'Finalizar Setup'}
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentStep(Math.min(visibleSteps.length - 1, currentStep + 1))}
                    disabled={step?.required && !canProceed()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente <ChevronRight size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
