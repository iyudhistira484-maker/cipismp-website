import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { deliveries, orderItems, orders, paymentEvents, payments, products, seasons, users } from "@/server/db/schema";
import { customersCsv } from "@/server/admin/export";
import { adminOrderDetail, listCustomers, pendingPaymentRows, recentWebhookEvents } from "@/server/admin/queries";
import { getOrderByPublicToken, getOrderDetail, getOrderOwnershipByPublicToken } from "@/server/orders";
import { databaseUrl, uniqueSuffix } from "./helpers";

const enabled = databaseUrl() !== null;
const suffix = uniqueSuffix();
const customerId = `usr_admin_data_customer_${suffix}`;
const staffId = `usr_admin_data_staff_${suffix}`;
const customerEmail = `admin-data-${suffix}-customer@example.com`;
const staffEmail = `admin-data-${suffix}-staff@example.com`;
const seasonId = `sn_admin_data_${suffix}`;
const linkedOrderId = `ord_admin_data_linked_${suffix}`;
const guestOrderId = `ord_admin_data_guest_${suffix}`;
const pendingOrderId = `ord_admin_data_pending_${suffix}`;
const paymentId = `pay_admin_data_${suffix}`;
const productId = `prd_admin_data_${suffix}`;
const orderItemId = `itm_admin_data_${suffix}`;
const deliveryId = `dly_admin_data_${suffix}`;
const webhookEventId = `evt_admin_data_${suffix}`;

