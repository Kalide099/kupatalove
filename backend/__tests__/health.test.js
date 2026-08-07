const request = require('supertest');
const { app } = require('../server');

describe('health endpoint', () => {
  it('returns a healthy response', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
