import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

type UploadStage = "uploading" | "validating";

type PresignedPostResponse = {
  importJobId: string;
  presignedPost: { url: string; fields: Record<string, string> };
};

// Progress stays below 100 until S3 has answered, so the bar never claims more than we know.
const MAX_PROGRESS_BEFORE_S3_REPLY = 99;

function postToS3(
  presignedPost: PresignedPostResponse["presignedPost"],
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  const formData = new FormData();
  Object.entries(presignedPost.fields).forEach(([key, value]) => formData.append(key, value));
  // S3 requires the file to be the last field of the form.
  formData.append("file", file);

  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", presignedPost.url);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(Math.min(percent, MAX_PROGRESS_BEFORE_S3_REPLY));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`S3 Upload failed with status ${request.status}`));
    };
    request.onerror = () => reject(new Error("Network error during S3 upload"));
    request.send(formData);
  });
}

/** Uploads a spreadsheet straight to S3 through a presigned POST and tracks progress. */
export function useImportUpload(onUploaded: () => void) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState<UploadStage | null>(null);

  function reset() {
    setProgress(null);
    setStage(null);
  }

  const mutation = useMutation({
    mutationFn: async ({ branchId, file }: { branchId: string; file: File }) => {
      setProgress(0);
      setStage("uploading");

      const response = await apiRequest<PresignedPostResponse>("/imports/presigned-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, fileName: file.name }),
      });

      await postToS3(response.presignedPost, file, setProgress);
      setProgress(100);
      setStage("validating");

      return { id: response.importJobId };
    },
    onSuccess: () => {
      reset();
      onUploaded();
      void queryClient.invalidateQueries({ queryKey: ["imports"] });
    },
    onError: reset,
  });

  return {
    upload: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
    progress,
    stage,
    reset,
  };
}