describe.skipIf(!enabled)("privasi halaman dan ekspor pelanggan", () => {
  beforeAll(async () => {
    await db.insert(seasons).values({
      id: seasonId,
      name: `Admin Data ${suffix}`,
      slug: `admin-data-${suffix}`,
      startAt: new Date(Date.now() - 86_400_000),
      endAt: new Date(Date.now() + 86_400_000),
    });
    await db.insert(users).values([
      {
        id: customerId,
        email: customerEmail,
        username: `cust${suffix}`,
        passwordHash: "test-only",
        role: "CUSTOMER",
      },
      {
        id: staffId,
        email: staffEmail,
        username: `staff${suffix}`,
        passwordHash: "test-only",
        role: "SUPPORT",
      },
    ]);
    await db.insert(orders).values([
      {
        id: linkedOrderId,
        orderNumber: `CIPI-ADMIN-LINKED-${suffix}`,
        publicToken: `admin-data-linked-${suffix}`,
        userId: customerId,
        email: customerEmail,
        mcUuid: `linked-${suffix}`,
        mcName: `Linked${suffix}`,
        seasonId,
        status: "PAID",
        subtotalIdr: 18_000,
        totalIdr: 18_000,
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
      {
        id: guestOrderId,
        orderNumber: `CIPI-ADMIN-GUEST-${suffix}`,
        publicToken: `admin-data-guest-${suffix}`,
        userId: null,
        email: customerEmail,
        mcUuid: `guest-${suffix}`,
        mcName: `Guest${suffix}`,
        seasonId,
        status: "PAID",
        subtotalIdr: 45_000,
        totalIdr: 45_000,
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
      {
        id: pendingOrderId,
        orderNumber: `CIPI-ADMIN-PENDING-${suffix}`,
        publicToken: `admin-data-pending-${suffix}`,
        userId: customerId,
        email: customerEmail,
        mcUuid: `pending-${suffix}`,
        mcName: `Pending${suffix}`,
        seasonId,
        status: "PENDING",
        subtotalIdr: 18_000,
        totalIdr: 18_000,
        adminNote: `admin-note-${suffix}`,
        customerNote: `customer-note-${suffix}`,
        paymentRef: `order-payment-ref-${suffix}`,
        ip: "192.0.2.20",
        userAgent: `order-user-agent-${suffix}`,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    ]);
    await db.insert(products).values({
      id: productId,
      slug: `admin-data-kit-${suffix}`,
      type: "KIT",
      name: "Admin Data Kit",
      tagline: "Test",
      description: "Fixture for admin order detail projection.",
      priceIdr: 18_000,
    });
    await db.insert(orderItems).values({
      id: orderItemId,
      orderId: pendingOrderId,
      productId,
      type: "KIT",
      nameSnapshot: "Admin Data Kit",
      unitPriceIdr: 18_000,
      quantity: 1,
      lineTotalIdr: 18_000,
      targetUuid: `private-target-${suffix}`,
      targetName: `Gifted${suffix}`,
      meta: {
        giftFromName: `GiftSender${suffix}`,
        giftFromUuid: `private-gift-uuid-${suffix}`,
        upgradeFromProductId: `private-upgrade-product-${suffix}`,
      },
    });
    await db.insert(deliveries).values({
      id: deliveryId,
      orderId: pendingOrderId,
      orderItemId,
      uuid: `private-delivery-uuid-${suffix}`,
      playerName: `Gifted${suffix}`,
      productId,
      status: "FAILED",
      attempts: 1,
      commands: [`private-command-${suffix}`],
      lastError: `delivery-failure-${suffix}`,
    });
    await db.insert(payments).values({
      id: paymentId,
      orderId: pendingOrderId,
      provider: "FAKE",
      providerRef: `admin-data-private-ref-${suffix}`,
      method: "VIRTUAL_ACCOUNT",
      amountIdr: 18_000,
      checkoutUrl: `https://checkout.example.test/${suffix}`,
      payCode: `private-pay-code-${suffix}`,
      rawCreate: { privateMarker: `raw-create-${suffix}` },
    });
    await db.insert(paymentEvents).values({
      id: webhookEventId,
      provider: "FAKE",
      eventType: "admin-data-test",
      signatureValid: false,
      dedupeKey: `admin-data-test-${suffix}`,
      rawPayload: { privateMarker: `raw-payload-${suffix}` },
      headers: { "x-private-marker": suffix },
      ip: "192.0.2.10",
      result: "ignored",
    });
  });

  afterAll(async () => {
    await db.delete(paymentEvents).where(eq(paymentEvents.id, webhookEventId));
    await db.delete(payments).where(eq(payments.id, paymentId));
    await db.delete(orders).where(eq(orders.id, linkedOrderId));
    await db.delete(orders).where(eq(orders.id, guestOrderId));
    await db.delete(orders).where(eq(orders.id, pendingOrderId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(users).where(eq(users.id, customerId));
    await db.delete(users).where(eq(users.id, staffId));
    await db.delete(seasons).where(eq(seasons.id, seasonId));
  });

  it("menampilkan akun pelanggan tetapi tidak akun staf pada daftar pelanggan", async () => {
    const rows = await listCustomers(suffix, 100);
    expect(rows.some((row) => row.id === customerId)).toBe(true);
    expect(rows.some((row) => row.id === staffId)).toBe(false);
  });

  it("mengekspor hanya data akun pelanggan dan order yang tertaut ke akunnya", async () => {
    const result = await customersCsv();
    const [header, ...rows] = result.csv.split("\r\n");
    expect(header).toBe("\uFEFFemail,username,dibuat,total_belanja_idr,jumlah_order_dibayar");
    expect(result.csv).toContain(customerEmail);
    expect(result.csv).not.toContain(staffEmail);

    const customerRow = rows.find((row) => row.startsWith(`${customerEmail},`));
    expect(customerRow).toBeDefined();
    const columns = customerRow!.split(",");
    expect(Number(columns[3])).toBe(18_000);
    expect(Number(columns[4])).toBe(1);
    expect(result.csv).not.toContain(`raw-payload-${suffix}`);
    expect(result.csv).not.toMatch(/2fa_aktif|email_terverifikasi|login_terakhir|password/i);
  });

  it("memuat detail order staf tanpa metadata privat yang tidak diperlukan", async () => {
    const detail = await adminOrderDetail(pendingOrderId);
    expect(detail?.order).toMatchObject({
      id: pendingOrderId,
      orderNumber: `CIPI-ADMIN-PENDING-${suffix}`,
      email: customerEmail,
      adminNote: `admin-note-${suffix}`,
    });
    for (const field of ["userId", "mcUuid", "customerNote", "paymentRef", "ip", "userAgent"]) {
      expect(detail?.order).not.toHaveProperty(field);
    }
    expect(detail?.payments[0]).toMatchObject({
      provider: "FAKE",
      providerRef: `admin-data-private-ref-${suffix}`,
      status: "PENDING",
      amountIdr: 18_000,
    });
    for (const field of ["orderId", "method", "feeIdr", "checkoutUrl", "payCode", "expiresAt", "updatedAt", "paidAt", "rawCreate"]) {
      expect(detail?.payments[0]).not.toHaveProperty(field);
    }
    expect(detail?.items[0]).toMatchObject({
      id: orderItemId,
      nameSnapshot: "Admin Data Kit",
      targetName: `Gifted${suffix}`,
      unitPriceIdr: 18_000,
      quantity: 1,
      lineTotalIdr: 18_000,
      giftFromName: `GiftSender${suffix}`,
    });
    for (const field of ["orderId", "productId", "targetUuid", "meta", "createdAt"]) {
      expect(detail?.items[0]).not.toHaveProperty(field);
    }
    expect(detail?.deliveries[0]).toMatchObject({
      id: deliveryId,
      playerName: `Gifted${suffix}`,
      status: "FAILED",
      method: "PLUGIN",
      attempts: 1,
      lastError: `delivery-failure-${suffix}`,
    });
    for (const field of ["orderId", "orderItemId", "seasonId", "uuid", "productId", "commands", "nextAttemptAt", "createdAt", "updatedAt", "deliveredAt"]) {
      expect(detail?.deliveries[0]).not.toHaveProperty(field);
    }
    expect(detail?.season).toEqual({ name: `Admin Data ${suffix}` });
  });

  it("membatasi lookup token dan detail pembeli ke field yang dibutuhkan", async () => {
    const lookup = await getOrderByPublicToken(`admin-data-pending-${suffix}`);
    expect(lookup).toEqual({ id: pendingOrderId });
    expect(await getOrderOwnershipByPublicToken(`admin-data-pending-${suffix}`)).toEqual({ id: pendingOrderId, userId: customerId });

    const detail = await getOrderDetail(pendingOrderId);
    expect(detail?.order).toMatchObject({
      orderNumber: `CIPI-ADMIN-PENDING-${suffix}`,
      userId: customerId,
      email: customerEmail,
      mcUuid: `pending-${suffix}`,
      mcName: `Pending${suffix}`,
      publicToken: `admin-data-pending-${suffix}`,
    });
    for (const field of ["seasonId", "adminNote", "customerNote", "paymentRef", "ip", "userAgent"]) {
      expect(detail?.order).not.toHaveProperty(field);
    }
    expect(detail?.payments[0]).toMatchObject({
      provider: "FAKE",
      providerRef: `admin-data-private-ref-${suffix}`,
      method: "VIRTUAL_ACCOUNT",
      status: "PENDING",
      checkoutUrl: `https://checkout.example.test/${suffix}`,
      payCode: `private-pay-code-${suffix}`,
    });
    for (const field of ["orderId", "amountIdr", "feeIdr", "expiresAt", "createdAt", "updatedAt", "rawCreate"]) {
      expect(detail?.payments[0]).not.toHaveProperty(field);
    }
    expect(detail?.items[0]?.meta).toEqual({ giftFromName: `GiftSender${suffix}` });
    for (const field of ["orderId", "productId", "targetUuid", "createdAt"]) {
      expect(detail?.items[0]).not.toHaveProperty(field);
    }
    expect(detail?.deliveries[0]).toMatchObject({ orderItemId, status: "FAILED" });
    for (const field of ["orderId", "uuid", "productId", "commands", "lastError", "updatedAt"]) {
      expect(detail?.deliveries[0]).not.toHaveProperty(field);
    }
    expect(detail?.season).toMatchObject({ name: `Admin Data ${suffix}` });
    for (const field of ["status", "notes", "freezeDays"]) expect(detail?.season).not.toHaveProperty(field);
  });

  it("memuat pembayaran menunggu tanpa referensi atau artefak gateway", async () => {
    const pending = await pendingPaymentRows(100);
    const payment = pending.find((row) => row.id === paymentId);
    expect(payment).toMatchObject({
      id: paymentId,
      orderNumber: `CIPI-ADMIN-PENDING-${suffix}`,
      provider: "FAKE",
      status: "PENDING",
      amountIdr: 18_000,
    });
    expect(payment).not.toHaveProperty("providerRef");
    expect(payment).not.toHaveProperty("rawCreate");
    expect(payment).not.toHaveProperty("payCode");
    expect(payment).not.toHaveProperty("checkoutUrl");
  });

  it("memuat ringkasan webhook tanpa payload mentah, header, IP, atau dedupe key", async () => {
    const events = await recentWebhookEvents(100);
    const event = events.find((row) => row.id === webhookEventId);
    expect(event).toMatchObject({
      id: webhookEventId,
      provider: "FAKE",
      eventType: "admin-data-test",
      signatureValid: false,
      result: "ignored",
    });
    expect(event).not.toHaveProperty("rawPayload");
    expect(event).not.toHaveProperty("headers");
    expect(event).not.toHaveProperty("ip");
    expect(event).not.toHaveProperty("dedupeKey");
  });
});
