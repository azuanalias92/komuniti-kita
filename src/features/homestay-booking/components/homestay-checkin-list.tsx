import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { ConfigDrawer } from "@/components/config-drawer";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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

export function HomestayCheckinList() {
  const { homestayId } = routeApi.useParams();

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

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCheckin) return;

    const values = editFormApi.getValues();
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
  };

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

      <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/homestay">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Link>
              </Button>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Homestay {homestayId} - Check-in History</h2>
            <p className="text-muted-foreground">All check-in records for this homestay.</p>
          </div>
          <Button asChild>
            <Link to="/homestay/$homestayId" params={{ homestayId }}>
              New Check-in
            </Link>
          </Button>
        </div>

        {isLoading && <div className="text-muted-foreground">Loading check-ins...</div>}
        {error && <div className="text-destructive">{(error as Error).message}</div>}
        {!isLoading && checkins.length === 0 && <div className="text-muted-foreground">No check-ins found for this homestay.</div>}
        {checkins.length > 0 && (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person in Charge</TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Plates</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Submitted At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkins.map((checkin) => (
                  <TableRow key={checkin.id}>
                    <TableCell className="font-medium">{checkin.personInCharge}</TableCell>
                    <TableCell>{checkin.numberOfGuests}</TableCell>
                    <TableCell>{checkin.dateOfArrival ? format(new Date(checkin.dateOfArrival), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell>{checkin.dateOfDeparture ? format(new Date(checkin.dateOfDeparture), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell>{checkin.numberPlates?.length ? checkin.numberPlates.join(", ") : "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{checkin.additionalNotes || "-"}</TableCell>
                    <TableCell>{format(new Date(checkin.submittedAt), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(checkin)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

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
