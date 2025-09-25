import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSession() {
  const sessionToken = '0101f24c9b59c77823a31583e36fb6e330eb89f7168c41e3c302cfc4ca36c42d';

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: { organization: true }
  });

  if (!session) {
    console.log('❌ Session not found in database!');
    console.log('Need to login again at https://gugaleo.axnexlabs.com.br');
  } else {
    const isValid = session.expiresAt > new Date();
    console.log('\n📊 SESSION STATUS:');
    console.log('   Valid:', isValid ? '✅ YES' : '❌ NO');
    console.log('   Organization:', session.organization.primaryNickname);
    console.log('   Plan:', session.organization.plan);
    console.log('   Status:', session.organization.subscriptionStatus);
    console.log('   Expires:', session.expiresAt);

    if (!isValid) {
      console.log('\n⚠️  Session expired! Need to login again.');
    } else {
      console.log('\n✅ Session is valid and organization is', session.organization.plan);
    }
  }

  await prisma.$disconnect();
}

checkSession();