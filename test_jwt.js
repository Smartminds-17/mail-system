const jwt = require('jsonwebtoken');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30';

const secret = 'your-secret-key'; // From your auth.js

// Decode without verification
const decoded = jwt.decode(token, { complete: true });
console.log('Decoded JWT:');
console.log('Header:', decoded.header);
console.log('Payload:', decoded.payload);

// Try to verify
try {
    const verified = jwt.verify(token, secret);
    console.log('JWT is valid:', verified);
} catch (error) {
    console.log('JWT verification failed:', error.message);
}
