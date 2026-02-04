const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function linkToGerardo() {
  try {
    // Link admin to the existing "gerardo" doctor profile
    const user = await prisma.user.update({
      where: { email: 'lopez.fafutis@gmail.com' },
      data: { doctorId: 'cmjabyfdm00bcmg0mp7uaq1nh' } // gerardo doctor ID
    });

    console.log('✅ Linked admin to "gerardo" doctor profile');
    console.log('   Email:', user.email);
    console.log('   DoctorId:', user.doctorId);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

linkToGerardo();
