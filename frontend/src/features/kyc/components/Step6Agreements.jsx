import React, { useState, useEffect, useRef } from "react";
import { 
  Menu,
  Minus,
  Plus,
  Maximize2,
  RotateCw,
  Download, 
  Printer, 
  MoreVertical,
  HardDrive
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { getAgreementDetails } from "../../../api/kyc.api";

export function Step6Agreements({ 
  formData, 
  onChange, 
  onNext, 
  isSavingStep = false 
}) {
  const [agreementData, setAgreementData] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [rotation, setRotation] = useState(0);
  const docContainerRef = useRef(null);

  // Load dynamic agreement details from backend
  useEffect(() => {
    let isMounted = true;
    async function loadAgreement() {
      try {
        const res = await getAgreementDetails();
        if (isMounted && res?.data) {
          setAgreementData(res.data);
          if (res.data.isAccepted && !formData.agreedTerms) {
            onChange("agreedTerms", true);
          }
        }
      } catch (err) {
        // Fallback to local data gracefully
      }
    }
    loadAgreement();
    return () => {
      isMounted = false;
    };
  }, []);

  // Format date as in reference screenshot: "12 October 2026"
  const agreementDate = agreementData?.signSection?.date || new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Dynamic merchant details from verified state
  const agentName = agreementData?.agentDetails?.name || formData.fullName || "[Agent Name]";
  const agentCity = agreementData?.agentDetails?.city || formData.city || "[City]";
  const agentMobile = agreementData?.agentDetails?.mobile || formData.phone || "[Mobile Number]";
  const documentId = agreementData?.id || "4cfb7c48-5913-44e0-8b2c-5e75b346ff14";

  // Clauses list verbatim from screenshot
  const clauses = [
    "I hereby undertake to use Payment Gateway services with my \"user ID\" only after agreeing to the online agreement on AquaPay portal.",
    "I hereby declare that I will use my own Credit Card/Debit Card/Net banking/UPI only.",
    "In case of any chargeback or fraud transaction claim, AquaPay reserves the right to recover the amount.",
    "AquaPay may suspend settlement during suspicious activities.",
    "I agree to use services only for legal business purposes.",
    "I will not tamper, hack, or misuse the services.",
    "AquaPay shall not be liable for any damages arising from misuse.",
    "I confirm all information provided by me is correct.",
    "I do not have any criminal background.",
    "This declaration is made voluntarily and knowingly."
  ];

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 15, 145));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 15, 75));
  };

  const handleFit = () => {
    setZoomLevel(100);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Pure Agreement PDF generator (only agreement content, never page layout)
  const downloadAgreementPdf = () => {
    try {
      toast.loading("Generating AquaPay Agent Agreement PDF...", { id: "pdf-gen" });
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;

      // Title: Bold, Underlined
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      const title = "AquaPay Agent Agreement";
      const titleWidth = doc.getTextWidth(title);
      const titleX = (pageWidth - titleWidth) / 2;
      let y = 24;
      doc.text(title, titleX, y);
      doc.setDrawColor(30, 30, 30);
      doc.setLineWidth(0.4);
      doc.line(titleX, y + 1.5, titleX + titleWidth, y + 1.5);

      y += 12;

      // Preamble
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);

      const p1 = `This Agent Agreement ("Agreement") is made on this ${agreementDate} by and between:`;
      const splitP1 = doc.splitTextToSize(p1, contentWidth);
      doc.text(splitP1, margin, y);
      y += splitP1.length * 5.5 + 2.5;

      const p2 = `AquaPay, a company incorporated under the Companies Act, 2013, hereinafter referred to as the "Company".`;
      const splitP2 = doc.splitTextToSize(p2, contentWidth);
      doc.text(splitP2, margin, y);
      y += splitP2.length * 5.5 + 2.5;

      doc.setFont("helvetica", "bold");
      doc.text("AND", margin, y);
      y += 6.5;

      doc.setFont("helvetica", "normal");
      const p3 = `${agentName}, residing at ${agentCity}, hereinafter referred to as the "Agent"`;
      const splitP3 = doc.splitTextToSize(p3, contentWidth);
      doc.text(splitP3, margin, y);
      y += splitP3.length * 5.5 + 5;

      // Clauses 1 to 10
      clauses.forEach((clause, index) => {
        const numText = `${index + 1}.  `;
        const numWidth = doc.getTextWidth(numText);
        const clauseLines = doc.splitTextToSize(clause, contentWidth - numWidth);

        doc.text(numText, margin, y);
        doc.text(clauseLines, margin + numWidth, y);
        y += clauseLines.length * 5.2 + 3.2;
      });

      y += 4;
      // Divider Line
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // Signature Block
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(`Date: ${agreementDate}`, margin, y);
      y += 5.5;
      doc.text(`Place: ${agentCity}`, margin, y);
      y += 5.5;
      doc.text(`Signature Name: ${agentName}`, margin, y);
      y += 5.5;
      doc.text(`Mobile Number: ${agentMobile}`, margin, y);
      y += 11;

      // Disclaimer
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      const disclaimer = "This is a system generated document. No physical signature required.";
      const discWidth = doc.getTextWidth(disclaimer);
      doc.text(disclaimer, (pageWidth - discWidth) / 2, y);

      // Save file as PDF
      doc.save(`AquaPay_Agent_Agreement_${documentId.slice(0, 8)}.pdf`);
      toast.success("AquaPay Agent Agreement PDF downloaded successfully!", { id: "pdf-gen" });
    } catch (err) {
      toast.error("Failed to generate PDF. Please try again.", { id: "pdf-gen" });
    }
  };

  // Print only the agreement document
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full">
      {/* Title above viewer */}
      <h3 className="text-xs sm:text-sm font-semibold text-slate-800 mb-2">
        AquaPay Agent Agreement
      </h3>

      {/* PDF Viewer Container */}
      <div className="rounded-lg overflow-hidden border border-slate-300 shadow-sm bg-[#525659]">
        
        {/* PDF Top Toolbar */}
        <div className="bg-[#323639] text-white px-3 sm:px-4 py-2 flex items-center justify-between text-xs select-none">
          {/* Left: Menu & Document ID */}
          <div className="flex items-center space-x-3 overflow-hidden">
            <button 
              type="button" 
              className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
              title="Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300 text-[11px] truncate max-w-[140px] sm:max-w-[260px]">
              {documentId}
            </span>
          </div>

          {/* Center: Page & Zoom Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-slate-300">
            <span className="text-[11px] font-medium px-1">1 / 1</span>
            
            <div className="h-3.5 w-px bg-slate-600 hidden sm:block" />

            <div className="flex items-center space-x-1">
              <button 
                type="button" 
                onClick={handleZoomOut}
                className="p-1 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
                title="Zoom Out"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1 w-10 text-center">
                {zoomLevel}%
              </span>
              <button 
                type="button" 
                onClick={handleZoomIn}
                className="p-1 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
                title="Zoom In"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-3.5 w-px bg-slate-600 hidden sm:block" />

            <button 
              type="button" 
              onClick={handleFit}
              className="p-1 hover:text-white hover:bg-white/10 rounded transition cursor-pointer hidden sm:inline-flex"
              title="Fit to Page"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <button 
              type="button" 
              onClick={handleRotate}
              className="p-1 hover:text-white hover:bg-white/10 rounded transition cursor-pointer hidden sm:inline-flex"
              title="Rotate"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-1 sm:space-x-2 text-slate-300">
            <button 
              type="button" 
              onClick={downloadAgreementPdf}
              className="p-1 hover:text-white hover:bg-white/10 rounded transition cursor-pointer hidden sm:inline-flex"
              title="Save to Drive"
            >
              <HardDrive className="w-3.5 h-3.5" />
            </button>

            <button 
              type="button" 
              onClick={downloadAgreementPdf}
              className="p-1 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
              title="Download Agreement PDF"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button 
              type="button" 
              onClick={handlePrint}
              className="p-1 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
              title="Print"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>

            <button 
              type="button" 
              className="p-1 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
              title="More options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body with Vertical Scroll (Clean Block Layout - No Cutoffs) */}
        <div 
          ref={docContainerRef}
          className="p-4 sm:p-8 max-h-[620px] overflow-y-auto overflow-x-auto bg-[#525659] block"
        >
          {/* Centered White Document Sheet with Natural Height Flow */}
          <div 
            id="agreement-printable-doc"
            style={{
              maxWidth: `${(42 * zoomLevel) / 100}rem`,
              transform: rotation ? `rotate(${rotation}deg)` : undefined,
              transition: "max-width 0.15s ease-out, transform 0.2s ease-out",
            }}
            className="w-full mx-auto bg-white shadow-2xl p-8 sm:p-14 text-slate-900 font-sans leading-relaxed text-xs sm:text-sm select-text my-2"
          >
            {/* Document Title */}
            <div className="text-center mb-6">
              <h2 className="text-base sm:text-lg font-bold tracking-tight inline-block underline underline-offset-4 decoration-2">
                AquaPay Agent Agreement
              </h2>
            </div>

            {/* Preamble */}
            <div className="space-y-4 mb-6 text-slate-900 leading-normal">
              <p>
                This Agent Agreement (&quot;Agreement&quot;) is made on this <strong>{agreementDate}</strong> by and between:
              </p>
              
              <p>
                <strong>AquaPay</strong>, a company incorporated under the Companies Act, 2013, hereinafter referred to as the &quot;Company&quot;.
              </p>

              <p className="font-bold tracking-wide">
                AND
              </p>

              <p>
                <strong>{agentName}</strong>, residing at {agentCity}, hereinafter referred to as the &quot;Agent&quot;
              </p>
            </div>

            {/* Numbered Clauses 1 to 10 */}
            <div className="space-y-3.5 mb-8 text-slate-900 leading-normal">
              {clauses.map((clause, idx) => (
                <div key={idx} className="flex items-start">
                  <span className="w-6 shrink-0 font-normal">{idx + 1}.</span>
                  <p className="flex-1">{clause}</p>
                </div>
              ))}
            </div>

            {/* Divider Line */}
            <hr className="border-t border-slate-400 my-6" />

            {/* Signature Block */}
            <div className="space-y-1.5 text-slate-900 font-medium text-xs sm:text-sm leading-relaxed mb-8">
              <p>Date: {agreementDate}</p>
              <p>Place: {agentCity}</p>
              <p>Signature Name: {agentName}</p>
              <p>Mobile Number: {agentMobile}</p>
            </div>

            {/* Disclaimer */}
            <div className="text-center pt-2">
              <p className="text-xs text-slate-500 font-normal">
                This is a system generated document. No physical signature required.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Acceptance Checkbox & Controls Below Viewer */}
      <div className="mt-4 space-y-2">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(formData.agreedTerms)}
            onChange={(e) => onChange("agreedTerms", e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs sm:text-sm text-slate-800 font-normal">
            I agree to all terms and conditions
          </span>
        </label>

        <div>
          <button
            type="button"
            onClick={downloadAgreementPdf}
            className="text-xs text-blue-600 hover:text-blue-800 underline font-normal cursor-pointer"
          >
            Download Agreement
          </button>
        </div>

        <hr className="border-t border-slate-200 mt-4 mb-4" />

        {/* Proceed & Continue Button */}
        <div>
          <button
            type="button"
            onClick={onNext}
            disabled={!formData.agreedTerms || isSavingStep}
            className={`px-5 py-2.5 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer ${
              formData.agreedTerms && !isSavingStep
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                : "bg-[#f4f4f4] text-[#b0b0b0] cursor-not-allowed border border-slate-200"
            }`}
          >
            {isSavingStep ? "Processing..." : "Proceed & Continue"}
          </button>
        </div>
      </div>

      {/* Print isolation styles: When printing, prints ONLY the document sheet, hides entire UI */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #agreement-printable-doc,
          #agreement-printable-doc * {
            visibility: visible !important;
          }
          #agreement-printable-doc {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 15mm 20mm !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default Step6Agreements;