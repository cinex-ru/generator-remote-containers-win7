module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    "\./src/",
    "\./out/",
    "\./build/",
    "\./dist/"
  ],
  cacheDirectory: './tmp'
};