import { suspendAudio, resumeAudio } from "./audioManager.js";
import { suspendVideo, resumeVideo } from "./videoManager.js";

// Menahan semua suara di feed (musik dan video) sementara layar lain, misalnya cerita, terbuka
export function suspendFeed() { suspendAudio(); suspendVideo(); }
export function resumeFeed() { resumeAudio(); resumeVideo(); }
