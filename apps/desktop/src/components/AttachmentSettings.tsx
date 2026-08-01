import { useCallback, useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  type UploadsConfig,
  getRuntimeConfig,
  updateRuntimeConfigSection,
  isRuntimeConfigApiError,
} from "../lib/runtimeConfigClient";
import { RuntimeConfigCard, type FieldDef } from "./RuntimeConfigCard";

const BYTES_PER_MB = 1024 * 1024;

/**
 * 附件上传设置页。
 *
 * 编辑 runtime.yaml 的 uploads 段（KStock 自定义段，字段对齐引擎
 * routers/uploads.py 的 _get_uploads_config_value 读取的 key）。
 *
 * 单位转换：后端 max_file_size / max_total_size 以字节存储，前端以 MB
 * 单位编辑——initialValue 传入前 ÷1048576，保存时 ×1048576 写回。
 *
 * 引擎每次请求从 app_config.uploads dict 读取（yaml 热重载），保存后
 * 热重载即生效，无需重启 gateway。
 */
export function AttachmentSettings() {
  const [uploadsConfig, setUploadsConfig] = useState<UploadsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rc = await getRuntimeConfig();
      setUploadsConfig(rc.uploads);
    } catch (err) {
      setError(isRuntimeConfigApiError(err) ? err.message : "加载附件配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // 字节 → MB，供 RuntimeConfigCard 编辑
  const initialValue = useMemo<Record<string, unknown>>(() => {
    if (!uploadsConfig) return {};
    return {
      max_files: uploadsConfig.max_files,
      max_file_size: +(uploadsConfig.max_file_size / BYTES_PER_MB).toFixed(2),
      max_total_size: +(uploadsConfig.max_total_size / BYTES_PER_MB).toFixed(2),
    };
  }, [uploadsConfig]);

  const handleSave = useCallback(async (value: Record<string, unknown>) => {
    // draft 里 size 是 MB，写回时转字节
    const payload: Record<string, unknown> = {
      max_files: Number(value.max_files) || 1,
      max_file_size: Math.max(1, Math.round((Number(value.max_file_size) || 1) * BYTES_PER_MB)),
      max_total_size: Math.max(1, Math.round((Number(value.max_total_size) || 1) * BYTES_PER_MB)),
    };
    await updateRuntimeConfigSection("uploads", payload);
    setUploadsConfig(payload as unknown as UploadsConfig);
  }, []);

  if (loading) {
    return (
      <div className="attachment-settings">
        <p className="memory-loading">加载附件配置…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="attachment-settings">
        <p className="auth-error" role="alert">{error}</p>
      </div>
    );
  }

  if (!uploadsConfig) {
    return null;
  }

  return (
    <div className="attachment-settings">
      <section className="settings-card database-notice-card" aria-label="说明">
        <div className="database-notice">
          <Info size={16} />
          <p>
            限制写入 runtime.yaml 的 <code>uploads</code> 段。引擎每次请求从配置读取，
            <strong>热重载即生效，无需重启 gateway</strong>。size 字段以 MB 为单位编辑，
            内部转字节存储。
          </p>
        </div>
      </section>

      <RuntimeConfigCard
        title="附件上传限制"
        description="控制单个会话（thread）的附件数量、单文件大小与总大小。超出限制时引擎返回 413。"
        fields={UPLOADS_FIELDS}
        initialValue={initialValue}
        onSave={handleSave}
        savedHint="已写入 runtime.yaml。引擎热重载即生效。"
      />
    </div>
  );
}

// ── 字段定义 ────────────────────────────────────────────────────────

const UPLOADS_FIELDS: FieldDef[] = [
  {
    key: "max_files",
    label: "文件数量上限",
    type: "number",
    min: 1,
    max: 100,
    step: 1,
    hint: "单个会话允许的最大附件数量（1-100）",
  },
  {
    key: "max_file_size",
    label: "单文件上限（MB）",
    type: "number",
    min: 1,
    step: 1,
    hint: "单个附件的最大体积，单位 MB（内部转字节存入 uploads.max_file_size）",
  },
  {
    key: "max_total_size",
    label: "总量上限（MB）",
    type: "number",
    min: 1,
    step: 1,
    hint: "单个会话所有附件合计的最大体积，单位 MB（内部转字节存入 uploads.max_total_size）",
  },
];
