import { useQuery } from "@tanstack/react-query";
// import { Button } from ":/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigDrawer } from "@/components/config-drawer";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { Overview } from "./components/overview";
import { RecentCheckins } from "./components/recent-checkins";
import { Users, CheckCircle, Car, UserCheck } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { parseISO, startOfDay, endOfDay, subDays, format } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export function Dashboard() {
  // Removed unused queries to avoid unnecessary API calls and potential 204 handling issues

  const { data: residentsData } = useQuery({
    queryKey: ["dashboard-residents"],
    queryFn: async () => {
      const token = useAuthStore.getState().auth.accessToken;
      const res = await fetch("/api/residents", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.status === 204) return [];
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
  });

  const { data: residentsTotal } = useQuery({
    queryKey: ["dashboard-residents-total"],
    queryFn: async () => {
      const token = useAuthStore.getState().auth.accessToken;
      const res = await fetch("/api/residents?page=1&pageSize=1", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.status === 204) return 0;
      if (!res.ok) return 0;
      const json = await res.json();
      return Number(json.total || 0);
    },
  });

  const { data: checkinsData } = useQuery({
    queryKey: ["dashboard-homestay-checkins"],
    queryFn: async () => {
      const token = useAuthStore.getState().auth.accessToken;
      const res = await fetch("/api/homestay-checkins", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
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
      <Header>
        <div className="ms-auto flex items-center space-x-4">
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <div className="mb-2 flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <Tabs orientation="vertical" defaultValue="overview" className="space-y-4">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="check-in-report">Check-in Report</TabsTrigger>
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
        </Tabs>
      </Main>
    </>
  );
}

function CheckInReportPanel() {
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
    queryKey: ["dashboard-check-in-logs"],
    queryFn: async () => {
      const token = useAuthStore.getState().auth.accessToken;
      const res = await fetch("/api/check-in", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
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
    queryKey: ["dashboard-checkpoints-names"],
    queryFn: async () => {
      const token = useAuthStore.getState().auth.accessToken;
      const res = await fetch("/api/checkpoints?pageSize=100", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) return [];
      const json = res.status === 204 ? { data: [] } : await res.json();
      return json.data || [];
    },
  });

  // Users lookup for "check-in by who" — must be before any early returns
  const { data: users = [] } = useQuery({
    queryKey: ["dashboard-users-for-check-in"],
    queryFn: async () => {
      const token = useAuthStore.getState().auth.accessToken;
      try {
        const res = await fetch("/api/users?pageSize=200", {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
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
