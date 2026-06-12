import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { ConfigDrawer } from "@/components/config-drawer";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { PageIntro } from "@/components/layout/page-intro";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useAuthStore } from "@/stores/auth-store";

type ResidentOwner = { name: string; phone: string; userId?: string };
type Resident = { id: string; houseNo: string; houseType: string; owners: ResidentOwner[]; vehicles: { brand: string; model: string; plate: string }[] };
type HomestayCheckIn = {
  id: string;
  homestayId: string;
  personInCharge: string;
  numberOfGuests: number;
  numberPlates: string[];
  dateOfArrival?: string;
  dateOfDeparture?: string;
  additionalNotes?: string;
  submittedAt: string;
};

export function HomestayCheckins() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["homestay-list-with-latest"],
    queryFn: async () => {
      const token = useAuthStore.getState().auth.accessToken;

      const residentsUrl = new URL("/api/residents", window.location.origin);
      residentsUrl.searchParams.append("houseType", "homestay");
      residentsUrl.searchParams.set("page", "1");
      residentsUrl.searchParams.set("pageSize", "100");

      const latestUrl = new URL("/api/homestay-checkins", window.location.origin);
      latestUrl.searchParams.set("latestByHomestay", "true");

      const [resResidents, resLatest] = await Promise.all([
        fetch(residentsUrl.toString(), {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }),
        fetch(latestUrl.toString(), {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }),
      ]);

      const residentsJson = resResidents.status === 204 ? { data: [] } : await resResidents.json();
      const latestJson = resLatest.status === 204 ? { data: [] } : await resLatest.json();

      const residents = (residentsJson.data ?? []) as Resident[];
      const latestList = (latestJson.data ?? []) as HomestayCheckIn[];
      const latestMap = new Map<string, HomestayCheckIn>();
      for (const item of latestList) latestMap.set(item.homestayId, item);

      const residentMap = new Map<string, Resident>();
      for (const r of residents) residentMap.set(r.houseNo, r);

      const unionHouseNos = new Set<string>([...residentMap.keys(), ...latestMap.keys()]);
      const rows = Array.from(unionHouseNos).map((houseNo) => {
        const r = residentMap.get(houseNo);
        return r ?? ({ id: `homestay-${houseNo}`, houseNo, houseType: "homestay", owners: [], vehicles: [] } as Resident);
      });

      return { residents: rows, latestMap };
    },
  });

  const rows = data?.residents ?? [];

  return (
    <>
      <Header fixed>
        <div className="ms-auto flex items-center space-x-4">
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <Main className="flex flex-1 flex-col gap-6">
        <PageIntro
          title="Homestay"
          subtitle="Review homestay records and open check-in actions."
        />

        {isLoading && <div className="text-muted-foreground">Loading homestays...</div>}
        {error && <div className="text-destructive">{(error as Error).message}</div>}
        {!isLoading && rows.length === 0 && <div className="text-muted-foreground">No homestays found.</div>}
        {rows.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>House No</TableHead>
                      <TableHead>Owners</TableHead>
                      <TableHead>Latest Check-in</TableHead>
                      <TableHead>Guests</TableHead>
                      <TableHead>Arrival</TableHead>
                      <TableHead>Departure</TableHead>
                      <TableHead>Plates</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const latest = data?.latestMap.get(r.houseNo);
                      const owners = r.owners
                        ?.map((o) => o.name)
                        .filter(Boolean)
                        .join(", ");
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{r.houseNo}</TableCell>
                          <TableCell>{owners || "-"}</TableCell>
                          <TableCell>{latest?.personInCharge || "-"}</TableCell>
                          <TableCell>{latest?.numberOfGuests ?? "-"}</TableCell>
                          <TableCell>{latest?.dateOfArrival ? format(new Date(latest.dateOfArrival), "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>{latest?.dateOfDeparture ? format(new Date(latest.dateOfDeparture), "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>{latest?.numberPlates?.length ? latest.numberPlates.join(", ") : "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button asChild variant="outline" size="sm">
                                <Link to="/homestay/$homestayId" params={{ homestayId: r.houseNo }}>
                                  Check In
                                </Link>
                              </Button>
                              <Button asChild variant="outline" size="sm">
                                <Link to="/homestay-list/$homestayId" params={{ homestayId: r.houseNo }}>
                                  List
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  );
}
