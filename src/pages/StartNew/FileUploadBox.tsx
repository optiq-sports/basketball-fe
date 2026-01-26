import React, { useState, DragEvent, ChangeEvent, useEffect } from 'react';
import { FiX, FiUploadCloud, FiCheckCircle } from 'react-icons/fi';

interface FileUploadBoxProps {
  onClose: () => void;
}

const FileUploadBox: React.FC<FileUploadBoxProps> = ({ onClose }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) startUpload(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
  };

  const startUpload = (file: File) => {
    setFileName(file.name);
    setIsUploading(true);
    setUploadComplete(false);
    setProgress(0);

    const uploadInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(uploadInterval);
          setTimeout(() => {
            setIsUploading(false);
            setUploadComplete(true);
          }, 500);
          return 100;
        }
        return prev + 4;
      });
    }, 120);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-md bg-white/20">
      <div className="bg-[#F8F8F8]/90 backdrop-blur-xl rounded-2xl shadow-xl w-full max-w-md p-8 relative border border-white/30 transition-all duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <FiX size={20} />
        </button>

        <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
          Upload Player List
        </h2>

        {/* Upload box */}
        {!isUploading && !uploadComplete && (
          <div
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50/70' : 'border-gray-300 bg-white/60'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <FiUploadCloud className="text-gray-400 text-6xl mb-4" />
            <p className="text-gray-700 font-medium mb-2 text-center">
              Drag and drop files here
            </p>
            <p className="text-gray-400 text-sm mb-4">or</p>

            <label
              htmlFor="file-upload"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer transition-colors"
            >
              Browse files
            </label>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />

            {fileName && (
              <p className="mt-4 text-sm text-gray-600 font-medium">
                Selected: {fileName}
              </p>
            )}
          </div>
        )}

        {/* Uploading (Circular Progress) */}
        {isUploading && (
          <div className="flex flex-col items-center justify-center p-10">
            <div className="relative w-24 h-24">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  className="text-gray-200"
                  strokeWidth="6"
                  stroke="currentColor"
                  fill="transparent"
                  r="45"
                  cx="50%"
                  cy="50%"
                />
                <circle
                  className="text-blue-600 transition-all duration-150"
                  strokeWidth="6"
                  strokeDasharray={2 * Math.PI * 45}
                  strokeDashoffset={2 * Math.PI * 45 * (1 - progress / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="45"
                  cx="50%"
                  cy="50%"
                />
                
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-gray-700">
                {progress}%
              </span>
            </div>
            <p className="mt-4 text-gray-600 text-sm font-medium">
              Uploading {fileName}...
            </p>
          </div>
        )}

        {/* Upload Complete */}
        {uploadComplete && (
          <div className="flex flex-col items-center justify-center p-10">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <FiCheckCircle className="text-green-500 text-7xl" />
            </div>
            <h3 className="text-xl font-semibold text-green-600 mt-4">
              Upload Complete!
            </h3>
            <p className="text-gray-600 text-sm mb-6">
              <br />
              {/* {fileName ? `${fileName} uploaded successfully.` : 'File uploaded successfully.'} */}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploadBox;
