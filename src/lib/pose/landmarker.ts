import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const WASM_PATH = '/mediapipe/wasm';
const REMOTE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker';

/** `full` sees joints better (fewer guessed ankles and wrists); `lite` is for machines that cannot keep up. */
export type Quality = 'full' | 'lite';
export type LandmarkerInfo = { quality: Quality; delegate: 'GPU' | 'CPU' };

const MODELS: Record<Quality, { local: string; remote: string }> = {
  full: { local: '/models/pose_landmarker_full.task', remote: `${REMOTE}/pose_landmarker_full/float16/1/pose_landmarker_full.task` },
  lite: { local: '/models/pose_landmarker_lite.task', remote: `${REMOTE}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task` },
};

export const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;

type Loaded = { landmarker: PoseLandmarker; info: LandmarkerInfo };

let fileset: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
const loading: Partial<Record<Quality, Promise<Loaded>>> = {};

/** Prefers a copy in public/models (works offline at the expo); the dev server answers missing files with HTML. */
async function modelPath(quality: Quality): Promise<string> {
  const { local, remote } = MODELS[quality];
  try {
    const response = await fetch(local, { method: 'HEAD' });
    if (response.ok && !(response.headers.get('content-type') ?? '').includes('text/html')) return local;
  } catch {
    // Sin copia local: se usa la de Google.
  }
  return remote;
}

async function make(quality: Quality, delegate: 'GPU' | 'CPU'): Promise<Loaded> {
  fileset ??= FilesetResolver.forVisionTasks(WASM_PATH);
  const landmarker = await PoseLandmarker.createFromOptions(await fileset, {
    baseOptions: { modelAssetPath: await modelPath(quality), delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    // A little stricter than the defaults when following a body: a shadow or a chair is not taken for a person.
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.6,
  });
  return { landmarker, info: { quality, delegate } };
}

/** `full` only makes sense with a GPU; without one, or offline without the full model, it falls back to `lite`. */
async function create(quality: Quality): Promise<Loaded> {
  if (quality === 'full') {
    try {
      return await make('full', 'GPU');
    } catch {
      return loadLandmarker('lite');
    }
  }
  try {
    return await make('lite', 'GPU');
  } catch {
    return await make('lite', 'CPU');
  }
}

let cpu: Promise<Loaded> | null = null;

/**
 * The next, safer landmarker after one failed while running (some GPU drivers load the model and then fail on the
 * first frame): full → lite on GPU → lite on CPU. Null when there is nothing safer left.
 */
export function fallbackLandmarker(current: LandmarkerInfo): Promise<Loaded> | null {
  if (current.quality === 'full') return loadLandmarker('lite');
  if (current.delegate === 'GPU') {
    cpu ??= make('lite', 'CPU').catch((error: unknown) => {
      cpu = null;
      throw error;
    });
    return cpu;
  }
  return null;
}

/** One shared landmarker per quality for the whole session; a failed load can be retried. */
export function loadLandmarker(quality: Quality = 'full'): Promise<Loaded> {
  loading[quality] ??= create(quality).catch((error: unknown) => {
    delete loading[quality];
    throw error;
  });
  return loading[quality];
}
