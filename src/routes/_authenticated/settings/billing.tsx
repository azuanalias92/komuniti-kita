import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";

type Settings = { rate: number; frequency: string; qrKey: string | null; bgKey?: string | null; startDate?: string };

export const Route = createFileRoute("/_authenticated/settings/billing")({
  beforeLoad: () => {
    throw redirect({ to: "/billing/settings" });
  },
});

export function BillingSettings() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.auth.accessToken);
  const { data } = useQuery<Settings | null>({
    queryKey: ["billing:settings"],
    queryFn: async () => {
      const res = await fetch("/api/billing/settings");
      if (res.status === 204) return null;
      return await res.json();
    },
  });

  const [rate, setRate] = useState<string>(data?.rate ? String(data.rate) : "");
  const [frequency, setFrequency] = useState<string>(data?.frequency || "monthly");
  const [startDate, setStartDate] = useState<string>(data?.startDate || "");
  const [file, setFile] = useState<File | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (payload: { rate: number; frequency: string; qrKey: string | null; bgKey: string | null; startDate: string }) => {
      const res = await fetch("/api/billing/settings", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let msg = "Failed to save settings";
        try {
          const j = JSON.parse(text);
          msg = j.error || msg;
        } catch {
          if (text) msg = text;
        }
        throw new Error(msg);
      }
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing:settings"] });
      toast.success("Settings saved");
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  async function handleSave() {
    const r = Number(rate);
    if (!r || isNaN(r) || r <= 0) return toast.error("Invalid rate");
    if (!startDate) return toast.error("Start date is required");
    let qrKey: string | null = data?.qrKey || null;
    let bgKey: string | null = data?.bgKey || null;
    if (file) {
      const key = `qr/${crypto.randomUUID()}-${file.name.replace(/\s+/g, "_")}`;
      const put = await fetch(`/api/r2/${key}`, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) return toast.error("QR upload failed");
      qrKey = key;
    }
    if (bgFile) {
      const key = `bg/${crypto.randomUUID()}-${bgFile.name.replace(/\s+/g, "_")}`;
      const put = await fetch(`/api/r2/${key}`, { method: "PUT", headers: { "content-type": bgFile.type || "application/octet-stream" }, body: bgFile });
      if (!put.ok) return toast.error("Background upload failed");
      bgKey = key;
    }
    await mutateAsync({ rate: r, frequency, qrKey, bgKey, startDate });
  }

  const qrUrl = data?.qrKey ? `/api/r2/${data.qrKey}` : "";
  const bgUrl = data?.bgKey ? `/api/r2/${data.bgKey}` : "";

  useEffect(() => {
    if (data) {
      setRate(String(data.rate));
      setFrequency(String(data.frequency));
      setStartDate(String(data.startDate || ""));
    }
  }, [data]);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Rate</Label>
          <Input type="number" min={0} step={0.01} value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Payment Frequency</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="semi-annual">Every 6 Months</SelectItem>
              <SelectItem value="annual">Annually</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>QR Code Image</Label>
          {qrUrl && <img src={qrUrl} alt="QR" className="h-40 w-40 border rounded" />}
          <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div className="space-y-2">
          <Label>Background Image</Label>
          {bgUrl && <img src={bgUrl} alt="Background preview" className="h-40 w-40 border rounded" />}
          <Input type="file" accept="image/*" onChange={(e) => setBgFile(e.target.files?.[0] || null)} />
        </div>
        <Button disabled={isPending} onClick={handleSave}>
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
