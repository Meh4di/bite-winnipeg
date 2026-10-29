import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { uploadImage, type ImageBucket } from "@/lib/bite";

export function ImagePick({
  bucket,
  userId,
  value,
  onChange,
  label,
  className = "h-32 w-full",
}: {
  bucket: ImageBucket;
  userId: string;
  value: string | null;
  onChange: (url: string) => void;
  label: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`relative grid cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-muted ${className}`}>
      {value ? (
        <img src={value} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="flex flex-col items-center gap-1 text-xs font-semibold text-muted-foreground">
          <ImagePlus className="size-6" />
          {busy ? "Uploading…" : label}
        </span>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            onChange(await uploadImage(bucket, userId, f));
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}
