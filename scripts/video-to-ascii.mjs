import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const [input = "docs/src/assets/3dsvg-video.mp4", output = "web/3dsvg-ascii.json"] =
  process.argv.slice(2);
const width = 120;
const height = 54;
const fps = 24;
const ramp = "·~ox+=*%$@";
const highlightThreshold = 0.72;
const frameSize = width * height;

const result = spawnSync(
  "ffmpeg",
  [
    "-v",
    "error",
    "-i",
    input,
    "-vf",
    `fps=${fps},crop=1200:1200:360:360,scale=${width}:${height}:flags=area,format=gray`,
    "-f",
    "rawvideo",
    "-",
  ],
  { maxBuffer: 8 * 1024 * 1024 },
);

if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr.toString());

const pixels = result.stdout;
assert(pixels.length > 0, "ffmpeg produced no frames");
assert.equal(pixels.length % frameSize, 0, "ffmpeg produced a partial frame");

const frames = [];
const highlights = [];
for (let offset = 0; offset < pixels.length; offset += frameSize) {
  const lines = [];
  const highlightLines = [];
  for (let row = 0; row < height; row += 1) {
    let line = "";
    let highlightLine = "";
    for (let column = 0; column < width; column += 1) {
      const luminance = pixels[offset + row * width + column];
      const level = Math.max(0, Math.min(1, (luminance - 8) / 145));
      const glyph = level === 0 ? " " : ramp[Math.round(level * (ramp.length - 1))];
      line += glyph;
      highlightLine += level >= highlightThreshold ? glyph : " ";
    }
    lines.push(line.trimEnd());
    highlightLines.push(highlightLine.trimEnd());
  }
  frames.push(lines.join("\n"));
  highlights.push(highlightLines.join("\n"));
}

assert(frames.some((frame) => frame.includes("@")), "character ramp did not reach its highlight");
assert(
  frames.every((frame) => frame.split("\n").every((line) => line.length <= width)),
  "a frame exceeded the character grid",
);
assert(highlights.some((frame) => frame.trim()), "highlight mask is empty");
writeFileSync(output, JSON.stringify({ fps, columns: width, frames, highlights }));
console.log(`Generated ${frames.length} frames at ${width}×${height} and ${fps} fps.`);
