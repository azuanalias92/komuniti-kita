import { getRouteApi } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DatePicker } from "@/components/date-picker";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { useState } from "react";

const routeApi = getRouteApi("/homestay/$homestayId");

const formSchema = z.object({
  personInCharge: z.string().min(1, "Person in charge is required"),
  numberOfGuests: z.coerce.number().int().min(1, "At least 1 guest").max(20, "Maximum 20 guests"),
  numberPlates: z.string().min(1, "At least one plate number is required"),
  dateOfArrival: z.date({ required_error: "Arrival date is required" }),
  dateOfDeparture: z.date({ required_error: "Departure date is required" }),
  additionalNotes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function HomestayBookingForm() {
  const { homestayId } = routeApi.useParams();
  const queryClient = useQueryClient();
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      personInCharge: "",
      numberOfGuests: undefined as any,
      numberPlates: "",
      dateOfArrival: undefined,
      dateOfDeparture: undefined,
      additionalNotes: "",
    },
  });

  const { handleSubmit, formState: { isSubmitting }, reset } = form;

  const onSubmit = async (data: FormValues) => {
    try {
      const payload = {
        homestayId,
        personInCharge: data.personInCharge,
        numberOfGuests: data.numberOfGuests,
        numberPlates: data.numberPlates.split(",").map((plate) => plate.trim()),
        dateOfArrival: data.dateOfArrival?.toISOString(),
        dateOfDeparture: data.dateOfDeparture?.toISOString(),
        additionalNotes: data.additionalNotes || "",
      };

      const token = useAuthStore.getState().auth.accessToken;
      const res = await fetch("/api/homestay-checkins", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to submit check-in");
      }

      setIsSuccess(true);

      try {
        await queryClient.invalidateQueries({ queryKey: ["homestay-list-with-latest"] });
      } catch {}

      reset();
    } catch (error) {
      toast.error("Failed to submit check-in. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Check In For Homestay {homestayId}</CardTitle>
          <CardDescription>Please fill in your check-in details</CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold">Check-in Successful!</h3>
              <p className="text-muted-foreground">Your check-in has been submitted successfully.</p>
              <Button onClick={() => setIsSuccess(false)} className="mt-4">
                Submit Another Check-in
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="personInCharge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Person In Charge</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter name of person in charge" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numberOfGuests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Guests</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Enter number of guests" min={1} max={20} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfArrival"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date of Arrival</FormLabel>
                      <FormControl>
                        <DatePicker selected={field.value} onSelect={field.onChange} placeholder="Select arrival date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfDeparture"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date of Departure</FormLabel>
                      <FormControl>
                        <DatePicker selected={field.value} onSelect={field.onChange} placeholder="Select departure date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numberPlates"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Number Plates</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter number plates (comma separated)" {...field} />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">Enter multiple number plates separated by commas (e.g., ABC123, XYZ456)</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="additionalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any special requests or additional information" rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Submitting..." : "Submit Check In"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
