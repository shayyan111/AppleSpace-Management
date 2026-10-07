export function startCamera(video: HTMLVideoElement, onCode: (code: string) => void, onError: (message: string) => void): { stop: () => void; ready: Promise<void> };
