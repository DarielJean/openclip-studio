import React, { useState, useRef, useEffect } from 'react';
import { Upload, Sparkles, Play, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { extractAudioFromVideo } from './utils/extractAudio';

export interface WordTimestamp {
  id: string;
  word: string;
  start: number;
  end: number;
}

export default function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>('');
  const [modelSize, setModelSize] = useState<string>('onnx-community/whisper-base_timestamped');
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Upload a video to begin');
  const [words, setWords] = useState<WordTimestamp[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./workers/whisperWorker.ts', import.meta.url), {
      type: 'module',
    });

    workerRef.current.onmessage = (e) => {
      const { status: workerStatus, message, words: transcribedWords } = e.data;
      if (workerStatus === 'loading' || workerStatus === 'transcribing') {
        setStatus('processing');
        setStatusMessage(message);
      } else if (workerStatus === 'complete') {
        setStatus('done');
        setStatusMessage(`Transcribed ${transcribedWords.length} words locally!`);
        setWords(transcribedWords);
      } else if (workerStatus === 'error') {
        setStatus('error');
        setStatusMessage(message);
      }
    };

    return () => workerRef.current?.terminate();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoUrl(URL.createObjectURL(file));
    setVideoName(file.name);
    setWords([]);
    setStatus('processing');
    setStatusMessage('Extracting 16kHz audio track...');

    try {
      const audioData = await extractAudioFromVideo(file);
      workerRef.current?.postMessage({
        type: 'transcribe',
        audio: audioData,
        model: modelSize,
      });
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(err?.message || 'Could not decode audio from video.');
    }
  };

  const jumpToTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">OpenClip Studio</h1>
              <p className="text-xs text-zinc-400">100% Free & Local Browser Video Clipper</p>
            </div>
          </div>

          {/* Whisper Model Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400">Whisper Model:</label>
            <select
              value={modelSize}
              onChange={(e) => setModelSize(e.target.value)}
              disabled={status === 'processing'}
              className="bg-zinc-900 border border-zinc-700 text-sm rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="onnx-community/whisper-tiny_timestamped">Tiny (Fastest, ~75MB)</option>
              <option value="onnx-community/whisper-base_timestamped">Base (Balanced, ~140MB)</option>
              <option value="onnx-community/whisper-small_timestamped">Small (Most Accurate, ~460MB)</option>
            </select>
          </div>
        </header>

        {/* Upload & Status Bar */}
        <div className="my-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/70 border border-zinc-800 p-4 rounded-xl">
          <label className="cursor-pointer inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            <Upload className="w-4 h-4" />
            <span>{videoName ? 'Change Video' : 'Upload Long-Form Video'}</span>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <div className="flex items-center gap-2 text-sm">
            {status === 'processing' && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
            {status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
            <span className={status === 'error' ? 'text-red-400' : 'text-zinc-300'}>
              {statusMessage}
            </span>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video Preview */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col">
            <h2 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
              <Play className="w-4 h-4" /> Source Video Preview
            </h2>
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                className="w-full rounded-lg bg-black max-h-[460px] object-contain"
              />
            ) : (
              <div className="flex-1 min-h-[300px] border-2 border-dashed border-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 text-sm">
                No video loaded yet (.mp4, .mov, .webm)
              </div>
            )}
          </div>

          {/* Interactive Word-Level Transcript */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col max-h-[540px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-400">
                Word-Level Transcript
              </h2>
              {words.length > 0 && (
                <span className="text-xs text-zinc-500">Click any word to jump</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {words.length === 0 ? (
                <div className="h-full min-h-[300px] flex items-center justify-center text-zinc-500 text-sm text-center px-6">
                  {status === 'processing'
                    ? 'Processing audio locally in your browser...'
                    : 'Upload a video with speech to generate word-by-word timestamps.'}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 leading-relaxed">
                  {words.map((w) => {
                    const isActive = currentTime >= w.start && currentTime <= w.end;
                    return (
                      <button
                        key={w.id}
                        onClick={() => jumpToTime(w.start)}
                        title={`${w.start.toFixed(2)}s → ${w.end.toFixed(2)}s`}
                        className={`px-1.5 py-0.5 rounded text-sm transition ${
                          isActive
                            ? 'bg-indigo-600 text-white font-semibold scale-105'
                            : 'bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700'
                        }`}
                      >
                        {w.word}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}