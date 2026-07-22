import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [jobId, fixtureId, sourceName] = process.argv.slice(2);

if (!jobId || !fixtureId || !sourceName) {
  throw new Error("用法：node scripts/save-analysis-mock.mjs <jobId> <mock-fixture-id> <sourceName>");
}
if (!/^mock-[a-z0-9-]+$/.test(fixtureId)) {
  throw new Error("fixtureId 必须以 mock- 开头，并且只包含小写字母、数字和连字符");
}

const workspace = process.cwd();
const jobDirectory = path.join(workspace, "tmp", "analysis-jobs", jobId);
const job = JSON.parse(await readFile(path.join(jobDirectory, "job.json"), "utf8"));
if (job.status !== "completed" || !job.result) {
  throw new Error(`任务 ${jobId} 尚未完成，不能保存为 mock`);
}

const publicFrameDirectory = path.join(workspace, "public", "mocks", fixtureId, "frames");
await mkdir(publicFrameDirectory, { recursive: true });
for (const fileName of await readdir(path.join(jobDirectory, "frames"))) {
  if (!fileName.endsWith(".jpg")) continue;
  await copyFile(path.join(jobDirectory, "frames", fileName), path.join(publicFrameDirectory, fileName));
}

const temporaryFramePrefix = `/api/analysis-jobs/${jobId}/frames/`;
function makePortable(value) {
  if (Array.isArray(value)) return value.map(makePortable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, makePortable(item)]));
  }
  if (typeof value === "string" && value.startsWith(temporaryFramePrefix)) {
    const stepId = value.slice(temporaryFramePrefix.length);
    return `/mocks/${fixtureId}/frames/${stepId}.jpg`;
  }
  return value;
}

const fixture = {
  meta: {
    dataSource: "mock",
    fixtureId,
    sourceName,
    sourceJobId: jobId,
    capturedAt: new Date(job.updatedAt).toISOString(),
    profile: job.profile,
  },
  result: makePortable(job.result),
};

const fixtureDirectory = path.join(workspace, "app", "mocks", "fixtures");
await mkdir(fixtureDirectory, { recursive: true });
const output = path.join(fixtureDirectory, `${fixtureId}.json`);
await writeFile(output, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
console.log(output);

