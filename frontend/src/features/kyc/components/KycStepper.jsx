import React from "react";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";

export function KycStepper({
  steps,
  currentStep,
  completedSteps = [],
  onSelectStep,
  isSubmitted,
}) {
  const percentComplete = Math.round((completedSteps.length / steps.length) * 100);

  return (
    <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
      {/* Top Progress Bar & Counter */}
      <div className="mb-5 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Verification Progress: <strong className="text-slate-800">{completedSteps.length} of {steps.length} completed</strong></span>
          <span className="font-semibold text-blue-700">{percentComplete}%</span>
        </div>
        <div className="overflow-hidden h-1.5 w-full rounded-full bg-slate-100">
          <div
            style={{ width: `${percentComplete}%` }}
            className="h-full bg-blue-600 transition-all duration-300 ease-out rounded-full"
          ></div>
        </div>
      </div>

      {/* Step Icons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {steps.map((step) => {
          const Icon = step.icon;
          const isDone = completedSteps.includes(step.id) || isSubmitted;
          const isCurrent = step.id === currentStep && !isSubmitted;

          // Check if all preceding steps are completed
          const allPreviousStepsDone = steps
            .filter((s) => s.id < step.id)
            .every((s) => completedSteps.includes(s.id));

          // Step 1 is always accessible. Subsequent steps require all previous steps to be completed.
          const isAccessible = step.id === 1 || allPreviousStepsDone || isDone;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                if (isAccessible) {
                  onSelectStep(step.id);
                } else {
                  toast.error(
                    `Please complete Step ${step.id - 1} before proceeding to Step ${step.id} (${step.name}).`
                  );
                }
              }}
              disabled={!isAccessible}
              className={`flex flex-col items-center p-2.5 rounded-xl transition-all duration-150 text-center relative select-none ${
                isCurrent
                  ? "bg-blue-50/80 border border-blue-600 text-blue-900 shadow-xs ring-1 ring-blue-600/10 cursor-default"
                  : isDone
                  ? "bg-emerald-50/80 hover:bg-emerald-100/70 text-emerald-900 border border-emerald-200 cursor-pointer"
                  : isAccessible
                  ? "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer"
                  : "bg-slate-50 text-slate-400 border border-slate-200/60 opacity-60 cursor-not-allowed"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 transition-all text-xs font-semibold ${
                  isCurrent
                    ? "bg-blue-600 text-white shadow-xs"
                    : isDone
                    ? "bg-emerald-600 text-white shadow-xs"
                    : isAccessible
                    ? "bg-slate-100 text-slate-700 border border-slate-200"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {isDone ? (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                ) : !isAccessible ? (
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>

              <span
                className={`text-xs font-semibold leading-tight line-clamp-1 ${
                  isCurrent
                    ? "text-blue-900 font-bold"
                    : isDone
                    ? "text-emerald-900"
                    : isAccessible
                    ? "text-slate-800"
                    : "text-slate-400"
                }`}
              >
                {step.id}. {step.name}
              </span>
              <span className="text-[11px] text-slate-500 hidden lg:block mt-0.5 line-clamp-1">
                {step.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default KycStepper;
