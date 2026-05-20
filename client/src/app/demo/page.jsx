'use client';

import FileUpload from "@/components/ui/file-upload"

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-[#0F172A] mb-2">File Upload Component</h1>
          <p className="text-slate-500 font-medium">Interactive drag & drop with real-time progress simulation.</p>
        </div>
        <FileUpload onFileSelect={(file) => console.log("Selected:", file)} />
      </div>
    </main>
  );
}

