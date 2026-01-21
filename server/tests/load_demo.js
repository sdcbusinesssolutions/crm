import http from 'k6/http';
import { check, sleep } from 'k6';

// simple k6 load test script
// Run with: k6 run load_test.js

export const options = {
    vus: 10, // 10 Virtual Users
    duration: '30s', // Run for 30 seconds
};

export default function () {
    // Replace with your local or staging URL
    const res = http.get('http://localhost:3000/api/status');

    check(res, {
        'is status 200': (r) => r.status === 200,
        'response time < 200ms': (r) => r.timings.duration < 200,
    });

    sleep(1);
}
