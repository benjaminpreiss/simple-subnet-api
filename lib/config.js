const {
  // DATABASE_URL points to `simple_subnet_api` database managed by this repository
  DATABASE_URL = 'postgres://localhost:5432/simple_subnet_api',
  PORT = '8080',
  HOST = '127.0.0.1',
  REQUEST_LOGGING = 'true'
} = process.env

export { DATABASE_URL, PORT, HOST, REQUEST_LOGGING }
