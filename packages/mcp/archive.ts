import { existsSync, statSync } from "node:fs";
import { lstat, open, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createGzip } from "node:zlib";

/** Archive requests accepted by the HTTP transport: /skills/<catalog-id>.tar.gz */
export const archivePathPattern = /^\/skills\/([a-z0-9]+(?:-[a-z0-9]+)*)\.tar\.gz$/;
export const archiveLimitBytes = 128 * 1024 * 1024;

const block = 512;
const ignoredNames = new Set([".mtkit-source.json", ".mtkit-skill.json", ".git", ".github", "node_modules", ".DS_Store"]);
const safeSegment = /^[\w.-]+$/;

export function hasSkillFolder(directory: string, id: string) {
  return archivePathPattern.test(`/skills/${id}.tar.gz`) && existsSync(join(directory, id, "SKILL.md"));
}

function octal(value: number, length: number) {
  return value.toString(8).padStart(length - 1, "0").slice(-(length - 1)) + "\0";
}

function header(name: string, size: number, mode: number, mtime: number, type = "0") {
  const buffer = Buffer.alloc(block);
  // PAX headers carry names over 100 bytes; the ustar field keeps a truncated copy.
  buffer.write(Buffer.from(name).subarray(0, 100).toString("latin1"), 0, 100, "latin1");
  buffer.write(octal(mode, 8), 100, "latin1");
  buffer.write(octal(0, 8), 108, "latin1");
  buffer.write(octal(0, 8), 116, "latin1");
  buffer.write(octal(size, 12), 124, "latin1");
  buffer.write(octal(mtime, 12), 136, "latin1");
  buffer.fill(0x20, 148, 156);
  buffer.write(type, 156, "latin1");
  buffer.write("ustar\0" + "00", 257, "latin1");
  const sum = buffer.reduce((total, byte) => total + byte, 0);
  buffer.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, "latin1");
  return buffer;
}

function paxRecord(key: string, value: string) {
  const body = ` ${key}=${value}\n`;
  let length = Buffer.byteLength(body) + 1;
  while (String(length).length + Buffer.byteLength(body) !== length) length = String(length).length + Buffer.byteLength(body);
  return Buffer.from(`${length}${body}`);
}

function padding(size: number) {
  return Buffer.alloc((block - (size % block)) % block);
}

async function* walk(directory: string, prefix: string): AsyncGenerator<{ path: string; file: string; size: number; mode: number; mtime: number }> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (ignoredNames.has(entry.name) || !safeSegment.test(entry.name)) continue;
    const file = join(directory, entry.name);
    const path = `${prefix}/${entry.name}`;
    // lstat: symbolic links and special files are never followed or packed.
    const stat = await lstat(file);
    if (stat.isDirectory()) yield* walk(file, path);
    else if (stat.isFile()) yield { path, file, size: stat.size, mode: stat.mode & 0o111 ? 0o755 : 0o644, mtime: Math.floor(stat.mtimeMs / 1000) };
  }
}

export interface ExtraFile { path: string; content: string }

function* entry(path: string, data: Buffer, mode: number, mtime: number): Generator<Buffer> {
  if (Buffer.byteLength(path) > 100) {
    const record = paxRecord("path", path);
    yield header("PaxHeader/entry", record.length, 0o644, mtime, "x");
    yield record;
    yield padding(record.length);
  }
  yield header(path, data.length, mode, mtime);
  yield data;
  yield padding(data.length);
}

async function* tarChunks(root: string, id: string, limit: number, extra: readonly ExtraFile[]): AsyncGenerator<Buffer> {
  let total = 0;
  for await (const { path, file, size, mode, mtime } of walk(join(root, id), id)) {
    total += size;
    if (total > limit) throw new Error("Skill archive exceeds the size limit");
    if (Buffer.byteLength(path) > 100) {
      const record = paxRecord("path", path);
      yield header(`PaxHeader/${id}`, record.length, 0o644, mtime, "x");
      yield record;
      yield padding(record.length);
    }
    yield header(path, size, mode, mtime);
    const handle = await open(file, "r");
    try {
      let remaining = size;
      while (remaining > 0) {
        const chunk = Buffer.allocUnsafe(Math.min(remaining, 64 * 1024));
        const { bytesRead } = await handle.read(chunk, 0, chunk.length, size - remaining);
        // A file that shrank while streaming would corrupt the tar, so abort instead.
        if (bytesRead === 0) throw new Error("Skill file changed while it was being archived");
        remaining -= bytesRead;
        yield chunk.subarray(0, bytesRead);
      }
    } finally {
      await handle.close();
    }
    yield padding(size);
  }
  // Generated files such as the install manifest; they replace nothing because the walk skips them.
  for (const { path, content } of extra) {
    if (!path.split("/").every(segment => safeSegment.test(segment) && segment !== "..")) throw new Error("Unsafe extra archive path");
    yield* entry(`${id}/${path}`, Buffer.from(content), 0o644, Math.floor(Date.now() / 1000));
  }
  yield Buffer.alloc(block * 2);
}

/** A gzip-compressed tar stream with one top-level folder named after the skill. */
export function createSkillArchive(directory: string, id: string, limit = archiveLimitBytes, extra: readonly ExtraFile[] = []): Readable {
  if (!hasSkillFolder(directory, id) || !statSync(join(directory, id)).isDirectory()) throw new Error("Skill folder is not available on this server.");
  const gzip = createGzip({ level: 6 });
  const source = Readable.from(tarChunks(directory, id, limit, extra));
  source.on("error", error => gzip.destroy(error));
  return source.pipe(gzip);
}

