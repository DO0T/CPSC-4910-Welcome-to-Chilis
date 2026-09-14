const request = require("supertest");
const app = require("./server");

describe("Health endpoint", () => {
  test("returns a successful health response", async () => {
    const response = await request(app).get("/api/health");

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.message).toBe(
      "Welcome to Chili's API is running"
    );
  });
});