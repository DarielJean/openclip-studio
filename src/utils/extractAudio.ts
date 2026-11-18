export async function extractAudioFromVideo(videoFile: File): Promise<Float32Array> {
  const arrayBuffer = await videoFile.arrayBuffer();
  // Whisper expects 16,000 Hz sample rate
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // Extract the first channel (mono)
  const channelData = audioBuffer.getChannelData(0);
  await audioCtx.close();

  return channelData;
}