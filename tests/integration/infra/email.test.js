import email from "infra/email.js";
import orchestrator from "tests/orchestrator";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("infra/email.js", () => {
  test("send()", async () => {
    await orchestrator.deleteAllEmails();
    await email.send({
      from: "Lumen <contact@lumen.com.br>",
      to: "contact@email.com",
      subject: "Subject test",
      text: "Body test",
    });
    await email.send({
      from: "Lumen <contact@lumen.com.br>",
      to: "contact@email.com",
      subject: "Last sent mail",
      text: "Body test 2",
    });

    const lastEmail = await orchestrator.getLastEmail();

    expect(lastEmail.sender).toBe("<contact@lumen.com.br>");
    expect(lastEmail.recipients[0]).toBe("<contact@email.com>");
    expect(lastEmail.subject).toBe("Last sent mail");
    expect(lastEmail.text).toBe("Body test 2\n");
  });
});
