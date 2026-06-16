import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle2, ArrowLeft } from "lucide-react";

type Resident = { id: string; houseNo: string };
type Settings = { rate: number; frequency: string; qrKey: string | null; bgKey?: string | null; bankName?: string | null; accountNumber?: string | null; tenantName?: string | null };

export const Route = createFileRoute("/payment")({
  component: PaymentPage,
});

function PaymentPage() {
  const { data: residents } = useQuery<Resident[]>({
    queryKey: ["residents:list"],
    queryFn: async () => {
      const res = await apiFetch("/api/residents?page=1&pageSize=1000");
      if (res.status === 204) return [];
      const json = await res.json();
      return (json.data || []).map((r: any) => ({ id: r.id, houseNo: r.houseNo }));
    },
  });
  const { data: settings } = useQuery<Settings | null>({
    queryKey: ["billing:settings"],
    queryFn: async () => {
      const res = await apiFetch("/api/billing/settings");
      if (res.status === 204) return null;
      return await res.json();
    },
  });

  const [houseId, setHouseId] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastHouse, setLastHouse] = useState("");
  const qrUrl = useMemo(() => (settings?.qrKey ? `/api/r2/${settings.qrKey}` : ""), [settings]);
  const bgUrl = useMemo(() => (settings?.bgKey ? `/api/r2/${settings.bgKey}` : ""), [settings]);

  useEffect(() => {
    if (settings?.rate && !amount) setAmount(String(settings.rate));
  }, [settings?.rate]);

  async function handleSubmit() {
    try {
      if (!houseId) return toast.error("Please select a house");
      const amt = Number(amount);
      if (!amt || isNaN(amt) || amt <= 0) return toast.error("Amount is invalid");
      if (!file) return toast.error("Please upload a receipt");

      setSubmitting(true);
      const key = `receipts/${crypto.randomUUID()}-${file.name.replace(/\s+/g, "_")}`;
      const put = await apiFetch(`/api/r2/${key}`, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) throw new Error("Failed to upload receipt");

      const post = await fetch("/api/billing/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId, amount: amt, receiptKey: key }),
      });
      if (!post.ok) throw new Error("Failed to submit payment");

      const house = (residents || []).find((r) => r.id === houseId);
      setLastHouse(house?.houseNo || houseId);
      setSubmitted(true);
    } catch (e: any) {
      toast.error(e.message || "Submission error");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setHouseId("");
    setAmount(settings?.rate ? String(settings.rate) : "");
    setFile(null);
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <>
        {bgUrl && <img src={bgUrl} alt="Background" className="pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover opacity-50" />}
        <div className="min-h-screen flex items-center justify-center px-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="flex justify-center mb-2">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-2xl">Thank You!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your payment for <span className="font-medium text-foreground">House {lastHouse}</span> has been submitted successfully.
              </p>
              <p className="text-sm text-muted-foreground">
                An admin will review and confirm your payment shortly.
              </p>
              <Button className="w-full gap-2" onClick={resetForm}>
                <ArrowLeft className="h-4 w-4" />
                Submit Another Payment
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      {bgUrl && <img src={bgUrl} alt="Background" className="pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover opacity-50" />}
      <div className="min-h-screen flex flex-col sm:flex-row items-center justify-center gap-8 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Payment For {settings?.tenantName || "Komuniti Kita"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {qrUrl ? (
              <img src={qrUrl} alt="Payment QR" className="h-72 w-72 rounded border" />
            ) : (
              <div className="h-72 w-72 rounded border flex items-center justify-center text-muted-foreground">No QR configured</div>
            )}
            {settings && (
              <div className="text-sm text-muted-foreground">
                Rate: RM {settings.rate} &bull; {settings.frequency}
              </div>
            )}
            {settings?.bankName && settings?.accountNumber && (
              <div className="w-full space-y-1 border-t pt-3 text-sm">
                <p className="font-medium text-foreground">Bank Transfer</p>
                <p className="text-muted-foreground">{settings.bankName}</p>
                <p className="text-muted-foreground font-mono">{settings.accountNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Submit Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>House Number</Label>
              <Select value={houseId} onValueChange={setHouseId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select house" />
                </SelectTrigger>
                <SelectContent>
                  {(residents || []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.houseNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Receipt Image</Label>
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
