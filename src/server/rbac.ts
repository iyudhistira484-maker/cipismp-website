
export type Role = "OWNER" | "ADMIN" | "SUPPORT" | "CUSTOMER";

export type Permission =
  | "analytics.read"
  | "orders.read"
  | "orders.write"
  | "orders.redeliver"
  | "products.write"
  | "seasons.write"
  | "customers.read"
  | "coupons.write"
  | "delivery.read"
  | "delivery.write"
  | "grants.write"
  | "settings.read"
  | "settings.write"
  | "payments.secrets"
  | "staff.write"
  | "audit.read";

const SUPPORT: Permission[] = [
  "orders.read",
  "orders.redeliver",
  "customers.read",
  "delivery.read",
  "grants.write",
  "audit.read",
];

const ADMIN: Permission[] = [
  ...SUPPORT,
  "analytics.read",
  "orders.write",
  "products.write",
  "seasons.write",
  "coupons.write",
  "delivery.write",
  "settings.read",
  "settings.write",
];

const OWNER: Permission[] = [...ADMIN, "payments.secrets", "staff.write"];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER,
  ADMIN,
  SUPPORT,
  CUSTOMER: [],
};

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  SUPPORT: "Support",
  CUSTOMER: "Pelanggan",
};

export const STAFF_ROLES: Role[] = ["OWNER", "ADMIN", "SUPPORT"];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export class ForbiddenError extends Error {
  constructor(message = "Kamu tidak punya akses ke halaman ini.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) throw new ForbiddenError();
}
