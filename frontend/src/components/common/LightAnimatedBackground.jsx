import React from "react";

export function LightAnimatedBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
      {/* Soft gradient blur spheres */}
      <div className="absolute -top-[15%] -left-[10%] w-[520px] h-[520px] rounded-full bg-gradient-to-br from-blue-300/35 to-indigo-200/25 blur-3xl animate-pulse" />
      <div className="absolute top-[35%] -right-[12%] w-[640px] h-[640px] rounded-full bg-gradient-to-br from-cyan-200/40 via-sky-100/30 to-blue-200/25 blur-3xl" />
      <div className="absolute -bottom-[15%] left-[25%] w-[580px] h-[580px] rounded-full bg-gradient-to-tr from-sky-200/30 to-blue-300/25 blur-3xl" />

      {/* Subtle micro-dot pattern overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#3868b0_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.035]" />
    </div>
  );
}

export default LightAnimatedBackground;

