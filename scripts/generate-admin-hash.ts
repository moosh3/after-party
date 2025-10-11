import bcrypt from 'bcryptjs';

async function generateHash(password: string) {
  const hash = await bcrypt.hash(password, 12);
  console.log('\nAdmin Password Hash:');
  console.log(hash);
  console.log('\nAdd this to your .env.local file:');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
}

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run generate-admin-hash <password>');
  process.exit(1);
}

generateHash(password);

