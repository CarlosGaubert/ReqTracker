# 🚀 ReqTracker

**ReqTracker** es una aplicación de escritorio multiplataforma (Windows, macOS y Linux) de alto rendimiento diseñada para la gestión dinámica de proyectos, el seguimiento y alerta de requerimientos pendientes (To-Dos) y el almacenamiento de ideas rápidas. 

Construida sobre **Tauri v2** y **React**, ofrece una experiencia de usuario sumamente fluida, nativa y ligera. Incorpora una arquitectura **Offline-First** que guarda todos tus datos localmente al instante y sincroniza opcionalmente con tu propia nube (**Supabase**) de forma directa mediante tus credenciales de API (URL del proyecto y Anon Key), sin necesidad de intermediarios ni flujos de inicio de sesión obligatorios.

---

## ✨ Características Principales

*   **🗂️ Registro Dinámico de Proyectos:** Crea, edita y gestiona proyectos de trabajo de forma fluida.
*   **⏰ Historial de Requerimientos (To-Do):** Cada proyecto cuenta con su propia lista de tareas con fecha de creación y fecha estimada de entrega.
*   **🔔 Alarma Activable de Vencimiento:** Un servicio en segundo plano analiza tus requerimientos. Si alguno está a **3 días o menos** de vencer, la aplicación te notificará con una **alerta nativa del sistema operativo** (configurable por tarea).
*   **💡 Banco de Ideas:** Una sección rápida en cuadrícula para registrar apuntes, ideas o notas inmediatas sin asociar a proyectos.
*   **🔌 Modo Offline-First:** Los datos se registran localmente en la base de datos de tu dispositivo. Trabaja sin internet y, en cuanto recuperes la conexión, la aplicación sincronizará automáticamente tus cambios pendientes a través de una cola de sincronización.
*   **☁️ Sincronización Directa en la Nube:** Conecta tu base de datos de Supabase de manera directa y segura mediante tus credenciales de API (Project URL y Anon Key) para sincronizar tu información sin necesidad de cuentas ni flujos de inicio de sesión.
*   **🗑️ Sincronización Bidireccional de Eliminaciones:** Respeta los borrados en ambas direcciones; si eliminas un registro en Supabase, este desaparecerá del cliente local al sincronizar, y viceversa.

---

## 🛠️ Tecnologías Utilizadas

*   **Backend:** [Rust](https://www.rust-lang.org/) + [Tauri v2](https://tauri.app/) (Seguro, ultra-rápido y consume una fracción de memoria en comparación con Electron).
*   **Frontend:** [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/).
*   **Diseño y Estilos:** [Tailwind CSS v4](https://tailwindcss.com/) + [Shadcn/ui](https://ui.shadcn.com/) (Componentes premium con micro-interacciones pulidas y soporte nativo para Modo Oscuro/Claro).
*   **Base de datos:** Almacenamiento Local (local) + [Supabase](https://supabase.com/) (remoto, base de datos PostgreSQL con sincronización transparente de dos vías y manejo de cola sin conexión).

---

## 🚀 Instalación y Desarrollo Local

### Requisitos Previos

Asegúrate de tener instalado en tu sistema:
1.  **Node.js** (v18 o superior).
2.  **Rust y Cargo** ([Instalar Rust](https://www.rust-lang.org/tools/install)).
3.  **Herramientas de Compilación:**
    *   **macOS:** Xcode Command Line Tools (`xcode-select --install`).
    *   **Windows:** Visual Studio Build Tools con la carga de trabajo de compilación C++.
    *   **Linux:** Dependencias del sistema webkit y de notificaciones (ver documentación de Tauri).

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

Para activar la sincronización directa en la nube de tus datos de forma privada:

1.  Crea un proyecto gratuito en [Supabase](https://supabase.com/).
2.  Ve a **Project Settings > API** y copia la **Project URL** y la **Anon Key**.
3.  Entra en la sección de **Ajustes & Sync** dentro de ReqTracker y guarda estas credenciales.
4.  Crea las tres tablas ejecutando este script simplificado en el **SQL Editor** de tu proyecto de Supabase:

```sql
-- 1. Tabla de Proyectos
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
);
```

---

## 📦 Publicación de Versiones (Releases) con GitHub Actions

El proyecto incluye un flujo de trabajo CI/CD configurado en `.github/workflows/release.yml` para compilar los instaladores nativos de forma totalmente automática.

Cada vez que publiques una etiqueta (tag) de versión que coincida con el patrón `v*` (por ejemplo, `v1.0.0`), GitHub Actions construirá los instaladores nativos en paralelo para los siguientes sistemas operativos y creará un borrador de release (Draft Release) con las descargas listas:

*   **🖥️ Windows:** Genera instaladores `.msi` (instalador estándar de Windows) y ejecutables `.exe`.
*   **🍎 macOS:** Genera instaladores `.dmg` y paquetes de aplicación `.app` tanto para procesadores **Apple Silicon** (M1/M2/M3/M4) como para **Intel**.
*   **🐧 Linux:** Genera instaladores Debian `.deb` y ejecutables portables `.AppImage`.

---

## 🍎 Nota importante para usuarios de macOS (Gatekeeper / Cuarentena)

Al descargar la aplicación en macOS desde el navegador o GitHub Releases, el sistema operativo (Gatekeeper) puede mostrar el siguiente aviso:

> **⚠️ "ReqTracker está dañado y no puede abrirse. Deberías moverlo al basurero."**

Esto ocurre porque la aplicación es de código abierto y no cuenta con un certificado de pago de Apple Developer. **El archivo no está dañado ni contiene malware.**

### Solución rápida (1 solo comando):

1. Arrastra `ReqTracker.app` a tu carpeta de **Aplicaciones** (`/Applications`).
2. Abre la **Terminal** de tu Mac.
3. Ejecuta el siguiente comando:
   ```bash
   xattr -cr /Applications/ReqTracker.app
   ```
4. ¡Listo! Abre la aplicación normalmente desde Aplicaciones o Spotlight.

*Alternativa desde interfaz gráfica:*
Ve a **Ajustes del Sistema** > **Privacidad y seguridad** > sección **Seguridad** y presiona **"Abrir de todos modos"** (*Open Anyway*).

