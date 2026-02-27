// test-env.js
require('dotenv').config();

console.log("What Node.js sees in .env:");
console.log("DB_HOST     →", process.env.DB_HOST);
console.log("DB_USER     →", process.env.DB_USER);
console.log("DB_PASSWORD →", process.env.DB_PASSWORD || "(empty or missing)");
console.log("DB_NAME     →", process.env.DB_NAME);
console.log("PORT        →", process.env.PORT);