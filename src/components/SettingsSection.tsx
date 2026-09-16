import React, { useState, useEffect } from 'react';
import { isPermissionGranted } from '@tauri-apps/plugin-notification';
import { Save, RefreshCw, AlertTriangle, Key, HelpCircle, Copy, Check, Clock, Radio, ShieldCheck, Bell, Volume2 } from 'lucide-react';
import { db, SupabaseConfig, AlarmSettings } from '../services/db';
import { playAlarmChime } from '../services/alarms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const SQL_SCRIPT = `-- 1. Tabla de Proyectos
create table projects (
  id uuid primary key,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabla de Requerimientos (To-Do)
create table requirements (
  id uuid primary key,
  project_id uuid references projects on delete cascade not null,
  title text not null,
  description text,
  status text not null check (status in ('todo', 'in-progress', 'done')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  estimated_date text not null,
  alarm_enabled boolean default true not null,
  notified boolean default false not null
);

-- 3. Tabla de Ideas
create table ideas (
  id uuid primary key,
  title text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);`;

const highlightSQL = (code: string) => {
  const lines = code.split('\n');
  return lines.map((line, idx) => {
    if (line.trim().startsWith('--')) {
      return (
        <div key={idx} className="text-neutral-450 dark:text-neutral-500 italic">
          {line}
        </div>
      );
    }

    const parts: React.ReactNode[] = [];
    const tokenRegex = /(--.*)|('[^']*')|(\b(?:create table|table|primary key|not null|references|on delete cascade|check|default|in|constraint)\b)|(\b(?:uuid|text|timestamp with time zone|boolean|timestamp)\b)|(\b(?:timezone|now)\b)|([(),;])/gi;
    
    let lastIndex = 0;
    let match;
    let key = 0;

    tokenRegex.lastIndex = 0;

    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }

      const [, comment, string, keyword, type, func, symbol] = match;

      if (comment) {
        parts.push(<span key={key++} className="text-neutral-450 dark:text-neutral-500 italic">{comment}</span>);
      } else if (string) {
        parts.push(<span key={key++} className="text-emerald-600 dark:text-emerald-400 font-medium">{string}</span>);
      } else if (keyword) {
        parts.push(<span key={key++} className="text-amber-600 dark:text-amber-500 font-bold">{keyword}</span>);
      } else if (type) {
        parts.push(<span key={key++} className="text-sky-600 dark:text-sky-400 font-semibold">{type}</span>);
      } else if (func) {
        parts.push(<span key={key++} className="text-violet-600 dark:text-violet-400">{func}</span>);
      } else if (symbol) {
        parts.push(<span key={key++} className="text-neutral-450 dark:text-neutral-600 font-bold">{symbol}</span>);
      }

      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    return (
      <div key={idx} className="min-h-[1.2rem] whitespace-pre">
        {parts.length > 0 ? parts : ' '}
      </div>
    );
  });
};

interface SettingsSectionProps {
  onSync: () => Promise<void>;
  isSyncing: boolean;
  onSessionChange: () => void;
  syncError?: string | null;
  lastSyncedAt?: number | null;
  syncInterval?: number;
  onIntervalChange?: (seconds: number) => void;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  onSync,
  isSyncing,
  onSessionChange,
  syncError,
  lastSyncedAt,
  syncInterval = 30,
  onIntervalChange,
}) => {
  const [config, setConfig] = useState<SupabaseConfig>({ url: '', anonKey: '' });
  const [isConfigSaved, setIsConfigSaved] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notificationsAllowed, setNotificationsAllowed] = useState(true);
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(() => db.getAlarmSettings());
  const [, setTick] = useState(0);

  const handleUpdateAlarmSettings = (updated: Partial<AlarmSettings>) => {
    const newSettings = { ...alarmSettings, ...updated };
    setAlarmSettings(newSettings);
    db.saveAlarmSettings(newSettings);
  };

  // Periodic tick to refresh relative time labels
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  const formatLastSync = (timestamp?: number | null) => {
    if (!timestamp) return 'Aún no sincronizado';
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 5) return 'Hace un instante';
    if (diffSec < 60) return `Hace ${diffSec}s`;
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `Hace ${mins} min`;
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const checkNotificationPermissions = async () => {
    try {
      const allowed = await isPermissionGranted();
      setNotificationsAllowed(allowed);
    } catch (e) {
      console.error('Error checking permissions', e);
    }
  };

  useEffect(() => {
    checkNotificationPermissions();
  }, []);

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const activeConfig = db.loadConfig();
    if (activeConfig) {
      setConfig(activeConfig);
      setIsConfigSaved(true);
    }
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.url.trim() || !config.anonKey.trim()) return;

    setAuthError(null);
    setIsTestingConnection(true);

    try {
      const test = await db.testConnection(config.url.trim(), config.anonKey.trim());
      if (test.success) {
        db.saveConfig({
          url: config.url.trim(),
          anonKey: config.anonKey.trim(),
        });
        setIsConfigSaved(true);
        onSessionChange();
      } else {
        setAuthError(test.error || 'No se pudo conectar a Supabase. Verifica la URL y la clave Anon Key.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error de conexión.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleClearConfig = () => {
    db.saveConfig(null);
    setConfig({ url: '', anonKey: '' });
    setIsConfigSaved(false);
    setAuthError(null);
    onSessionChange();
  };

  return (
    <div className="flex flex-col gap-6 max-w-[760px] pb-12">
      {/* 1. Header & Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 font-sans">Ajustes & Sincronización</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
          Conecta directamente con tu propia base de datos Supabase para mantener tus datos sincronizados entre todos tus dispositivos.
        </p>
      </div>

      <Separator className="bg-neutral-200 dark:bg-neutral-800" />

      {/* 1.1 Permisos de Notificaciones */}
      {!notificationsAllowed && (
        <Card className="border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400 shadow-none rounded-xl">
          <CardContent className="p-4 flex items-center gap-3 text-sm font-medium">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <span className="font-bold">Notificaciones deshabilitadas en el sistema:</span> Permite las notificaciones del sistema para que las alarmas de tus requerimientos puedan avisarte oportunamente en el escritorio.
            </div>
          </CardContent>
        </Card>
      )}

      {/* 1.2 Preferencias de Alarmas y Recordatorios */}
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Bell className="h-4.5 w-4.5 text-amber-500" />
            <span>Preferencias de Alarmas & Recordatorios</span>
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Personaliza cómo y cuándo recibir alertas sobre vencimientos de requerimientos.
          </p>
        </div>

        <div className="p-4.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/30 space-y-4">
          
          {/* Anticipación predeterminada */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800/60">
            <div>
              <Label className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Anticipación predeterminada
              </Label>
              <p className="text-xs text-neutral-450 dark:text-neutral-400">
                Tiempo previo de aviso para nuevos requerimientos creados.
              </p>
            </div>
            <select
              value={alarmSettings.advanceDays}
              onChange={(e) => handleUpdateAlarmSettings({ advanceDays: Number(e.target.value) })}
              className="h-9 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 font-medium text-xs cursor-pointer focus:ring-1 focus:ring-emerald-500"
            >
              <option value={0}>El mismo día del vencimiento</option>
              <option value={1}>1 día antes</option>
              <option value={2}>2 días antes</option>
              <option value={3}>3 días antes (Predeterminado)</option>
              <option value={7}>1 semana antes (7 días)</option>
            </select>
          </div>

          {/* Avisar el día de vencimiento */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800/60">
            <div>
              <Label htmlFor="notify-due-date" className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 cursor-pointer">
                Aviso el día de vencimiento (Día D)
              </Label>
              <p className="text-xs text-neutral-450 dark:text-neutral-400">
                Envía una alerta el día exacto en que vence el requerimiento.
              </p>
            </div>
            <Checkbox
              id="notify-due-date"
              checked={alarmSettings.notifyOnDueDate}
              onCheckedChange={(checked) => handleUpdateAlarmSettings({ notifyOnDueDate: !!checked })}
              className="h-5 w-5 rounded-md border-neutral-300 dark:border-neutral-700 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 cursor-pointer"
            />
          </div>

          {/* Avisar si está vencido */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800/60">
            <div>
              <Label htmlFor="notify-overdue" className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 cursor-pointer">
                Recordatorio de requerimientos vencidos
              </Label>
              <p className="text-xs text-neutral-450 dark:text-neutral-400">
                Mantiene una alerta diaria mientras la tarea permanezca incompleta o no se posponga.
              </p>
            </div>
            <Checkbox
              id="notify-overdue"
              checked={alarmSettings.notifyOverdue}
              onCheckedChange={(checked) => handleUpdateAlarmSettings({ notifyOverdue: !!checked })}
              className="h-5 w-5 rounded-md border-neutral-300 dark:border-neutral-700 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 cursor-pointer"
            />
          </div>

          {/* Notificaciones de escritorio */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800/60">
            <div>
              <Label htmlFor="desktop-notifications" className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 cursor-pointer">
                Notificaciones de escritorio del sistema (OS)
              </Label>
              <p className="text-xs text-neutral-450 dark:text-neutral-400">
                Dispara las notificaciones nativas de macOS / Windows en segundo plano.
              </p>
            </div>
            <Checkbox
              id="desktop-notifications"
              checked={alarmSettings.desktopNotifications}
              onCheckedChange={(checked) => handleUpdateAlarmSettings({ desktopNotifications: !!checked })}
              className="h-5 w-5 rounded-md border-neutral-300 dark:border-neutral-700 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 cursor-pointer"
            />
          </div>

          {/* Sonido de alerta in-app */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="sound-enabled" className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 cursor-pointer">
                Sonido de alerta (Chime sintetizado)
              </Label>
              <p className="text-xs text-neutral-450 dark:text-neutral-400">
                Reproduce un tono suave armónico al dispararse un recordatorio o notificación.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => playAlarmChime()}
                className="h-7 text-xs gap-1 px-2 text-neutral-600 dark:text-neutral-300 cursor-pointer"
                title="Escuchar sonido de prueba"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Probar</span>
              </Button>
              <Checkbox
                id="sound-enabled"
                checked={alarmSettings.soundEnabled}
                onCheckedChange={(checked) => handleUpdateAlarmSettings({ soundEnabled: !!checked })}
                className="h-5 w-5 rounded-md border-neutral-300 dark:border-neutral-700 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 cursor-pointer"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Configuration Card */}
      <div className="space-y-4">
        {authError && (
          <Card className="border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400 shadow-none rounded-xl">
            <CardContent className="p-4 flex items-center gap-3 text-sm font-medium">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span>{authError}</span>
            </CardContent>
          </Card>
        )}

        {!isConfigSaved ? (
          <form onSubmit={handleSaveConfig} className="space-y-4.5 border border-neutral-200 dark:border-neutral-800 p-5 rounded-2xl bg-white/70 dark:bg-neutral-900/30">
            <div className="space-y-2">
              <Label htmlFor="sb-url" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <Key className="h-4 w-4 text-neutral-400" />
                <span>Supabase Project URL</span>
              </Label>
              <Input
                type="text"
                id="sb-url"
                value={config.url}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                placeholder="Ej. https://xxxxxx.supabase.co"
                required
                disabled={isTestingConnection}
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 text-sm h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sb-key" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <Key className="h-4 w-4 text-neutral-400" />
                <span>Supabase Project Anon Key</span>
              </Label>
              <Input
                type="password"
                id="sb-key"
                value={config.anonKey}
                onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
                placeholder="Ej. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                required
                disabled={isTestingConnection}
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 text-sm h-10 rounded-xl"
              />
            </div>
            <Button type="submit" className="h-10 px-5 text-sm font-semibold gap-2 rounded-xl shadow-sm" disabled={isTestingConnection}>
              {isTestingConnection ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Probando Conexión...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Conectar Base de Datos</span>
                </>
              )}
            </Button>
          </form>
        ) : (
          <Card className="border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/30 shadow-sm rounded-2xl">
            <CardContent className="p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-base font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
                    <span>Base de Datos Conectada</span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate max-w-full">
                    URL: {config.url}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 sm:h-8.5 px-3 text-xs font-semibold rounded-lg border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 self-stretch sm:self-auto justify-center"
                  onClick={handleClearConfig}
                >
                  Desconectar
                </Button>
              </div>

              <Separator className="bg-neutral-200 dark:border-neutral-800" />

              {/* Sincronización Continua & Automática */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-emerald-500 animate-pulse flex-shrink-0" />
                    <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      Sincronización Continua en la Nube
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/60 px-2.5 py-1 rounded-full self-start sm:self-auto">
                    <Clock className="h-3.5 w-3.5 text-neutral-400" />
                    <span>Última: <strong>{formatLastSync(lastSyncedAt)}</strong></span>
                  </div>
                </div>

                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Monitorea cambios en la base de datos de Supabase en tiempo real (WebSockets) y mediante intervalos programados, detectando cambios automáticamente sin parpadear la interfaz ni sobreescribir datos locales.
                </p>

                {/* Interval Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-1">
                  <div>
                    <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-neutral-500" />
                      <span>Frecuencia de Auto-Sincronización</span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                      Elige el intervalo de chequeo automático en segundo plano.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: 'Manual', value: 0 },
                      { label: '15s', value: 15 },
                      { label: '30s', value: 30 },
                      { label: '60s', value: 60 }
                    ].map(opt => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={syncInterval === opt.value ? 'default' : 'outline'}
                        size="sm"
                        className={`h-7.5 px-2.5 text-xs font-semibold rounded-lg ${
                          syncInterval === opt.value
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-sm'
                            : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300'
                        }`}
                        onClick={() => onIntervalChange?.(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Safe Sync Assurance Callout */}
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs mt-1">
                  <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    <strong>Protección activa:</strong> El motor utiliza bloqueo de concurrencia (Mutex) para evitar choques en la red y fusiona los cambios de la nube protegiendo tus ediciones locales no sincronizadas.
                  </span>
                </div>
              </div>

              <Separator className="bg-neutral-200 dark:bg-neutral-800" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Sincronización Directa</div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed max-w-[460px]">
                    Fuerza una comprobación y subida inmediata con tu base de datos remota ahora mismo.
                  </p>
                </div>
                <Button 
                  size="sm" 
                  className="h-8.5 sm:h-9 px-3.5 sm:px-4 text-xs font-semibold gap-2 rounded-xl shadow-sm self-stretch sm:self-auto justify-center"
                  onClick={onSync} 
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
                </Button>
              </div>

              {syncError && (
                <Card className="border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400 shadow-none mt-1 rounded-xl">
                  <CardContent className="p-3.5 flex items-center gap-2.5 text-xs font-medium">
                    <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0" />
                    <span>Error al sincronizar: {syncError}</span>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 2. Setup Help Card */}
      <Card className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/10 shadow-none p-5 rounded-2xl flex flex-col md:flex-row gap-4.5">
        <HelpCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-2.5 flex-1">
          <h4 className="font-bold text-base text-neutral-900 dark:text-neutral-100">¿Cómo crear un proyecto gratis en Supabase?</h4>
          <ol className="list-decimal pl-4 text-sm text-neutral-600 dark:text-neutral-300 space-y-2 leading-relaxed">
            <li>Ve a <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold">supabase.com</a> y crea una cuenta gratis.</li>
            <li>Crea un nuevo proyecto y copia la <strong>URL del proyecto</strong> y la <strong>Clave Anon (Anon Key)</strong> en la pestaña API Settings.</li>
            <li>Conecta tu base de datos aquí introduciendo esos datos.</li>
            <li>Crea tres tablas en tu editor SQL de Supabase ejecutando este script simplificado:
              <div className="relative group mt-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900/70 max-w-full">
                <div className="absolute right-2.5 top-2.5 z-10">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs gap-1.5 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-lg shadow-sm"
                    onClick={handleCopySQL}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span className="font-semibold">Copiar SQL</span>
                      </>
                    )}
                  </Button>
                </div>
                <pre className="p-4 text-xs font-mono text-neutral-700 dark:text-neutral-200 overflow-auto max-h-[320px] leading-relaxed pt-12 max-w-full">
                  {highlightSQL(SQL_SCRIPT)}
                </pre>
              </div>
            </li>
          </ol>
        </div>
      </Card>
    </div>
  );
};
