import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-normal">Admin</h1>
        <p className="text-muted-foreground">
          Správa školy, uživatelů a nastavení aplikace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Administrace</CardTitle>
          <CardDescription>
            Tato sekce bude obsahovat správu uživatelů, tříd, rozvrhů a systémových nastavení.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Obsah administrace bude doplněn.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
