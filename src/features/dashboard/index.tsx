import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";
import { Overview } from "./components/overview";
import { RecentCheckins } from "./components/recent-checkins";
import { Users, CheckCircle, Car, UserCheck } from "lucide-react";
import { useTenantStore } from "@/stores/tenant-store";
import { apiFetch } from "@/lib/api";
import { parseISO, startOfDay, endOfDay, subDays, format } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { cn } from "@/lib/utils";

export function Dashboard() {
  const currentTenantId = useTenantStore((s) => s.currentTenantId);

  const { data: residentsData } = useQuery({
    queryKey: ["dashboard-residents", currentTenantId],
    queryFn: async () => {
      const res = await apiFetch("/api/residents");
      if (res.status === 204) return [];
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
  });

  const { data: residentsTotal } = useQuery({
    queryKey: ["dashboard-residents-total", currentTenantId],
    queryFn: async () => {
      const res = await apiFetch("/api/residents?page=1&pageSize=1");
      if (res.status === 204) return 0;
      if (!res.ok) return 0;
      const json = await res.json();
      return Number(json.total || 0);
    },
  });

  const { data: checkinsData } = useQuery({
    queryKey: ["dashboard-homestay-checkins", currentTenantId],
    queryFn: async () => {
      const res = await apiFetch("/api/homestay-checkins");
      if (!res.ok) return [];
      const json = res.status === 204 ? { data: [] } : await res.json();
      return json.data || [];
    },
  });

  const totalResidents = residentsTotal ?? 0;

  // Count total vehicles from residents
  const totalVehicles =
    residentsData?.reduce((sum: number, resident: any) => {
      return sum + (resident.vehicles?.length || 0);
    }, 0) || 0;

  // Calculate today's check-ins
  const todayCheckins =
    checkinsData?.filter((c: any) => {
      try {
        const date = new Date(c.submittedAt);
        const today = new Date();
        return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
      } catch {
        return false;
      }
    }).length || 0;

  // Calculate currently staying (arrival before/on today, departure today or after)
  const currentlyStaying =
    checkinsData?.filter((c: any) => {
      try {
        if (!c.dateOfArrival || !c.dateOfDeparture) return false;
        const arrival = parseISO(c.dateOfArrival);
        const departure = parseISO(c.dateOfDeparture);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const arrivalDate = new Date(arrival);
        const departureDate = new Date(departure);
        arrivalDate.setHours(0, 0, 0, 0);
        departureDate.setHours(0, 0, 0, 0);

        return arrivalDate <= today && departureDate >= today;
      } catch {
        return false;
      }
    }).length || 0;

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header />

      {/* ===== Main ===== */}
      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro title="Dashboard" subtitle="View community activity and key totals." />
        <Card className={cn('max-sm:has-[div[role="toolbar"]]:mb-16', "flex flex-1 flex-col")}>
          <CardContent className="flex flex-1 flex-col gap-4">
            <Tabs orientation="vertical" defaultValue="overview" className="space-y-4">
              <div className="w-full overflow-x-auto">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="check-in-report">Check-in Report</TabsTrigger>
                  <TabsTrigger value="financial-report">Financial Report</TabsTrigger>
                  <TabsTrigger value="homestay-report">Homestay Report</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Residents</CardTitle>
                      <Users className="text-muted-foreground h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalResidents}</div>
                      <p className="text-muted-foreground text-xs">Registered residents</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Registered Vehicles</CardTitle>
                      <Car className="text-muted-foreground h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{totalVehicles}</div>
                      <p className="text-muted-foreground text-xs">Total vehicles</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Currently Staying</CardTitle>
                      <UserCheck className="text-muted-foreground h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{currentlyStaying}</div>
                      <p className="text-muted-foreground text-xs">Active homestays</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Today's Check-ins</CardTitle>
                      <CheckCircle className="text-muted-foreground h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{todayCheckins}</div>
                      <p className="text-muted-foreground text-xs">New arrivals today</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
                  <Card className="col-span-1 lg:col-span-4">
                    <CardHeader>
                      <CardTitle>Monthly Check-ins</CardTitle>
                      <CardDescription>Homestay check-ins over the last 12 months</CardDescription>
                    </CardHeader>
                    <CardContent className="ps-2">
                      <Overview checkinsData={checkinsData || []} />
                    </CardContent>
                  </Card>
                  <Card className="col-span-1 lg:col-span-3">
                    <CardHeader>
                      <CardTitle>Recent Check-ins</CardTitle>
                      <CardDescription>Latest homestay check-ins</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RecentCheckins />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="check-in-report" className="space-y-4">
                <CheckInReportPanel />
              </TabsContent>
              <TabsContent value="financial-report" className="space-y-4">
                <FinancialReportPanel />
              </TabsContent>
              <TabsContent value="homestay-report" className="space-y-4">
                <HomestayReportPanel checkinsData={checkinsData || []} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </Main>
    </>
  );
}

