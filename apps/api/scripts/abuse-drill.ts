function getArg(name: string, fallback: string) {
  return process.argv.find((entry) => entry.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
}

async function main() {
  const baseUrl = getArg("base", "http://localhost:4001/v1");
  const attackerEmail = `phase5-abuse-${Date.now()}@example.com`;
  const unauthorizedAdmin = await fetch(`${baseUrl}/admin/connectors`);
  const anonymousReport = await fetch(`${baseUrl}/reports`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clusterId: "missing",
      reason: "wrong_info"
    })
  });

  const otpResponse = await fetch(`${baseUrl}/auth/email/request-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: attackerEmail })
  });
  const otp = (await otpResponse.json()) as { otpPreview?: string };

  const wrongOtp = await fetch(`${baseUrl}/auth/email/verify-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: attackerEmail, code: "000000" })
  });

  const verify = await fetch(`${baseUrl}/auth/email/verify-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: attackerEmail, code: otp.otpPreview })
  });
  const auth = (await verify.json()) as { accessToken?: string };
  const nonAdmin = await fetch(`${baseUrl}/admin/connectors`, {
    headers: {
      authorization: `Bearer ${auth.accessToken}`
    }
  });

  const checks = {
    unauthorizedAdminStatus: unauthorizedAdmin.status,
    anonymousReportStatus: anonymousReport.status,
    wrongOtpStatus: wrongOtp.status,
    nonAdminStatus: nonAdmin.status
  };
  const passed =
    checks.unauthorizedAdminStatus === 401 &&
    checks.anonymousReportStatus === 401 &&
    checks.wrongOtpStatus === 401 &&
    checks.nonAdminStatus === 403;

  console.log(
    JSON.stringify(
      {
        ...checks,
        passed
      },
      null,
      2
    )
  );

  if (!passed) {
    process.exitCode = 1;
  }
}

void main();
