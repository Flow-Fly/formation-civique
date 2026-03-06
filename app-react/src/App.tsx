import { createHashRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout.tsx";
import { DashboardPage } from "@/components/dashboard/dashboard-page.tsx";
import { StudyPage } from "@/components/study/study-page.tsx";
import { ContentPage } from "@/components/study/content-page.tsx";
import { QuizPage } from "@/components/quiz/quiz-page.tsx";
import { FlashcardsPage } from "@/components/flashcards/flashcards-page.tsx";
import { SettingsPage } from "@/components/settings/settings-page.tsx";
import { QuestionsPage } from "@/components/questions/questions-page.tsx";

/** Constrains child routes to 960px — used for all pages except fiche content */
function NarrowContainer() {
  return (
    <div className="max-w-[960px] mx-auto">
      <Outlet />
    </div>
  );
}

const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        element: <NarrowContainer />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
          { path: "study", element: <StudyPage /> },
          { path: "quiz", element: <QuizPage /> },
          { path: "flashcards", element: <FlashcardsPage /> },
          { path: "questions", element: <QuestionsPage /> },
          { path: "settings", element: <SettingsPage /> },
        ],
      },
      { path: "study/:theme/:subcategory/:slug", element: <ContentPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
