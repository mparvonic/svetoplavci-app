import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function KioskPage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold tracking-normal">Kioskový režim</h1>
      <p className="text-xl text-muted-foreground">
        Fullscreen režim bez navigace – vhodný pro informační kiosek.
      </p>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Školní informace</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Zde bude obsah pro kiosk – rozvrh, oznámení, informace o škole.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
