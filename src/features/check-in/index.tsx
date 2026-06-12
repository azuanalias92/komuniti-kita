import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import { useAuthStore } from "@/stores/auth-store";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PageIntro } from "@/components/layout/page-intro";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { Search } from "@/components/search";
import { ConfigDrawer } from "@/components/config-drawer";

export function CheckIn() {
  const {
    auth: { user: authUser, accessToken },
  } = useAuthStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<{ timestamp: string; checkpoint: string } | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isNearCheckpoint, setIsNearCheckpoint] = useState<boolean | null>(null);
  const [distanceToNearest, setDistanceToNearest] = useState<number | null>(null);
  const [nearestCheckpoint, setNearestCheckpoint] = useState<{ id: string; name: string } | null>(null);

  // Fetch settings and checkpoints
  const { data: settings } = useQuery({
    queryKey: ["check-in-settings"],
    queryFn: async () => {
      const res = await axios.get("/api/settings/check-in", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.data;
    },
  });

  const { data: checkpoints } = useQuery({
    queryKey: ["checkpoints"],
    queryFn: async () => {
      const res = await axios.get("/api/checkpoints", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.status === 204 ? [] : (res.data?.data ?? []);
    },
  });

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to calculate distance
  function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d * 1000; // Distance in meters
  }

  function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }

  // Check proximity
  useEffect(() => {
    if (!coordinates || !settings || !checkpoints) return;

    let minDistance = Infinity;
    let nearest: any = null;

    for (const cp of checkpoints) {
      const dist = getDistanceFromLatLonInKm(coordinates.lat, coordinates.lng, cp.latitude, cp.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = cp;
      }
    }

    setDistanceToNearest(minDistance);
    setNearestCheckpoint(nearest ? { id: String(nearest.id), name: String(nearest.name) } : null);
    setIsNearCheckpoint(minDistance <= settings.radius);

    // Fetch last check-in if near a checkpoint
    if (minDistance <= settings.radius && nearest) {
      fetchLastCheckIn(nearest.id);
    } else {
      setLastCheckInTime(null);
    }
  }, [coordinates, settings, checkpoints]);

  const [lastCheckInTime, setLastCheckInTime] = useState<string | null>(null);

  const fetchLastCheckIn = async (checkpointId: string) => {
    try {
      const res = await axios.get(`/api/check-in?userId=${authUser?.accountNo}&checkpointId=${checkpointId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setLastCheckInTime(res.data.lastCheckIn);
    } catch (e) {
      console.error("Failed to fetch last check-in", e);
    }
  };

  // Watch user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationError(null);
      },
      (error) => {
        let msg = "Unable to retrieve your location";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Location permission denied";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "Location unavailable";
        }
        setLocationError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const mutation = useMutation({
    mutationFn: async (coords: { latitude: number; longitude: number }) => {
      const res = await axios.post(
        "/api/check-in",
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          userId: authUser?.accountNo,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Check-in Successful", {
        description: data.message,
      });
      setLastCheckIn({
        timestamp: data.timestamp,
        checkpoint: data.checkpoint,
      });
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || "Check-in failed";
      toast.error("Check-in Failed", {
        description: msg,
      });
    },
  });

  const handleCheckIn = () => {
    if (coordinates) {
      mutation.mutate({
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      });
    } else {
      // Fallback if watchPosition hasn't fired yet (rare if supported)
      toast.error("Location not available yet", {
        description: "Please wait for GPS signal.",
      });
    }
  };

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
      <Main className="flex flex-1 flex-col gap-6 sm:gap-8">
        <PageIntro
          title="Check In"
          subtitle="Check in from your current location."
        />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
          <div className="text-center space-y-2">
            <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
              <p>Current time: {currentTime.toLocaleTimeString()}</p>
              {coordinates ? (
                <div className="flex flex-col items-center gap-1">
                  <p className="font-mono text-xs bg-muted px-2 py-1 rounded">
                    GPS: {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                  </p>
                  {/* {distanceToNearest !== null && (
                    <div className="flex flex-col items-center">
                      <p className={`text-xs ${isNearCheckpoint ? "text-green-600" : "text-red-500"}`}>
                        {nearestCheckpointName}: {Math.round(distanceToNearest)}m away (Max {settings?.radius}m)
                      </p>
                    </div>
                  )} */}
                </div>
              ) : (
                <p className="text-xs animate-pulse">Acquiring GPS...</p>
              )}
            </div>
          </div>

          <Button
            onClick={handleCheckIn}
            disabled={mutation.isPending || !coordinates}
            className={`w-64 h-64 text-2xl font-bold rounded-full transition-all duration-300 transform hover:scale-105 ${
              mutation.isPending || !coordinates
                ? "bg-gray-400 cursor-wait"
                : isNearCheckpoint
                  ? "bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl"
                  : "bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl"
            }`}
          >
            {mutation.isPending ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span>Checking...</span>
              </div>
            ) : !coordinates ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">Locating...</span>
              </div>
            ) : isNearCheckpoint ? (
              "CHECK IN"
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span>TOO FAR</span>
                <span className="text-xs font-normal opacity-90">Move Closer</span>
              </div>
            )}
          </Button>

          {nearestCheckpoint && distanceToNearest !== null && (
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center">
                    <MapPin className="h-5 w-5 inline-block me-2" />
                    <p className="font-medium">Checkpoint</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{nearestCheckpoint.name}</p>
                    {lastCheckInTime && <p className="text-xs text-muted-foreground mt-1">Last check-in: {format(new Date(lastCheckInTime), "dd/MM/yyyy HH:mm")}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{Math.round(distanceToNearest)}m</p>
                    <p className={`text-xs ${isNearCheckpoint ? "text-green-600" : "text-red-500"}`}>{isNearCheckpoint ? "Within radius" : "Too far"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {locationError && <p className="text-destructive text-sm font-medium bg-destructive/10 px-4 py-2 rounded-md">{locationError}</p>}

          {lastCheckIn && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-sm text-muted-foreground">Last successful check-in:</p>
              <p className="font-medium text-lg">{lastCheckIn.checkpoint}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(lastCheckIn.timestamp), "PPpp")}</p>
            </div>
          )}
        </div>
      </Main>
    </>
  );
}
