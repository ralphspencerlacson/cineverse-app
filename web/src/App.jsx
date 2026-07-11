import Router from "./components/router/Router";
import { AuthProvider } from "./context/AuthContext";
// CSS
import "./App.css";

function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

export default App;
