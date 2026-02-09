import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Question, QuizAnswer, QuizScore } from "@/types/index.ts";
import * as engine from "@/services/quiz-engine.ts";
import * as sr from "@/services/spaced-repetition.ts";
import * as storage from "@/services/storage.ts";

type QuizPhase = "setup" | "active" | "results";

interface QuizState {
  phase: QuizPhase;
  questions: Question[];
  current: number;
  answers: QuizAnswer[];
  timed: boolean;
  timeLimit: number;
  timeRemaining: number;
  isExam: boolean;
  showingFeedback: boolean;
  selectedChoice: string | null;
  score: QuizScore | null;
}

type QuizAction =
  | { type: "START"; questions: Question[]; timed: boolean; timeLimit: number; isExam: boolean }
  | { type: "SELECT_CHOICE"; choiceId: string; question: Question }
  | { type: "NEXT_QUESTION" }
  | { type: "SKIP"; question: Question }
  | { type: "TICK" }
  | { type: "FINISH" }
  | { type: "RESET" };

const initialState: QuizState = {
  phase: "setup",
  questions: [],
  current: 0,
  answers: [],
  timed: false,
  timeLimit: 0,
  timeRemaining: 0,
  isExam: false,
  showingFeedback: false,
  selectedChoice: null,
  score: null,
};

function finishQuiz(state: QuizState): QuizState {
  const score = engine.calculateScore(state.answers);
  const history = storage.load<Array<Record<string, unknown>>>("quiz_history", []);
  history.push({
    date: new Date().toISOString(),
    ...score,
    isExam: state.isExam,
  });
  storage.save("quiz_history", history);
  sr.recordStudyActivity();

  return { ...state, phase: "results", score };
}

function reducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case "START":
      return {
        ...initialState,
        phase: "active",
        questions: action.questions,
        timed: action.timed,
        timeLimit: action.timeLimit,
        timeRemaining: action.timeLimit,
        isExam: action.isExam,
      };

    case "SELECT_CHOICE": {
      const q = action.question;
      const isCorrect = action.choiceId === q.correctAnswer;
      const answer: QuizAnswer = {
        questionId: q.id,
        themeId: q.themeId,
        themeName: q.themeName,
        chosen: action.choiceId,
        correct: q.correctAnswer,
        isCorrect,
      };
      sr.rateCard(q.id, isCorrect ? 3 : 0);

      const newAnswers = [...state.answers, answer];

      if (state.isExam) {
        const nextIdx = state.current + 1;
        if (nextIdx >= state.questions.length) {
          return finishQuiz({ ...state, answers: newAnswers });
        }
        return {
          ...state,
          answers: newAnswers,
          current: nextIdx,
          selectedChoice: null,
        };
      }

      return {
        ...state,
        answers: newAnswers,
        selectedChoice: action.choiceId,
        showingFeedback: true,
      };
    }

    case "NEXT_QUESTION": {
      const nextIdx = state.current + 1;
      if (nextIdx >= state.questions.length) {
        return finishQuiz(state);
      }
      return {
        ...state,
        current: nextIdx,
        showingFeedback: false,
        selectedChoice: null,
      };
    }

    case "SKIP": {
      const q = action.question;
      const answer: QuizAnswer = {
        questionId: q.id,
        themeId: q.themeId,
        themeName: q.themeName,
        chosen: null,
        correct: q.correctAnswer,
        isCorrect: false,
      };
      const newAnswers = [...state.answers, answer];
      const nextIdx = state.current + 1;
      if (nextIdx >= state.questions.length) {
        return finishQuiz({ ...state, answers: newAnswers });
      }
      return {
        ...state,
        answers: newAnswers,
        current: nextIdx,
      };
    }

    case "TICK": {
      const remaining = state.timeRemaining - 1;
      if (remaining <= 0) {
        return finishQuiz({ ...state, timeRemaining: 0 });
      }
      return { ...state, timeRemaining: remaining };
    }

    case "FINISH":
      return finishQuiz(state);

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export function useQuiz() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.phase === "active" && state.timed) {
      timerRef.current = setInterval(() => dispatch({ type: "TICK" }), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.phase, state.timed]);

  useEffect(() => {
    if (state.phase !== "active" && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [state.phase]);

  const start = useCallback(
    (questions: Question[], options: { timed: boolean; timeLimit?: number; isExam: boolean }) => {
      dispatch({
        type: "START",
        questions,
        timed: options.timed,
        timeLimit: options.timeLimit || 0,
        isExam: options.isExam,
      });
    },
    []
  );

  const selectChoice = useCallback(
    (choiceId: string, question: Question) => {
      dispatch({ type: "SELECT_CHOICE", choiceId, question });
    },
    []
  );

  const nextQuestion = useCallback(() => dispatch({ type: "NEXT_QUESTION" }), []);
  const skip = useCallback(
    (question: Question) => dispatch({ type: "SKIP", question }),
    []
  );
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { state, start, selectChoice, nextQuestion, skip, reset };
}
