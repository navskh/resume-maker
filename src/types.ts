export interface Version {
  id: string;
  content: string;
  createdAt: string;
  label: string;
  charCount: number;
}

export interface Question {
  id: string;
  title: string;
  maxChars: number | null;
  versions: Version[];
  activeVersionId: string | null;
}

export interface AppState {
  questions: Question[];
  selectedQuestionId: string | null;
  globalContext: string;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
}

export interface Suggestion {
  original: string;
  replacement: string;
  reason: string;
}

export interface WordMapCategory {
  type: string;
  items: string[];
}

export interface WordMapResult {
  word: string;
  categories: WordMapCategory[];
}
