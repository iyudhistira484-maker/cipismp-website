import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const smtpMocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({ createTransport: smtpMocks.createTransport }));

describe("provider email Resend / SMTP", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_FROM", "CipiSMP <no-reply@cipismp.test>");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "mailer");
    vi.stubEnv("SMTP_PASSWORD", "smtp-test-password");
    vi.stubEnv("SMTP_SECURE", "0");
    smtpMocks.createTransport.mockReset().mockReturnValue({ sendMail: smtpMocks.sendMail });
    smtpMocks.sendMail.mockReset().mockResolvedValue({ messageId: "mail-1" });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("mengirim email Resend dengan bearer key, envelope, dan isi lengkap", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "re_123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { sendWithProvider } = await import("@/server/email");

    await expect(
      sendWithProvider({
        to: "player@example.test",
        subject: "Struk CipiSMP",
        html: "<p>Lunas</p>",
        text: "Lunas",
      }),
    ).resolves.toEqual({ ok: true, provider: "resend" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.resend.com/emails");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer re_test_key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      from: "CipiSMP <no-reply@cipismp.test>",
      to: ["player@example.test"],
      subject: "Struk CipiSMP",
      html: "<p>Lunas</p>",
      text: "Lunas",
    });
  });

  it("membuat transport SMTP sesuai host/auth dan mengirim pesan", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "smtp");
    const { sendWithProvider } = await import("@/server/email");

    await expect(
      sendWithProvider({
        to: "player@example.test",
        subject: "Kode verifikasi",
        html: "<strong>123456</strong>",
        text: "123456",
      }),
    ).resolves.toEqual({ ok: true, provider: "smtp" });

    expect(smtpMocks.createTransport).toHaveBeenCalledWith({
      host: "smtp.example.test",
      port: 587,
      secure: false,
      auth: { user: "mailer", pass: "smtp-test-password" },
    });
    expect(smtpMocks.sendMail).toHaveBeenCalledWith({
      from: "CipiSMP <no-reply@cipismp.test>",
      to: "player@example.test",
      subject: "Kode verifikasi",
      html: "<strong>123456</strong>",
      text: "123456",
    });
  });

  it("menggagalkan konfigurasi kosong dan meneruskan error provider", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.resetModules();
    let email = await import("@/server/email");
    await expect(
      email.sendWithProvider({ to: "a@example.test", subject: "x", html: "x", text: "x" }),
    ).rejects.toThrow("RESEND_API_KEY belum diisi");

    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.resetModules();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    email = await import("@/server/email");
    await expect(
      email.sendWithProvider({ to: "a@example.test", subject: "x", html: "x", text: "x" }),
    ).rejects.toThrow("Resend 429: rate limited");
  });
});
