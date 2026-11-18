import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FileCheck,
  Building2,
  Camera,
  FileText,
  UserCheck,
} from "lucide-react";
import { getSubmissionStatus } from "../../../api/kyc.api";

export function KycSubmissionChecklist({ onNavigateToStep, onStatusLoaded }) {
  const [submissionData, setSubmissionData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    try {
      setIsLoading(true);
      setError("");
      const res = await getSubmissionStatus();
      if (res && res.data) {
        setSubmissionData(res.data);
        if (onStatusLoaded) onStatusLoaded(res.data);
      }
    } catch (err) {
      setError("Unable to verify live prerequisites with backend");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const stepIcons = {
    1: UserCheck,
    2: ShieldCheck,
    3: FileCheck,
    4: Building2,
    5: Camera,
    6: FileText,
  };

  const stepsList = [
    { number: 1, title: "Basic Details & Contact Verification", desc: "Legal profile, address, and mobile OTP" },
    { number: 2, title: "Aadhaar Identity Verification", desc: "UIDAI authenticated via DigiLocker" },
    { number: 3, title: "PAN Tax Records", desc: "Income Tax Department verified" },
    { number: 4, title: "Bank Account Details", desc: "Penny Drop / IFSC verification" },
    { number: 5, title: "Media Uploads & Live Video KYC", desc: "Outlet photo, selfie, and recorded consent video" },
    { number: 6, title: "Agent Operating Agreement", desc: "Terms & merchant policy acceptance" },
  ];

  const incompleteNumbers = new Set(
    (submissionData?.incompleteSteps || []).map((s) => Number(s.stepNumber))
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <ShieldCheck className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Prerequisite Steps Compliance Checklist
            </h3>
            <p className="text-xs text-slate-400">
              Verified against live backend database before final application submission
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadStatus}
          disabled={isLoading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold border border-slate-200 transition cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
          <span>Verify State</span>
        </button>
      </div>

      {/* Main Status Callout */}
      {submissionData && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            submissionData.isReadyForSubmission
              ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
              : submissionData.isSubmitted
              ? "bg-blue-50/60 border-blue-200 text-blue-900"
              : "bg-amber-50/60 border-amber-200 text-amber-900"
          }`}
        >
          {submissionData.isReadyForSubmission ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : submissionData.isSubmitted ? (
            <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="text-xs space-y-0.5">
            <div className="font-bold">
              {submissionData.isReadyForSubmission
                ? "All 6 Prerequisites Completed & Validated"
                : submissionData.isSubmitted
                ? "Application Already Submitted & In Compliance Review"
                : `${submissionData.incompleteSteps?.length || 0} Required Step(s) Pending Completion`}
            </div>
            <p className="text-slate-600 leading-relaxed">{submissionData.message}</p>
          </div>
        </div>
      )}

      {/* 6 Steps Grid List */}
      <div className="divide-y divide-slate-100">
        {stepsList.map((step) => {
          const isIncomplete = incompleteNumbers.has(step.number);
          const isDone = submissionData ? !isIncomplete : false;
          const IconComp = stepIcons[step.number] || ShieldCheck;

          return (
            <div
              key={step.number}
              className="py-3 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isDone
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <span className="font-bold text-[11px]">{step.number}</span>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-2">
                    <span>{step.title}</span>
                    {isDone && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                        Done
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-[11px]">{step.desc}</div>
                </div>
              </div>

              {isIncomplete && onNavigateToStep && (
                <button
                  type="button"
                  onClick={() => onNavigateToStep(step.number)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer shrink-0"
                >
                  <span>Complete</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default KycSubmissionChecklist;