"use client";
 
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";
import {
  UploadCloud,
  File as FileIcon,
  Trash2,
  Loader,
  CheckCircle,
} from "lucide-react";
 
export default function FileUpload({ onFileSelect }) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);
 
  // Process dropped or selected files
  const handleFiles = (fileList) => {
    const newFiles = Array.from(fileList).map((file) => ({
      id: `${URL.createObjectURL(file)}-${Date.now()}`,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      progress: 0,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      file,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((f) => {
      simulateUpload(f.id);
      if (onFileSelect) onFileSelect(f.file);
    });
  };
 
  // Simulate upload progress
  const simulateUpload = (id) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, progress: Math.min(progress, 100) } : f,
        ),
      );
      if (progress >= 100) {
        clearInterval(interval);
        if (navigator.vibrate) navigator.vibrate(100);
      }
    }, 300);
  };
 
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };
 
  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
 
  const onDragLeave = () => setIsDragging(false);
 
  const onSelect = (e) => {
    if (e.target.files) handleFiles(e.target.files);
  };
 
  const formatFileSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };
 
  return (
    <div className="w-full max-w-3xl mx-auto p-2">
      {/* Drop zone */}
      <motion.div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        initial={false}
        animate={{
          borderColor: isDragging ? "#7C3AED" : "#E2E8F0",
          scale: isDragging ? 1.02 : 1,
        }}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className={clsx(
          "relative rounded-3xl p-8 md:p-12 text-center cursor-pointer bg-[#F8FAFC] border-2 border-dashed border-[#E2E8F0] hover:border-[#7C3AED] shadow-sm hover:shadow-md transition-all group overflow-hidden",
          isDragging && "ring-4 ring-purple-400/20 border-[#7C3AED]",
        )}
      >
        {/* Background Sparkles Effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-10 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-500 to-transparent animate-glow-slow" />
        </div>

        <div className="flex flex-col items-center gap-5 relative z-10">
          <motion.div
            animate={{ y: isDragging ? [-5, 0, -5] : 0 }}
            transition={{
              duration: 1.5,
              repeat: isDragging ? Infinity : 0,
              ease: "easeInOut",
            }}
            className="relative"
          >
            <motion.div
              animate={{
                opacity: isDragging ? [0.5, 1, 0.5] : 1,
                scale: isDragging ? [0.95, 1.05, 0.95] : 1,
              }}
              transition={{
                duration: 2,
                repeat: isDragging ? Infinity : 0,
                ease: "easeInOut",
              }}
              className="absolute -inset-4 bg-purple-400/10 rounded-full blur-md"
              style={{ display: isDragging ? "block" : "none" }}
            />
            <UploadCloud
              className={clsx(
                "w-16 h-16 md:w-20 md:h-20 drop-shadow-sm",
                isDragging
                  ? "text-[#7C3AED]"
                  : "text-slate-400 group-hover:text-[#7C3AED] transition-colors duration-300",
              )}
            />
          </motion.div>
 
          <div className="space-y-2">
            <h3 className="text-xl md:text-2xl font-black text-[#0F172A]">
              {isDragging
                ? "Drop files here"
                : files.length
                  ? "Add more files"
                  : "Upload your source material"}
            </h3>
            <p className="text-[#64748B] md:text-lg max-w-md mx-auto font-medium">
              {isDragging ? (
                <span className="font-bold text-[#7C3AED]">
                  Release to process
                </span>
              ) : (
                <>
                  Drag & drop files here, or{" "}
                  <span className="text-[#7C3AED] font-bold underline decoration-2 underline-offset-4">browse</span>
                </>
              )}
            </p>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
              PDF, PNG, JPG, or TXT up to 10MB
            </p>
          </div>
 
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={onSelect}
            accept="image/*,application/pdf,video/*,audio/*,text/*,application/zip"
          />
        </div>
      </motion.div>
 
      {/* Uploaded files list */}
      <div className="mt-8">
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-between items-center mb-3 px-2"
            >
              <h3 className="font-black text-lg md:text-xl text-[#0F172A]">
                Files added ({files.length})
              </h3>
              {files.length > 1 && (
                <button
                  onClick={() => setFiles([])}
                  className="text-xs font-black uppercase tracking-widest px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 hover:text-red-600 transition-all"
                >
                  Clear all
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
 
        <div
          className={clsx(
            "flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar",
            files.length > 3 && "max-h-96",
          )}
        >
          <AnimatePresence>
            {files.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="px-4 py-4 flex items-start gap-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm hover:shadow-md transition-all duration-200"
              >
                {/* Thumbnail */}
                <div className="relative flex-shrink-0">
                  {file.type.startsWith("image/") && file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover border border-[#E2E8F0] shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#7C3AED]">
                      <FileIcon size={32} />
                    </div>
                  )}
                  {file.progress === 100 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute -right-2 -bottom-2 bg-white rounded-full shadow-md"
                    >
                      <CheckCircle className="w-6 h-6 text-[#22C55E]" />
                    </motion.div>
                  )}
                </div>
 
                {/* File info & progress */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex flex-col gap-1 w-full">
                    {/* Filename */}
                    <div className="flex items-center gap-2 min-w-0">
                      <h4
                        className="font-black text-base md:text-lg truncate text-[#0F172A]"
                        title={file.name}
                      >
                        {file.name}
                      </h4>
                    </div>
 
                    {/* Details & remove/loading */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-slate-400">
                        {formatFileSize(file.size)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-[#7C3AED]">
                          {Math.round(file.progress)}%
                        </span>
                        {file.progress < 100 ? (
                          <Loader className="w-4 h-4 animate-spin text-[#7C3AED]" />
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFiles((prev) =>
                                prev.filter((f) => f.id !== file.id),
                              );
                            }}
                            className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
 
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${file.progress}%` }}
                      transition={{
                        duration: 0.4,
                      }}
                      className={clsx(
                        "h-full rounded-full",
                        file.progress < 100 ? "bg-[#7C3AED]" : "bg-[#22C55E]",
                      )}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

