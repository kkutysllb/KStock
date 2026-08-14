import { Home } from "./pages/Home";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ToastHost } from "./components/ToastHost";

export function App() {
  return (
    <AppErrorBoundary>
      <Home />
      <ToastHost />
    </AppErrorBoundary>
  );
}
