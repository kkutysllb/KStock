import { Home } from "./pages/Home";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ToastHost } from "./components/ToastHost";
import { WindowControls } from "./components/WindowControls";

export function App() {
  return (
    <AppErrorBoundary>
      <Home />
      <ToastHost />
      {/* Windows 无框窗口自绘窗控，非 Windows 宿主返回 null。 */}
      <WindowControls />
    </AppErrorBoundary>
  );
}
