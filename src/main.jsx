import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./AuthContext.jsx";
import { StoryProvider } from "./StoryContext.jsx";
import { DraftProvider } from "./DraftContext.jsx";
import { autoFullscreen } from "./fullscreen.js";
import "./index.css";
import "./app.css";

autoFullscreen();

// Tahan lama (menu salin/unduh) dan pemblokiran teks dimatikan, kecuali di kolom isian dan konsol admin
const boleh = (t) => (t?.nodeType === 3 ? t.parentElement : t)?.closest?.("input, textarea, .term-out, .a-text");
document.addEventListener("contextmenu", (e) => { if (!boleh(e.target)) e.preventDefault(); });
document.addEventListener("selectstart", (e) => { if (!boleh(e.target)) e.preventDefault(); });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <StoryProvider>
          <DraftProvider>
            <App />
          </DraftProvider>
        </StoryProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
