/**
 * SpeechRecognition 封装（设计 04 §6.8.2）—— 唯一碰 window.SpeechRecognition 的文件。
 * 关键三点：onend 守护重启（带退避）、onresult 全量重建（禁止 append）、no-speech 不算错误。
 * E2E 可替换 window.SpeechRecognition 为假类（§16-9）。
 */

export interface VoiceCb {
  onFinal(text: string): void;
  onInterim(text: string): void;
  onError(code: string): void;
  onStateChange(s: 'idle' | 'listening' | 'restarting' | 'unsupported'): void;
}

export interface RecognizerHandle {
  start(): void;
  stop(): void;
  supported: boolean;
}

interface SpeechResultAlt { transcript: string; confidence: number }
interface SpeechResult { isFinal: boolean; length: number; [i: number]: SpeechResultAlt }
interface SpeechEvent { results: { length: number; [i: number]: SpeechResult } }
interface SpeechErrEvent { error: string }
interface SpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((ev: SpeechEvent) => void) | null;
  onerror: ((ev: SpeechErrEvent) => void) | null;
  onend: (() => void) | null;
}

type Ctor = new () => SpeechRec;

function getCtor(): Ctor | null {
  const w = window as unknown as {
    SpeechRecognition?: Ctor;
    webkitSpeechRecognition?: Ctor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getCtor() !== null;
}

export function createRecognizer(cb: VoiceCb, opts: { lang?: string } = {}): RecognizerHandle {
  const Ctor = getCtor();
  if (!Ctor) {
    cb.onStateChange('unsupported');
    return { start() {}, stop() {}, supported: false };
  }

  const rec = new Ctor();
  rec.lang = opts.lang ?? 'zh-CN';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 3;

  let alive = false;
  let restartTimer: number | null = null;
  let backoff = 300;

  rec.onstart = () => {
    backoff = 300;
    cb.onStateChange('listening');
  };

  rec.onresult = (ev) => {
    let finalText = '';
    let interim = '';
    // ★ 全量重建：同一 resultIndex 的文本会反复改写，增量拼接会越说越乱
    for (let i = 0; i < ev.results.length; i++) {
      const r = ev.results[i];
      const alt = r[0];
      if (!alt) continue;
      if (r.isFinal) finalText += alt.transcript;
      else interim += alt.transcript;
    }
    if (finalText) cb.onFinal(finalText.trim());
    cb.onInterim(interim.trim());
  };

  rec.onerror = (ev) => {
    if (ev.error === 'no-speech') return;   // 停顿是常态，不弹提示
    cb.onError(ev.error);
  };

  rec.onend = () => {
    if (!alive) {
      cb.onStateChange('idle');
      return;
    }
    cb.onStateChange('restarting');
    restartTimer = window.setTimeout(() => {
      try {
        rec.start();
      } catch {
        // InvalidStateError：已在跑，忽略
      }
    }, backoff);
    backoff = Math.min(backoff * 2, 3000);
  };

  return {
    supported: true,
    start() {
      alive = true;
      try {
        rec.start();
      } catch {
        // 已在跑
      }
    },
    stop() {
      alive = false;
      if (restartTimer) clearTimeout(restartTimer);
      try {
        rec.stop();
      } catch {
        // ignore
      }
    },
  };
}

/** 错误码 → 可操作提示（设计 §11 降级矩阵） */
export function speechErrorHint(code: string): string {
  switch (code) {
    case 'network':
      return '语音服务连不上，请改用 Edge 或检查网络';
    case 'not-allowed':
    case 'service-not-allowed':
      return '请在浏览器地址栏允许麦克风后重试';
    case 'audio-capture':
      return '没有检测到麦克风，请检查设备';
    case 'language-not-supported':
      return '当前浏览器不支持中文识别，请改用 Edge / Chrome';
    default:
      return `语音识别失败（${code}），请重试`;
  }
}
