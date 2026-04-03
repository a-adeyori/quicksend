import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

type WebSpeechCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: Event) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): WebSpeechCtor | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: WebSpeechCtor;
    webkitSpeechRecognition?: WebSpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useWebSpeechRecognition() {
  const [supported] = useState(() => getSpeechRecognition() !== null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<InstanceType<WebSpeechCtor> | null>(null);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError('Speech recognition is not available in this browser.');
      return;
    }
    setError(null);
    setTranscript('');
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: Event) => {
      const ev = e as unknown as {
        resultIndex: number;
        results: { length: number; item: (i: number) => { 0: { transcript: string } } };
      };
      let text = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        text += ev.results.item(i)[0].transcript;
      }
      setTranscript(text.trim());
    };
    rec.onerror = (e: Event) => {
      const err = (e as unknown as { error?: string }).error ?? 'recognition error';
      setError(err);
    };
    rec.onend = () => {
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start microphone');
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
  }, []);

  return { supported, transcript, setTranscript, error, setError, start, stop };
}
