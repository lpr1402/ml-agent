import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  console.log('=== CHECKING ML ACCOUNTS ===');
  const accounts = await prisma.mLAccount.findMany({
    where: { isActive: true },
    select: {
      id: true,
      mlUserId: true,
      nickname: true,
      organizationId: true
    }
  });

  console.log('\nActive ML Accounts:');
  accounts.forEach(acc => {
    console.log(`- ID: ${acc.id}`);
    console.log(`  ML User ID: ${acc.mlUserId}`);
    console.log(`  Nickname: ${acc.nickname}`);
    console.log(`  Organization: ${acc.organizationId}\n`);
  });

  console.log('\n=== CHECKING RECENT QUESTIONS ===');
  const questions = await prisma.question.findMany({
    orderBy: { receivedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      mlQuestionId: true,
      status: true,
      text: true,
      itemTitle: true,
      failureReason: true,
      receivedAt: true,
      mlAccount: {
        select: {
          nickname: true
        }
      }
    }
  });

  console.log('\nRecent Questions:');
  questions.forEach(q => {
    console.log(`- Question ID: ${q.mlQuestionId}`);
    console.log(`  Status: ${q.status}`);
    console.log(`  Text: ${q.text?.substring(0, 50)}...`);
    console.log(`  Item: ${q.itemTitle || 'NO ITEM TITLE'}`);
    if (q.failureReason) {
      console.log(`  Error: ${q.failureReason}`);
    }
    console.log(`  Account: ${q.mlAccount?.nickname}`);
    console.log(`  Received: ${q.receivedAt}\n`);
  });

  console.log('\n=== CHECKING WEBHOOK EVENTS ===');
  const webhookEvents = await prisma.webhookEvent.findMany({
    where: { eventType: 'questions' },
    orderBy: { receivedAt: 'desc' },
    take: 5,
    select: {
      eventId: true,
      userId: true,
      status: true,
      processingError: true,
      receivedAt: true,
      mlAccountId: true,
      organizationId: true
    }
  });

  console.log('\nRecent Webhook Events:');
  webhookEvents.forEach(e => {
    console.log(`- Event ID: ${e.eventId}`);
    console.log(`  User ID (Seller): ${e.userId}`);
    console.log(`  Status: ${e.status}`);
    console.log(`  ML Account ID: ${e.mlAccountId || 'NULL'}`);
    console.log(`  Organization: ${e.organizationId || 'NULL'}`);
    if (e.processingError) {
      console.log(`  Error: ${e.processingError}`);
    }
    console.log(`  Received: ${e.receivedAt}\n`);
  });

  await prisma.$disconnect();
}

checkData().catch(console.error);