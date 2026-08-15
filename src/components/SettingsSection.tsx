import React, { useState, useEffect } from 'react';
import { Save, LogIn, LogOut, UserPlus, RefreshCw, AlertTriangle, Key, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { db, SupabaseConfig } from '../services/db';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';

interface SettingsSectionProps {
  onSync: () => Promise<void>;
  isSyncing: boolean;
  onSessionChange: () => void;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  onSync,
  isSyncing,
  onSessionChange,
}) => {
  const [config, setConfig] = useState<SupabaseConfig>({ url: '', anonKey: '' });
  const [isConfigSaved, setIsConfigSaved] = useState(false);
  const [session, setSession] = useState<any>(null);
  
  // Auth Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<string | null>(null);

  useEffect(() => {
    const activeConfig = db.loadConfig();
    if (activeConfig) {
      setConfig(activeConfig);
      setIsConfigSaved(true);
      checkSession();
    }
  }, []);

  const checkSession = async () => {
    const supabase = db.getSupabaseClient();
    if (supabase) {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.url.trim() || !config.anonKey.trim()) return;

    db.saveConfig({
      url: config.url.trim(),
      anonKey: config.anonKey.trim(),
    });
    setIsConfigSaved(true);
    setAuthError(null);
    checkSession();
    onSessionChange();
  };

  const handleClearConfig = () => {
    if (confirm('¿Estás seguro de que quieres quitar las credenciales de Supabase? Esto desactivará la sincronización y cerrará tu sesión.')) {
      db.saveConfig(null);
      setConfig({ url: '', anonKey: '' });
      setIsConfigSaved(false);
      setSession(null);
      setAuthError(null);
      onSessionChange();
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = db.getSupabaseClient();
    if (!supabase) return;

    setAuthError(null);
    setAuthLoading(true);

    try {
      if (isSignUp) {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });
        if (error) throw error;
        
        // Sometimes signup auto-logs in, check
        if (data.session) {
          setSession(data.session);
          await db.pushAllData(); // Push existing local data on first login
          onSessionChange();
          alert('¡Cuenta creada y sesión iniciada! Tus datos locales se han subido a la nube.');
        } else {
          alert('¡Registro exitoso! Por favor verifica tu correo para activar tu cuenta.');
        }
      } else {
        // Log In
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (error) throw error;
        setSession(data.session);
        // Pull cloud data and merge
        await db.pullAllData();
        onSessionChange();
      }
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Error de autenticación');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'azure') => {
    const supabase = db.getSupabaseClient();
    if (!supabase) return;

    setAuthError(null);
    setOauthStatus('Iniciando servidor local de autenticación...');

    try {
      // 1. Start OAuth local HTTP server in Rust
      await invoke('start_oauth_server');

      // 2. Listen to the Tauri event for callback
      const unlisten = await listen<{ hash: string }>('oauth-callback', async (event) => {
        setOauthStatus('Autenticación recibida. Iniciando sesión...');
        const hash = event.payload.hash;
        
        // Parse access_token and refresh_token
        // Format of hash: #access_token=xxx&refresh_token=yyy&...
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;

            setSession(data.session);
            setOauthStatus('Sincronizando datos...');
            // Pull cloud data and merge
            await db.pullAllData();
            onSessionChange();
            setOauthStatus(null);
          } catch (e: any) {
            setAuthError('Error al establecer la sesión: ' + e.message);
            setOauthStatus(null);
          }
        } else {
          setAuthError('No se encontraron tokens válidos en el callback.');
          setOauthStatus(null);
        }
        
        unlisten();
      });

      // 3. Open OAuth provider in system browser
      const oauthUrl = `${config.url}/auth/v1/authorize?provider=${provider}&redirect_to=http://localhost:14209/callback`;
      setOauthStatus('Abre tu navegador para completar el inicio de sesión...');
      await openUrl(oauthUrl);

    } catch (e: any) {
      setAuthError('Error de OAuth: ' + e.message);
      setOauthStatus(null);
    }
  };

  const handleLogout = async () => {
    const supabase = db.getSupabaseClient();
    if (!supabase) return;

    if (confirm('¿Quieres cerrar sesión? Tus datos guardados seguirán en tu base de datos local.')) {
      await supabase.auth.signOut();
      setSession(null);
      onSessionChange();
    }
  };

  return (
    <div className="settings-container">
      {/* 1. Supabase Credentials Card */}
      <div className="settings-group">
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Configuración de Base de Datos en la Nube</h3>
        <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Para activar la sincronización online de requerimientos e ideas, necesitas conectar tu propio proyecto de <strong>Supabase</strong>.
        </p>

        {!isConfigSaved ? (
          <form onSubmit={handleSaveConfig} className="card">
            <div className="form-group">
              <label htmlFor="sb-url" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Key size={14} />
                <span>Supabase Project URL</span>
              </label>
              <input
                type="text"
                id="sb-url"
                value={config.url}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                placeholder="Ej. https://xxxxxx.supabase.co"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="sb-key" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Key size={14} />
                <span>Supabase Project Anon Key</span>
              </label>
              <input
                type="password"
                id="sb-key"
                value={config.anonKey}
                onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
                placeholder="Ej. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              <Save size={16} />
              <span>Conectar Base de Datos</span>
            </button>
          </form>
        ) : (
          <div className="card flex-between">
            <div>
              <div style={{ fontWeight: 600, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="status-dot online"></span>
                <span>Base de Datos Conectada</span>
              </div>
              <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>
                URL: {config.url}
              </p>
            </div>
            <button className="btn btn-danger" onClick={handleClearConfig}>
              Desconectar
            </button>
          </div>
        )}
      </div>

      {/* 2. Authentication Section */}
      {isConfigSaved && (
        <div className="settings-group">
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Inicio de Sesión y Sincronización</h3>
          <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            Inicia sesión para sincronizar tus requerimientos e ideas con la nube.
          </p>

          {authError && (
            <div className="card flex-row" style={{ borderColor: 'var(--accent-red)', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: '#f87171' }}>
              <AlertTriangle size={20} />
              <span>{authError}</span>
            </div>
          )}

          {oauthStatus && (
            <div className="card flex-row" style={{ borderColor: 'var(--accent-blue)', backgroundColor: 'var(--accent-blue-active)', color: 'var(--accent-blue)' }}>
              <RefreshCw size={20} className="spin-animation" />
              <span>{oauthStatus}</span>
            </div>
          )}

          {session ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="flex-between">
                <div>
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>Sesión activa como:</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.25rem' }}>{session.user.email}</div>
                </div>
                <button className="btn btn-danger" onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
              
              <div style={{ borderBottom: '1px solid var(--border-color)' }}></div>

              <div className="flex-between">
                <div>
                  <div style={{ fontWeight: 600 }}>Sincronización Bidireccional</div>
                  <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>
                    Si realizaste cambios sin conexión, se sincronizarán ahora.
                  </p>
                </div>
                <button className="btn btn-primary" onClick={onSync} disabled={isSyncing}>
                  <RefreshCw size={16} className={isSyncing ? 'spin-animation' : ''} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="auth-card">
              {/* OAuth Google & Microsoft */}
              <div className="oauth-buttons">
                <button className="btn btn-oauth flex-row" onClick={() => handleOAuthLogin('google')}>
                  <img src="https://www.google.com/favicon.ico" alt="Google Logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <span>Iniciar sesión con Google</span>
                </button>
                <button className="btn btn-oauth flex-row" onClick={() => handleOAuthLogin('azure')}>
                  <img src="https://www.microsoft.com/favicon.ico" alt="Microsoft Logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <span>Iniciar sesión con Microsoft (Outlook)</span>
                </button>
              </div>

              <div className="or-divider">o usa tu correo electrónico</div>

              {/* Email / Password Auth */}
              <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="auth-email">Correo Electrónico</label>
                  <input
                    type="email"
                    id="auth-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@ejemplo.com"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="auth-pass">Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="auth-pass"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', padding: '0.2rem' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex-between" style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
                    onClick={() => setIsSignUp(!isSignUp)}
                  >
                    {isSignUp ? '¿Ya tienes una cuenta? Inicia Sesión' : '¿No tienes una cuenta? Regístrate'}
                  </button>

                  <button type="submit" className="btn btn-primary" disabled={authLoading}>
                    {authLoading ? (
                      <RefreshCw size={16} className="spin-animation" />
                    ) : isSignUp ? (
                      <UserPlus size={16} />
                    ) : (
                      <LogIn size={16} />
                    )}
                    <span>{isSignUp ? 'Registrarse' : 'Iniciar Sesión'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 3. Setup Help Card */}
      <div className="card flex-row" style={{ gap: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
        <HelpCircle size={24} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
        <div>
          <h4 style={{ margin: 0, fontWeight: 600 }}>¿Cómo crear un proyecto gratis en Supabase?</h4>
          <ol style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.2rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '0.85rem' }}>
            <li>Ve a <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a> y crea una cuenta gratis.</li>
            <li>Crea un nuevo proyecto y copia la <strong>URL del proyecto</strong> y la <strong>Clave Anon (Anon Key)</strong> (están en Configuración de la API).</li>
            <li>En la sección <strong>Authentication &gt; URL Configuration</strong> de Supabase, establece tu Site URL o añade <code>http://localhost:14209/callback</code> a la lista de Redirect URLs si deseas usar login con Google/Outlook.</li>
            <li>Crea tres tablas en tu editor SQL con este script:
              <pre style={{ backgroundColor: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', marginTop: '0.35rem' }}>
{`-- 1. Tabla de Proyectos
create table projects (
  id uuid primary key,
  user_id uuid references auth.users not null,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabla de Requerimientos
create table requirements (
  id uuid primary key,
  project_id uuid references projects on delete cascade not null,
  user_id uuid references auth.users not null,
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
  user_id uuid references auth.users not null,
  title text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);`}
              </pre>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
