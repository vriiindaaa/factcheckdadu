import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";

export function ApiKeyMissingDialog({
  open,
  onOpenChange,
  onOpenSettings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenSettings: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
            <KeyRound className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Gemini API key required</DialogTitle>
          <DialogDescription className="text-center">
            To fact-check your PDF, please add your Gemini API key in Settings. Your key stays in this browser only.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onOpenSettings();
            }}
          >
            Open Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}