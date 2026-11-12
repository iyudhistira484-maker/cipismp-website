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

/** A password-only session is not an authenticated viewer when 2FA is enabled. */
export async function getViewer(): Promise<Viewer | null> {
  const current = await getCurrentSession();
  if (!current || (current.user.totpEnabledAt && !current.session.mfaSatisfiedAt)) return null;
  return { user: current.user, sessionId: current.session.id };
}

/** Dipakai di halaman: redirect ke login dengan parameter next yang aman. */
export async function requireViewer(nextPath?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    const current = await getCurrentSession();
    if (current?.user.totpEnabledAt && !current.session.mfaSatisfiedAt) {
      redirect(nextPath ? `/masuk/2fa?next=${encodeURIComponent(nextPath)}` : "/masuk/2fa");
    }
    redirect(nextPath ? `/masuk?next=${encodeURIComponent(nextPath)}` : "/masuk");
  }
  if (isStaff(viewer.user.role) && !viewer.user.totpEnabledAt) redirect("/admin/keamanan");
  return viewer;
}

/** Only the enrollment actions may accept a staff session before 2FA is set up. */
export async function requireMfaEnrollmentViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new UnauthenticatedError();
  return viewer;
}

/** Dashboard pemain hanya untuk akun pelanggan; akun staf memakai panelnya sendiri. */
export async function requireCustomer(nextPath?: string): Promise<Viewer> {
  const viewer = await requireViewer(nextPath);
  if (isStaff(viewer.user.role)) redirect("/admin");
  return viewer;
}

export async function requireVerifiedViewer(nextPath?: string): Promise<Viewer> {
  const viewer = await requireViewer(nextPath);
  if (!viewer.user.emailVerifiedAt) redirect("/verifikasi-email");
  return viewer;
}

export async function requireStaff(permission?: Permission): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    const current = await getCurrentSession();
    if (current?.user.totpEnabledAt && !current.session.mfaSatisfiedAt) redirect("/masuk/2fa?next=%2Fadmin");
    redirect("/masuk?next=%2Fadmin");
  }
  if (!isStaff(viewer.user.role)) redirect("/403");
  // Allow first-time staff to reach account security, but not administrative data or actions.
  if (permission && !viewer.user.totpEnabledAt) redirect("/admin/keamanan");
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
  if (isStaff(viewer.user.role) && !viewer.user.totpEnabledAt) {
    throw new UnauthenticatedError("Aktifkan 2FA sebelum menggunakan fitur admin.");
  }
  assertPermission(viewer.user.role, permission);
  return viewer;
}

export async function requireVerifiedEmailApi(): Promise<Viewer> {
  const viewer = await requireViewerApi();
  if (!viewer.user.emailVerifiedAt) throw new EmailUnverifiedError();
  return viewer;
}
