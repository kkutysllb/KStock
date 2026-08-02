import { Home } from "./pages/Home";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

export function App() {
  return (
    <AppErrorBoundary>
      <Home />
    </AppErrorBoundary>
  );
}
