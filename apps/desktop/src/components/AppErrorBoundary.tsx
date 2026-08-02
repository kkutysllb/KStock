import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
  onReload?: () => void;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("KStock UI render failed", error, info);
  }

  private reload = () => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-error-boundary" role="alert" aria-label="界面渲染失败">
        <div className="app-error-card">
          <p className="eyebrow">KStock UI</p>
          <h1>界面渲染失败</h1>
          <p>
            某个历史任务或本地数据触发了渲染异常。你可以先重新加载；如果仍然出现，
            请把下面的错误信息发给开发者。
          </p>
          <pre>{this.state.error.message}</pre>
          <button type="button" onClick={this.reload}>重新加载</button>
        </div>
      </main>
    );
  }
}
