import { NextResponse } from "next/server";
import { searchPlanVideos, type PlanVideoCandidate } from "../../plan-video-catalog";

export const runtime = "nodejs";

function toPublicCandidate(candidate: PlanVideoCandidate & { score: number; matchReasons: string[] }) {
  const { localFile, ...publicCandidate } = candidate;
  void localFile;
  return publicCandidate;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const results = searchPlanVideos(query).map(toPublicCandidate);
  return NextResponse.json({ query, source: "curated", results });
}