function CheckInReportPanel() {
  const currentTenantId = useTenantStore((s) => s.currentTenantId);

  type LogItem = {
    id: string;
    checkpointId: string;
    checkpointName?: string;
    userId?: string;
    userName?: string;
    timestamp: string;
    date: Date;
  };

  const { data: checkIns = [], isLoading } = useQuery({
    queryKey: ["dashboard-check-in-logs", currentTenantId],
    queryFn: async () => {
      const res = await apiFetch("/api/check-in");
      if (!res.ok) return [];
      const json = res.status === 204 ? [] : await res.json();
      return (json as any[]).map((item) => ({
        id: item.id,
        checkpointId: item.checkpointId || item.checkpoint_id,
        checkpointName: item.checkpointName || item.checkpoint_name,
        userId: item.userId || item.user_id,
        userName: item.userName || item.user_name,
        timestamp: item.timestamp || item.created_at,
        date: new Date(item.timestamp || item.created_at),
      })) as LogItem[];
    },
  });

  const { data: checkpoints = [] } = useQuery({
    queryKey: ["dashboard-checkpoints-names", currentTenantId],
    queryFn: async () => {
      const res = await apiFetch("/api/checkpoints?pageSize=100");
      if (!res.ok) return [];
      const json = res.status === 204 ? { data: [] } : await res.json();
      return json.data || [];
    },
  });

  // Users lookup for "check-in by who" — must be before any early returns
  const { data: users = [] } = useQuery({
    queryKey: ["dashboard-users-for-check-in", currentTenantId],
    queryFn: async () => {
      try {
        const res = await apiFetch("/api/users?pageSize=200");
        if (!res.ok) return [];
        const json = res.status === 204 ? { data: [] } : await res.json();
        return json.data || [];
      } catch {
        return [];
      }
    },
  });

  const nameById = new Map<string, string>();
  (checkpoints as any[]).forEach((cp) => nameById.set(String(cp.id), String(cp.name)));

  const groups = new Map<string, { id: string; name: string; logs: LogItem[] }>();
  (checkIns as LogItem[]).forEach((log) => {
    const key = String(log.checkpointId);
    const name = log.checkpointName || nameById.get(key) || key;
    const grp = groups.get(key) || { id: key, name, logs: [] };
    grp.logs.push(log);
    groups.set(key, grp);
  });

  const entries = Array.from(groups.values());

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-muted-foreground">Loading check-in logs...</div>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-muted-foreground">No check-in records found</div>
      </Card>
    );
  }

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const weekCutoff = subDays(new Date(), 7);
  const monthCutoff = subDays(new Date(), 30);

  const userNameById = new Map<string, string>();
  (users as any[]).forEach((u) => {
    const id = String(u.id ?? "");
    const name = String(((u.firstName || "") + " " + (u.lastName || "")).trim() || u.username || id);
    if (id) userNameById.set(id, name);
  });

  // Shared logs for 30-day window
  const allLogs = entries.flatMap((g) => g.logs);

  // Build per-user series (top 5) for grouped bars
  const userCountsForSeries = new Map<string, number>();
  allLogs
    .filter((l) => l.date >= monthCutoff)
    .forEach((l) => {
      const id = String(l.userId || "");
      userCountsForSeries.set(id, (userCountsForSeries.get(id) || 0) + 1);
    });
  const topUsersSeries = Array.from(userCountsForSeries.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const series = topUsersSeries.map((id, idx) => ({ id, key: `user_${id}`, name: userNameById.get(id) || id, color: `var(--chart-${(idx % 5) + 1})` }));
  const otherKey = "other";

  const dailyData: Array<Record<string, number | string>> = [];
  for (let i = 29; i >= 0; i--) {
    const day = subDays(new Date(), i);
    const s = startOfDay(day);
    const e = endOfDay(day);
    const base: Record<string, number | string> = { day: format(day, "dd") };
    series.forEach((srs) => (base[srs.key] = 0));
    let other = 0;
    allLogs.forEach((l) => {
      if (l.date >= s && l.date <= e) {
        const uid = String(l.userId || "");
        const srs = series.find((x) => x.id === uid);
        if (srs) base[srs.key] = Number(base[srs.key] || 0) + 1;
        else other += 1;
      }
    });
    base[otherKey] = other;
    dailyData.push(base);
  }

  // Top users list (for the second chart)
  const userCounts = new Map<string, number>();
  allLogs
    .filter((l) => l.date >= monthCutoff)
    .forEach((l) => {
      const id = String(l.userId || "");
      userCounts.set(id, (userCounts.get(id) || 0) + 1);
    });
  const topUsersData = Array.from(userCounts.entries())
    .map(([id, value]) => ({ name: userNameById.get(id) || id || "-", value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return (
    <div className="space-y-4">
      {entries.map((group) => {
        const todayCount = group.logs.filter((l) => l.date >= todayStart && l.date <= todayEnd).length;
        const weekCount = group.logs.filter((l) => l.date >= weekCutoff).length;
        const monthCount = group.logs.filter((l) => l.date >= monthCutoff).length;

        return (
          <Card key={group.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{group.name}</CardTitle>
              <span className="text-sm text-muted-foreground">{group.logs.length} total</span>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{todayCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Last 7 days</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{weekCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Last 30 days</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{monthCount}</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>Last 30 Days</CardTitle>
          <CardDescription>Daily check-ins by user (grouped)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {series.map((srs) => (
                  <Bar key={srs.key} dataKey={srs.key} name={srs.name} fill={srs.color} />
                ))}
                <Bar dataKey={otherKey} name="Other" fill="var(--chart-5)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Users (Last 30 Days)</CardTitle>
          <CardDescription>Who checked in the most</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topUsersData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} hide={false} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Check-ins" fill="var(--chart-2)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FinancialReportPanel() {
  const currentTenantId = useTenantStore((s) => s.currentTenantId);
  const year = String(new Date().getFullYear());
  const month = String(new Date().getMonth() + 1);

  const { data, isLoading, error } = useQuery<{
    frequency: string;
    rate: number;
    period: { start: string; end: string } | null;
    data: {
      houseId: string;
      houseNo: string;
      amountDue: number;
      amountPaid: number;
      debit: number;
      credit: number;
      status: string;
    }[];
  } | null>({
    queryKey: ["dashboard-financial-summary", year, month, currentTenantId],
    queryFn: async () => {
      const params = new URLSearchParams({ frequency: "monthly", year, month });
      const res = await apiFetch(`/api/billing/summary?${params.toString()}`);
      if (res.status === 204) return null;
      if (!res.ok) return null;
      return await res.json();
    },
  });

  const rows = data?.data || [];
  const totals = rows.reduce(
    (acc, r) => {
      acc.due += Number(r.amountDue || 0);
      acc.paid += Number(r.amountPaid || 0);
      acc.debit += Number(r.debit || 0);
      acc.credit += Number(r.credit || 0);
      return acc;
    },
    { due: 0, paid: 0, debit: 0, credit: 0 },
  );

  const chartData = [
    { name: "Due", amount: totals.due },
    { name: "Paid", amount: totals.paid },
    { name: "Debit", amount: totals.debit },
    { name: "Credit", amount: totals.credit },
  ];

  return (
    <div className="space-y-4">
      {error ? (
        <div className="text-destructive">Failed to load financial report.</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Due</CardTitle>
            <CardDescription>
              {data?.period ? `${data.period.start} → ${data.period.end}` : "No billing period"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.due.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CardDescription>Confirmed payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.paid.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debit</CardTitle>
            <CardDescription>Outstanding</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.debit.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credit</CardTitle>
            <CardDescription>Overpayment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.credit.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing Summary</CardTitle>
          <CardDescription>{isLoading ? "Loading..." : "This month overview"}</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="amount" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function HomestayReportPanel({ checkinsData }: { checkinsData: any[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalCheckins = checkinsData.length;
  const todayCheckins =
    checkinsData.filter((c: any) => {
      const ts = c.submittedAt || c.submitted_at || c.createdAt || c.created_at;
      if (!ts) return false;
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return false;
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length || 0;

  const currentlyStaying =
    checkinsData.filter((c: any) => {
      try {
        const arrivalRaw = c.dateOfArrival || c.date_of_arrival;
        const departureRaw = c.dateOfDeparture || c.date_of_departure;
        if (!arrivalRaw || !departureRaw) return false;
        const arrival = parseISO(String(arrivalRaw));
        const departure = parseISO(String(departureRaw));
        const a = new Date(arrival);
        const d = new Date(departure);
        a.setHours(0, 0, 0, 0);
        d.setHours(0, 0, 0, 0);
        return a <= today && d >= today;
      } catch {
        return false;
      }
    }).length || 0;

  const days = Array.from({ length: 14 }).map((_, idx) => {
    const date = subDays(today, 13 - idx);
    const start = startOfDay(date);
    const end = endOfDay(date);
    const count = checkinsData.filter((c: any) => {
      const ts = c.submittedAt || c.submitted_at || c.createdAt || c.created_at;
      if (!ts) return false;
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    }).length;
    return { day: format(date, "dd MMM"), checkins: count };
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Check-ins</CardTitle>
            <CardDescription>All time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCheckins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <CardDescription>New arrivals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayCheckins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Staying</CardTitle>
            <CardDescription>Active homestays</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentlyStaying}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Check-ins (Last 14 Days)</CardTitle>
          <CardDescription>Daily total</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} interval={2} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="checkins" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
