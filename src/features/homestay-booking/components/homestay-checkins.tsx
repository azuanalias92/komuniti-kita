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
import { DataTableColumnHeader, DataTablePagination, DataTableToolbar } from "@/components/data-table";
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

type HomestayCheckinRow = {
  id: string;
  houseNo: string;
  owners: string;
  latestCheckIn: string;
  guests: number | null;
  arrival: string;
  departure: string;
  plates: string;
};

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "dd/MM/yyyy");
}

export function HomestayCheckins() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

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
  const tableData = useMemo<HomestayCheckinRow[]>(
    () =>
      rows.map((resident) => {
        const latest = data?.latestMap.get(resident.houseNo);
        return {
          id: resident.id,
          houseNo: resident.houseNo,
          owners:
            resident.owners
              ?.map((owner) => owner.name)
              .filter(Boolean)
              .join(", ") || "-",
          latestCheckIn: latest?.personInCharge || "-",
          guests: latest?.numberOfGuests ?? null,
          arrival: formatDate(latest?.dateOfArrival),
          departure: formatDate(latest?.dateOfDeparture),
          plates: latest?.numberPlates?.length ? latest.numberPlates.join(", ") : "-",
        };
      }),
    [data?.latestMap, rows],
  );

  const columns = useMemo<ColumnDef<HomestayCheckinRow>[]>(
    () => [
      {
        accessorKey: "houseNo",
        header: ({ column }) => <DataTableColumnHeader column={column} title="House No" />,
        cell: ({ row }) => <span className="font-medium">{row.original.houseNo}</span>,
        enableHiding: false,
      },
      {
        accessorKey: "owners",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Owners" />,
      },
      {
        accessorKey: "latestCheckIn",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Latest Check-in" />,
      },
      {
        accessorKey: "guests",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Guests" />,
        cell: ({ row }) => row.original.guests ?? "-",
      },
      {
        accessorKey: "arrival",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Arrival" />,
      },
      {
        accessorKey: "departure",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Departure" />,
      },
      {
        accessorKey: "plates",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Plates" />,
        enableSorting: false,
      },
      {
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/homestay/$homestayId" params={{ homestayId: row.original.houseNo }}>
                Check In
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/homestay-list/$homestayId" params={{ homestayId: row.original.houseNo }}>
                List
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: tableData,
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
        row.original.houseNo.toLowerCase().includes(searchValue) ||
        row.original.owners.toLowerCase().includes(searchValue) ||
        row.original.latestCheckIn.toLowerCase().includes(searchValue) ||
        String(row.original.guests ?? "").includes(searchValue) ||
        row.original.arrival.toLowerCase().includes(searchValue) ||
        row.original.departure.toLowerCase().includes(searchValue) ||
        row.original.plates.toLowerCase().includes(searchValue)
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
    <>
      <Header fixed>
        <div className="ms-auto flex items-center space-x-4">
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro
          title="Homestay"
          subtitle="Review homestay records and open check-in actions."
        />

        <Card className="max-sm:has-[div[role='toolbar']]:mb-16">
          <CardContent className="flex flex-col gap-4">
            <DataTableToolbar
              table={table}
              searchPlaceholder="Filter by house no, owner, guest, plate, or date..."
            />
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        {isLoading ? (
                          <span className="text-muted-foreground">Loading homestays...</span>
                        ) : error ? (
                          <span className="text-destructive">{(error as Error).message}</span>
                        ) : (
                          <span className="text-muted-foreground">No homestays found.</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination table={table} className="mt-auto" />
          </CardContent>
        </Card>
      </Main>
    </>
  );
}
