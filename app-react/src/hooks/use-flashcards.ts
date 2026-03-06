import { useCallback, useReducer } from "react";
import type { QuestionInstance, Quality, RatingName, ExamCode } from "@/types/index.ts";
import * as sr from "@/services/spaced-repetition.ts";

type DeckPhase = "setup" | "active" | "summary";

interface DeckState {
  phase: DeckPhase;
  cards: QuestionInstance[];
  current: number;
  flipped: boolean;
  reviewed: number;
  exam: ExamCode | null;
  ratings: Record<RatingName, number>;
}

type DeckAction =
  | { type: "START"; cards: QuestionInstance[]; exam: ExamCode }
  | { type: "FLIP" }
  | { type: "RATE"; quality: Quality }
  | { type: "RESET" };

const initialState: DeckState = {
  phase: "setup",
  cards: [],
  current: 0,
  flipped: false,
  reviewed: 0,
  exam: null,
  ratings: { again: 0, hard: 0, good: 0, easy: 0 },
};

const qualityToRating: Record<Quality, RatingName> = {
  0: "again",
  2: "hard",
  3: "good",
  5: "easy",
};

function reducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case "START":
      return {
        ...initialState,
        phase: "active",
        cards: action.cards,
        exam: action.exam,
      };

    case "FLIP":
      return { ...state, flipped: true };

    case "RATE": {
      const q = state.cards[state.current];
      const exam = state.exam || q.exam || "CR";
      sr.rateCard(q.id, action.quality, exam);
      sr.recordStudyActivity(exam);

      const ratingName = qualityToRating[action.quality];
      const newRatings = { ...state.ratings, [ratingName]: state.ratings[ratingName] + 1 };
      const nextIdx = state.current + 1;

      if (nextIdx >= state.cards.length) {
        return {
          ...state,
          phase: "summary",
          reviewed: state.reviewed + 1,
          ratings: newRatings,
          current: nextIdx,
        };
      }

      return {
        ...state,
        current: nextIdx,
        flipped: false,
        reviewed: state.reviewed + 1,
        ratings: newRatings,
      };
    }

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export function useFlashcards() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const start = useCallback(
    (cards: QuestionInstance[], exam: ExamCode) => dispatch({ type: "START", cards, exam }),
    [],
  );
  const flip = useCallback(() => dispatch({ type: "FLIP" }), []);
  const rate = useCallback((quality: Quality) => dispatch({ type: "RATE", quality }), []);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { state, start, flip, rate, reset };
}
