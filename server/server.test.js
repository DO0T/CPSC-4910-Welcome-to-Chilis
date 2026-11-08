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

test('login remains public while post-removal endpoints require authentication', async () => {
  const login = await request(app).post('/api/login').send({});
  expect(login.statusCode).toBe(400);
  expect(login.body.message).toBe('Username and password are required');
  expect((await request(app).get('/api/sponsor/policy')).statusCode).toBe(401);
  expect((await request(app).get('/api/driver/post-removal-access')).statusCode).toBe(401);
});
