export interface ImportFileCandidate {
  name: string;
  type: string;
  size: number;
}

export const MAX_IMPORT_FILE_SIZE = 200 * 1024 * 1024;
export const MAX_IMPORT_IMAGES = 9;

export function validateImportFiles(files: ImportFileCandidate[]) {
  const videos = files.filter((file) => file.type === "video/mp4" || file.type === "video/quicktime" || /\.(mp4|mov)$/i.test(file.name));
  const images = files.filter((file) => file.type === "image/jpeg" || file.type === "image/png" || /\.(jpe?g|png)$/i.test(file.name));
  if (videos.length + images.length !== files.length) return "仅支持 MP4、MOV、JPG 和 PNG 文件";
  if (videos.length && files.length > 1) return "视频一次只能选择 1 个，不能与图片混合";
  if (images.length > MAX_IMPORT_IMAGES) return "图文内容最多选择 9 张图片";
  if (files.some((file) => file.size > MAX_IMPORT_FILE_SIZE)) return "单个文件不能超过 200 MB";
  return null;
}
