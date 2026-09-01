import { getDesktopBridge, isDesktopRuntime } from "../../lib/desktopBridge";

/** 按文件名 / MIME 判定预览形态：html / markdown / text / 直接下载。 */
export function getArtifactPreviewKind(name: string, contentType = ""): "html" | "markdown" | "text" | "download" {
  if (/\.(html?|xhtml|svg)$/i.test(name)) return "html";
  if (/\.(md|markdown)$/i.test(name)) return "markdown";
  if (/\.(log|txt|json|csv|tsv|ya?ml)$/i.test(name)) return "text";
  if (/^text\//i.test(contentType)) return "text";
  return "download";
}

export function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
      reader.addEventListener("error", () => reject(reader.error ?? new Error("文件读取失败")));
      reader.readAsText(blob);
    });
  }
  return new Response(blob).text();
}

/** 桌面端走系统保存对话框；浏览器/不支持时由调用方回退到 anchor 下载。 */
export async function saveArtifactBlob(name: string, blob: Blob): Promise<"saved" | "cancelled" | "unsupported"> {
  if (!isDesktopRuntime()) return "unsupported";
  const result = await getDesktopBridge()!.saveArtifact(name, await readBlobBytes(blob));
  return result.saved ? "saved" : "cancelled";
}

export async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") return new Uint8Array(await blob.arrayBuffer());
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(new Uint8Array(reader.result as ArrayBuffer)));
      reader.addEventListener("error", () => reject(reader.error ?? new Error("文件读取失败")));
      reader.readAsArrayBuffer(blob);
    });
  }
  return new Uint8Array(await new Response(blob).arrayBuffer());
}

export function fallbackDownloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
