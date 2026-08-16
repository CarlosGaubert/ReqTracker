import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertTriangle, Key, HelpCircle, Copy, Check } from 'lucide-react';
import { db, SupabaseConfig } from '../services/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  onSync,
  isSyncing,
  onSessionChange,
  syncError,
}) => {
  const [config, setConfig] = useState<SupabaseConfig>({ url: '', anonKey: '' });
  const [isConfigSaved, setIsConfigSaved] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [copied, setCopied] = useState(false);

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
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1 pb-8">
      {/* 1. Supabase Credentials Card */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Configuración de Base de Datos en la Nube</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
          Conecta tu propio proyecto de <strong>Supabase</strong> para activar la sincronización en la nube de tus proyectos, requerimientos e ideas de forma transparente.
        </p>

        {authError && (
          <Card className="border-red-500/25 bg-red-500/5 text-red-600 dark:text-red-400 shadow-none">
            <CardContent className="p-3.5 flex items-center gap-2.5 text-xs font-medium">
              <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0" />
              <span>{authError}</span>
            </CardContent>
          </Card>
        )}

        {!isConfigSaved ? (
          <form onSubmit={handleSaveConfig} className="space-y-4 border border-neutral-200 dark:border-neutral-800 p-4 rounded-xl bg-white dark:bg-neutral-900/10">
            <div className="space-y-1.5">
              <Label htmlFor="sb-url" className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" />
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
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 text-sm h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sb-key" className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" />
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
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 text-sm h-9"
              />
            </div>
            <Button type="submit" className="h-9 gap-1.5" disabled={isTestingConnection}>
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
          <Card className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/10 shadow-none">
            <CardContent className="p-4 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Base de Datos Conectada</span>
                  </div>
                  <p className="text-[11px] text-neutral-450 dark:text-neutral-550 mt-1 truncate max-w-[400px]">
                    URL: {config.url}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 border-red-500/20 text-red-500 dark:text-red-400 hover:bg-red-500/5 hover:text-red-600 dark:hover:text-red-300"
                  onClick={handleClearConfig}
                >
                  Desconectar
                </Button>
              </div>

              <Separator className="bg-neutral-200 dark:bg-neutral-800" />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-250">Sincronización Directa</div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed max-w-[420px]">
                    Sincroniza tus proyectos, tareas e ideas locales directamente con tu base de datos remota.
                  </p>
                </div>
                <Button 
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={onSync} 
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
                </Button>
              </div>

              {syncError && (
                <Card className="border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400 shadow-none mt-1">
                  <CardContent className="p-3 flex items-center gap-2 text-xs font-medium">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>Error al sincronizar: {syncError}</span>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 2. Setup Help Card */}
      <Card className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/5 shadow-none p-4 flex flex-col md:flex-row gap-4">
        <HelpCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-2 flex-1">
          <h4 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">¿Cómo crear un proyecto gratis en Supabase?</h4>
          <ol className="list-decimal pl-4 text-xs text-neutral-500 dark:text-neutral-400 space-y-2 leading-relaxed">
            <li>Ve a <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">supabase.com</a> y crea una cuenta gratis.</li>
            <li>Crea un nuevo proyecto y copia la <strong>URL del proyecto</strong> y la <strong>Clave Anon (Anon Key)</strong> en la pestaña API Settings.</li>
            <li>Conecta tu base de datos aquí introduciendo esos datos.</li>
            <li>Crea tres tablas en tu editor SQL de Supabase ejecutando este script simplificado:
              <div className="relative group mt-2 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-900/60 max-w-full">
                <div className="absolute right-2 top-2 z-10">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1 border-neutral-350 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 shadow-none"
                    onClick={handleCopySQL}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span className="font-medium">Copiar</span>
                      </>
                    )}
                  </Button>
                </div>
                <pre className="p-4 text-[10px] font-mono text-neutral-600 dark:text-neutral-300 overflow-auto max-h-[300px] leading-relaxed pt-11 max-w-full">
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
