export type ItemKind = "definition" | "theorem" | "proposition" | "lemma" | "corollary" | "algorithm" | "remark";

export interface GraphNodeData {
  id: string | number;
  x?: number;
  y?: number;
  [k: string]: unknown;
}
export interface GraphEdgeData {
  from: string | number;
  to: string | number;
  w?: number | string;
  [k: string]: unknown;
}
export interface GraphData {
  directed?: boolean;
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
}

export interface Example {
  title?: string;
  body: string;
  graph?: GraphData;
}

export interface IllustrationStep {
  caption: string;
  add?: (string | number)[][];
  remove?: (string | number)[][];
  nodes?: Record<string, string>;
  edges?: Record<string, string>;
  labels?: Record<string, string>;
  edge_labels?: Record<string, string>;
  set?: (string | number)[];
  edge_set?: string[];
  colors?: Record<string, number>;
  witness?: boolean;
}

export interface Illustration {
  title: string;
  for?: "statement" | "proof";
  property?: string;
  graph: GraphData;
  steps: IllustrationStep[];
  interactive?: boolean;
}

export interface ChapterRef {
  id: string;
  number: number;
  title: string;
}

export interface ItemBrief {
  id: string;
  kind: ItemKind;
  label?: string;
  title: string;
  section?: string;
  terms: string[];
  supplemented: boolean;
  has_proof: boolean;
  visualization?: string;
  illustrations: number;
  chapter: ChapterRef;
}

export interface Item {
  id: string;
  kind: ItemKind;
  label?: string;
  section?: string;
  title: string;
  terms: string[];
  statement: string;
  intuition?: string;
  proof?: string;
  proof_steps: string[];
  pseudocode?: string;
  complexity?: string;
  examples: Example[];
  illustrations?: Illustration[];
  visualization?: string;
  related: string[];
  source?: string;
  supplemented: boolean;
}

export interface ItemDetail extends Item {
  chapter: ChapterRef;
  related_items: ItemBrief[];
  referenced_by: ItemBrief[];
  exam_questions: number[];
}

export interface Section {
  number: string;
  title: string;
}

export interface ChapterSummary {
  id: string;
  number: number;
  title: string;
  summary?: string;
  source?: string;
  exam_questions: number[];
  sections: Section[];
  counts: Partial<Record<ItemKind, number>>;
  item_count: number;
  quiz_count: number;
  proof_count: number;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  summary?: string;
  source?: string;
  exam_questions: number[];
  sections: Section[];
  items: Item[];
  quiz_count: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
  related: string[];
}

export interface SearchHit extends ItemBrief {
  score: number;
  statement: string;
}

export interface ExamQuestion {
  number: number;
  title: string;
  group: number;
  chapters: string[];
  items: string[];
  outline?: string;
  algorithms?: string;
  example_tasks?: string;
  item_details: ItemBrief[];
}

export interface User {
  id: number;
  email: string;
  display_name: string;
  created_at: string;
}

export interface CardState {
  item_id: string;
  chapter_id: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  review_count: number;
  last_grade: number | null;
  due_at: string;
  last_reviewed_at: string | null;
}

export interface SrsQueue {
  cards: { item: Item & { chapter_id: string }; state: CardState | null }[];
  due_count: number;
  new_count: number;
  total: number;
}

export interface ChapterProgress {
  chapter_id: string;
  mastery: number;
  cards_total: number;
  cards_learned: number;
  cards_due: number;
  quiz_answered: number;
  quiz_accuracy: number | null;
  exercise_attempts: number;
  exercise_accuracy: number | null;
  proof_attempts: number;
  proof_accuracy: number | null;
}

export interface ProgressSummary {
  chapters: ChapterProgress[];
  exam: { number: number; last_score: number | null; attempts: number; last_at: string | null }[];
  total_reviews: number;
  streak_days: number;
}

export interface ExerciseType {
  id: string;
  title: string;
  chapter: string;
  description: string;
}

export type AnswerSpec =
  | { kind: "integer"; label?: string }
  | { kind: "vector"; labels: string[]; allow_inf?: boolean }
  | { kind: "matrix"; size: number; labels: string[]; allow_inf?: boolean }
  | { kind: "reducibility" }
  | { kind: "sat"; variables: string[] };

export interface ExerciseTask {
  type: string;
  title: string;
  chapter: string;
  seed: string;
  difficulty: number;
  prompt: string;
  answer_spec: AnswerSpec;
  data: { graph?: GraphData; matrix?: number[][]; formula?: string };
}

export interface CheckResult {
  correct: boolean;
  score: number;
  explanation: string;
}

export interface SavedGraph {
  id: number;
  name: string;
  data: GraphData;
  created_at: string;
  updated_at: string;
}

export interface VisualizationInfo {
  id: string;
  title: string;
  items: ItemBrief[];
}
