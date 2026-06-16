import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { ConfigDrawer } from "@/components/config-drawer";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { PageIntro } from "@/components/layout/page-intro";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTableColumnHeader, DataTablePagination, DataTableToolbar } from "@/components/data-table";
import { format, isToday, parseISO } from "date-fns";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

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

type GuardRecordTone = "green" | "blue" | "red";

const toneStyles: Record<
  GuardRecordTone,
  {
    dot: string;
    plate: string;
  }
> = {
  green: {
    dot: "bg-green-500",
    plate: "bg-green-500/10 border-green-500/20",
  },
  blue: {
    dot: "bg-blue-500",
    plate: "bg-blue-500/10 border-blue-500/20",
  },
  red: {
    dot: "bg-red-500",
    plate: "bg-red-500/10 border-red-500/20",
  },
};

function GuardRecordTable({
  title,
  tone,
  data,
  emptyText,
}: {
  title: string;
  tone: GuardRecordTone;
  data: HomestayCheckIn[];
  emptyText: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const columns = useMemo<ColumnDef<HomestayCheckIn>[]>(
    () => [
      {
        accessorKey: "homestayId",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Homestay" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.homestayId}</span>
        ),
      },
      {
        accessorKey: "personInCharge",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Person in Charge" />
        ),
      },
      {
        accessorKey: "numberOfGuests",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Guests" />
        ),
      },
      {
        accessorKey: "numberPlates",
        header: "Vehicle Plates",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.numberPlates?.length ? (
            <div className="flex flex-wrap gap-2">
              {row.original.numberPlates.map((plate, idx) => (
                <span
                  key={`${row.original.id}-${idx}`}
                  className={cn(
                    "inline-block rounded border px-3 py-1 font-mono",
                    toneStyles[tone].plate
                  )}
                >
                  {plate}
                </span>
              ))}
            </div>
          ) : (
            "-"
          ),
      },
    ],
    [tone]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const searchValue = String(filterValue).trim().toLowerCase();
      if (!searchValue) return true;

      return (
        row.original.homestayId.toLowerCase().includes(searchValue) ||
        row.original.personInCharge.toLowerCase().includes(searchValue) ||
        String(row.original.numberOfGuests).includes(searchValue) ||
        row.original.numberPlates.some((plate) =>
          plate.toLowerCase().includes(searchValue)
        )
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <span className={cn("inline-block h-3 w-3 rounded-full", toneStyles[tone].dot)}></span>
        {title} ({data.length})
      </h3>
      <Card className="max-sm:has-[div[role='toolbar']]:mb-16">
        <CardContent className="flex flex-col gap-4">
          <DataTableToolbar
            table={table}
            searchPlaceholder="Filter homestay records..."
          />
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {emptyText}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} className="mt-auto" />
        </CardContent>
      </Card>
    </section>
  );
}

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
        <PageIntro title="Homestay Record" subtitle={`Arrivals, stays, and departures for ${format(new Date(), "dd MMM yyyy")}.`} />

        {isLoading && <div className="text-muted-foreground">Loading vehicle activity...</div>}
        {error && <div className="text-destructive">{(error as Error).message}</div>}

        {!isLoading && (
          <div className="space-y-6">
            <GuardRecordTable
              title="Arriving Today"
              tone="green"
              data={arrivals}
              emptyText="No arrivals scheduled for today."
            />
            <GuardRecordTable
              title="Staying Today"
              tone="blue"
              data={staying}
              emptyText="No guests staying today."
            />
            <GuardRecordTable
              title="Departing Today"
              tone="red"
              data={departures}
              emptyText="No departures scheduled for today."
            />
          </div>
        )}
      </Main>
    </>
  );
}
