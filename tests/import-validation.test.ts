import { describe, expect, it } from "vitest";
import { MAX_IMPORT_FILE_SIZE, validateImportFiles } from "../app/import-validation";

const file = (name: string, type: string, size = 1024) => ({ name, type, size });

describe("首页文件导入校验", () => {
  it("支持单个 MP4 或 MOV 视频", () => {
    expect(validateImportFiles([file("meal.mp4", "video/mp4")])).toBeNull();
    expect(validateImportFiles([file("meal.mov", "video/quicktime")])).toBeNull();
  });

  it("支持最多 9 张 JPG 或 PNG 图片", () => {
    expect(validateImportFiles(Array.from({ length: 9 }, (_, index) => file(`${index}.jpg`, "image/jpeg")))).toBeNull();
    expect(validateImportFiles(Array.from({ length: 10 }, (_, index) => file(`${index}.png`, "image/png")))).toBe("图文内容最多选择 9 张图片");
  });

  it("拒绝视频混选、未知格式和超大文件", () => {
    expect(validateImportFiles([file("meal.mp4", "video/mp4"), file("cover.jpg", "image/jpeg")])).toBe("视频一次只能选择 1 个，不能与图片混合");
    expect(validateImportFiles([file("notes.pdf", "application/pdf")])).toBe("仅支持 MP4、MOV、JPG 和 PNG 文件");
    expect(validateImportFiles([file("meal.mp4", "video/mp4", MAX_IMPORT_FILE_SIZE + 1)])).toBe("单个文件不能超过 200 MB");
  });
});
