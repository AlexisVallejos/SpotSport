# Entrenar con cámara — diseño

Fecha: 2026-10-09 · Estado: aprobado

## Objetivo

Sumar a SpotSport una página **"Entrenar con cámara"** que:

1. Muestra el catálogo de ejercicios de Ritmo-Vida (misma fuente: wger.de, en español).
2. Deja elegir un ejercicio y abrir la cámara del navegador.
3. Analiza la postura en vivo con MediaPipe Pose, da feedback ("bajá más", "cadera alineada") y cuenta repeticiones o tiempo sostenido.

Todo corre en el navegador: el video nunca sale del equipo.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Dónde corre el análisis | Navegador, `@mediapipe/tasks-vision` (Pose Landmarker lite, GPU). Sin Python. |
| Fuente de ejercicios | wger.de directo desde el browser (CORS `*` verificado), lógica portada de `ritmo-vida/supabase/functions/ritmo-life/wger.ts`. Sin login. |
| Navegación | Sin router: hash `#entrenar` cambia entre landing y página Entrenar. |
| Alcance del análisis | 8 ejercicios con reglas: sentadilla, estocada, flexión, plancha, puente de glúteo / hip thrust, elevación de piernas, plancha lateral, patada de glúteo. El resto: cámara + esqueleto, sin corrección. |
| Respaldo offline | Si wger falla, catálogo local con esos 8 ejercicios (instrucciones de `ritmo-vida/src/data/training.ts`). |
| Modelo | `pose_landmarker_lite.task` y WASM servidos desde `public/` (sin CDN en la expo). |

## Arquitectura

```
src/
  lib/
    hashRoute.ts            useHashRoute(): '' | 'entrenar'
    wger.ts                 loadCatalog(), searchExercises(), CATEGORY, tipos
    exercises/
      local.ts              8 ejercicios de respaldo (instrucciones, tip, versión fácil)
      match.ts              ruleFor(exercise) → PoseRule | null (por nombre)
    pose/
      geometry.ts           angle(a,b,c), visible(), midpoint(), landmarks índices
      rules.ts              PoseRule por ejercicio
      engine.ts             createTracker(rule) → update(landmarks, t) → TrackerState
      landmarker.ts         carga perezosa de PoseLandmarker
  components/
    molecules/ExerciseCard/ tarjeta con foto, músculos, insignia "Postura"
    organisms/ExerciseCatalog/  buscador + chips + grilla + detalle
    organisms/PoseCoach/        permiso, video, canvas, panel de feedback
  pages/Entrenar.tsx        catálogo → preparación → coach
```

### Reglas de postura (`PoseRule`)

```ts
type PoseRule = {
  id: string;                    // 'squat', 'plank', ...
  name: string;
  view: 'side' | 'front';        // cómo ubicar la cámara
  mode: 'reps' | 'hold';
  required: number[];            // landmarks que deben verse
  // reps: métrica principal (ej. ángulo rodilla) y umbrales arriba/abajo
  metric: (lm) => number;
  up: number; down: number;      // reps: umbral de vuelta y de profundidad
  checks: Check[];               // condiciones de forma, cada una con mensaje
};
type Check = { test: (lm) => boolean; message: string; joints: number[] };
```

El motor (`engine.ts`) es una máquina de estados pura:

- `reps`: `up → (metric cruza down) → down → (metric cruza up) → up` = 1 rep. Si algún check falló durante la rep, la rep se marca "corregida" y no suma; se guarda el mensaje.
- `hold`: el cronómetro avanza solo mientras todos los checks pasan.
- Antes de contar exige que `required` sean visibles (visibility > 0.5) → si no, estado `framing` con "Alejate, no te veo completo".
- Suavizado: media móvil de 5 frames sobre la métrica para evitar rebotes.

Es testeable sin cámara: entra un array de landmarks sintéticos, sale el estado.

## Flujo de UI

1. **Catálogo**: título, buscador, chips de músculo, filtro "Solo con análisis de postura" (activo por defecto), tarjetas con insignia. Detalle con instrucciones + botón "Empezar con cámara".
2. **Preparación**: instrucción de ubicación (lado/frente, 2–3 m), botón "Activar cámara" (recién ahí se pide permiso).
3. **Coach**: video espejado + esqueleto (articulaciones verdes/rojas), panel con reps grandes, serie actual (3 series), mensaje, barra de calidad. Desktop lado a lado, mobile apilado.
4. **Resumen**: reps válidas, corregidas, error más común. Botones "Otra vez" y "Elegir otro".

Estilo SpotSport: fondo `#080808`, acento `#ff7900`, Barlow Condensed en títulos, Inter en texto.

## Errores

| Caso | Respuesta |
|---|---|
| Permiso denegado | Explicación + cómo habilitar + reintentar |
| Sin cámara | "No encontramos una cámara conectada" |
| Contexto no seguro | Aviso: la cámara requiere HTTPS o localhost |
| wger caído | Catálogo local de 8 ejercicios |
| Modelo no carga | Mensaje + reintentar |

La cámara se detiene (tracks `stop()`) al salir del coach.

## Pruebas

- Unitarias (Vitest): `geometry`, `engine` (reps válidas, rep corregida, hold, framing), `wger.searchExercises`, `match.ruleFor`.
- Build `npm run build` limpio.
- Navegador: catálogo carga, filtro, detalle, pantalla de preparación, manejo de permiso denegado.
- Prueba con cámara real: manual por el usuario.

## Fuera de alcance

- Guardar progreso / login Supabase.
- Reglas para el resto del catálogo.
- App de escritorio o backend Python.
