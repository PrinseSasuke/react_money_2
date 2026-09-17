const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

describe("password hashing", () => {
  it("hashes a password and verifies it correctly", async () => {
    const hash = await bcrypt.hash("password123", 10);
    expect(hash).not.toBe("password123");
    await expect(bcrypt.compare("password123", hash)).resolves.toBe(true);
  });

  it("rejects the wrong password against a hash", async () => {
    const hash = await bcrypt.hash("password123", 10);
    await expect(bcrypt.compare("wrong-password", hash)).resolves.toBe(false);
  });
});

describe("JWT sign/verify", () => {
  const SECRET = "test-secret";

  it("signs a token and verifies it with the same secret", () => {
    const token = jwt.sign({ userId: "abc-123" }, SECRET, { expiresIn: "1h" });
    const payload = jwt.verify(token, SECRET);
    expect(payload.userId).toBe("abc-123");
  });

  it("rejects a token verified with the wrong secret", () => {
    const token = jwt.sign({ userId: "abc-123" }, SECRET, { expiresIn: "1h" });
    expect(() => jwt.verify(token, "other-secret")).toThrow();
  });

  it("rejects an expired token", () => {
    const token = jwt.sign({ userId: "abc-123" }, SECRET, { expiresIn: -1 });
    expect(() => jwt.verify(token, SECRET)).toThrow(/expired/i);
  });
});
