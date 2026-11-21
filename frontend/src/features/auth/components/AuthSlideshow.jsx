import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const DEFAULT_AUTH_SLIDES = [
  "/slide-utility-pay.jpg",
  "/slide-merchant-analytics.jpg",
  "/slide-bulk-batch.jpg",
];

export function AuthSlideshow({ slides = DEFAULT_AUTH_SLIDES, intervalMs = 2500 }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [slides.length, intervalMs]);

  return (
    <div className="w-full lg:w-1/2 relative min-h-[460px] sm:min-h-[520px] lg:min-h-[600px] overflow-hidden bg-gradient-to-br from-[#f8fbfe] via-white to-[#edf5fc] flex items-center justify-center p-6 sm:p-10 group select-none">
      {/* Slide Visual Images with Crossfade */}
      {slides.map((imgSrc, idx) => (
        <div
          key={imgSrc}
          className={`absolute inset-0 flex items-center justify-center p-6 sm:p-10 transition-all duration-700 ease-in-out ${
            idx === currentSlide
              ? "opacity-100 scale-100 z-10"
              : "opacity-0 scale-95 pointer-events-none z-0"
          }`}
        >
          <img
            src={imgSrc}
            alt={`Slideshow illustration ${idx + 1}`}
            className="max-w-full max-h-[440px] sm:max-h-[480px] lg:max-h-[520px] w-auto h-auto object-contain rounded-2xl drop-shadow-[0_16px_36px_rgba(56,104,176,0.14)] select-none"
          />
        </div>
      ))}

      {/* Left / Right Arrow Navigation Buttons */}
      <button
        type="button"
        onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
        className="absolute left-4 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/80 shadow-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
        title="Previous slide"
      >
        <ChevronLeft size={18} />
      </button>

      <button
        type="button"
        onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
        className="absolute right-4 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/80 shadow-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
        title="Next slide"
      >
        <ChevronRight size={18} />
      </button>

      {/* Navigation Progress Indicators / Dots */}
      <div className="absolute bottom-6 z-20 flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200/60 shadow-xs">
        {slides.map((imgSrc, idx) => (
          <button
            key={imgSrc}
            type="button"
            onClick={() => setCurrentSlide(idx)}
            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
              idx === currentSlide
                ? "w-7 bg-blue-600 shadow-xs"
                : "w-2 bg-slate-300 hover:bg-slate-400"
            }`}
            title={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default AuthSlideshow;
