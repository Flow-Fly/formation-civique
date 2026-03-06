import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { DataProvider } from "@/context/data-context.tsx";
import { ThemeProvider } from "@/context/theme-context.tsx";
import { ExamProvider } from "@/context/exam-context.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ExamProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </ExamProvider>
    </ThemeProvider>
  </StrictMode>
);
