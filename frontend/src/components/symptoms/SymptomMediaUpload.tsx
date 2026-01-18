import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Camera, Upload, X, Image, Video, Loader2, 
  CheckCircle2, AlertCircle, FileImage 
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

interface MediaFile {
  id: string;
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
}

interface SymptomMediaUploadProps {
  appointmentId?: string;
  onFilesChange?: (files: MediaFile[]) => void;
  maxFiles?: number;
}

export const SymptomMediaUpload = ({ 
  appointmentId, 
  onFilesChange,
  maxFiles = 5 
}: SymptomMediaUploadProps) => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    // Check max files
    if (files.length + selectedFiles.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const newFiles: MediaFile[] = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Invalid file type. Use JPEG, PNG, WebP, MP4, or MOV`);
        continue;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: File too large. Maximum 10MB`);
        continue;
      }
      
      // Create preview
      const preview = URL.createObjectURL(file);
      
      newFiles.push({
        id: `file-${Date.now()}-${i}`,
        file,
        preview,
        uploading: false,
        uploaded: false
      });
    }
    
    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    onFilesChange?.(updatedFiles);
    
    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    const updatedFiles = files.filter(f => f.id !== id);
    setFiles(updatedFiles);
    onFilesChange?.(updatedFiles);
  };

  const uploadFile = async (mediaFile: MediaFile) => {
    if (!appointmentId) {
      toast.error("Cannot upload without appointment ID");
      return;
    }

    // Update state to uploading
    setFiles(prev => prev.map(f => 
      f.id === mediaFile.id ? { ...f, uploading: true } : f
    ));

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Please sign in to upload");
      }

      const formData = new FormData();
      formData.append('file', mediaFile.file);
      formData.append('description', `Symptom media: ${mediaFile.file.name}`);

      const response = await fetch(
        `${BACKEND_URL}/api/appointments/${appointmentId}/media`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Upload failed");
      }

      // Update state to uploaded
      setFiles(prev => prev.map(f => 
        f.id === mediaFile.id ? { ...f, uploading: false, uploaded: true } : f
      ));
      
      toast.success(`${mediaFile.file.name} uploaded`);
    } catch (error) {
      console.error("Upload error:", error);
      setFiles(prev => prev.map(f => 
        f.id === mediaFile.id ? { 
          ...f, 
          uploading: false, 
          error: error instanceof Error ? error.message : "Upload failed" 
        } : f
      ));
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const uploadAllFiles = async () => {
    const pendingFiles = files.filter(f => !f.uploaded && !f.uploading);
    for (const file of pendingFiles) {
      await uploadFile(file);
    }
  };

  const isImage = (file: File) => file.type.startsWith('image/');
  const isVideo = (file: File) => file.type.startsWith('video/');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base">Upload Photos/Videos of Symptoms</Label>
        <span className="text-sm text-muted-foreground">{files.length}/{maxFiles} files</span>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Upload images of rashes, wounds, swelling, or videos showing symptoms. 
        This helps the clinician assess your condition.
      </p>

      {/* Upload area */}
      <div 
        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 rounded-full bg-primary/10">
            <Camera className="w-6 h-6 text-primary" />
          </div>
          <p className="font-medium">Click to upload or drag files here</p>
          <p className="text-sm text-muted-foreground">
            JPEG, PNG, WebP, MP4, MOV • Max 10MB each
          </p>
        </div>
      </div>

      {/* File previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {files.map((mediaFile) => (
            <Card key={mediaFile.id} className="relative overflow-hidden">
              <CardContent className="p-2">
                {/* Preview */}
                <div className="aspect-square relative rounded-lg overflow-hidden bg-muted">
                  {isImage(mediaFile.file) ? (
                    <img 
                      src={mediaFile.preview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : isVideo(mediaFile.file) ? (
                    <video 
                      src={mediaFile.preview} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileImage className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Type badge */}
                  <div className="absolute top-2 left-2">
                    {isImage(mediaFile.file) ? (
                      <div className="p-1 rounded bg-black/50">
                        <Image className="w-3 h-3 text-white" />
                      </div>
                    ) : (
                      <div className="p-1 rounded bg-black/50">
                        <Video className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Status overlay */}
                  {mediaFile.uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                  {mediaFile.uploaded && (
                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                  )}
                  {mediaFile.error && (
                    <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                  )}
                </div>
                
                {/* File name */}
                <p className="text-xs truncate mt-2 text-muted-foreground">
                  {mediaFile.file.name}
                </p>
                
                {/* Remove button */}
                {!mediaFile.uploading && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(mediaFile.id);
                    }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload all button */}
      {files.length > 0 && appointmentId && files.some(f => !f.uploaded && !f.uploading) && (
        <Button 
          onClick={uploadAllFiles}
          className="w-full"
          disabled={files.every(f => f.uploaded || f.uploading)}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload {files.filter(f => !f.uploaded).length} File(s)
        </Button>
      )}
    </div>
  );
};

export default SymptomMediaUpload;
