import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import type { ExamCode, QualityFlag } from "@/types.ts";

interface FilterBarProps {
  query: string;
  onQueryChange: (v: string) => void;
  exam: string;
  onExamChange: (v: string) => void;
  themeId: string;
  onThemeChange: (v: string) => void;
  themes: [string, string][];
  status: string;
  onStatusChange: (v: string) => void;
  qualityFlag: string;
  onQualityFlagChange: (v: string) => void;
  qualityFlags: QualityFlag[];
  poolFlag: string;
  onPoolFlagChange: (v: string) => void;
  counts: { total: number; filtered: number; pending: number; reviewed: number };
}

const EXAMS: ExamCode[] = ["CSP", "CR", "NAT"];

export function FilterBar({
  query,
  onQueryChange,
  exam,
  onExamChange,
  themeId,
  onThemeChange,
  themes,
  status,
  onStatusChange,
  qualityFlag,
  onQualityFlagChange,
  qualityFlags,
  poolFlag,
  onPoolFlagChange,
  counts,
}: FilterBarProps) {
  return (
    <div className="border rounded-lg p-3 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        <div className="text-xs text-muted-foreground">
          {counts.filtered}/{counts.total} shown · {counts.pending} pending · {counts.reviewed} reviewed
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <input
          type="text"
          placeholder="Search text / id..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm col-span-2 md:col-span-1"
        />

        <Select value={exam} onValueChange={onExamChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Exam" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All exams</SelectItem>
            {EXAMS.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={themeId} onValueChange={onThemeChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All themes</SelectItem>
            {themes.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">pending</SelectItem>
            <SelectItem value="reviewed">reviewed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={qualityFlag} onValueChange={onQualityFlagChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Quality flag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All flags</SelectItem>
            {qualityFlags.map((flag) => (
              <SelectItem key={flag} value={flag}>{flag}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={poolFlag} onValueChange={onPoolFlagChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Pools" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pools</SelectItem>
            <SelectItem value="ok">Pools valid</SelectItem>
            <SelectItem value="issue">Pools with issues</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
