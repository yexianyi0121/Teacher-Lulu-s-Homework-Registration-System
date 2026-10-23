import { useCallback, useEffect, useRef } from 'react';
import { useStore, currentClass } from '../store';
import { createRecognizer, isSpeechSupported, speechErrorHint } from '../infra/voice/recognizer';
import type { RecognizerHandle } from '../infra/voice/recognizer';
import { parseVoiceReport } from '../domain/voice/parse';
import { putVoiceLog } from '../infra/idb';
import { uid } from '../utils/id';

const TOGGLE_EVENT = 'xq:toggle-voice';

function describeValue(c: ReturnType<typeof parseVoiceReport>['commands'][number]): string {
  if (c.status === 'missing') return '缺交';
  if (c.status === 'leave') return '请假';
  if (c.pass === true) return '过关';
  if (c.value?.kind === 'grade') return c.value.grade;
  if (c.value?.kind === 'score') return `${c.value.score} 分`;
  if (c.value?.kind === 'text') return c.value.text;
  if (c.stamp === 'corrected') return '已更正';
  if (c.makeup) return '补交';
  return c.action ?? '—';
}

/**
 * 语音录入（设计 04 §6.8）—— 仅用户主动点击/ Ctrl+M 时才连浏览器语音服务。
 * 四层：识别 → 归一化 → 槽位解析 → 回显确认（闪示 + 可撤销）。
 */
export function useVoice() {
  const listening = useStore((s) => s.voiceListening);
  const recRef = useRef<RecognizerHandle | null>(null);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    useStore.getState().setVoiceListening(false);
    useStore.getState().setVoiceInterim('');
  }, []);

  const handleFinal = useCallback((text: string) => {
    const s = useStore.getState();
    const n = currentClass(s)?.count ?? 0;
    const { commands, issues } = parseVoiceReport(text, {
      n,
      scheme: s.draft.scheme,
      focusNo: s.focusedNo,
    });

    void putVoiceLog({
      id: uid('voice'),
      raw: text,
      normalized: text,
      parsedJson: JSON.stringify(commands),
      accepted: commands.length > 0,
      correctedTo: issues.map((i) => i.text).join(' | '),
      at: Date.now(),
    });

    if (!commands.length) {
      const msg = issues[0]?.text ?? `没听懂「${text}」`;
      s.pushVoiceBanner({ id: uid('vb'), text: `🎤 ${msg}`, tone: 'warn' });
      return;
    }

    s.applyVoiceCommands(commands);
    const summary = commands.map((c) => `${c.no}号→${describeValue(c)}`).join('，');
    s.pushVoiceBanner({ id: uid('vb'), text: `🎤 ${summary}`, tone: 'ok' });
    s.setVoiceInterim('');
    s.setFlashNo(commands[0].no);
    window.setTimeout(() => {
      const now = useStore.getState();
      if (now.flashNo !== null) now.setFlashNo(null);
    }, 600);

    for (const i of issues) {
      s.pushVoiceBanner({ id: uid('vb'), text: `🎤 ${i.no ? `${i.no}号：` : ''}${i.text}`, tone: 'warn' });
    }
  }, []);

  const toggle = useCallback(() => {
    const st = useStore.getState();
    if (st.voiceListening) {
      stop();
      return;
    }
    if (!isSpeechSupported()) {
      st.showToast('当前浏览器不支持语音识别，请使用 Edge / Chrome', 'warn');
      return;
    }

    const rec = createRecognizer({
      onInterim: (t) => useStore.getState().setVoiceInterim(t),
      onFinal: handleFinal,
      onError: (code) => {
        const s = useStore.getState();
        s.showToast(speechErrorHint(code), code === 'network' ? 'warn' : 'error');
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          s.setVoiceListening(false);
        }
      },
      onStateChange: (state) => {
        const s = useStore.getState();
        if (state === 'unsupported') {
          s.showToast('当前浏览器不支持语音识别，请使用 Edge / Chrome', 'warn');
          s.setVoiceListening(false);
          return;
        }
        s.setVoiceListening(state === 'listening' || state === 'restarting');
      },
    });

    recRef.current = rec;
    st.setVoiceListening(true);
    rec.start();
    st.showToast('聆听中… 试试说「12号优秀」或「5号已更正」', 'ok');
  }, [handleFinal, stop]);

  useEffect(() => {
    const handler = () => toggle();
    document.addEventListener(TOGGLE_EVENT, handler);
    return () => {
      document.removeEventListener(TOGGLE_EVENT, handler);
      recRef.current?.stop();
    };
  }, [toggle]);

  return { supported: isSpeechSupported(), listening, toggle, stop };
}
