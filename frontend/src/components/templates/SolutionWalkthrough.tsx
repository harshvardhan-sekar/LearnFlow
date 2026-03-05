import { useState, useCallback } from "react";
import StepNavigator from "../ui/StepNavigator";
import DataTable from "../ui/DataTable";
import CodeBlock from "../ui/CodeBlock";

interface DataTableData {
  headers: string[];
  rows: (string | number | null)[][];
  highlight_rows?: number[];
  highlight_color?: "blue" | "green" | "yellow" | "red" | "purple";
}

interface CodeSnippet {
  language?: string;
  code: string;
  highlight_lines?: number[];
}

interface Step {
  step_number: number;
  title: string;
  explanation: string;
  data_table?: DataTableData;
  code_snippet?: CodeSnippet;
}

interface FinalAnswer {
  explanation: string;
  code?: string;
}

export interface SolutionWalkthroughData {
  template: "solution_walkthrough";
  title: string;
  problem_statement?: string;
  steps: Step[];
  final_answer?: FinalAnswer;
}

export default function SolutionWalkthrough({
  data,
}: {
  data: SolutionWalkthroughData;
}) {
  const totalSteps = data.steps.length + (data.final_answer ? 1 : 0);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);

  const goTo = useCallback((next: number) => {
    setVisible(false);
    setTimeout(() => {
      setCurrent(next);
      setVisible(true);
    }, 120);
  }, []);

  const isFinalStep = data.final_answer && current === data.steps.length;
  const step = !isFinalStep ? data.steps[current] : null;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/60 bg-gradient-to-b from-slate-900 to-slate-800/90 font-mono text-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/50 bg-slate-800/50">
        <div className="flex items-start gap-3">
          <span className="text-blue-400 text-lg">⚡</span>
          <div>
            <h3 className="text-slate-100 font-semibold leading-tight">
              {data.title}
            </h3>
            {data.problem_statement && (
              <p className="mt-1.5 text-slate-400 text-xs leading-relaxed font-sans">
                {data.problem_statement}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Step content with fade transition */}
      <div
        className="px-5 py-4 min-h-[160px] transition-opacity duration-150"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {isFinalStep && data.final_answer ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                ✓
              </span>
              <span className="text-green-400 font-semibold text-xs uppercase tracking-wider">
                Final Answer
              </span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed font-sans">
              {data.final_answer.explanation}
            </p>
            {data.final_answer.code && (
              <CodeBlock code={data.final_answer.code} language="sql" />
            )}
          </div>
        ) : step ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-700 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                {step.step_number}
              </span>
              <span className="text-blue-300 font-semibold text-xs">
                {step.title}
              </span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed font-sans">
              {step.explanation}
            </p>
            {step.data_table && (
              <DataTable
                headers={step.data_table.headers}
                rows={step.data_table.rows}
                highlight_rows={step.data_table.highlight_rows}
                highlight_color={step.data_table.highlight_color}
              />
            )}
            {step.code_snippet && (
              <CodeBlock
                code={step.code_snippet.code}
                language={step.code_snippet.language}
                highlight_lines={step.code_snippet.highlight_lines}
              />
            )}
          </div>
        ) : null}
      </div>

      {/* Navigator */}
      <div className="px-5 pb-4">
        <StepNavigator
          currentStep={current}
          totalSteps={totalSteps}
          onPrev={() => goTo(Math.max(0, current - 1))}
          onNext={() => goTo(Math.min(totalSteps - 1, current + 1))}
        />
      </div>
    </div>
  );
}
