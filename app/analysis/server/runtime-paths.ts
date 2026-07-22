import os from "node:os";
import path from "node:path";

export function resolveRuntimeTempRoot(options: {
  isVercel?: boolean;
  cwd?: string;
  systemTemp?: string;
} = {}) {
  const isVercel = options.isVercel ?? Boolean(process.env.VERCEL);
  const cwd = options.cwd ?? process.cwd();
  const systemTemp = options.systemTemp ?? os.tmpdir();
  return isVercel ? path.join(systemTemp, "baobao") : path.join(cwd, "tmp");
}

export const runtimeTempRoot = resolveRuntimeTempRoot();
