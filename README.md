# 🚀 ReqTracker

**ReqTracker** es una aplicación de escritorio multiplataforma (Windows, macOS y Linux) de alto rendimiento diseñada para la gestión dinámica de proyectos, el seguimiento y alerta de requerimientos pendientes (To-Dos) y el almacenamiento de ideas rápidas. 

Construida sobre **Tauri v2** y **React**, ofrece una experiencia de usuario sumamente fluida y ligera. Incorpora una arquitectura **Offline-First** que guarda todos tus datos localmente al instante y sincroniza opcionalmente con la nube (**Supabase**) cuando inicias sesión con tu correo o tus cuentas de **Google (Gmail)** o **Microsoft (Outlook)**.

---

## ✨ Características Principales

*   **🗂️ Registro Dinámico de Proyectos:** Crea, edita y elimina proyectos de trabajo.
*   **⏰ Historial de Requerimientos (To-Do):** Cada proyecto tiene su propia lista de tareas con fecha de creación y fecha estimada de entrega.
*   **🔔 Alarma Activable de Vencimiento:** Un servicio en segundo plano analiza tus requerimientos. Si alguno está a **3 días o menos** de vencer, la aplicación te notificará con una **alerta nativa del sistema operativo** (configurable por tarea).
*   **💡 Banco de Ideas:** Una sección rápida en cuadrícula para registrar apuntes, ideas o notas inmediatas sin asociar a proyectos.
*   **🔌 Modo Offline-First:** Los datos se registran localmente en la base de datos de tu dispositivo. Trabaja sin internet y, en cuanto recuperes la conexión, la aplicación sincronizará automáticamente tus cambios pendientes.
*   **☁ Sincronización en la Nube:** Inicia sesión con tu correo o mediante **OAuth con Google y Outlook** para abrir tus requerimientos e ideas en cualquier dispositivo.

---

## 🛠️ Tecnologías Utilizadas

*   **Backend:** [Rust](https://www.rust-lang.org/) + [Tauri v2](https://tauri.app/) (Seguro, rápido y consume una fracción de memoria en comparación con Electron).
*   **Frontend:** [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/).
*   **Estilos:** Vanilla CSS (Diseño premium oscuro adaptativo, sin frameworks pesados).
*   **Base de datos y Auth:** LocalStorage/IndexedDB (local) + [Supabase](https://supabase.com/) (remoto, base de datos PostgreSQL en tiempo real y OAuth).

---

## 🚀 Instalación y Desarrollo Local

### Requisitos Previos

Asegúrate de tener instalado en tu sistema:
1.  **Node.js** (v18 o superior).
2.  **Rust y Cargo** ([Instalar Rust](https://www.rust-lang.org/tools/install)).
3.  **Herramientas de Compilación:**
    *   **macOS:** Xcode Command Line Tools (`xcode-select --install`).
    *   **Windows:** Visual Studio Build Tools C++ de C++.
    *   **Linux:** Dependencias del sistema webkit y de notificaciones (ver sección de Linux abajo).

### Clonación y Ejecución

1.  Clona el repositorio en tu máquina local:
    ```bash
    git clone <tu-repositorio-url>
    cd gallant-einstein
    ```

2.  Instala las dependencias de Node:
    ```bash
    npm install
    ```

3.  Inicia la aplicación en modo desarrollo:
    ```bash
    npm run tauri dev
    ```
    *Nota: La primera compilación tomará un poco de tiempo mientras Rust descarga y construye las dependencias necesarias. Las ejecuciones posteriores se abrirán en segundos.*

---

## ☁️ Configuración de la Nube (Supabase)

Para activar el inicio de sesión con correo, Google o Outlook, y sincronizar tus datos de forma privada:

1.  Crea un proyecto gratuito en [Supabase](https://supabase.com/).
2.  Ve a **Project Settings > API** y copia la **Project URL** y la **Anon Key**.
3.  Entra en la sección de **Ajustes & Sync** dentro de ReqTracker y guarda estas credenciales.
4.  Crea las siguientes tablas de base de datos ejecutando este script en el **SQL Editor** de Supabase:

```sql
-- 1. Tabla de Proyectos
create table projects (
  id uuid primary key,
  user_id uuid references auth.users not null,
  name text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabla de Requerimientos (To-Do)
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
);

-- Habilitar Row Level Security (RLS) para mayor seguridad
alter table projects enable row level security;
alter table requirements enable row level security;
alter table ideas enable row level security;

-- Políticas de seguridad para que los usuarios solo accedan a sus propios datos
create policy "Users can perform CRUD on their own projects" on projects
  for all using (auth.uid() = user_id);

create policy "Users can perform CRUD on their own requirements" on requirements
  for all using (auth.uid() = user_id);

create policy "Users can perform CRUD on their own ideas" on ideas
  for all using (auth.uid() = user_id);
```

### Habilitar Autenticación OAuth (Google/Outlook)
1.  En tu dashboard de Supabase, ve a **Authentication > Providers** y activa **Google** y/o **Azure (Microsoft)** ingresando tus credenciales de cliente del proveedor.
2.  En **Authentication > URL Configuration > Redirect URLs**, añade la dirección del callback del servidor local de la app:
    `http://localhost:14209/callback`

---

## 📦 Publicación de Versiones (Releases) con GitHub Actions

El proyecto incluye un flujo de trabajo CI/CD configurado en `.github/workflows/release.yml` para compilar los instaladores nativos de forma totalmente automática.

Cada vez que publiques una etiqueta (tag) de versión que coincida con el patrón `v*` (por ejemplo, `v1.0.0`), GitHub Actions construirá los instaladores nativos en paralelo para los siguientes sistemas operativos y creará un borrador de release (Draft Release) con las descargas listas:

*   **🖥️ Windows:** Genera instaladores `.msi` (instalador estándar de Windows) y ejecutables `.exe`.
*   **🍎 macOS:** Genera instaladores `.dmg` y paquetes de aplicación `.app` tanto para procesadores **Apple Silicon** (M1/M2/M3) como para **Intel**.
*   **🐧 Linux:** Genera instaladores Debian `.deb` y ejecutables portables `.AppImage`.

### Cómo crear un nuevo Release:

1.  Actualiza la versión en tu archivo `src-tauri/tauri.conf.json` y `package.json`.
2.  Haz un commit con los cambios y crea un tag de Git:
    ```bash
    git add .
    git commit -m "Preparando versión v1.0.0"
    git tag -a v1.0.0 -m "Release v1.0.0"
    ```
3.  Sube el código y el tag a GitHub:
    ```bash
    git push origin main
    git push origin v1.0.0
    ```
4.  Ve a la pestaña **Actions** en tu repositorio de GitHub para seguir la compilación. Al finalizar, ve a la pestaña **Releases** de tu repositorio, edita el borrador generado, añade las notas del release y publícalo.
