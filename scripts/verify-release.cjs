const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const workspaceRoot = path.join(__dirname, '..');
console.log('🔍 Iniciando verificación completa de ReqTracker...');

// Helper to check files exist
const checkFileExists = (filePath, name) => {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: No se encontró el archivo ${name} en: ${filePath}`);
    process.exit(1);
  }
};

const pkgPath = path.join(workspaceRoot, 'package.json');
const tauriConfigPath = path.join(workspaceRoot, 'src-tauri/tauri.conf.json');
const capabilitiesPath = path.join(workspaceRoot, 'src-tauri/capabilities/default.json');

checkFileExists(pkgPath, 'package.json');
checkFileExists(tauriConfigPath, 'tauri.conf.json');
checkFileExists(capabilitiesPath, 'capabilities/default.json');

// 1. Validar coincidencia de versión
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));

if (pkg.version !== tauriConfig.version) {
  console.error(`❌ Error de Validación: Las versiones no coinciden.`);
  console.error(`   package.json:      v${pkg.version}`);
  console.error(`   tauri.conf.json:   v${tauriConfig.version}`);
  process.exit(1);
}
console.log(`✅ Coincidencia de versión validada: v${pkg.version}`);

// 2. Validar estructura de capacidades y permisos
const cap = JSON.parse(fs.readFileSync(capabilitiesPath, 'utf8'));
const requiredPermissions = [
  'core:default',
  'opener:default',
  'notification:default',
  'updater:default',
  'process:default'
];

const missingPermissions = requiredPermissions.filter(p => !cap.permissions.includes(p));
if (missingPermissions.length > 0) {
  console.error(`❌ Error de Configuración: Faltan permisos requeridos en capabilities/default.json:`);
  console.error(`   ${missingPermissions.join(', ')}`);
  process.exit(1);
}
console.log('✅ Estructura de permisos de capacidades validada.');

// 3. Validar configuración del plugin de actualizaciones
if (!tauriConfig.plugins || !tauriConfig.plugins.updater) {
  console.error('❌ Error de Configuración: Falta el bloque de configuración del "updater" en tauri.conf.json.');
  process.exit(1);
}

const updater = tauriConfig.plugins.updater;
if (!updater.pubkey || updater.pubkey.length !== 152) {
  console.error('❌ Error de Configuración: La clave pública "pubkey" del updater debe tener exactamente 152 caracteres base64.');
  process.exit(1);
}

if (!updater.endpoints || updater.endpoints.length === 0) {
  console.error('❌ Error de Configuración: Debes especificar al menos un endpoint de actualización en tauri.conf.json.');
  process.exit(1);
}
console.log('✅ Configuración del plugin de actualizaciones validada.');

// 4. Compilación del Frontend (Typecheck y Linter)
console.log('📦 Compilando frontend (tsc && vite build)...');
try {
  execSync('npm run build', { cwd: workspaceRoot, stdio: 'inherit' });
  console.log('✅ Frontend compilado sin errores.');
} catch (e) {
  console.error('❌ Error: La compilación del frontend falló. Corrige los errores de Typescript/Vite.');
  process.exit(1);
}

// 5. Compilación del Backend Rust
console.log('🦀 Verificando código Rust (cargo check)...');
try {
  execSync('cargo check --manifest-path src-tauri/Cargo.toml', { cwd: workspaceRoot, stdio: 'inherit' });
  console.log('✅ Backend Rust compilado y validado sin errores.');
} catch (e) {
  console.error('❌ Error: La verificación del backend Rust falló.');
  process.exit(1);
}

// 6. Test de Arranque Dinámico (Smoke Test)
console.log('🚀 Iniciando test de arranque de la aplicación (Smoke Test)...');

const child = spawn('npm', ['run', 'tauri', 'dev'], {
  cwd: workspaceRoot,
  env: { ...process.env, TAURI_HEADLESS: 'true' }
});

let crashed = false;
let cargoOutputs = '';

child.stdout.on('data', (data) => {
  const output = data.toString();
  cargoOutputs += output;
  if (output.toLowerCase().includes('panic') || output.toLowerCase().includes('error while running')) {
    crashed = true;
  }
});

child.stderr.on('data', (data) => {
  const output = data.toString();
  cargoOutputs += output;
  if (output.toLowerCase().includes('panic') || output.toLowerCase().includes('error while running') || output.toLowerCase().includes('fatal')) {
    crashed = true;
  }
});

child.on('exit', (code) => {
  if (code !== null && code !== 0) {
    crashed = true;
  }
});

setTimeout(() => {
  try {
    child.kill('SIGINT');
  } catch (err) {
    // Already exited
  }

  if (crashed) {
    console.error('❌ Error de Ejecución: La aplicación falló al arrancar o arrojó un panic.');
    console.error('=== LOG DE SALIDA ===');
    console.error(cargoOutputs);
    console.error('=====================');
    process.exit(1);
  } else {
    console.log('✅ Test de arranque de la aplicación exitoso.');
    console.log('🎉 ¡Todas las verificaciones pasaron con éxito! ReqTracker es completamente estable.');
    process.exit(0);
  }
}, 8000);
