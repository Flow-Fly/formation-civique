import { useQuiz } from "@/hooks/use-quiz.ts";
import { useData } from "@/context/data-context.tsx";
import { useExam } from "@/context/exam-context.tsx";
import { QuizSetup } from "./quiz-setup.tsx";
import { QuizQuestion } from "./quiz-question.tsx";
import { QuizResults } from "./quiz-results.tsx";
import type { QuestionInstance } from "@/types/index.ts";

export function QuizPage() {
  const { loading } = useData();
  const { activeExam } = useExam();
  const quiz = useQuiz();

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">Chargement...</div>;
  }

  if (quiz.state.phase === "results" && quiz.state.score) {
    return (
      <QuizResults
        score={quiz.state.score}
        answers={quiz.state.answers}
        questions={quiz.state.questions}
        isExam={quiz.state.isExam}
        onRetry={quiz.reset}
        onReviewMistakes={(questions: QuestionInstance[]) => {
          quiz.start(questions, { timed: false, isExam: false, exam: activeExam });
        }}
      />
    );
  }

  if (quiz.state.phase === "active") {
    const q = quiz.state.questions[quiz.state.current];
    return (
      <QuizQuestion
        question={q}
        current={quiz.state.current}
        total={quiz.state.questions.length}
        timed={quiz.state.timed}
        timeRemaining={quiz.state.timeRemaining}
        isExam={quiz.state.isExam}
        showingFeedback={quiz.state.showingFeedback}
        selectedChoice={quiz.state.selectedChoice}
        onSelectChoice={(choiceId) => quiz.selectChoice(choiceId, q)}
        onNext={quiz.nextQuestion}
        onSkip={() => quiz.skip(q)}
      />
    );
  }

  return <QuizSetup onStart={quiz.start} />;
}
