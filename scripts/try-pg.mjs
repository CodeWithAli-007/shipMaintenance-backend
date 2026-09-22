import pg from 'pg';

const attempts = [
  { label: 'empty string', password: '' },
  { label: 'undefined', password: undefined },
  { label: 'connectionString empty', connectionString: 'postgresql://postgres:@localhost:5432/postgres' },
  { label: 'connectionString no pass', connectionString: 'postgresql://postgres@localhost:5432/postgres' },
];

for (const attempt of attempts) {
  const client = new pg.Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    database: 'postgres',
    ...attempt,
  });
  try {
    await client.connect();
    const row = (await client.query('select current_user')).rows[0];
    console.log('OK', attempt.label, row);
    await client.end();
    break;
  } catch (error) {
    console.log('FAIL', attempt.label, error.message);
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}
