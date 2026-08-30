# 🏆 Jack & Jill Scoring System

Sistema web Full-Stack (React+Vite / Node.js) para la calificación en vivo del torneo Jack & Jill. Ofrece una interfaz mobile-first para jueces con protección anti-errores, y un centro de control para que los organizadores gestionen el avance de categorías y resultados en tiempo real con auditoría en Google Sheets.

## ✨ Características Principales

### 👨‍⚖️ Panel de Jueces (Mobile-First)
* **Ingreso Ágil:** Teclados numéricos optimizados para dispositivos móviles (soporte dual para comas y puntos).
* **Bloqueo Anti-Errores:** Prevención de envíos duplicados y validación estricta de rangos de calificación según la fase (Preliminar, Semifinal, Final).
* **Auto-Sincronización:** Lectura en tiempo real de la fase activa controlada por el organizador.
* **Pre-fetching:** Recuperación de calificaciones previas para evitar sobreescritura accidental.

### 📊 Centro de Control (Organizador)
* **Gestión de Fases Independientes:** Control separado para categorías `Amateur` y `Open`.
* **Progresión de Torneo (Bracket Progression):** Modal de avance de fase que calcula automáticamente los cupos, realizando el corte y marcando a los competidores eliminados de forma masiva.
* **Tabla de Posiciones en Vivo:** Ranking actualizado al instante con diferenciación visual de podio (Oro, Plata, Bronce).
* **Registro Integrado:** Formulario rápido para añadir nuevos competidores a la pista directamente desde el panel.

### 🧠 Motor Matemático y Arquitectura
* **Resolución de Empates (Estándar WSDC):** Algoritmo que desempata automáticamente analizando los "picos" altos o bajos de las calificaciones individuales de cada juez.
* **Regla "Head Judge":** Sistema de decisión final automatizado basado en el peso del Juez Principal en caso de empates matemáticos absolutos.
* **Caché en Memoria RAM:** Sistema de intercepción de peticiones (Polling de 3 segundos) que responde desde la RAM de Node.js, reduciendo el consumo de la API de Google Sheets en un 80% y evitando límites de cuota (Error `429 Too Many Requests`).
* **Tolerancia a Punto Flotante:** Corrección matemática nativa para evitar desajustes por decimales residuales en JavaScript.

---

## 🛠️ Stack Tecnológico

**Frontend:**
* **React + Vite:** Empaquetado ultra rápido y renderizado eficiente.
* **TypeScript:** Tipado estricto para estructurar competidores, roles (Leaders/Followers) y fases.
* **Tailwind CSS:** Diseño UI oscuro, cristalomorfismo y detalles dorados/coral.
* **Axios:** Cliente HTTP para consumo de API.

**Backend:**
* **Node.js + Express:** Servidor ligero y de alta concurrencia.
* **Google APIs (`googleapis`):** Integración bidireccional segura mediante Service Accounts.

**Base de Datos:**
* **Google Sheets API v4:** Actuando como base de datos serverless y panel de auditoría física de fácil lectura para el staff.