import React, { useState, DragEvent, ChangeEvent } from 'react';
import { FiX, FiUploadCloud, FiCheckCircle } from 'react-icons/fi';
import { useUploadPlayersExcel } from '../../api/hooks';

interface PlayerUploadResult {
  createdCount?: number;
  duplicatesCount?: number;
  duplicateMatches?: unknown[];
}

interface FileUploadBoxProps {
  teamId: string;
  onClose: () => void;
  onSuccess?: (result: PlayerUploadResult) => void;
}

const FileUploadBox: React.FC<FileUploadBoxProps> = ({ teamId, onClose, onSuccess }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<PlayerUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useUploadPlayersExcel();

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
    if (file) handleFile(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleFile = (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'xlsx') {
      setError('Only .xlsx files are supported');
      return;
    }
    setError(null);
    setFileName(file.name);
    setSelectedFile(file);
  };

  const startUpload = () => {
    if (!teamId || !selectedFile) return;
    setError(null);
    setUploadResult(null);
    uploadMutation.mutate(
      { teamId, file: selectedFile },
      {
        onSuccess: (data) => {
          const result = {
            createdCount: data?.createdCount,
            duplicatesCount: data?.duplicatesCount,
            duplicateMatches: data?.duplicateMatches as unknown[] | undefined,
          };
          setUploadResult(result);
          onSuccess?.(result);
        },
        onError: (err) => {
          setError(err.message ?? 'Upload failed');
        },
      }
    );
  };

  const handleClose = () => {
    setFileName(null);
    setSelectedFile(null);
    setUploadResult(null);
    setError(null);
    onClose();
  };

  if (!teamId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-md bg-white/20">
        <div className="bg-[#F8F8F8]/90 backdrop-blur-xl rounded-2xl shadow-xl w-full max-w-md p-8 relative border border-white/30">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">Upload Player List</h2>
          <p className="text-gray-600 text-sm mb-6">
            Excel upload requires teams to exist in the system. Create teams first in Teams Management, then use the
            Players Management page to upload your player list.
          </p>
          <button
            onClick={handleClose}
            className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (uploadResult) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-md bg-white/20">
        <div className="bg-[#F8F8F8]/90 backdrop-blur-xl rounded-2xl shadow-xl w-full max-w-md p-8 relative border border-white/30">
          <div className="flex flex-col items-center justify-center p-6">
            <FiCheckCircle className="text-green-500 text-7xl mb-4" />
            <h3 className="text-xl font-semibold text-green-600 mb-2">Upload Complete!</h3>
            <p className="text-gray-600 text-sm mb-4">
              Created: {uploadResult.createdCount ?? 0} | Duplicates skipped: {uploadResult.duplicatesCount ?? 0}
            </p>
            <button
              onClick={handleClose}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-md bg-white/20">
      <div className="bg-[#F8F8F8]/90 backdrop-blur-xl rounded-2xl shadow-xl w-full max-w-md p-8 relative border border-white/30 transition-all duration-300">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <FiX size={20} />
        </button>

        <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">Upload Player List</h2>

        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center justify-center p-10">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-600 text-sm font-medium">Uploading {fileName}...</p>
          </div>
        ) : (
          <>
            <div
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50/70' : 'border-gray-300 bg-white/60'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FiUploadCloud className="text-gray-400 text-6xl mb-4" />
              <p className="text-gray-700 font-medium mb-2 text-center">Drag and drop .xlsx file here</p>
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
                accept=".xlsx"
                className="hidden"
                onChange={handleFileChange}
              />

              {fileName && <p className="mt-4 text-sm text-gray-600 font-medium">Selected: {fileName}</p>}
            </div>

            {error && (
              <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            {uploadMutation.error && (
              <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {uploadMutation.error.message}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={handleClose} className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={startUpload}
                disabled={!selectedFile}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUploadBox;
