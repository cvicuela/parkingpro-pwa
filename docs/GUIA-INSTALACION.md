# ParkingPro - Guia de Instalacion

## Tabla de Contenido

1. [Requerimientos de Hardware](#1-requerimientos-de-hardware)
2. [Requerimientos de Software](#2-requerimientos-de-software)
3. [Servicios Externos](#3-servicios-externos)
4. [Instalacion del Backend](#4-instalacion-del-backend)
5. [Instalacion del Frontend (PWA)](#5-instalacion-del-frontend-pwa)
6. [Compilacion del Escritorio (.exe)](#6-compilacion-del-escritorio-exe)
7. [Modos de Despliegue](#7-modos-de-despliegue)
8. [Verificacion de la Instalacion](#8-verificacion-de-la-instalacion)
9. [Solucion de Problemas](#9-solucion-de-problemas)

---

## 1. Requerimientos de Hardware

### Servidor / PC Principal

| Componente | Minimo | Recomendado |
|---|---|---|
| CPU | Intel i3 / Ryzen 3 (2 nucleos) | Intel i5 / Ryzen 5 (4 nucleos) |
| RAM | 4 GB | 8 GB |
| Almacenamiento | 20 GB SSD | 50 GB SSD |
| Red | Ethernet 100 Mbps | Ethernet 1 Gbps |
| Sistema Operativo | Windows 10 (64-bit) | Windows 11 (64-bit) |

### Dispositivos de Control de Acceso (Opcionales)

| Dispositivo | Modelo Soportado | Conexion | Uso |
|---|---|---|---|
| **Barrera vehicular** | ZKTeco ProBG3000 o compatible | TCP/IP o USB Relay | Apertura/cierre de barrera |
| **Modulo relay USB** | LCUS-type HID (2 canales) | USB Serial (CH340/FTDI) | Control de barreras via serial |
| **Lector RFID** | ZKTeco o compatible (Wiegand/TCP) | TCP/IP o Wiegand | Lectura de tarjetas de acceso |
| **Camara LPR** | ZKTeco LPR o compatible | TCP/IP (PUSH/TCP) | Reconocimiento de placas |
| **Impresora termica** | 80mm o 58mm (ESC/POS) | USB / Red | Tickets de entrada y recibos |

### Red Local

- Switch Ethernet con suficientes puertos para todos los dispositivos
- Router/Access Point si se usa PWA desde tablets o moviles
- Direcciones IP fijas recomendadas para dispositivos de control

---

## 2. Requerimientos de Software

### Para ejecutar ParkingPro (produccion)

| Software | Version | Obligatorio | Notas |
|---|---|---|---|
| **Node.js** | 18 o superior | Si | Runtime del backend y build del frontend |
| **npm** | 9 o superior | Si | Incluido con Node.js |
| **PostgreSQL** | 12 o superior | Si (modo local) | Base de datos principal |
| **Git** | 2.30+ | Si | Clonado del repositorio |
| **Google Chrome** | 105+ | Si (modo PWA) | Soporte Web Serial API |

### Para compilar el .exe (desktop con Tauri)

| Software | Version | Obligatorio | Notas |
|---|---|---|---|
| **Rust** | 1.70+ | Si | Compilador del backend nativo |
| **Visual Studio Build Tools** | 2019+ | Si (Windows) | Compilador C++ para dependencias nativas |
| **WebView2** | Incluido en Win10+ | Si | Motor web del escritorio (viene preinstalado) |

### Instalacion de prerrequisitos en Windows

```powershell
# 1. Node.js (descargar de https://nodejs.org - LTS recomendado)
# Verificar instalacion:
node --version     # debe ser >= 18
npm --version      # debe ser >= 9

# 2. PostgreSQL (descargar de https://www.postgresql.org/download/windows/)
# Durante instalacion: anotar usuario, contrasena y puerto (default: 5432)

# 3. Git (descargar de https://git-scm.com/download/win)
git --version

# 4. Rust (solo si va a compilar el .exe)
# Ejecutar desde PowerShell:
irm https://sh.rustup.rs -useb | iex
# Reiniciar terminal despues de instalar
rustc --version    # debe ser >= 1.70
cargo --version

# 5. Visual Studio Build Tools (solo si va a compilar el .exe)
# Descargar de: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Seleccionar: "Desktop development with C++"
```

### Instalacion de prerrequisitos en Linux (Ubuntu/Debian)

```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Git
sudo apt install -y git

# Rust (solo para compilar desktop)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Dependencias de compilacion para Tauri (solo para compilar desktop)
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget \
  file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  libudev-dev pkg-config
```

---

## 3. Servicios Externos

### Obligatorios

| Servicio | Uso | Configuracion |
|---|---|---|
| **PostgreSQL** (local) | Base de datos | Crear DB `parkingpro` con usuario y contrasena |

### Opcionales (segun modo de despliegue)

| Servicio | Uso | Cuando se necesita |
|---|---|---|
| **Supabase** | Base de datos cloud + auth | Modo `remote` o `hybrid` |
| **Stripe** | Procesamiento de pagos con tarjeta | Si se aceptan pagos electronicos |
| **Twilio** | Notificaciones SMS | Si se envian SMS a clientes |
| **Servidor SMTP** | Alertas por email | Si se envian correos de notificacion |
| **VAPID Keys** | Push notifications en PWA | Para notificaciones push en el navegador |

### Generar VAPID Keys (para push notifications)

```bash
npx web-push generate-vapid-keys
```

---

## 4. Instalacion del Backend

### 4.1 Clonar el repositorio

```bash
git clone <url-del-repo>/parkingpro-backend.git
cd parkingpro-backend
```

### 4.2 Instalar dependencias

```bash
npm install
```

### 4.3 Crear la base de datos PostgreSQL

```bash
# Conectar a PostgreSQL
psql -U postgres

# Dentro de psql:
CREATE DATABASE parkingpro;
CREATE USER parkingpro_user WITH ENCRYPTED PASSWORD 'tu_contrasena_segura';
GRANT ALL PRIVILEGES ON DATABASE parkingpro TO parkingpro_user;
\q
```

### 4.4 Configurar variables de entorno

Crear archivo `.env` en la raiz del backend:

```env
# ── Servidor ──
PORT=3000
NODE_ENV=production
DEPLOYMENT_MODE=local          # Opciones: local | remote | hybrid

# ── Base de datos ──
DATABASE_URL=postgresql://parkingpro_user:tu_contrasena_segura@localhost:5432/parkingpro

# ── JWT (usar una clave secreta larga y aleatoria) ──
JWT_SECRET=cambiar_por_clave_secreta_aleatoria_de_al_menos_32_caracteres
JWT_EXPIRES_IN=24h

# ── Frontend ──
FRONTEND_URL=http://localhost:5173

# ── Impuestos (Republica Dominicana: 18% ITBIS) ──
TAX_RATE=0.18

# ── Deteccion de fraude ──
CASH_DIFF_THRESHOLD=200
REFUND_LIMIT_OPERATOR=500

# ── Supabase (solo modo remote/hybrid) ──
# SUPABASE_URL=https://tu-proyecto.supabase.co
# SUPABASE_SERVICE_KEY=eyJ...

# ── Stripe (opcional - pagos electronicos) ──
# STRIPE_SECRET_KEY=sk_live_...

# ── SMTP (opcional - alertas por email) ──
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=tu_email@gmail.com
# SMTP_PASS=tu_contrasena_de_app

# ── Push Notifications (opcional) ──
# VAPID_PUBLIC_KEY=BN...
# VAPID_PRIVATE_KEY=...
# VAPID_EMAIL=mailto:admin@tudominio.com

# ── Rate Limiting ──
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4.5 Ejecutar migraciones y seed

```bash
# Crear tablas
npm run migrate

# Cargar datos iniciales (usuario admin, planes, etc.)
npm run seed
```

### 4.6 Iniciar el servidor

```bash
# Desarrollo (con hot reload)
npm run dev

# Produccion
npm start
```

El backend estara disponible en `http://localhost:3000`.

### 4.7 Ejecutar como servicio en Windows

Para que el backend inicie automaticamente con Windows, usar PM2:

```bash
# Instalar PM2 globalmente
npm install -g pm2 pm2-windows-startup

# Registrar el servicio
pm2 start src/server.js --name parkingpro-backend
pm2 save
pm2-startup install
```

---

## 5. Instalacion del Frontend (PWA)

### 5.1 Clonar el repositorio

```bash
git clone <url-del-repo>/parkingpro-pwa.git
cd parkingpro-pwa
```

### 5.2 Instalar dependencias

```bash
npm install
```

### 5.3 Configurar variables de entorno

Crear archivo `.env` en la raiz del frontend:

```env
# ── Modo de despliegue ──
VITE_DEPLOYMENT_MODE=local     # Opciones: local | remote | hybrid

# ── API Backend ──
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000

# ── Supabase (solo modo remote/hybrid) ──
# VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...
```

### 5.4 Iniciar en modo desarrollo

```bash
npm run dev
```

El frontend estara disponible en `http://localhost:5173`.

### 5.5 Build de produccion (PWA)

```bash
npm run build
```

Los archivos de produccion se generan en `dist/`. Se pueden servir con cualquier servidor web estatico (Nginx, Apache, Netlify, etc.).

### 5.6 Acceso como PWA

1. Abrir `http://localhost:5173` en Google Chrome
2. Click en el icono de "Instalar" en la barra de direcciones
3. La PWA se instala como aplicacion independiente
4. Funciona offline para operaciones basicas (entradas, salidas, pagos)

---

## 6. Compilacion del Escritorio (.exe)

La version de escritorio usa **Tauri v2** y genera un instalador `.exe` nativo para Windows con:
- Comunicacion serial nativa (Rust) en vez de Web Serial API
- Auto-inicio con Windows
- Bandeja de sistema (system tray)
- Instalador NSIS (.exe) y MSI

### 6.1 Prerrequisitos adicionales

Verificar que estan instalados:

```bash
rustc --version     # >= 1.70
cargo --version
node --version      # >= 18
```

En Windows, verificar que Visual Studio Build Tools esta instalado con el componente "Desktop development with C++".

### 6.2 Instalar dependencias del proyecto

```bash
cd parkingpro-pwa
npm install
```

### 6.3 Desarrollo con Tauri (hot reload)

```bash
npm run tauri:dev
```

Esto abre la aplicacion de escritorio con el frontend en modo desarrollo. Los cambios en el codigo React se reflejan al instante.

### 6.4 Compilar el .exe instalable

```bash
npm run tauri:build
```

> La primera compilacion descarga y compila las dependencias de Rust. Puede tomar 5-15 minutos dependiendo de la velocidad del equipo. Las compilaciones siguientes son mucho mas rapidas.

### 6.5 Ubicacion de los instaladores

Despues de compilar, los instaladores se encuentran en:

```
src-tauri/target/release/bundle/
  nsis/
    ParkingPro_1.0.0_x64-setup.exe     # Instalador NSIS
  msi/
    ParkingPro_1.0.0_x64_en-US.msi     # Instalador MSI
```

### 6.6 Instalar en el equipo destino

1. Copiar `ParkingPro_1.0.0_x64-setup.exe` al equipo destino
2. Ejecutar el instalador como Administrador
3. Seguir el asistente de instalacion
4. ParkingPro aparecera en el menu de inicio y se iniciara automaticamente con Windows
5. El icono de ParkingPro aparecera en la bandeja del sistema (system tray)

### 6.7 Comportamiento del escritorio

- **Cerrar ventana**: Minimiza a la bandeja (no cierra la aplicacion)
- **Click en icono de bandeja**: Muestra/oculta la ventana
- **Menu de bandeja**: Mostrar ParkingPro / Ocultar / Salir
- **Auto-inicio**: Se inicia automaticamente con Windows
- **Puerto serial**: Se detectan los puertos USB automaticamente (no requiere permisos especiales del navegador)

---

## 7. Modos de Despliegue

ParkingPro soporta 3 modos de despliegue:

### Modo `local` (Recomendado para estacionamiento individual)

```
DEPLOYMENT_MODE=local
VITE_DEPLOYMENT_MODE=local
```

- Backend Express + PostgreSQL local
- No requiere internet
- Ideal para un solo estacionamiento
- Menor latencia en operaciones

### Modo `remote` (Recomendado para multiples sucursales)

```
DEPLOYMENT_MODE=remote
VITE_DEPLOYMENT_MODE=remote
```

- Backend Express + Supabase cloud
- Requiere internet permanente
- Datos sincronizados en la nube
- Acceso desde cualquier ubicacion

### Modo `hybrid` (Recomendado para alta disponibilidad)

```
DEPLOYMENT_MODE=hybrid
VITE_DEPLOYMENT_MODE=hybrid
```

- Backend Express + PostgreSQL local + Supabase cloud
- Funciona sin internet (usa DB local)
- Sincroniza con la nube cuando hay conexion
- Mejor de ambos mundos

---

## 8. Verificacion de la Instalacion

### Checklist de verificacion

```bash
# 1. Backend corriendo
curl http://localhost:3000/api/health
# Respuesta esperada: {"status":"ok","mode":"local"}

# 2. Frontend accesible
# Abrir http://localhost:5173 en el navegador

# 3. Conexion a base de datos
curl http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@parkingpro.com","password":"admin123"}'
# Respuesta esperada: {"token":"eyJ...","user":{...}}

# 4. WebSocket funcionando
# En la consola del navegador (F12):
# Verificar que no hay errores de Socket.IO

# 5. Puerto serial (solo .exe)
# En Dispositivos > Configurar relay USB
# Debe listar los puertos COM disponibles
```

### Puertos utilizados

| Puerto | Servicio | Protocolo |
|---|---|---|
| 3000 | Backend API + Socket.IO | HTTP/WS |
| 5173 | Frontend dev server | HTTP |
| 5432 | PostgreSQL | TCP |
| 9600 | Relay USB (baud rate) | Serial |

---

## 9. Solucion de Problemas

### El backend no inicia

```bash
# Verificar que PostgreSQL esta corriendo
pg_isready -h localhost -p 5432

# Verificar conexion a la base de datos
psql -U parkingpro_user -d parkingpro -h localhost

# Revisar logs
npm run dev 2>&1 | tee backend.log
```

### Error "Web Serial API no soportada"

- Usar Google Chrome (Firefox/Safari no soportan Web Serial)
- Acceder via `https://` o `localhost` (no funciona en `http://` remoto)
- Alternativa: usar la version de escritorio (.exe) que no requiere Web Serial

### Error al compilar Tauri

```bash
# Verificar Rust
rustup update

# Limpiar cache de compilacion
cd src-tauri && cargo clean && cd ..

# Recompilar
npm run tauri:build
```

### El relay USB no responde

1. Verificar que el dispositivo aparece en Administrador de Dispositivos (Windows)
2. Instalar driver CH340 si el puerto no aparece: buscar "CH340 driver" en Google
3. Verificar baud rate: debe ser 9600
4. Probar con otro cable USB
5. En la version de escritorio, ir a Dispositivos y seleccionar el puerto correcto

### La impresora no imprime

1. Verificar que la impresora esta configurada como predeterminada en Windows
2. En Chrome: Configuracion > Impresoras > verificar que la termica aparece
3. Probar impresion de prueba desde Windows

### Puerto 3000 o 5173 ocupado

```bash
# Windows - encontrar proceso usando el puerto
netstat -ano | findstr :3000

# Matar proceso
taskkill /PID <numero_pid> /F

# O cambiar el puerto en .env (PORT=3001)
```

---

## Arquitectura del Sistema

```
                    +------------------+
                    |   Navegador /    |
                    |   App Desktop    |
                    |   (React PWA)    |
                    +--------+---------+
                             |
                    HTTP / WebSocket
                             |
                    +--------+---------+
                    |  Backend Express |
                    |   (Node.js)     |
                    |   Puerto 3000    |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------+--+   +------+------+   +---+--------+
     | PostgreSQL |   |  Supabase   |   | Servicios  |
     |  (local)   |   |  (cloud)    |   | Externos   |
     |  Pto 5432  |   |  (opcional) |   | Stripe,    |
     +------------+   +-------------+   | Twilio,    |
                                        | SMTP       |
                                        +------------+

     Dispositivos fisicos (via backend o serial directo):
     +----------+  +-----------+  +----------+  +----------+
     | Barreras |  | Lectores  |  | Camaras  |  | Impresora|
     | ZKTeco   |  | RFID      |  | LPR      |  | Termica  |
     +----------+  +-----------+  +----------+  +----------+
```
