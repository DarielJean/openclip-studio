import { pipeline, env } from '@huggingface/transformers';

// Fetch models from Hugging Face Hub and cache them in browser IndexedDB
env.allowLocalModels = false;

let transcriber: any = null;
let loadedModelName = '';

self.onmessage = async (event: MessageEvent) => {
  const {
    type,
    audio,
    model = 'onnx-community/whisper-base_timestamped',
    language = 'english',
  } = event.data;

  if (type === 'transcribe') {
    try {
      // Load or switch model if needed
      if (!transcriber || loadedModelName !== model) {
        self.postMessage({
          status: 'loading',
          message: `Downloading & loading ${model.split('/')[1]} (cached in browser after first run)...`,
        });

        const hasWebGPU = 'gpu' in navigator;

        transcriber = await pipeline('automatic-speech-recognition', model, {
          device: hasWebGPU ? 'webgpu' : 'wasm',
        });
        loadedModelName = model;
      }

      self.postMessage({
        status: 'transcribing',
        message: 'Transcribing speech & extracting word-level timestamps...',
      });

      const result = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language,
        task: 'transcribe',
        return_timestamps: 'word',
      });

      // Format into clean word objects for our subtitle editor & clip finder
      const words = (result.chunks || []).map((chunk: any, index: number) => ({
        id: `word-${index}`,
        word: chunk.text.trim(),
        start: chunk.timestamp[0] ?? 0,
        end: chunk.timestamp[1] ?? (chunk.timestamp[0] ?? 0) + 0.3,
      }));

      self.postMessage({
        status: 'complete',
        text: result.text,
        words,
      });
    } catch (error: any) {
      self.postMessage({
        status: 'error',
        message: error?.message || 'Transcription failed.',
      });
    }
  }
};