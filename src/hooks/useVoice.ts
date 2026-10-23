import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { createRecognition, isSpeechSupported } from '../infra/speech';
import type { SpeechRecognitionLike } from '../infra/speech';
import { parseUtterance } from '../domain/voice-parse';
import type { VoiceEdit } from '../domain/voice-parse';
import { VOICE_TOGGLE_EVENT } from './useInputEngine';

function describe(action: VoiceEdit['action']): string {
  switch (action.type) {
    case 'grade':
      return action.grade === 'CHECK' ? '√' : action.grade === 'CROSS' ? '×' : action.grade;
    case 'score':
      return `${action.score} 分`;
    case 'stamp':
      return action.stamp === 'corrected' ? '已更正' : '优秀';
    case 'text':
      return action.text;
    case 'clear':
      return '已清除';
    default:
      return '';
  }
}

function pickOutOfRange(text: string, count: number): number | null {
  const re = /(\d+)\s*号/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (n > count) return n;
  }
  return null;
}

/**
 * 语音录入（PRD FR-12 / 设计 §6.8）
 * 仅在用户主动点击（或 Ctrl+M）时才连接浏览器语音服务。
 */
export function useVoice() {
  const listening = useStore((s) => s.voiceListening);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    useStore.getState().setVoiceListening(false);
    useStore.getState().setVoiceInterim('');
  }, []);

  const toggle = useCallback(() => {
    const st = useStore.getState();
    if (st.voiceListening) {
      stop();
      return;
    }
    if (!isSpeechSupported) {
      st.showToast('当前浏览器不支持语音识别，请使用 Chrome / Edge', 'warn');
      return;
    }

    const rec = createRecognition({
      onInterim: (text) => useStore.getState().setVoiceInterim(text),
      onFinal: (text) => {
        const state = useStore.getState();
        const outOfRange = pickOutOfRange(text, state.settings.count);
        if (outOfRange !== null) {
          state.showToast(`${outOfRange}号不存在`, 'warn');
          return;
        }
        const edits = parseUtterance(text, state.settings.count);
        if (edits.length === 0) {
          state.showToast(`没听懂：${text}`, 'warn');
          return;
        }
        state.applyVoiceEdits(edits);
        const nos = edits.map((e) => `${e.no}号`).join('、');
        state.showToast(`${nos} → ${describe(edits[0].action)} ✓`, 'ok');
        state.setVoiceInterim('');
        window.setTimeout(() => {
          const now = useStore.getState();
          if (now.flashNo !== null) now.setFlashNo(null);
        }, 320);
      },
      onError: (error) => {
        const state = useStore.getState();
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          state.showToast('请在地址栏允许麦克风权限', 'warn');
        } else if (error !== 'aborted' && error !== 'no-speech') {
          state.showToast('语音识别出错，请重试', 'warn');
        }
        state.setVoiceListening(false);
      },
      onEnd: () => {
        const state = useStore.getState();
        state.setVoiceListening(false);
        state.setVoiceInterim('');
      },
    });

    if (!rec) {
      st.showToast('当前浏览器不支持语音识别，请使用 Chrome / Edge', 'warn');
      return;
    }

    recRef.current = rec;
    st.setVoiceListening(true);
    try {
      rec.start();
      st.showToast('聆听中… 试试说「12号优秀」或「5号已更正」', 'ok');
    } catch {
      st.setVoiceListening(false);
      st.showToast('语音识别启动失败，请重试', 'warn');
    }
  }, [stop]);

  useEffect(() => {
    const handler = () => toggle();
    document.addEventListener(VOICE_TOGGLE_EVENT, handler);
    return () => {
      document.removeEventListener(VOICE_TOGGLE_EVENT, handler);
      recRef.current?.stop();
    };
  }, [toggle]);

  return { supported: isSpeechSupported, listening, toggle, stop };
}
