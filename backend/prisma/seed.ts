/**
 * Seed: pre-verified demo user (KYC APPROVED) + contacts + sample payments.
 *
 * Run: npm run db:seed
 * Or:  npx prisma db seed
 *
 * Reviewer login (sandbox — no real money):
 *   Email:    demo@quicksend.app
 *   Username: demo
 *   Password: password123
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

const REVIEWER_EMAIL = 'demo@quicksend.app';
const REVIEWER_USERNAME = 'demo';
const REVIEWER_PASSWORD = 'password123';

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash(REVIEWER_PASSWORD, 12);
  const verifiedAt = new Date();

  const user = await db.user.upsert({
    where: { email: REVIEWER_EMAIL },
    update: {
      passwordHash,
      username: REVIEWER_USERNAME,
      firstName: 'Demo',
      lastName: 'Reviewer',
      kycStatus: 'APPROVED',
      kycVerifiedAt: verifiedAt,
      isVerified: true,
      isActive: true,
      balanceCents: 854732n,
      assetCode: 'USD',
      assetScale: 2,
    },
    create: {
      email: REVIEWER_EMAIL,
      username: REVIEWER_USERNAME,
      firstName: 'Demo',
      lastName: 'Reviewer',
      passwordHash,
      kycStatus: 'APPROVED',
      kycVerifiedAt: verifiedAt,
      isVerified: true,
      balanceCents: 854732n,
      assetCode: 'USD',
      assetScale: 2,
    },
  });

  console.log(`✅ Demo user: ${user.email} / @${user.username} (id: ${user.id})`);

  const contacts = [
    { name: 'Sarah (Daughter)', initials: 'SD', color: '#D1FAE5', walletAddress: 'https://ilp.interledger-test.dev/sarah' },
    { name: 'Mike (Son)', initials: 'MS', color: '#E0F2FE', walletAddress: 'https://ilp.interledger-test.dev/mike' },
    { name: 'Mary (Sister)', initials: 'MR', color: '#FEF3C7', walletAddress: 'https://ilp.interledger-test.dev/mary' },
    { name: 'Dr. Johnson', initials: 'DJ', color: '#EDE9FE', walletAddress: 'https://ilp.interledger-test.dev/dr-johnson' },
  ];

  for (const c of contacts) {
    await db.contact.upsert({
      where: { userId_walletAddress: { userId: user.id, walletAddress: c.walletAddress } },
      update: {},
      create: { userId: user.id, ...c },
    });
  }
  console.log(`✅ Seeded ${contacts.length} contacts`);

  const existingTx = await db.payment.count({ where: { senderId: user.id } });
  if (existingTx === 0) {
    const now = new Date();
    const txs = [
      {
        recipientName: 'Sarah (Daughter)',
        recipientWalletAddress: contacts[0].walletAddress,
        debitAmountCents: 5000n,
        receiveAmountCents: 4998n,
        feeAmountCents: 2n,
        status: 'COMPLETED' as const,
        completedAt: new Date(now.getTime() - 2 * 86400_000),
      },
      {
        recipientName: 'Electricity Bill',
        recipientWalletAddress: 'https://wallet.example.com/city-power',
        debitAmountCents: 12000n,
        receiveAmountCents: 11995n,
        feeAmountCents: 5n,
        status: 'COMPLETED' as const,
        completedAt: new Date(now.getTime() - 5 * 86400_000),
      },
      {
        recipientName: 'Mike (Son)',
        recipientWalletAddress: contacts[1].walletAddress,
        debitAmountCents: 3000n,
        receiveAmountCents: 2998n,
        feeAmountCents: 2n,
        status: 'COMPLETED' as const,
        completedAt: new Date(now.getTime() - 8 * 86400_000),
      },
    ];

    for (const tx of txs) {
      await db.payment.create({
        data: { senderId: user.id, ...tx, initiatedAt: tx.completedAt },
      });
    }
    console.log(`✅ Seeded ${txs.length} sample payments`);
  }

  console.log('\n── Reviewer login ───────────────────────────────────');
  console.log(`   Email:    ${REVIEWER_EMAIL}`);
  console.log(`   Username: @${REVIEWER_USERNAME}`);
  console.log(`   Password: ${REVIEWER_PASSWORD}`);
  console.log('────────────────────────────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());