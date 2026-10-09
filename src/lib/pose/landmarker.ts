import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const WASM_PATH = '/mediapipe/wasm';
const LOCAL_MODEL = '/models/pose_landmarker_lite.task';
const REMOTE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

let loading: Promise<PoseLandmarker> | null = null;

/** Prefers a copy in public/models (works offline at the expo); the dev server answers missing files with HTML. */
async function modelPath(): Promise<string> {
  try {
    const response = await fetch(LOCAL_MODEL, { method: 'HEAD' });
    if (response.ok && !(response.headers.get('content-type') ?? '').includes('text/html')) return LOCAL_MODEL;
  } catch {
    // Sin copia local: se usa la de Google.
  }
  return REMOTE_MODEL;
}

async function create(): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  const modelAssetPath = await modelPath();
  const options = (delegate: 'GPU' | 'CPU') => ({ baseOptions: { modelAssetPath, delegate }, runningMode: 'VIDEO' as const, numPoses: 1 });
  try {
    return await PoseLandmarker.createFromOptions(fileset, options('GPU'));
  } catch {
    return await PoseLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

/** One shared landmarker for the whole session; a failed load can be retried. */
export function loadLandmarker(): Promise<PoseLandmarker> {
  loading ??= create().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}
