import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { ConfigDrawer } from "@/components/config-drawer";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { PageIntro } from "@/components/layout/page-intro";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, isToday, parseISO } from "date-fns";
import { useAuthStore } from "@/stores/auth-store";

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

export function HomestayGuardRecord() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["homestay-guard-record-today"],
    queryFn: async () => {
      const token = useAuthStore.getState().auth.accessToken;

      const url = new URL("/api/homestay-checkins", window.location.origin);
      url.searchParams.set("page", "1");
      url.searchParams.set("pageSize", "100");

      const res = await fetch(url.toString(), {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch check-ins");
      }

      const json = res.status === 204 ? { data: [] } : await res.json();
      const allCheckins = (json.data ?? []) as HomestayCheckIn[];

      // Filter for today's arrivals, departures, and current stays
      const arrivals: HomestayCheckIn[] = [];
      const departures: HomestayCheckIn[] = [];
      const staying: HomestayCheckIn[] = [];

      allCheckins.forEach((checkin) => {
        const hasArrival = checkin.dateOfArrival ? parseISO(checkin.dateOfArrival) : null;
        const hasDeparture = checkin.dateOfDeparture ? parseISO(checkin.dateOfDeparture) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Arriving today
        if (hasArrival && isToday(hasArrival)) {
          arrivals.push(checkin);
        }

        // Departing today
        if (hasDeparture && isToday(hasDeparture)) {
          departures.push(checkin);
        }

        // Currently staying (arrival is today or before, departure is today or after)
        if (hasArrival && hasDeparture) {
          const arrivalDate = new Date(hasArrival);
          const departureDate = new Date(hasDeparture);
          arrivalDate.setHours(0, 0, 0, 0);
          departureDate.setHours(0, 0, 0, 0);

          if (arrivalDate <= today && departureDate >= today) {
            staying.push(checkin);
          }
        }
      });

      return { arrivals, staying, departures };
    },
  });

  const arrivals = data?.arrivals ?? [];
  const departures = data?.departures ?? [];
  const staying = data?.staying ?? [];
  return (
    <>
      <Header fixed>
        <Search />
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro
          title="Homestay Record"
          subtitle={`Arrivals, stays, and departures for ${format(new Date(), "dd MMM yyyy")}.`}
        />

        {isLoading && <div className="text-muted-foreground">Loading vehicle activity...</div>}
        {error && <div className="text-destructive">{(error as Error).message}</div>}

        {!isLoading && (
          <div className="space-y-6">
            {/* Arrivals Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
                Arriving Today ({arrivals.length})
              </h3>
              {arrivals.length === 0 ? (
                <div className="text-muted-foreground text-sm">No arrivals scheduled for today.</div>
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Homestay</TableHead>
                            <TableHead>Person in Charge</TableHead>
                            <TableHead>Guests</TableHead>
                            <TableHead className="font-bold">Vehicle Plates</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {arrivals.map((checkin) => (
                            <TableRow key={checkin.id}>
                              <TableCell className="font-medium">{checkin.homestayId}</TableCell>
                              <TableCell>{checkin.personInCharge}</TableCell>
                              <TableCell>{checkin.numberOfGuests}</TableCell>
                              <TableCell className="font-bold text-lg">
                                {checkin.numberPlates?.length ? (
                                  <div className="flex flex-wrap gap-2">
                                    {checkin.numberPlates.map((plate, idx) => (
                                      <span key={idx} className="inline-block bg-green-500/10 border border-green-500/20 px-3 py-1 rounded font-mono">
                                        {plate}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Staying Today Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="inline-block w-3 h-3 bg-blue-500 rounded-full"></span>
                Staying Today ({staying.length})
              </h3>
              {staying.length === 0 ? (
                <div className="text-muted-foreground text-sm">No guests staying today.</div>
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Homestay</TableHead>
                        <TableHead>Person in Charge</TableHead>
                        <TableHead>Guests</TableHead>
                        <TableHead className="font-bold">Vehicle Plates</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staying.map((checkin) => (
                        <TableRow key={checkin.id}>
                          <TableCell className="font-medium">{checkin.homestayId}</TableCell>
                          <TableCell>{checkin.personInCharge}</TableCell>
                          <TableCell>{checkin.numberOfGuests}</TableCell>
                          <TableCell className="font-bold text-lg">
                            {checkin.numberPlates?.length ? (
                              <div className="flex flex-wrap gap-2">
                                {checkin.numberPlates.map((plate, idx) => (
                                  <span key={idx} className="inline-block bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded font-mono">
                                    {plate}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Departures Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="inline-block w-3 h-3 bg-red-500 rounded-full"></span>
                Departing Today ({departures.length})
              </h3>
              {departures.length === 0 ? (
                <div className="text-muted-foreground text-sm">No departures scheduled for today.</div>
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Homestay</TableHead>
                        <TableHead>Person in Charge</TableHead>
                        <TableHead>Guests</TableHead>
                        <TableHead className="font-bold">Vehicle Plates</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departures.map((checkin) => (
                        <TableRow key={checkin.id}>
                          <TableCell className="font-medium">{checkin.homestayId}</TableCell>
                          <TableCell>{checkin.personInCharge}</TableCell>
                          <TableCell>{checkin.numberOfGuests}</TableCell>
                          <TableCell className="font-bold text-lg">
                            {checkin.numberPlates?.length ? (
                              <div className="flex flex-wrap gap-2">
                                {checkin.numberPlates.map((plate, idx) => (
                                  <span key={idx} className="inline-block bg-red-500/10 border border-red-500/20 px-3 py-1 rounded font-mono">
                                    {plate}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </Main>
    </>
  );
}
