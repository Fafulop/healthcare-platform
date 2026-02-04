const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAdmin() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'lopez.fafutis@gmail.com' },
      select: {
        id: true,
        email: true,
        role: true,
        doctorId: true,
        name: true
      }
    });

    console.log('Current admin user in database:');
    console.log(user);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAdmin();
