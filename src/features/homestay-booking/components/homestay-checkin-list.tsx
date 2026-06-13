import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Link, getRouteApi } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DataTableColumnHeader, DataTablePagination, DataTableToolbar } from "@/components/data-table";
import { DatePicker } from "@/components/date-picker";
import { format, parseISO } from "date-fns";
import { useAuthStore } from "@/stores/auth-store";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";

const routeApi = getRouteApi("/_authenticated/homestay-list/$homestayId");

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

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "dd/MM/yyyy");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "dd/MM/yyyy HH:mm");
}

export function HomestayCheckinList() {
  const { homestayId } = routeApi.useParams();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["homestay-checkins", homestayId],
    queryFn: async () => {
      const token = useAuthStore.getState().auth.accessToken;

      const url = new URL("/api/homestay-checkins", window.location.origin);
      url.searchParams.set("homestayId", homestayId);

      const res = await fetch(url.toString(), {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch check-ins");
      }

      const json = res.status === 204 ? { data: [] } : await res.json();
      return (json.data ?? []) as HomestayCheckIn[];
    },
  });

  const checkins = data ?? [];
  const queryClient = useQueryClient();

  // Edit dialog state + form
  const [editingCheckin, setEditingCheckin] = useState<HomestayCheckIn | null>(null);

  const editFormSchema = z.object({
    personInCharge: z.string().min(1, "Person in charge is required"),
    numberOfGuests: z.coerce.number().int().min(1, "At least 1 guest"),
    numberPlates: z.string().min(1, "At least one plate is required"),
    dateOfArrival: z.date().optional(),
    dateOfDeparture: z.date().optional(),
    additionalNotes: z.string().optional(),
  });

  type EditFormValues = z.infer<typeof editFormSchema>;

  const editFormApi = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema) as any,
    defaultValues: {
      personInCharge: "",
      numberOfGuests: undefined as any,
      numberPlates: "",
      dateOfArrival: undefined,
      dateOfDeparture: undefined,
      additionalNotes: "",
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; body: any }) => {
      const token = useAuthStore.getState().auth.accessToken;
      const res = await fetch(`/api/homestay-checkins/${data.id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data.body),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update check-in");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homestay-checkins", homestayId] });
      toast.success("Check-in updated successfully!");
      setEditingCheckin(null);
    },
    onError: (error) => {
      toast.error(`Failed to update: ${(error as Error).message}`);
    },
  });

  const handleEditClick = (checkin: HomestayCheckIn) => {
    setEditingCheckin(checkin);
    editFormApi.reset({
      personInCharge: checkin.personInCharge,
      numberOfGuests: checkin.numberOfGuests,
      numberPlates: checkin.numberPlates.join(", "),
      dateOfArrival: checkin.dateOfArrival ? parseISO(checkin.dateOfArrival) : undefined,
      dateOfDeparture: checkin.dateOfDeparture ? parseISO(checkin.dateOfDeparture) : undefined,
      additionalNotes: checkin.additionalNotes || "",
    });
  };

  const handleEditSubmit = editFormApi.handleSubmit((values) => {
    if (!editingCheckin) return;
    const payload = {
      personInCharge: values.personInCharge,
      numberOfGuests: values.numberOfGuests,
      numberPlates: values.numberPlates
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      dateOfArrival: values.dateOfArrival?.toISOString(),
      dateOfDeparture: values.dateOfDeparture?.toISOString(),
      additionalNotes: values.additionalNotes || "",
    };

    updateMutation.mutate({ id: editingCheckin.id, body: payload });
  });

  const columns = useMemo<ColumnDef<HomestayCheckIn>[]>(
    () => [
      {
        accessorKey: "personInCharge",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Person in Charge" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.personInCharge}</span>
        ),
      },
      {
        accessorKey: "numberOfGuests",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Guests" />
        ),
      },
      {
        accessorKey: "dateOfArrival",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Arrival" />
        ),
        cell: ({ row }) => formatDate(row.original.dateOfArrival),
      },
      {
        accessorKey: "dateOfDeparture",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Departure" />
        ),
        cell: ({ row }) => formatDate(row.original.dateOfDeparture),
      },
      {
        accessorKey: "numberPlates",
        header: "Plates",
        cell: ({ row }) =>
          row.original.numberPlates?.length
            ? row.original.numberPlates.join(", ")
            : "-",
      },
      {
        accessorKey: "additionalNotes",
        header: "Notes",
        cell: ({ row }) => (
          <span className="block max-w-xs truncate">
            {row.original.additionalNotes || "-"}
          </span>
        ),
      },
      {
        accessorKey: "submittedAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Submitted At" />
        ),
        cell: ({ row }) => formatDateTime(row.original.submittedAt),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditClick(row.original)}
            >
              <Pencil className="mr-1 h-4 w-4" />
              Edit
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: checkins,
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

      const plates = row.original.numberPlates.join(", ").toLowerCase();
      return (
        row.original.personInCharge.toLowerCase().includes(searchValue) ||
        String(row.original.numberOfGuests).includes(searchValue) ||
        plates.includes(searchValue) ||
        (row.original.additionalNotes || "").toLowerCase().includes(searchValue) ||
        formatDate(row.original.dateOfArrival).toLowerCase().includes(searchValue) ||
        formatDate(row.original.dateOfDeparture).toLowerCase().includes(searchValue) ||
        formatDateTime(row.original.submittedAt).toLowerCase().includes(searchValue)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [globalFilter, checkins.length]);

  return (
    <>
      <Header />

      <Main className="flex flex-1 flex-col gap-4">
        <PageIntro
          title={`Homestay ${homestayId}`}
          subtitle="Review the full check-in history for this homestay."
          actions={
            <>
              <Button asChild variant="outline" size="sm">
                <Link to="/homestay/listing">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Link>
              </Button>
              <Button asChild>
                <Link to="/homestay/$homestayId" params={{ homestayId }}>
                  New Check-in
                </Link>
              </Button>
            </>
          }
        />

        <Card className="max-sm:has-[div[role='toolbar']]:mb-16">
          <CardContent className="flex flex-col gap-4 p-6">
            <DataTableToolbar
              table={table}
              searchPlaceholder="Filter by guest, plate, notes, or date..."
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
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
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
                          {isLoading
                            ? "Loading check-ins..."
                            : error
                              ? (error as Error).message
                              : "No check-ins found for this homestay."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            <DataTablePagination table={table} className="mt-auto" />
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingCheckin} onOpenChange={(open) => !open && setEditingCheckin(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Check-in</DialogTitle>
            </DialogHeader>
            <Form {...editFormApi}>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <FormField
                  control={editFormApi.control}
                  name="personInCharge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Person in Charge</FormLabel>
                      <FormControl>
                        <Input {...field} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editFormApi.control}
                  name="numberOfGuests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Guests</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editFormApi.control}
                  name="dateOfArrival"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Arrival Date</FormLabel>
                      <FormControl>
                        <DatePicker selected={field.value} onSelect={field.onChange} placeholder="Select arrival date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editFormApi.control}
                  name="dateOfDeparture"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Departure Date</FormLabel>
                      <FormControl>
                        <DatePicker selected={field.value} onSelect={field.onChange} placeholder="Select departure date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editFormApi.control}
                  name="numberPlates"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Plates</FormLabel>
                      <FormControl>
                        <Input placeholder="Comma separated" required {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editFormApi.control}
                  name="additionalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setEditingCheckin(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  );
}
