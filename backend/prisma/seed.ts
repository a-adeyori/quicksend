/**
 * Seed: creates a demo user + contacts for local development.
 *
 * Run: npm run db:seed
 * Login: demo@quicksend.app / password123
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  const user = await db.user.upsert({
    where: { email: 'demo@quicksend.app' },
    update: {},
    create: {
      email: 'demo@quicksend.app',
      firstName: 'Demo',
      lastName: 'User',
      passwordHash,
      kycStatus: 'APPROVED',
      isVerified: true,
      balanceCents: 854732n, // $8,547.32
      assetCode: 'USD',
      assetScale: 2,
    },
  });

  console.log(`✅ Demo user: ${user.email} (id: ${user.id})`);

  // Seed contacts
  const contacts = [
    { name: 'Sarah (Daughter)', initials: 'SD', color: '#D1FAE5', walletAddress: 'https://ilp.interledger-test.dev/sarah' },
    { name: 'Mike (Son)',       initials: 'MS', color: '#E0F2FE', walletAddress: 'https://ilp.interledger-test.dev/mike' },
    { name: 'Mary (Sister)',    initials: 'MR', color: '#FEF3C7', walletAddress: 'https://ilp.interledger-test.dev/mary' },
    { name: 'Dr. Johnson',      initials: 'DJ', color: '#EDE9FE', walletAddress: 'https://ilp.interledger-test.dev/dr-johnson' },
  ];

  for (const c of contacts) {
    await db.contact.upsert({
      where: { userId_walletAddress: { userId: user.id, walletAddress: c.walletAddress } },
      update: {},
      create: { userId: user.id, ...c },
    });
  }
  console.log(`✅ Seeded ${contacts.length} contacts`);

  // Seed sample transactions
  const now = new Date();
  const txs = [
    { recipientName: 'Sarah (Daughter)', recipientWalletAddress: contacts[0].walletAddress, debitAmountCents: 5000n,  receiveAmountCents: 4998n, feeAmountCents: 2n,  status: 'COMPLETED' as const, completedAt: new Date(now.getTime() - 2 * 86400_000) },
    { recipientName: 'Electricity Bill',  recipientWalletAddress: 'https://wallet.example.com/city-power', debitAmountCents: 12000n, receiveAmountCents: 11995n, feeAmountCents: 5n,  status: 'COMPLETED' as const, completedAt: new Date(now.getTime() - 5 * 86400_000) },
    { recipientName: 'Mike (Son)',         recipientWalletAddress: contacts[1].walletAddress, debitAmountCents: 3000n,  receiveAmountCents: 2998n, feeAmountCents: 2n,  status: 'COMPLETED' as const, completedAt: new Date(now.getTime() - 8 * 86400_000) },
  ];

  for (const tx of txs) {
    await db.payment.create({
      data: { senderId: user.id, ...tx, initiatedAt: tx.completedAt },
    });
  }
  console.log(`✅ Seeded ${txs.length} payments`);

  console.log('\n🚀 Done! Login at http://localhost:3001');
  console.log('   Email:    demo@quicksend.app');
  console.log('   Password: password123');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
