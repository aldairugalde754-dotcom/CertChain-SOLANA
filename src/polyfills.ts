import { Buffer } from "buffer";

if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer;
  (window as any).global = window;
  (window as any).process = (window as any).process || { env: {} };
}

if (typeof globalThis !== "undefined") {
  (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
  (globalThis as any).process = (globalThis as any).process || { env: {} };
}