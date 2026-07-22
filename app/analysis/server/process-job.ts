import "server-only";
import { searchKnowledge } from "../evidence";
import { extractFrames } from "./frames";
import { personalizeWithQwen, parseVideoWithQwen } from "./qwen";
import { loadJob, updateJob } from "./storage";

export async function processAnalysisJob(jobId: string) {
  try {
    const job = await loadJob(jobId);
    if (!job) throw new Error("分析任务不存在");
    await updateJob(jobId, { status: "parsing_video", progress: 10, stageText: "正在读取视频中的食材和动作" });
    const facts = await parseVideoWithQwen(job.video);
    await updateJob(jobId, { status: "searching_knowledge", progress: 45, stageText: "正在匹配政策证据与宝宝档案" });
    const evidence = searchKnowledge();
    await updateJob(jobId, { status: "generating_plan", progress: 55, stageText: "正在生成宝宝版本与陪做步骤" });
    let result = await personalizeWithQwen(facts, job.profile, evidence);
    await updateJob(jobId, { status: "extracting_frames", progress: 80, stageText: "正在提取每一步的关键画面" });
    result = await extractFrames(jobId, job.video, result);
    await updateJob(jobId, { progress: 95, stageText: "正在完成结果校验" });
    await updateJob(jobId, { status: "completed", progress: 100, stageText: "分析完成", result, error: null });
  } catch (error) {
    await updateJob(jobId, { status: "failed", stageText: "分析失败", error: error instanceof Error ? error.message : "未知错误" }).catch(() => undefined);
  }
}
