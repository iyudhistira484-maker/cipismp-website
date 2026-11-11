import { redirect } from "next/navigation";
import { getCurrentSession, type SessionUser } from "./session";
import { assertPermission, hasPermission, isStaff, type Permission } from "../rbac";

export class UnauthenticatedError extends Error {
  constructor(message = "Kamu harus masuk terlebih dahulu.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class EmailUnverifiedError extends Error {
  constructor(message = "Verifikasi email kamu dulu untuk melanjutkan.") {
    super(message);
    this.name = "EmailUnverifiedError";
  }
}

export interface Viewer {
  user: SessionUser;
  sessionId: string;
}

export async function getViewer(): Promise<Viewer | null> {
  const current = await getCurrentSession();
  if (!current) return null;
  return { user: current.user, sessionId: current.session.id };
}

/** Dipakai di halaman: redirect ke login dengan parameter next yang aman. */
export async function requireViewer(nextPath?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(nextPath ? `/masuk?next=${encodeURIComponent(nextPath)}` : "/masuk");
  return viewer;
}

export async function requireVerifiedViewer(nextPath?: string): Promise<Viewer> {
  const viewer = await requireViewer(nextPath);
  if (!viewer.user.emailVerifiedAt) redirect("/dashboard/verifikasi-email");
  return viewer;
}

export async function requireStaff(permission?: Permission): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/masuk?next=%2Fadmin");
  if (!isStaff(viewer.user.role)) redirect("/403");
  if (permission && !hasPermission(viewer.user.role, permission)) redirect("/403");
  return viewer;
}

/** Versi untuk server action/route handler yang butuh error, bukan redirect. */
export async function requireViewerApi(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new UnauthenticatedError();
  return viewer;
}

export async function requirePermissionApi(permission: Permission): Promise<Viewer> {
  const viewer = await requireViewerApi();
  assertPermission(viewer.user.role, permission);
  return viewer;
}

export async function requireVerifiedEmailApi(): Promise<Viewer> {
  const viewer = await requireViewerApi();
  if (!viewer.user.emailVerifiedAt) throw new EmailUnverifiedError();
  return viewer;
}
