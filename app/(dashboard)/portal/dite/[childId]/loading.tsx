import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ChildDetailLoading() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-40" />
      </header>
      <Tabs defaultValue="lodicky" className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="lodicky">Lodičky dítěte</TabsTrigger>
          <TabsTrigger value="lodicky-po-plavbach">Lodičky po plavbách</TabsTrigger>
          <TabsTrigger value="hodnoceni-predmetu">Hodnocení předmětů</TabsTrigger>
          <TabsTrigger value="hodnoceni-oblasti">Hodnocení oblastí</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      </Tabs>
    </div>
  );
}
