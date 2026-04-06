"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Layers, Users, Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProtoDebugPanel, createProtoDebugEvent, type ProtoDebugEvent } from "@/components/proto/proto-debug-panel";
import { ProtoEdgePanel } from "@/components/proto/proto-edge-panel";
import {
  PROTO_ACTORS,
  PROTO_LODICKY_CATALOG,
  PROTO_OSOBNI_LODICKA_EVENTS,
  PROTO_OSOBNI_LODICKY,
  PROTO_QUICK_NAV,
  PROTO_ROLE_OPTIONS,
  PROTO_STUDENTS,
  getActorsByRole,
  getParentChildren,
  type ProtoRoleId,
} from "@/src/lib/mock/proto-lodicky-playground";
import { UI_CLASSES } from "@/src/lib/design-pack/ui";

const DEFAULT_ROLE: ProtoRoleId = "garant";

export default function ProtoShellPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const initialRole = normalizeRole(searchParams.get("role"));
  const [activeRole, setActiveRole] = useState<ProtoRoleId>(initialRole);
  const queryUserId = searchParams.get("user") ?? "";

  const roleUsers = useMemo(() => getActorsByRole(activeRole), [activeRole]);

  const [selectedUserId, setSelectedUserId] = useState<string>(queryUserId);
  const activeUserId = useMemo(
    () =>
      roleUsers.some((user) => user.id === selectedUserId)
        ? selectedUserId
        : (roleUsers[0]?.id ?? ""),
    [roleUsers, selectedUserId],
  );

  const [debugEvents, setDebugEvents] = useState<ProtoDebugEvent[]>([]);

  useEffect(() => {
    if (!activeUserId) return;
    const params = new URLSearchParams();
    params.set("role", activeRole);
    params.set("user", activeUserId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeRole, activeUserId, pathname, router]);

  const activeUser = roleUsers.find((user) => user.id === activeUserId) ?? roleUsers[0] ?? null;

  const visibleStudents = useMemo(() => {
    if (!activeUser) return [];

    if (activeRole === "zak" && activeUser.linkedStudentId) {
      return PROTO_STUDENTS.filter((student) => student.id === activeUser.linkedStudentId);
    }

    if (activeRole === "rodic") {
      return getParentChildren(activeUser.id);
    }

    return PROTO_STUDENTS;
  }, [activeRole, activeUser]);

  const visibleStudentIds = useMemo(
    () => new Set(visibleStudents.map((student) => student.id)),
    [visibleStudents],
  );

  const visiblePersonalCount = useMemo(
    () => PROTO_OSOBNI_LODICKY.filter((item) => visibleStudentIds.has(item.studentId)).length,
    [visibleStudentIds],
  );

  const visibleEventsCount = useMemo(
    () =>
      PROTO_OSOBNI_LODICKA_EVENTS.filter((event) => {
        const personal = PROTO_OSOBNI_LODICKY.find((item) => item.id === event.osobniLodickaId);
        return personal ? visibleStudentIds.has(personal.studentId) : false;
      }).length,
    [visibleStudentIds],
  );

  const quickStats = [
    {
      id: "stat-students",
      title: "Viditelní žáci",
      value: String(visibleStudents.length),
      icon: Users,
      action: "preview-students",
    },
    {
      id: "stat-personal",
      title: "Osobní lodičky",
      value: String(visiblePersonalCount),
      icon: Layers,
      action: "preview-personal-lodicky",
    },
    {
      id: "stat-events",
      title: "Historické eventy",
      value: String(visibleEventsCount),
      icon: Waves,
      action: "preview-events",
    },
  ];

  function pushDebug(event: Omit<ProtoDebugEvent, "id" | "at">) {
    setDebugEvents((prev) => [createProtoDebugEvent(event), ...prev].slice(0, 60));
  }

  function handleRoleChange(value: string) {
    const nextRole = normalizeRole(value);
    const nextUsers = getActorsByRole(nextRole);
    setActiveRole(nextRole);
    setSelectedUserId(nextUsers[0]?.id ?? "");
    pushDebug({
      elementId: "SEL-R001",
      label: "Přepínač role",
      action: "change-role",
      hierarchy: "EDGE_PANEL > SELECT_ROLE",
      payload: `role=${nextRole}`,
    });
  }

  function handleUserChange(value: string) {
    setSelectedUserId(value);
    pushDebug({
      elementId: "SEL-U001",
      label: "Přepínač uživatele",
      action: "change-user",
      hierarchy: "EDGE_PANEL > SELECT_USER",
      payload: `user=${value}`,
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <ProtoEdgePanel
        roleOptions={PROTO_ROLE_OPTIONS}
        activeRole={activeRole}
        activeUserId={activeUserId}
        usersForRole={roleUsers}
        onRoleChange={handleRoleChange}
        onUserChange={handleUserChange}
        navItems={PROTO_QUICK_NAV}
        query={{ role: activeRole, user: activeUserId }}
      />

      <section className={`${UI_CLASSES.pageContainer} space-y-6`}>
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4DA6]">Proto shell</p>
          <h1 className="text-2xl font-semibold text-[#05204A]">Vývojové prostředí prototypu</h1>
          <p className="text-sm text-slate-600">
            Přepínání rolí a uživatelů je přes schovávací panel vlevo. Tato stránka je pracovní dashboard
            pro rychlé ladění dat a interakcí.
          </p>
          {activeUser && (
            <Badge className="bg-[#EAF2FF] text-[#0A4DA6] hover:bg-[#EAF2FF]">
              Aktivní kontext: {activeUser.jmeno} · {labelForRole(activeRole)}
            </Badge>
          )}
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {quickStats.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.id}
                className="border-[#D9E4F2]"
                onClick={() =>
                  pushDebug({
                    elementId: `CRD-${item.id}`,
                    label: item.title,
                    action: item.action,
                    hierarchy: "PROTO_SHELL > SUMMARY_CARDS",
                  })
                }
              >
                <CardHeader className="pb-2">
                  <CardDescription>{item.title}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <p className="text-3xl font-semibold text-[#05204A]">{item.value}</p>
                  <Icon className="size-5 text-[#0A4DA6]" />
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-[#D9E4F2]">
            <CardHeader>
              <CardTitle className="text-[#05204A]">Rychlá navigace</CardTitle>
              <CardDescription>
                Primární pracovní stránka pro tuto fázi je Osobní lodičky.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                asChild
                className={UI_CLASSES.primaryButton}
                onClick={() =>
                  pushDebug({
                    elementId: "BTN-NAV-LODIN",
                    label: "Přejít na Osobní lodičky",
                    action: "navigate",
                    hierarchy: "PROTO_SHELL > QUICK_NAV",
                  })
                }
              >
                <Link href={`/proto-shell/osobni-lodicky?role=${activeRole}&user=${activeUserId}`}>
                  Otevřít stránku Osobní lodičky
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[#D9E4F2]">
            <CardHeader>
              <CardTitle className="text-[#05204A]">Rozsah mock dat</CardTitle>
              <CardDescription>
                Dataset je schválně větší pro ladění filtrů, řazení a fulltextu.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entita</TableHead>
                    <TableHead>Počet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["Uživatelé", String(PROTO_ACTORS.length)],
                    ["Žáci", String(PROTO_STUDENTS.length)],
                    ["Lodičky", String(PROTO_LODICKY_CATALOG.length)],
                    ["Osobní lodičky", String(PROTO_OSOBNI_LODICKY.length)],
                    ["Historie stavů", String(PROTO_OSOBNI_LODICKA_EVENTS.length)],
                  ].map(([label, value], index) => (
                    <TableRow
                      key={label}
                      onClick={() =>
                        pushDebug({
                          elementId: `T100-R${index + 1}`,
                          label,
                          action: "inspect-row",
                          tableId: "T100",
                          rowId: String(index + 1),
                          hierarchy: "PROTO_SHELL > DATASET_TABLE",
                          payload: `count=${value}`,
                        })
                      }
                    >
                      <TableCell>{label}</TableCell>
                      <TableCell className="font-semibold text-[#05204A]">{value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </section>

      <ProtoDebugPanel events={debugEvents} onClear={() => setDebugEvents([])} />
    </main>
  );
}

function normalizeRole(input: string | null): ProtoRoleId {
  if (input === "rodic" || input === "zak" || input === "spravce" || input === "garant") {
    return input;
  }
  return DEFAULT_ROLE;
}

function labelForRole(role: ProtoRoleId): string {
  return PROTO_ROLE_OPTIONS.find((item) => item.id === role)?.label ?? role;
}
