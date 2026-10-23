/** Web Speech API 封装（设计 §6.8，唯一允许联网的入口，且仅由用户主动触发） */

export interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

export interface SpeechEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
}

export interface SpeechErrorLike {
  error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: SpeechErrorLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const isSpeechSupported: boolean = getCtor() !== null;

export interface SpeechHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export function createRecognition(handlers: SpeechHandlers): SpeechRecognitionLike | null {
  const Ctor = getCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = 'zh-CN';
  rec.continuous = true;
  rec.interimResults = true;

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const transcript = result[0]?.transcript ?? '';
      if (result.isFinal) handlers.onFinal(transcript);
      else interim += transcript;
    }
    if (interim) handlers.onInterim(interim);
  };

  rec.onerror = (e) => handlers.onError(e.error);
  rec.onend = () => handlers.onEnd();

  return rec;
}
