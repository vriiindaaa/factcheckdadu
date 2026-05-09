import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MustacheLogo } from "@/components/MustacheLogo";
import { extractPdfText } from "@/lib/pdf";
import { extractClaims, verifyClaim, type Claim, type Verdict } from "@/lib/gemini";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

type VerdictName = Verdict["verdict"];

type ClaimResult = Claim & Verdict;

function Index() {
  const [stage, setStage] = useState<"idle" | "extracting" | "verifying" | "done">("idle");
  const [results, setResults] = useState<ClaimResult[]>([]);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [statusMsg, setStatusMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file.");
      return;
    }
    setFileName(file.name);
    setResults([]);
    setProgress({ current: 0, total: 0 });
    try {
      setStage("extracting");
      setStatusMsg("Reading PDF...");
      const text = await extractPdfText(file);
      if (!text.trim()) throw new Error("No readable text found in this PDF.");

      setStatusMsg("Extracting factual claims with AI...");
      const claims = await extractClaims(text);
      if (!claims.length) throw new Error("No factual claims found in this PDF.");

      setStage("verifying");
      setProgress({ current: 0, total: claims.length });

      const verified: ClaimResult[] = [];
      for (let i = 0; i < claims.length; i++) {
        const c = claims[i];
        setStatusMsg(`Verifying claim ${i + 1} of ${claims.length}...`);
        try {
          const v = await verifyClaim(c.claim);
          verified.push({ ...c, ...v });
        } catch (e) {
          verified.push({
            ...c,
            verdict: "Inaccurate",
            explanation: e instanceof Error ? e.message : "Verification failed.",
            source: "",
          });
        }
        setResults([...verified]);
        setProgress({ current: i + 1, total: claims.length });
      }

      setStage("done");
      setStatusMsg("");
      toast.success("Fact-checking complete.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
      setStage("idle");
      setStatusMsg("");
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const counts = useMemo(
    () =>
      results.reduce(
        (a, r) => {
          if (r.verdict === "Verified") a.v++;
          else if (r.verdict === "Inaccurate") a.i++;
          else if (r.verdict === "False") a.f++;
          return a;
        },
        { v: 0, i: 0, f: 0 },
      ),
    [results],
  );

  const downloadCsv = () => {
    const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["ID", "Category", "Claim", "Verdict", "Explanation", "Source"],
      ...results.map((r) => [r.id, r.category, r.claim, r.verdict, r.explanation, r.source]),
    ];
    const csv = rows.map((r) => r.map((c) => esc(String(c))).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factcheck-${fileName.replace(/\.pdf$/i, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setResults([]);
    setStage("idle");
    setFileName("");
    setProgress({ current: 0, total: 0 });
  };

  const busy = stage === "extracting" || stage === "verifying";
  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ background: "var(--gradient-hero)" }}>
      <Toaster theme="dark" />

      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-primary)" }}
        />
        <div
          className="absolute bottom-[-200px] right-[-120px] h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--gradient-primary)" }}
        />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="text-primary">
            <MustacheLogo className="h-9 w-9" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Fact check dadu</h1>
            <p className="text-xs text-muted-foreground">AI PDF fact-checker · Powered by Groq</p>
          </div>
        </div>
        {(stage === "done" || busy) && (
          <Button variant="outline" onClick={reset} disabled={busy}>
            <RefreshCw className="mr-2 h-4 w-4" /> New PDF
          </Button>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        {stage === "idle" && (
          <section className="pt-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto max-w-2xl text-center"
            >
              <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI-powered · Drop a PDF, get instant fact-checked claims
              </div>
              <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
                Fact-check any PDF in{" "}
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-text)" }}>
                  seconds.
                </span>
              </h2>
              <p className="mt-4 text-muted-foreground">
                Upload a PDF, AI extracts factual claims and verifies each one with a verdict, reasoning, and source.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`mx-auto mt-10 max-w-2xl cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
                dragOver ? "border-primary bg-primary/10" : "border-border bg-card/50 hover:border-primary/60 hover:bg-card"
              }`}
              style={{ boxShadow: dragOver ? "var(--shadow-glow)" : undefined }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Upload className="mx-auto h-12 w-12 text-primary" />
              <p className="mt-4 text-lg font-medium">Drop your PDF here</p>
              <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
            </motion.div>
          </section>
        )}

        {busy && (
          <section className="pt-16">
            <div
              className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <h3 className="mt-4 text-xl font-semibold">{statusMsg || "Working..."}</h3>
              <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" /> {fileName}
              </p>
              {stage === "verifying" && progress.total > 0 && (
                <div className="mt-5 space-y-2">
                  <Progress value={pct} />
                  <p className="text-xs text-muted-foreground">
                    {progress.current} / {progress.total} claims · {pct}%
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {(stage === "done" || (stage === "verifying" && results.length > 0)) && (
          <section className="pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-3">
                <SummaryPill icon={<CheckCircle2 className="h-4 w-4" />} label="Verified" count={counts.v} tone="success" />
                <SummaryPill icon={<AlertTriangle className="h-4 w-4" />} label="Inaccurate" count={counts.i} tone="warning" />
                <SummaryPill icon={<XCircle className="h-4 w-4" />} label="False" count={counts.f} tone="destructive" />
              </div>
              {stage === "done" && (
                <Button onClick={downloadCsv}>
                  <Download className="mr-2 h-4 w-4" /> Download CSV
                </Button>
              )}
            </div>

            <div
              className="mt-6 rounded-2xl border border-border bg-card/55 p-4 backdrop-blur"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-semibold">Fact-check results</h2>
                  <p className="text-sm text-muted-foreground">
                    {fileName} · {results.length} claims
                  </p>
                </div>
                <Badge variant="outline">Powered by Groq</Badge>
              </div>

              <div className="mt-4 space-y-4">
                <AnimatePresence initial={false}>
                  {results.map((r) => (
                    <ClaimCard key={r.id} r={r} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function SummaryPill({
  icon,
  label,
  count,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: "success" | "warning" | "destructive";
}) {
  const colors = {
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    destructive: "bg-destructive/15 text-destructive border-destructive/30",
  }[tone];
  return (
    <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${colors}`}>
      {icon}
      <span>{label}</span>
      <span className="rounded-full bg-background/30 px-2 py-0.5 text-xs">{count}</span>
    </div>
  );
}

function ClaimCard({ r }: { r: ClaimResult }) {
  const tone =
    r.verdict === "Verified"
      ? { badge: "bg-success/20 text-success border-success/40", border: "border-l-success" }
      : r.verdict === "False"
        ? { badge: "bg-destructive/20 text-destructive border-destructive/40", border: "border-l-destructive" }
        : { badge: "bg-warning/20 text-warning border-warning/40", border: "border-l-warning" };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} layout>
      <Card className={`border-l-4 p-5 ${tone.border}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">{r.category}</Badge>
          <Badge className={`border ${tone.badge}`}>{r.verdict}</Badge>
        </div>
        <p className="mt-3 font-medium text-foreground">{r.claim}</p>
        {r.explanation && <p className="mt-2 text-sm text-muted-foreground">{r.explanation}</p>}
        {r.source && (
          <a
            href={r.source}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> {r.source}
          </a>
        )}
      </Card>
    </motion.div>
  );
}
