import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout.tsx";
import { DashboardPage } from "@/components/dashboard/dashboard-page.tsx";
import { StudyPage } from "@/components/study/study-page.tsx";
import { QuizPage } from "@/components/quiz/quiz-page.tsx";
import { FlashcardsPage } from "@/components/flashcards/flashcards-page.tsx";
import { SettingsPage } from "@/components/settings/settings-page.tsx";

const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "study", element: <StudyPage /> },
      { path: "quiz", element: <QuizPage /> },
      { path: "flashcards", element: <FlashcardsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
