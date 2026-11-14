// Generates the app's short interface sounds as 16-bit mono WAV files in assets/sounds.
// These are synthesized placeholders (soft sine tones with a quick attack and exponential decay).
// To use designed sounds instead, drop files with the same names into assets/sounds.
//
//   node tools/sounds/generate.mjs

import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sounds');

/** One note: pitch glides from `from` to `to` Hz, with a few harmonics, soft attack, exponential decay. */
function note({ from, to = from, ms, gain = 0.4, decay = 0.04, harmonics = [1, 0.25, 0.08] }) {
  const n = Math.floor((RATE * ms) / 1000);
  const samples = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const progress = i / n;
    const freq = from + (to - from) * Math.min(1, progress * 1.6);
    phase += (2 * Math.PI * freq) / RATE;
    let v = 0;
    harmonics.forEach((h, k) => {
      v += h * Math.sin(phase * (k + 1));
    });
    const attack = Math.min(1, t / 0.004);
    const env = attack * Math.exp(-t / decay);
    samples[i] = v * env * gain;
  }
  return samples;
}

function sequence(parts, gapMs = 0) {
  const gap = new Float32Array(Math.floor((RATE * gapMs) / 1000));
  const chunks = [];
  parts.forEach((p, i) => {
    chunks.push(p);
    if (i < parts.length - 1 && gap.length) chunks.push(gap);
  });
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  return all;
}

function toWav(samples) {
  const bytes = samples.length * 2;
  const buf = Buffer.alloc(44 + bytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + bytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(bytes, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
  return buf;
}

const SOUNDS = {
  // Soft rising pop when a message leaves.
  send: note({ from: 520, to: 820, ms: 130, decay: 0.045 }),
  // Two-note chime when a message arrives.
  receive: sequence([note({ from: 784, ms: 90, decay: 0.05 }), note({ from: 1047, ms: 150, decay: 0.07 })], 10),
  // Tiny bright ping for a reaction.
  react: note({ from: 1319, ms: 100, decay: 0.03, harmonics: [1, 0.4, 0.15] }),
  // Warm double tap for a like.
  like: sequence([note({ from: 880, ms: 70, decay: 0.03 }), note({ from: 1320, ms: 110, decay: 0.05 })], 0),
  // Rising blip: recording started.
  recordStart: note({ from: 600, to: 990, ms: 120, decay: 0.05 }),
  // Falling blip: recording stopped.
  recordStop: note({ from: 990, to: 600, ms: 120, decay: 0.05 }),
};

fs.mkdirSync(out, { recursive: true });
for (const [name, samples] of Object.entries(SOUNDS)) {
  const file = path.join(out, `${name}.wav`);
  fs.writeFileSync(file, toWav(samples));
  console.log(name, `${(fs.statSync(file).size / 1024).toFixed(1)} KB`, `${Math.round((samples.length / RATE) * 1000)} ms`);
}
